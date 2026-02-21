import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/errors";
import {
  benchmarkBand,
  computeControlFreshness,
  scoreToTrendSparkline,
  type ControlFreshnessComputed,
} from "@/lib/edtech/adoption-intelligence";

type ControlRow = {
  id: string;
  code: string;
  title: string;
  description: string;
  risk_level: "low" | "medium" | "high";
};

type PostgrestLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const ADOPTION_INTELLIGENCE_TABLES = [
  "control_freshness_snapshots",
  "adoption_edges",
  "intervention_recommendations",
  "intervention_executions",
  "evidence_lineage_links",
  "benchmark_cohorts",
  "benchmark_metric_snapshots",
];

function hasAdoptionTableName(text: string): boolean {
  return ADOPTION_INTELLIGENCE_TABLES.some((tableName) => text.includes(tableName));
}

export function isAdoptionIntelligenceSchemaMissingError(
  error: PostgrestLikeError | null | undefined,
): boolean {
  if (!error) return false;

  const message = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  if (!hasAdoptionTableName(message)) return false;

  if (error.code === "PGRST205" || error.code === "42P01") return true;

  return (
    message.includes("could not find the table") ||
    message.includes("in the schema cache") ||
    message.includes("does not exist")
  );
}

function benchmarkCompatFallback(cohortCode?: string) {
  return {
    cohortCode: cohortCode ?? "mid_market_saas",
    orgMetricValue: null,
    cohortMetricValue: null,
    percentileRank: null,
    delta: null,
    band: benchmarkBand(null),
    snapshotAt: null,
    compatMode: true,
  };
}

