import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/errors";

type RelationType = "derived_from" | "supersedes" | "exported_in";

export async function createEvidenceLineageLinks(input: {
  supabase: SupabaseClient;
  orgId: string;
  sourceEvidenceId: string;
  targetEvidenceIds: string[];
  relationType: RelationType;
  createdBy: string | null;
  metadata?: Record<string, unknown>;
}): Promise<number> {
  if (input.targetEvidenceIds.length === 0) {
    return 0;
  }

  const rows = input.targetEvidenceIds.map((targetEvidenceId) => ({
    org_id: input.orgId,
    source_evidence_id: input.sourceEvidenceId,
    target_evidence_id: targetEvidenceId,
    relation_type: input.relationType,
    metadata_json: input.metadata ?? {},
    created_by: input.createdBy,
  }));

  const insert = await input.supabase
    .from("evidence_lineage_links")
    .upsert(rows, {
      onConflict: "org_id,source_evidence_id,target_evidence_id,relation_type",
      ignoreDuplicates: true,
    });

  if (insert.error) {
    throw new ApiError("DB_ERROR", insert.error.message, 500);
  }

  return rows.length;
}

export async function fetchLineageForEvidenceIds(input: {
  supabase: SupabaseClient;
  orgId: string;
  evidenceIds: string[];
}): Promise<{
  bySource: Map<string, Array<{ targetEvidenceId: string; relationType: RelationType; createdAt: string }>>;
  byTarget: Map<string, Array<{ sourceEvidenceId: string; relationType: RelationType; createdAt: string }>>;
}> {
  const bySource = new Map<string, Array<{ targetEvidenceId: string; relationType: RelationType; createdAt: string }>>();
  const byTarget = new Map<string, Array<{ sourceEvidenceId: string; relationType: RelationType; createdAt: string }>>();

  if (input.evidenceIds.length === 0) {
    return { bySource, byTarget };
  }

  const [sourceLinks, targetLinks] = await Promise.all([
    input.supabase
      .from("evidence_lineage_links")
      .select("source_evidence_id,target_evidence_id,relation_type,created_at")
      .eq("org_id", input.orgId)
      .in("source_evidence_id", input.evidenceIds)
      .order("created_at", { ascending: true }),
    input.supabase
      .from("evidence_lineage_links")
      .select("source_evidence_id,target_evidence_id,relation_type,created_at")
      .eq("org_id", input.orgId)
      .in("target_evidence_id", input.evidenceIds)
      .order("created_at", { ascending: true }),
  ]);

  if (sourceLinks.error || targetLinks.error) {
    throw new ApiError(
      "DB_ERROR",
      sourceLinks.error?.message ?? targetLinks.error?.message ?? "Lineage lookup failed",
      500,
    );
  }

  const merged = [...(sourceLinks.data ?? []), ...(targetLinks.data ?? [])];
  const dedupe = new Set<string>();

  for (const item of merged) {
    const dedupeKey = `${item.source_evidence_id}:${item.target_evidence_id}:${item.relation_type}:${item.created_at}`;
    if (dedupe.has(dedupeKey)) continue;
    dedupe.add(dedupeKey);

    const sourceList = bySource.get(item.source_evidence_id) ?? [];
    sourceList.push({
      targetEvidenceId: item.target_evidence_id,
      relationType: item.relation_type as RelationType,
      createdAt: item.created_at,
    });
    bySource.set(item.source_evidence_id, sourceList);

    const targetList = byTarget.get(item.target_evidence_id) ?? [];
    targetList.push({
      sourceEvidenceId: item.source_evidence_id,
      relationType: item.relation_type as RelationType,
      createdAt: item.created_at,
    });
    byTarget.set(item.target_evidence_id, targetList);
  }

  return { bySource, byTarget };
}
