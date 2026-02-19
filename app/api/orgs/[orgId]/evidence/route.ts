import { ApiError } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/route-helpers";
import { requireOrgAccess } from "@/lib/edtech/db";
import { writeRequestAuditLog } from "@/lib/edtech/request-audit-log";
import { evidenceQuerySchema } from "@/lib/edtech/validation";

export async function GET(
  request: Request,
  context: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await context.params;

  return withApiHandler(request, async ({ requestId, route }) => {
    const { supabase, user } = await requireOrgAccess(request, orgId, "manager");

    const url = new URL(request.url);
    const parsedQuery = evidenceQuerySchema.safeParse({
      controlId: url.searchParams.get("controlId") ?? undefined,
      campaignId: url.searchParams.get("campaignId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    });

    if (!parsedQuery.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsedQuery.error.issues[0]?.message ?? "Invalid evidence query",
        400,
      );
    }

    let query = supabase
      .from("evidence_objects")
      .select(
        "id,control_id,campaign_id,module_id,assignment_id,user_id,evidence_type,evidence_status,confidence_score,quality_score,checksum,source_table,source_id,metadata_json,occurred_at,created_at,controls(id,code,title)",
      )
      .eq("org_id", orgId)
      .order("occurred_at", { ascending: false })
      .limit(500);

    if (parsedQuery.data.controlId) {
      query = query.eq("control_id", parsedQuery.data.controlId);
    }
    if (parsedQuery.data.campaignId) {
      query = query.eq("campaign_id", parsedQuery.data.campaignId);
    }
    if (parsedQuery.data.status) {
      query = query.eq("evidence_status", parsedQuery.data.status);
    }

    const evidenceResult = await query;

    if (evidenceResult.error) {
      throw new ApiError("DB_ERROR", evidenceResult.error.message, 500);
    }

    const evidenceRows = evidenceResult.data ?? [];
    const evidenceIds = evidenceRows.map((row) => row.id);

    const latestEventsByEvidenceId = new Map<
      string,
      { provider: string; status: string; externalEvidenceId: string | null; createdAt: string }
    >();

    if (evidenceIds.length > 0) {
      const eventsResult = await supabase
        .from("integration_sync_events")
        .select("evidence_object_id,provider,status,external_evidence_id,created_at")
        .eq("org_id", orgId)
        .in("evidence_object_id", evidenceIds)
        .order("created_at", { ascending: false });

      if (eventsResult.error) {
        throw new ApiError("DB_ERROR", eventsResult.error.message, 500);
      }

      for (const event of eventsResult.data ?? []) {
        if (!latestEventsByEvidenceId.has(event.evidence_object_id)) {
          latestEventsByEvidenceId.set(event.evidence_object_id, {
            provider: event.provider,
            status: event.status,
            externalEvidenceId: event.external_evidence_id,
            createdAt: event.created_at,
          });
        }
      }
    }

    const statusCounts: Record<"queued" | "synced" | "rejected" | "stale" | "superseded", number> = {
      queued: 0,
      synced: 0,
      rejected: 0,
      stale: 0,
      superseded: 0,
    };

    for (const evidence of evidenceRows) {
      const status = evidence.evidence_status;
      if (status && status in statusCounts) {
        statusCounts[status as keyof typeof statusCounts] += 1;
      }
    }

    await writeRequestAuditLog({
      supabase,
      requestId,
      route,
      action: "evidence_view",
      statusCode: 200,
      orgId,
      userId: user.id,
      metadata: {
        total: evidenceRows.length,
        filters: parsedQuery.data,
      },
    });

    return {
      orgId,
      summary: {
        total: evidenceRows.length,
        statusCounts,
      },
      items: evidenceRows.map((row) => {
        const control = Array.isArray(row.controls) ? row.controls[0] : row.controls;
        return {
          id: row.id,
          controlId: row.control_id,
          campaignId: row.campaign_id,
          moduleId: row.module_id,
          assignmentId: row.assignment_id,
          userId: row.user_id,
          evidenceType: row.evidence_type,
          status: row.evidence_status,
          confidenceScore: Number(row.confidence_score),
          qualityScore: Number(row.quality_score),
          checksum: row.checksum,
          sourceTable: row.source_table,
          sourceId: row.source_id,
          occurredAt: row.occurred_at,
          metadata: row.metadata_json,
          control: control
            ? {
                id: control.id,
                code: control.code,
                title: control.title,
              }
            : null,
          latestSyncEvent: latestEventsByEvidenceId.get(row.id) ?? null,
        };
      }),
    };
  });
}