export async function loadControlFreshness(input: {
  supabase: SupabaseClient;
  orgId: string;
  controlIds?: string[];
}): Promise<{
  controls: ControlRow[];
  computedByControlId: Map<string, ControlFreshnessComputed>;
  trendByControlId: Map<string, number[]>;
  mappedCampaignIdsByControlId: Map<string, string[]>;
  mappedModuleIdsByControlId: Map<string, string[]>;
  compatMode: boolean;
}> {
  let controlQuery = input.supabase
    .from("controls")
    .select("id,code,title,description,risk_level")
    .eq("org_id", input.orgId)
    .order("code", { ascending: true });

  if ((input.controlIds ?? []).length > 0) {
    controlQuery = controlQuery.in("id", input.controlIds ?? []);
  }

  const controlsResult = await controlQuery;
  if (controlsResult.error) {
    throw new ApiError("DB_ERROR", controlsResult.error.message, 500);
  }

  const controls = (controlsResult.data ?? []) as ControlRow[];
  if (controls.length === 0) {
    return {
      controls: [],
      computedByControlId: new Map(),
      trendByControlId: new Map(),
      mappedCampaignIdsByControlId: new Map(),
      mappedModuleIdsByControlId: new Map(),
      compatMode: false,
    };
  }

  const controlIds = controls.map((item) => item.id);

  const [mappingsResult, evidenceResult, trendsResult] = await Promise.all([
    input.supabase
      .from("control_mappings")
      .select("control_id,campaign_id,module_id")
      .eq("org_id", input.orgId)
      .eq("active", true)
      .in("control_id", controlIds),
    input.supabase
      .from("evidence_objects")
      .select("control_id,evidence_status,occurred_at,evidence_type,metadata_json")
      .eq("org_id", input.orgId)
      .in("control_id", controlIds),
    input.supabase
      .from("control_freshness_snapshots")
      .select("control_id,freshness_score,computed_at")
      .eq("org_id", input.orgId)
      .in("control_id", controlIds)
      .order("computed_at", { ascending: false })
      .limit(2000),
  ]);

  if (mappingsResult.error || evidenceResult.error) {
    throw new ApiError(
      "DB_ERROR",
      mappingsResult.error?.message ??
        evidenceResult.error?.message ??
        "Failed to load adoption freshness data",
      500,
    );
  }

  const compatMode = isAdoptionIntelligenceSchemaMissingError(trendsResult.error);
  if (trendsResult.error && !compatMode) {
    throw new ApiError("DB_ERROR", trendsResult.error.message, 500);
  }

  const mappedCampaignIdsByControlId = new Map<string, string[]>();
  const mappedModuleIdsByControlId = new Map<string, string[]>();
  const campaignIds = new Set<string>();
  for (const mapping of mappingsResult.data ?? []) {
    const campaignList = mappedCampaignIdsByControlId.get(mapping.control_id) ?? [];
    if (mapping.campaign_id) {
      campaignList.push(mapping.campaign_id);
      campaignIds.add(mapping.campaign_id);
    }
    mappedCampaignIdsByControlId.set(mapping.control_id, Array.from(new Set(campaignList)));

    const moduleList = mappedModuleIdsByControlId.get(mapping.control_id) ?? [];
    if (mapping.module_id) {
      moduleList.push(mapping.module_id);
    }
    mappedModuleIdsByControlId.set(mapping.control_id, Array.from(new Set(moduleList)));
  }

  const campaignUpdatedById = new Map<string, string>();
  if (campaignIds.size > 0) {
    const campaignResult = await input.supabase
      .from("learning_campaigns")
      .select("id,updated_at")
      .eq("org_id", input.orgId)
      .in("id", Array.from(campaignIds));
    if (campaignResult.error) {
      throw new ApiError("DB_ERROR", campaignResult.error.message, 500);
    }
    for (const campaign of campaignResult.data ?? []) {
      campaignUpdatedById.set(campaign.id, campaign.updated_at);
    }
  }

  const evidenceByControlId = new Map<
    string,
    Array<{
      control_id: string | null;
      evidence_status: "queued" | "synced" | "rejected" | "stale" | "superseded" | null;
      occurred_at: string;
      evidence_type?: string | null;
      metadata_json?: Record<string, unknown> | null;
    }>
  >();

  for (const evidence of evidenceResult.data ?? []) {
    if (!evidence.control_id) continue;
    const rows = evidenceByControlId.get(evidence.control_id) ?? [];
    rows.push(evidence);
    evidenceByControlId.set(evidence.control_id, rows);
  }

  const computedByControlId = new Map<string, ControlFreshnessComputed>();
  for (const control of controls) {
    const campaignTimestamps = (mappedCampaignIdsByControlId.get(control.id) ?? [])
      .map((campaignId) => campaignUpdatedById.get(campaignId))
      .filter((value): value is string => Boolean(value));
    const lastPolicyUpdateAt =
      campaignTimestamps.length > 0
        ? campaignTimestamps.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
        : null;

    const computed = computeControlFreshness({
      controlId: control.id,
      evidenceRows: evidenceByControlId.get(control.id) ?? [],
      lastPolicyUpdateAt,
    });

    computedByControlId.set(control.id, computed);
  }

  const trendByControlId = new Map<string, number[]>();
  const trendRawByControl = new Map<string, number[]>();
  for (const trend of compatMode ? [] : (trendsResult.data ?? [])) {
    const list = trendRawByControl.get(trend.control_id) ?? [];
    if (list.length < 7) {
      list.push(Number(trend.freshness_score));
    }
    trendRawByControl.set(trend.control_id, list);
  }

  for (const control of controls) {
    const fromSnapshots = trendRawByControl.get(control.id);
    if (fromSnapshots && fromSnapshots.length > 0) {
      trendByControlId.set(control.id, [...fromSnapshots].reverse());
    } else {
      trendByControlId.set(
        control.id,
        scoreToTrendSparkline(computedByControlId.get(control.id)?.score ?? 0),
      );
    }
  }

  return {
    controls,
    computedByControlId,
    trendByControlId,
    mappedCampaignIdsByControlId,
    mappedModuleIdsByControlId,
    compatMode,
  };
}

