import { randomUUID } from "node:crypto";

import { ApiError } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/route-helpers";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { requireOrgAccess } from "@/lib/edtech/db";
import { sendCampaignInvites } from "@/lib/edtech/email";
import { enforceRateLimit } from "@/lib/edtech/rate-limit";
import { writeRequestAuditLog } from "@/lib/edtech/request-audit-log";
import { logInfo } from "@/lib/observability/logger";

export async function POST(
  request: Request,
  context: { params: Promise<{ orgId: string; campaignId: string }> },
) {
  const { orgId, campaignId } = await context.params;

  return withApiHandler(request, async ({ requestId, route }) => {
    const { supabase, user } = await requireOrgAccess(request, orgId, "admin");

    const limit = enforceRateLimit(`${orgId}:${user.id}:campaign_publish`);
    if (!limit.allowed) {
      throw new ApiError(
        "RATE_LIMITED",
        `Publish rate limit reached. Retry in ${Math.ceil((limit.retryAfterMs ?? 0) / 1000)} seconds.`,
        429,
      );
    }

    const campaignResult = await supabase
      .from("learning_campaigns")
      .select("id,name,status,due_at")
      .eq("id", campaignId)
      .eq("org_id", orgId)
      .single();

    if (campaignResult.error || !campaignResult.data) {
      throw new ApiError("NOT_FOUND", "Campaign not found", 404);
    }

    if (campaignResult.data.status !== "draft") {
      throw new ApiError("CONFLICT", "Campaign is already published or archived", 409);
    }

    const modulesResult = await supabase
      .from("learning_modules")
      .select("id")
      .eq("org_id", orgId)
      .eq("campaign_id", campaignId);

    if (modulesResult.error) {
      throw new ApiError("DB_ERROR", modulesResult.error.message, 500);
    }

    const modules = modulesResult.data ?? [];
    if (modules.length === 0) {
      throw new ApiError("CONFLICT", "Campaign has no modules", 409);
    }

    const membersResult = await supabase
      .from("organization_members")
      .select("user_id,email")
      .eq("org_id", orgId)
      .in("role", ["learner", "manager", "admin", "owner"]);

    if (membersResult.error) {
      throw new ApiError("DB_ERROR", membersResult.error.message, 500);
    }

    const members = membersResult.data ?? [];
    if (members.length === 0) {
      throw new ApiError("CONFLICT", "No members found for assignment", 409);
    }

    const dueAt = campaignResult.data.due_at;
    const assignmentRows = modules.flatMap((module) =>
      members.map((member) => ({
        id: randomUUID(),
        org_id: orgId,
        campaign_id: campaignId,
        module_id: module.id,
        user_id: member.user_id,
        state: "assigned",
        due_at: dueAt,
      })),
    );

    const assignmentInsert = await supabase
      .from("assignments")
      .insert(assignmentRows, { defaultToNull: true });

    if (assignmentInsert.error) {
      throw new ApiError("DB_ERROR", assignmentInsert.error.message, 500);
    }

    const campaignUpdate = await supabase
      .from("learning_campaigns")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaignId)
      .eq("org_id", orgId);

    if (campaignUpdate.error) {
      throw new ApiError("DB_ERROR", campaignUpdate.error.message, 500);
    }

    const inviteTargets = members.map((member) => ({
      email: member.email,
      assignmentId: assignmentRows.find((row) => row.user_id === member.user_id)?.id ?? "",
      campaignName: campaignResult.data.name,
    }));

    const emailedCount = await sendCampaignInvites(inviteTargets, requestId);

    logInfo("campaign_published", {
      request_id: requestId,
      route,
      org_id: orgId,
      user_id: user.id,
      event: ANALYTICS_EVENTS.campaignPublished,
      status_code: 200,
    });

    await writeRequestAuditLog({
      supabase,
      requestId,
      route,
      action: "campaign_publish",
      statusCode: 200,
      orgId,
      userId: user.id,
      metadata: {
        campaignId,
        assignmentsCreated: assignmentRows.length,
        emailedCount,
      },
    });

    return {
      ok: true,
      campaignId,
      assignmentsCreated: assignmentRows.length,
      emailedCount,
    };
  });
}
