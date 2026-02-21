import { ApiError } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/route-helpers";
import { requireOrgAccess } from "@/lib/edtech/db";
import { fetchLineageForEvidenceIds } from "@/lib/edtech/evidence-lineage";
import { writeRequestAuditLog } from "@/lib/edtech/request-audit-log";

export async function GET(
  request: Request,
  context: { params: Promise<{ orgId: string; controlId: string }> },
) {
  const { orgId, controlId } = await context.params;

  return withApiHandler(request, async ({ requestId, route }) => {
    const { supabase, user } = await requireOrgAccess(request, orgId, "manager");

    const controlResult = await supabase
      .from("controls")
      .select("id,code,title")
      .eq("org_id", orgId)
      .eq("id", controlId)
      .single();

    if (controlResult.error || !controlResult.data) {
      throw new ApiError("NOT_FOUND", "Control not found", 404);
    }

    const evidenceResult = await supabase
      .from("evidence_objects")
      .select(
        "id,evidence_type,evidence_status,checksum,lineage_hash,superseded_by_evidence_id,source_table,source_id,occurred_at,created_at",
      )
      .eq("org_id", orgId)
      .eq("control_id", controlId)
      .order("occurred_at", { ascending: true });

    if (evidenceResult.error) {
      throw new ApiError("DB_ERROR", evidenceResult.error.message, 500);
    }

    const evidence = evidenceResult.data ?? [];
    const evidenceIds = evidence.map((item) => item.id);

    const [lineage, syncEventsResult] = await Promise.all([
      fetchLineageForEvidenceIds({
        supabase,
        orgId,
        evidenceIds,
      }),
      evidenceIds.length > 0
        ? supabase
            .from("integration_sync_events")
            .select("evidence_object_id,provider,status,created_at")
            .eq("org_id", orgId)
            .in("evidence_object_id", evidenceIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (syncEventsResult.error) {
      throw new ApiError("DB_ERROR", syncEventsResult.error.message, 500);
    }

    const latestSyncEventByEvidence = new Map<
      string,
      { provider: string; status: string; createdAt: string }
    >();
    for (const event of syncEventsResult.data ?? []) {
      if (!latestSyncEventByEvidence.has(event.evidence_object_id)) {
        latestSyncEventByEvidence.set(event.evidence_object_id, {
          provider: event.provider,
          status: event.status,
          createdAt: event.created_at,
        });
      }
    }

    await writeRequestAuditLog({
      supabase,
      requestId,
      route,
      action: "control_lineage_view",
      statusCode: 200,
      orgId,
      userId: user.id,
      metadata: {
        controlId,
        evidenceCount: evidence.length,
      },
    });

    return {
      orgId,
      control: {
        id: controlResult.data.id,
        code: controlResult.data.code,
        title: controlResult.data.title,
      },
      summary: {
        evidenceCount: evidence.length,
        lineageLinks:
          Array.from(lineage.bySource.values()).reduce((sum, list) => sum + list.length, 0),
      },
      timeline: evidence.map((item) => ({
        id: item.id,
        occurredAt: item.occurred_at,
        createdAt: item.created_at,
        evidenceType: item.evidence_type,
        status: item.evidence_status,
        checksum: item.checksum,
        lineageHash: item.lineage_hash,
        source: {
          table: item.source_table,
          id: item.source_id,
        },
        supersededByEvidenceId: item.superseded_by_evidence_id,
        supersedesEvidenceIds: (lineage.bySource.get(item.id) ?? [])
          .filter((edge) => edge.relationType === "supersedes")
          .map((edge) => edge.targetEvidenceId),
        derivedFromEvidenceIds: (lineage.bySource.get(item.id) ?? [])
          .filter((edge) => edge.relationType === "derived_from")
          .map((edge) => edge.targetEvidenceId),
        exportedInEvidenceIds: (lineage.bySource.get(item.id) ?? [])
          .filter((edge) => edge.relationType === "exported_in")
          .map((edge) => edge.targetEvidenceId),
        derivedByEvidenceIds: (lineage.byTarget.get(item.id) ?? [])
          .filter((edge) => edge.relationType === "derived_from")
          .map((edge) => edge.sourceEvidenceId),
        latestSyncEvent: latestSyncEventByEvidence.get(item.id) ?? null,
      })),
    };
  });
}
