import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/errors";
import type { EvidenceStatus } from "@/lib/types";

type EvidenceType =
  | "material_acknowledgment"
  | "quiz_attempt"
  | "quiz_pass"
  | "attestation"
  | "campaign_export";

function buildEvidenceChecksum(input: {
  orgId: string;
  evidenceType: EvidenceType;
  sourceTable: string;
  sourceId: string;
  controlId: string | null;
  occurredAt: string;
  metadata: Record<string, unknown>;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        orgId: input.orgId,
        evidenceType: input.evidenceType,
        sourceTable: input.sourceTable,
        sourceId: input.sourceId,
        controlId: input.controlId,
        occurredAt: input.occurredAt,
        metadata: input.metadata,
      }),
    )
    .digest("hex");
}

async function resolveMappedControlIds(input: {
  supabase: SupabaseClient;
  orgId: string;
  campaignId?: string | null;
  moduleId?: string | null;
}): Promise<string[]> {
  const predicates: string[] = [];

  if (input.moduleId) {
    predicates.push(`module_id.eq.${input.moduleId}`);
  }
  if (input.campaignId) {
    predicates.push(`campaign_id.eq.${input.campaignId}`);
  }

  if (predicates.length === 0) {
    return [];
  }

  const mappingsResult = await input.supabase
    .from("control_mappings")
    .select("control_id")
    .eq("org_id", input.orgId)
    .eq("active", true)
    .or(predicates.join(","));

  if (mappingsResult.error) {
    throw new ApiError("DB_ERROR", mappingsResult.error.message, 500);
  }

  return Array.from(
    new Set(
      (mappingsResult.data ?? [])
        .map((row) => row.control_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

export async function createEvidenceObjects(input: {
  supabase: SupabaseClient;
  orgId: string;
  campaignId?: string | null;
  moduleId?: string | null;
  assignmentId?: string | null;
  userId?: string | null;
  evidenceType: EvidenceType;
  sourceTable: string;
  sourceId: string;
  metadata?: Record<string, unknown>;
  occurredAtIso?: string;
  confidenceScore?: number;
  qualityScore?: number;
  status?: EvidenceStatus;
}): Promise<{ created: number; controlsMapped: number }> {
  const occurredAt = input.occurredAtIso ?? new Date().toISOString();
  const metadata = input.metadata ?? {};
  const status = input.status ?? "queued";
  const confidenceScore = input.confidenceScore ?? 0.8;
  const qualityScore = input.qualityScore ?? 80;

  const controlIds = await resolveMappedControlIds({
    supabase: input.supabase,
    orgId: input.orgId,
    campaignId: input.campaignId,
    moduleId: input.moduleId,
  });

  const targets: Array<string | null> = controlIds.length > 0 ? controlIds : [null];

  const existingResult = await input.supabase
    .from("evidence_objects")
    .select("id,control_id")
    .eq("org_id", input.orgId)
    .eq("evidence_type", input.evidenceType)
    .eq("source_table", input.sourceTable)
    .eq("source_id", input.sourceId);

  if (existingResult.error) {
    throw new ApiError("DB_ERROR", existingResult.error.message, 500);
  }

  const existingControlIds = new Set(
    (existingResult.data ?? []).map((row) => row.control_id ?? "__NULL__"),
  );

  const rowsToInsert = targets
    .filter((controlId) => !existingControlIds.has(controlId ?? "__NULL__"))
    .map((controlId) => ({
      org_id: input.orgId,
      control_id: controlId,
      campaign_id: input.campaignId ?? null,
      module_id: input.moduleId ?? null,
      assignment_id: input.assignmentId ?? null,
      user_id: input.userId ?? null,
      evidence_type: input.evidenceType,
      evidence_status: status,
      confidence_score: confidenceScore,
      quality_score: qualityScore,
      checksum: buildEvidenceChecksum({
        orgId: input.orgId,
        evidenceType: input.evidenceType,
        sourceTable: input.sourceTable,
        sourceId: input.sourceId,
        controlId,
        occurredAt,
        metadata,
      }),
      source_table: input.sourceTable,
      source_id: input.sourceId,
      metadata_json: metadata,
      occurred_at: occurredAt,
      updated_at: new Date().toISOString(),
    }));

  if (rowsToInsert.length === 0) {
    return {
      created: 0,
      controlsMapped: controlIds.length,
    };
  }

  const insertResult = await input.supabase.from("evidence_objects").insert(rowsToInsert);

  if (insertResult.error) {
    throw new ApiError("DB_ERROR", insertResult.error.message, 500);
  }

  return {
    created: rowsToInsert.length,
    controlsMapped: controlIds.length,
  };
}

export async function markCampaignEvidenceStale(input: {
  supabase: SupabaseClient;
  orgId: string;
  campaignId: string;
}): Promise<number> {
  const toStaleResult = await input.supabase
    .from("evidence_objects")
    .update({
      evidence_status: "stale",
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", input.orgId)
    .eq("campaign_id", input.campaignId)
    .in("evidence_status", ["queued", "synced"])
    .select("id");

  if (toStaleResult.error) {
    throw new ApiError("DB_ERROR", toStaleResult.error.message, 500);
  }

  return (toStaleResult.data ?? []).length;
}
