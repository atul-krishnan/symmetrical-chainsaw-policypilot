import { ApiError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { withApiHandler } from "@/lib/api/route-helpers";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { requireOrgAccess } from "@/lib/edtech/db";
import { sendReminderEmail } from "@/lib/edtech/email";
import { enforceRateLimit } from "@/lib/edtech/rate-limit";
import { writeRequestAuditLog } from "@/lib/edtech/request-audit-log";
import { nudgeSendSchema } from "@/lib/edtech/validation";
import { logInfo } from "@/lib/observability/logger";

export async function POST(
  request: Request,
  context: { params: Promise<{ orgId: string; campaignId: string }> },
) {
  const { orgId, campaignId } = await context.params;

  return withApiHandler(request, async ({ requestId, route }) => {
    const { supabase, user } = await requireOrgAccess(request, orgId, "admin");

    const limit = enforceRateLimit(`${orgId}:${user.id}:nudge_send`);
    if (!limit.allowed) {
      throw new ApiError(
        "RATE_LIMITED",
        `Reminder rate limit reached. Retry in ${Math.ceil((limit.retryAfterMs ?? 0) / 1000)} seconds.`,
        429,
      );
    }

    const payload = await parseJsonBody<unknown>(request);
    const parsed = nudgeSendSchema.safeParse(payload);

    if (!parsed.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid reminder payload",
        400,
      );
    }

    let query = supabase
      .from("assignments")
      .select("id,user_id,state,organization_members!inner(email),learning_campaigns!inner(name)")
      .eq("org_id", orgId)
      .eq("campaign_id", campaignId)
      .in("state", ["assigned", "in_progress", "overdue"]);

    if (parsed.data.mode === "overdue_only") {
      query = query.eq("state", "overdue");
    }

    const assignmentsResult = await query;
    if (assignmentsResult.error) {
      throw new ApiError("DB_ERROR", assignmentsResult.error.message, 500);
    }

    const recipients = (assignmentsResult.data ?? []).map((item) => {
      const member = Array.isArray(item.organization_members)
        ? item.organization_members[0]
        : item.organization_members;
      const campaign = Array.isArray(item.learning_campaigns)
        ? item.learning_campaigns[0]
        : item.learning_campaigns;

      return {
        email: member?.email ?? "",
        assignmentId: item.id,
        campaignName: campaign?.name ?? "Compliance Campaign",
      };
    });

    const validRecipients = recipients.filter((recipient) => Boolean(recipient.email));
    const sentCount = await sendReminderEmail(validRecipients, requestId);

    if (sentCount > 0) {
      const notificationRows = validRecipients.map((recipient) => ({
        org_id: orgId,
        campaign_id: campaignId,
        assignment_id: recipient.assignmentId,
        recipient_email: recipient.email,
        notification_type: "reminder",
        status: "sent",
      }));
      const notificationInsert = await supabase.from("notification_jobs").insert(notificationRows);
      if (notificationInsert.error) {
        throw new ApiError("DB_ERROR", notificationInsert.error.message, 500);
      }
    }

    logInfo("nudges_sent", {
      request_id: requestId,
      route,
      org_id: orgId,
      user_id: user.id,
      event: ANALYTICS_EVENTS.nudgeSent,
      status_code: 200,
    });

    await writeRequestAuditLog({
      supabase,
      requestId,
      route,
      action: "nudge_send",
      statusCode: 200,
      orgId,
      userId: user.id,
      metadata: {
        campaignId,
        sentCount,
        mode: parsed.data.mode,
      },
    });

    return {
      ok: true,
      sentCount,
      mode: parsed.data.mode,
    };
  });
}
