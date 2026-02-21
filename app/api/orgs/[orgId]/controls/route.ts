import { ApiError } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/route-helpers";
import {
  isAdoptionIntelligenceSchemaMissingError,
  loadControlFreshness,
  resolveBenchmarkDelta,
} from "@/lib/edtech/adoption-store";
import { requireOrgAccess } from "@/lib/edtech/db";
import { writeRequestAuditLog } from "@/lib/edtech/request-audit-log";

type EvidenceCounters = {
  total: number;
  queued: number;
  synced: number;
  rejected: number;
  stale: number;
  superseded: number;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await context.params;

  return withApiHandler(request, async ({ requestId, route }) => {
    const { supabase, user } = await requireOrgAccess(request, orgId, "manager");

    const [frameworksResult, controlsResult, mappingsResult, evidenceResult, campaignsResult] =
      await Promise.all([
        supabase
          .from("control_frameworks")
          .select("id,name,version,source,created_at")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false }),
        supabase
          .from("controls")
          .select("id,framework_id,code,title,description,risk_level")
          .eq("org_id", orgId)
          .order("code", { ascending: true }),
        supabase
          .from("control_mappings")
          .select("id,control_id,campaign_id,module_id,mapping_strength,active")
          .eq("org_id", orgId),
        supabase
          .from("evidence_objects")
          .select("id,control_id,evidence_status")
          .eq("org_id", orgId),
        supabase
          .from("learning_campaigns")
          .select("id,name,status")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false }),
      ]);

    if (campaignsResult.error) {
      throw new ApiError(
        "DB_ERROR",
        campaignsResult.error.message,
        500,
      );
    }

    if (
      frameworksResult.error ||
      controlsResult.error ||
      mappingsResult.error ||
      evidenceResult.error
    ) {
      throw new ApiError(
        "DB_ERROR",
        frameworksResult.error?.message ??
          controlsResult.error?.message ??
          mappingsResult.error?.message ??
          evidenceResult.error?.message ??
          "Failed to load control library",
        500,
      );
    }

    const frameworks = frameworksResult.data ?? [];
    const controls = controlsResult.data ?? [];
    const mappings = (mappingsResult.data ?? []).filter((item) => item.active);
    const evidence = evidenceResult.data ?? [];
    const campaigns = campaignsResult.data ?? [];

    const [freshnessLoaded, interventionsResult, benchmarkDelta] = await Promise.all([
      loadControlFreshness({
        supabase,
        orgId,
      }),
      supabase
        .from("intervention_recommendations")
        .select("control_id,status,created_at")
        .eq("org_id", orgId)
        .in("status", ["proposed", "approved", "executing"])
        .order("created_at", { ascending: false }),
      resolveBenchmarkDelta({
        supabase,
        orgId,
        metricName: "control_freshness",
      }),
    ]);

    const compatMode =
      freshnessLoaded.compatMode ||
      benchmarkDelta.compatMode ||
      isAdoptionIntelligenceSchemaMissingError(interventionsResult.error);

    if (interventionsResult.error && !isAdoptionIntelligenceSchemaMissingError(interventionsResult.error)) {
      throw new ApiError("DB_ERROR", interventionsResult.error.message, 500);
    }

    const interventionCountByControl = new Map<string, number>();
    const latestInterventionStatusByControl = new Map<string, string>();
    for (const item of compatMode ? [] : (interventionsResult.data ?? [])) {
      interventionCountByControl.set(
        item.control_id,
        (interventionCountByControl.get(item.control_id) ?? 0) + 1,
      );
      if (!latestInterventionStatusByControl.has(item.control_id)) {
        latestInterventionStatusByControl.set(item.control_id, item.status);
      }
    }

    const frameworkById = new Map(frameworks.map((framework) => [framework.id, framework]));

    const mappingCounts = new Map<string, number>();
    const activeCampaignByControl = new Map<string, string>();
    const activeStrengthByControl = new Map<string, "primary" | "supporting">();
    for (const mapping of mappings) {
      mappingCounts.set(mapping.control_id, (mappingCounts.get(mapping.control_id) ?? 0) + 1);

      if (mapping.campaign_id && !activeCampaignByControl.has(mapping.control_id)) {
        activeCampaignByControl.set(mapping.control_id, mapping.campaign_id);
      }

      if (
        (mapping.mapping_strength === "primary" || mapping.mapping_strength === "supporting") &&
        !activeStrengthByControl.has(mapping.control_id)
      ) {
        activeStrengthByControl.set(mapping.control_id, mapping.mapping_strength);
      }
    }

    const evidenceStatsByControl = new Map<string, EvidenceCounters>();
    for (const item of evidence) {
      if (!item.control_id) continue;

      const current = evidenceStatsByControl.get(item.control_id) ?? {
        total: 0,
        queued: 0,
        synced: 0,
        rejected: 0,
        stale: 0,
        superseded: 0,
      };

      current.total += 1;
      const status = item.evidence_status;
      if (status && status in current) {
        current[status as keyof Omit<EvidenceCounters, "total">] += 1;
      }
      evidenceStatsByControl.set(item.control_id, current);
    }

    const mappedControlIds = new Set(mappings.map((item) => item.control_id));

    const items = controls.map((control) => {
      const framework = control.framework_id ? frameworkById.get(control.framework_id) : null;
      const evidenceStats = evidenceStatsByControl.get(control.id) ?? {
        total: 0,
        queued: 0,
        synced: 0,
        rejected: 0,
        stale: 0,
        superseded: 0,
      };

      return {
        id: control.id,
        code: control.code,
        title: control.title,
        description: control.description,
        riskLevel: control.risk_level,
        framework: framework
          ? {
              id: framework.id,
              name: framework.name,
              version: framework.version,
            }
          : null,
        mappingCount: mappingCounts.get(control.id) ?? 0,
        activeCampaignId: activeCampaignByControl.get(control.id) ?? null,
        activeMappingStrength: activeStrengthByControl.get(control.id) ?? null,
        evidence: evidenceStats,
        freshness: (() => {
          const snapshot = freshnessLoaded.computedByControlId.get(control.id);
          if (!snapshot) {
            return {
              state: "critical",
              score: 0,
              latestEvidenceAt: null,
            };
          }
          return {
            state: snapshot.state,
            score: snapshot.score,
            latestEvidenceAt: snapshot.latestEvidenceAt,
          };
        })(),
        freshnessTrend: freshnessLoaded.trendByControlId.get(control.id) ?? [],
        benchmark: (() => {
          const snapshot = freshnessLoaded.computedByControlId.get(control.id);
          const basePercentile = benchmarkDelta.percentileRank;
          const score = snapshot?.score ?? 0;
          const percentileRank =
            basePercentile === null
              ? Number(score.toFixed(1))
              : Math.max(1, Math.min(99, Number((basePercentile + (score - 70) * 0.4).toFixed(1))));
          return {
            cohortCode: benchmarkDelta.cohortCode,
            percentileRank,
            band: benchmarkDelta.band,
          };
        })(),
        intervention: {
          activeCount: interventionCountByControl.get(control.id) ?? 0,
          latestStatus: latestInterventionStatusByControl.get(control.id) ?? null,
        },
      };
    });

    const coverageRatio = controls.length > 0 ? mappedControlIds.size / controls.length : 0;

    await writeRequestAuditLog({
      supabase,
      requestId,
      route,
      action: "controls_view",
      statusCode: 200,
      orgId,
      userId: user.id,
      metadata: {
        controlCount: controls.length,
        mappedControlCount: mappedControlIds.size,
        compatMode,
      },
    });

    return {
      orgId,
      frameworks,
      campaigns,
      controls: items,
      compatMode,
      summary: {
        totalControls: controls.length,
        mappedControls: mappedControlIds.size,
        coverageRatio,
        benchmarkCohort: benchmarkDelta.cohortCode,
      },
    };
  });
}
