import { ApiError } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/route-helpers";
import { computeCampaignMetrics } from "@/lib/edtech/dashboard";
import { requireOrgAccess } from "@/lib/edtech/db";
import { writeRequestAuditLog } from "@/lib/edtech/request-audit-log";

export async function GET(
  request: Request,
  context: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await context.params;

  return withApiHandler(request, async ({ requestId, route }) => {
    const { supabase, user } = await requireOrgAccess(request, orgId, "manager");

    const campaignResult = await supabase
      .from("learning_campaigns")
      .select("id,name")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (campaignResult.error) {
      throw new ApiError("DB_ERROR", campaignResult.error.message, 500);
    }

    const campaigns = campaignResult.data ?? [];
    const campaignMetrics = await Promise.all(
      campaigns.map(async (campaign) => {
        const [assignments, attempts, attestations] = await Promise.all([
          supabase
            .from("assignments")
            .select("id,state")
            .eq("org_id", orgId)
            .eq("campaign_id", campaign.id),
          supabase
            .from("module_attempts")
            .select("score_pct")
            .eq("org_id", orgId)
            .eq("campaign_id", campaign.id),
          supabase
            .from("attestations")
            .select("id")
            .eq("org_id", orgId)
            .eq("campaign_id", campaign.id),
        ]);

        if (assignments.error || attempts.error || attestations.error) {
          throw new ApiError(
            "DB_ERROR",
            assignments.error?.message ?? attempts.error?.message ?? attestations.error?.message ?? "Failed to load dashboard metrics",
            500,
          );
        }

        const assignmentRows = assignments.data ?? [];
        const attemptsRows = attempts.data ?? [];
        const attestationRows = attestations.data ?? [];

        const averageScore =
          attemptsRows.length > 0
            ? attemptsRows.reduce((total, attempt) => total + attempt.score_pct, 0) /
            attemptsRows.length
            : 0;

        const metrics = computeCampaignMetrics({
          campaignId: campaign.id,
          assignmentsTotal: assignmentRows.length,
          assignmentsCompleted: assignmentRows.filter((item) => item.state === "completed").length,
          attestationsCount: attestationRows.length,
          averageScore,
        });

        return {
          name: campaign.name,
          ...metrics,
        };
      }),
    );

    // At-risk learners: overdue or still pending
    const atRiskResult = await supabase
      .from("assignments")
      .select(
        "id,user_id,state,due_at,learning_modules!inner(title,role_track)",
      )
      .eq("org_id", orgId)
      .neq("state", "completed")
      .not("due_at", "is", null)
      .lt("due_at", new Date().toISOString())
      .order("due_at", { ascending: true })
      .limit(50);

    const atRiskLearners = (atRiskResult.data ?? []).map((row) => {
      const mod = Array.isArray(row.learning_modules)
        ? row.learning_modules[0]
        : row.learning_modules;
      const dueDate = row.due_at ? new Date(row.due_at) : null;
      const daysOverdue = dueDate
        ? Math.max(0, Math.ceil((Date.now() - dueDate.getTime()) / 86400000))
        : 0;

      return {
        assignmentId: row.id,
        userId: row.user_id,
        state: row.state,
        dueAt: row.due_at,
        daysOverdue,
        moduleTitle: mod?.title ?? "Unknown",
        roleTrack: mod?.role_track ?? "general",
      };
    });

    await writeRequestAuditLog({
      supabase,
      requestId,
      route,
      action: "dashboard_view",
      statusCode: 200,
      orgId,
      userId: user.id,
      metadata: {
        campaigns: campaignMetrics.length,
      },
    });

    return {
      orgId,
      campaigns: campaignMetrics,
      atRiskLearners,
    };
  });
}
