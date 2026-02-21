import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { createHash, randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function checksum(input: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

async function main(): Promise<void> {
  const supabaseUrl = readEnv("DEMO_SUPABASE_URL") || readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = readEnv("DEMO_SUPABASE_SERVICE_ROLE_KEY") || readEnv("SUPABASE_SERVICE_ROLE_KEY");
  const explicitOrgId = readEnv("DEMO_ORG_ID");
  const fallbackOrgName = readEnv("DEMO_ORG_NAME") || "Acme Corp";
  const now = new Date();

  if (!supabaseUrl || !serviceRole) {
    throw new Error("Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.");
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const orgId = await (async () => {
    if (explicitOrgId) return explicitOrgId;
    const orgResult = await supabase
      .from("organizations")
      .select("id,name")
      .ilike("name", fallbackOrgName)
      .limit(1)
      .maybeSingle();
    if (orgResult.error || !orgResult.data?.id) {
      throw new Error(`Unable to resolve organization. Provide DEMO_ORG_ID (lookup by "${fallbackOrgName}" failed).`);
    }
    return orgResult.data.id;
  })();

  const [adminMember, control, campaign, module, cohort] = await Promise.all([
    supabase
      .from("organization_members")
      .select("user_id,role")
      .eq("org_id", orgId)
      .in("role", ["owner", "admin"])
      .limit(1)
      .maybeSingle(),
    supabase
      .from("controls")
      .select("id,code,title")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("learning_campaigns")
      .select("id,status")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("learning_modules")
      .select("id,campaign_id,role_track")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("benchmark_cohorts")
      .select("id,code")
      .eq("code", "mid_market_saas")
      .limit(1)
      .maybeSingle(),
  ]);

  if (control.error || !control.data?.id) {
    throw new Error(
      `No controls found in org ${orgId}. Import controls first from /product/admin/controls.`,
    );
  }
  if (adminMember.error) {
    throw new Error(adminMember.error.message);
  }
  if (campaign.error) {
    throw new Error(campaign.error.message);
  }
  if (module.error) {
    throw new Error(module.error.message);
  }
  if (cohort.error) {
    throw new Error(cohort.error.message);
  }

  const adminUserId = adminMember.data?.user_id ?? null;
  const campaignId = campaign.data?.id ?? module.data?.campaign_id ?? null;
  const moduleId = module.data?.id ?? null;
  const controlId = control.data.id;

  const staleOccurredAt = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 20).toISOString();
  const freshOccurredAt = new Date(now.getTime() - 1000 * 60 * 60 * 4).toISOString();

  const evidenceRows = [
    {
      id: randomUUID(),
      org_id: orgId,
      control_id: controlId,
      campaign_id: campaignId,
      module_id: moduleId,
      assignment_id: null,
      user_id: adminUserId,
      evidence_type: "quiz_attempt" as const,
      evidence_status: "stale" as const,
      confidence_score: 0.78,
      quality_score: 66,
      checksum: checksum({ orgId, controlId, t: "quiz_attempt", s: "stale", at: staleOccurredAt }),
      lineage_hash: checksum({ orgId, controlId, source: "demo-proof", at: staleOccurredAt }),
      source_table: "demo_seed",
      source_id: `demo-proof-${now.toISOString()}`,
      metadata_json: { scenario: "stale_control", generatedBy: "seed-demo-proof-paths" },
      occurred_at: staleOccurredAt,
      created_at: staleOccurredAt,
      updated_at: staleOccurredAt,
    },
    {
      id: randomUUID(),
      org_id: orgId,
      control_id: controlId,
      campaign_id: campaignId,
      module_id: moduleId,
      assignment_id: null,
      user_id: adminUserId,
      evidence_type: "material_acknowledgment" as const,
      evidence_status: "synced" as const,
      confidence_score: 0.91,
      quality_score: 88,
      checksum: checksum({ orgId, controlId, t: "material_acknowledgment", s: "synced", at: freshOccurredAt }),
      lineage_hash: checksum({ orgId, controlId, source: "demo-proof", at: freshOccurredAt }),
      source_table: "demo_seed",
      source_id: `demo-proof-${now.toISOString()}`,
      metadata_json: { scenario: "fresh_ack", generatedBy: "seed-demo-proof-paths" },
      occurred_at: freshOccurredAt,
      created_at: freshOccurredAt,
      updated_at: freshOccurredAt,
    },
    {
      id: randomUUID(),
      org_id: orgId,
      control_id: controlId,
      campaign_id: campaignId,
      module_id: moduleId,
      assignment_id: null,
      user_id: adminUserId,
      evidence_type: "campaign_export" as const,
      evidence_status: "queued" as const,
      confidence_score: 0.84,
      quality_score: 81,
      checksum: checksum({ orgId, controlId, t: "campaign_export", s: "queued", at: now.toISOString() }),
      lineage_hash: checksum({ orgId, controlId, source: "demo-proof", at: now.toISOString() }),
      source_table: "demo_seed",
      source_id: `demo-export-${now.toISOString()}`,
      metadata_json: { scenario: "export_checksum_path", generatedBy: "seed-demo-proof-paths" },
      occurred_at: now.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
  ];

  const evidenceInsert = await supabase.from("evidence_objects").insert(evidenceRows).select("id");
  if (evidenceInsert.error) {
    throw new Error(evidenceInsert.error.message);
  }

  const snapshotInsert = await supabase.from("control_freshness_snapshots").insert({
    org_id: orgId,
    control_id: controlId,
    freshness_state: "stale",
    freshness_score: 47.5,
    fresh_evidence_count: 1,
    stale_evidence_count: 1,
    rejected_evidence_count: 0,
    synced_evidence_count: 1,
    median_ack_hours: 6,
    last_policy_update_at: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 10).toISOString(),
    latest_evidence_at: freshOccurredAt,
    metadata_json: { scenario: "demo_proof_path" },
  });
  if (snapshotInsert.error) {
    throw new Error(snapshotInsert.error.message);
  }

  const interventionInsert = await supabase.from("intervention_recommendations").insert({
    org_id: orgId,
    control_id: controlId,
    campaign_id: campaignId,
    module_id: moduleId,
    recommendation_type: "role_refresher_module",
    status: "proposed",
    rationale: "Demo scenario: stale control evidence suggests refresher module.",
    expected_impact_pct: 18,
    confidence_score: 0.82,
    metadata_json: { scenario: "demo_proof_path" },
    proposed_by: adminUserId,
  });
  if (interventionInsert.error) {
    throw new Error(interventionInsert.error.message);
  }

  if (cohort.data?.id) {
    const benchmarkInsert = await supabase.from("benchmark_metric_snapshots").insert([
      {
        org_id: orgId,
        cohort_id: cohort.data.id,
        metric_name: "control_freshness",
        metric_value: 0.61,
        percentile_rank: 43,
        band_label: "average",
        sample_size: 40,
        window_days: 30,
        anonymized: false,
        metadata_json: { scenario: "demo_org" },
      },
      {
        org_id: null,
        cohort_id: cohort.data.id,
        metric_name: "control_freshness",
        metric_value: 0.71,
        percentile_rank: null,
        band_label: "cohort",
        sample_size: 400,
        window_days: 30,
        anonymized: true,
        metadata_json: { scenario: "demo_cohort" },
      },
    ]);
    if (benchmarkInsert.error) {
      throw new Error(benchmarkInsert.error.message);
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        orgId,
        controlId,
        campaignId,
        moduleId,
        insertedEvidenceCount: evidenceRows.length,
        insertedEvidenceIds: (evidenceInsert.data ?? []).map((item) => item.id),
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown error",
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