export async function upsertFreshnessSnapshots(input: {
  supabase: SupabaseClient;
  orgId: string;
  computed: ControlFreshnessComputed[];
}): Promise<number> {
  if (input.computed.length === 0) return 0;

  const rows = input.computed.map((item) => ({
    org_id: input.orgId,
    control_id: item.controlId,
    freshness_state: item.state,
    freshness_score: Number(item.score.toFixed(2)),
    fresh_evidence_count: item.freshEvidenceCount,
    stale_evidence_count: item.staleCount,
    rejected_evidence_count: item.rejectedCount,
    synced_evidence_count: item.syncedCount,
    median_ack_hours: item.medianAckHours,
    last_policy_update_at: item.lastPolicyUpdateAt,
    latest_evidence_at: item.latestEvidenceAt,
    metadata_json: {},
  }));

  const insert = await input.supabase.from("control_freshness_snapshots").insert(rows);
  if (insert.error) {
    throw new ApiError("DB_ERROR", insert.error.message, 500);
  }
  return rows.length;
}

export async function resolveBenchmarkDelta(input: {
  supabase: SupabaseClient;
  orgId: string;
  metricName: "control_freshness" | "time_to_ack_hours" | "stale_controls_ratio";
  cohortCode?: string;
}): Promise<{
  cohortCode: string;
  orgMetricValue: number | null;
  cohortMetricValue: number | null;
  percentileRank: number | null;
  delta: number | null;
  band: string;
  snapshotAt: string | null;
  compatMode: boolean;
}> {
  const cohortResult = await input.supabase
    .from("benchmark_cohorts")
    .select("id,code")
    .eq("active", true)
    .eq("code", input.cohortCode ?? "mid_market_saas")
    .maybeSingle();

  if (cohortResult.error) {
    if (isAdoptionIntelligenceSchemaMissingError(cohortResult.error)) {
      return benchmarkCompatFallback(input.cohortCode);
    }
    throw new ApiError("DB_ERROR", cohortResult.error.message, 500);
  }

  const fallbackCohort = {
    id: "00000000-0000-0000-0000-000000000000",
    code: input.cohortCode ?? "mid_market_saas",
  };
  const cohort = cohortResult.data ?? fallbackCohort;

  const [orgSnapshotResult, cohortSnapshotResult] = await Promise.all([
    cohortResult.data
      ? input.supabase
          .from("benchmark_metric_snapshots")
          .select("metric_value,percentile_rank,snapshot_at")
          .eq("org_id", input.orgId)
          .eq("cohort_id", cohort.id)
          .eq("metric_name", input.metricName)
          .order("snapshot_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    cohortResult.data
      ? input.supabase
          .from("benchmark_metric_snapshots")
          .select("metric_value,snapshot_at")
          .is("org_id", null)
          .eq("anonymized", true)
          .eq("cohort_id", cohort.id)
          .eq("metric_name", input.metricName)
          .order("snapshot_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (orgSnapshotResult.error || cohortSnapshotResult.error) {
    if (
      isAdoptionIntelligenceSchemaMissingError(orgSnapshotResult.error) ||
      isAdoptionIntelligenceSchemaMissingError(cohortSnapshotResult.error)
    ) {
      return benchmarkCompatFallback(cohort.code);
    }
    throw new ApiError(
      "DB_ERROR",
      orgSnapshotResult.error?.message ?? cohortSnapshotResult.error?.message ?? "Benchmark lookup failed",
      500,
    );
  }

  const fallbackCohortMetric = (() => {
    if (input.metricName === "control_freshness") return 0.72;
    if (input.metricName === "time_to_ack_hours") return 18;
    return 0.21;
  })();

  const orgMetricValue = orgSnapshotResult.data ? Number(orgSnapshotResult.data.metric_value) : null;
  const cohortMetricValue = cohortSnapshotResult.data
    ? Number(cohortSnapshotResult.data.metric_value)
    : fallbackCohortMetric;
  const percentileRank = orgSnapshotResult.data?.percentile_rank
    ? Number(orgSnapshotResult.data.percentile_rank)
    : null;

  const delta =
    orgMetricValue === null || cohortMetricValue === null
      ? null
      : Number((orgMetricValue - cohortMetricValue).toFixed(4));

  return {
    cohortCode: cohort.code,
    orgMetricValue,
    cohortMetricValue,
    percentileRank,
    delta,
    band: benchmarkBand(percentileRank),
    snapshotAt: orgSnapshotResult.data?.snapshot_at ?? null,
    compatMode: false,
  };
}
