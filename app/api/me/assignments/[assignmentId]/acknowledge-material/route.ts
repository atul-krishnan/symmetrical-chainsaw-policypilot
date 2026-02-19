import { ApiError } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/route-helpers";
import { requireUserAndClient } from "@/lib/edtech/db";
import { createEvidenceObjects } from "@/lib/edtech/evidence";
import { writeRequestAuditLog } from "@/lib/edtech/request-audit-log";

export async function POST(
  request: Request,
  context: { params: Promise<{ assignmentId: string }> },
) {
  const { assignmentId } = await context.params;

  return withApiHandler(request, async ({ requestId, route }) => {
    const { supabase, user } = await requireUserAndClient(request);

    const assignmentResult = await supabase
      .from("assignments")
      .select("id,org_id,campaign_id,module_id,user_id,state,material_acknowledged_at")
      .eq("id", assignmentId)
      .eq("user_id", user.id)
      .single();

    if (assignmentResult.error || !assignmentResult.data) {
      throw new ApiError("NOT_FOUND", "Assignment not found", 404);
    }

    const assignment = assignmentResult.data;

    const campaignResult = await supabase
      .from("learning_campaigns")
      .select("flow_version")
      .eq("id", assignment.campaign_id)
      .eq("org_id", assignment.org_id)
      .single();

    if (campaignResult.error || !campaignResult.data) {
      throw new ApiError("NOT_FOUND", "Campaign not found", 404);
    }

    const flowVersion = campaignResult.data.flow_version ?? 1;
    const alreadyAcknowledged = Boolean(assignment.material_acknowledged_at);
    const acknowledgedAt = assignment.material_acknowledged_at ?? new Date().toISOString();

    if (!alreadyAcknowledged) {
      const updateResult = await supabase
        .from("assignments")
        .update({
          material_acknowledged_at: acknowledgedAt,
          state: assignment.state === "assigned" ? "in_progress" : assignment.state,
          started_at: assignment.state === "assigned" ? acknowledgedAt : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("id", assignmentId)
        .eq("user_id", user.id);

      if (updateResult.error) {
        throw new ApiError("DB_ERROR", updateResult.error.message, 500);
      }
    }

    await createEvidenceObjects({
      supabase,
      orgId: assignment.org_id,
      campaignId: assignment.campaign_id,
      moduleId: assignment.module_id,
      assignmentId: assignment.id,
      userId: assignment.user_id,
      evidenceType: "material_acknowledgment",
      sourceTable: "assignments",
      sourceId: assignment.id,
      occurredAtIso: acknowledgedAt,
      confidenceScore: 0.95,
      qualityScore: 90,
      metadata: {
        flowVersion,
      },
    });

    await writeRequestAuditLog({
      supabase,
      requestId,
      route,
      action: "material_acknowledge",
      statusCode: 200,
      orgId: assignment.org_id,
      userId: user.id,
      metadata: {
        assignmentId,
        campaignId: assignment.campaign_id,
        flowVersion,
        alreadyAcknowledged,
      },
    });

    return {
      ok: true,
      assignmentId,
      flowVersion,
      materialAcknowledgedAt: acknowledgedAt,
      alreadyAcknowledged,
    };
  });
}
