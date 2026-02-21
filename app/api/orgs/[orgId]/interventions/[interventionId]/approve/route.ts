import { ApiError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { withApiHandler } from "@/lib/api/route-helpers";
import { requireOrgAccess } from "@/lib/edtech/db";
import { writeRequestAuditLog } from "@/lib/edtech/request-audit-log";
import { interventionApproveSchema } from "@/lib/edtech/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ orgId: string; interventionId: string }> },
) {
  const { orgId, interventionId } = await context.params;

  return withApiHandler(request, async ({ requestId, route }) => {
    const { supabase, user } = await requireOrgAccess(request, orgId, "admin");

    const payload = await parseJsonBody<unknown>(request).catch(() => ({}));
    const parsed = interventionApproveSchema.safeParse(payload ?? {});
    if (!parsed.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid approve payload",
        400,
      );
    }

    const recommendationResult = await supabase
      .from("intervention_recommendations")
      .select("id,status,metadata_json")
      .eq("org_id", orgId)
      .eq("id", interventionId)
      .single();

    if (recommendationResult.error || !recommendationResult.data) {
      throw new ApiError("NOT_FOUND", "Intervention recommendation not found", 404);
    }

    if (recommendationResult.data.status !== "proposed") {
      throw new ApiError("CONFLICT", "Only proposed interventions can be approved", 409);
    }

    const update = await supabase
      .from("intervention_recommendations")
      .update({
        status: "approved",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        metadata_json: {
          ...(recommendationResult.data.metadata_json ?? {}),
          approvalNote: parsed.data.note ?? null,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId)
      .eq("id", interventionId)
      .select("id,status,approved_at")
      .single();

    if (update.error || !update.data) {
      throw new ApiError("DB_ERROR", update.error?.message ?? "Approval failed", 500);
    }

    await writeRequestAuditLog({
      supabase,
      requestId,
      route,
      action: "intervention_approve",
      statusCode: 200,
      orgId,
      userId: user.id,
      metadata: {
        interventionId,
        note: parsed.data.note ?? null,
      },
    });

    return {
      ok: true,
      interventionId,
      status: update.data.status,
      approvedAt: update.data.approved_at,
    };
  });
}
