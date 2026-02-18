import { ApiError } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/route-helpers";
import { requireUserAndClient } from "@/lib/edtech/db";
import { writeRequestAuditLog } from "@/lib/edtech/request-audit-log";

export async function GET(request: Request) {
  return withApiHandler(request, async ({ requestId, route }) => {
    const { supabase, user } = await requireUserAndClient(request);

    const result = await supabase
      .from("assignments")
      .select(
        "id,state,due_at,module_id,campaign_id,learning_modules!inner(id,title,role_track,campaign_id)",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (result.error) {
      throw new ApiError("DB_ERROR", result.error.message, 500);
    }

    const items = (result.data ?? []).map((item) => {
      const moduleData = Array.isArray(item.learning_modules)
        ? item.learning_modules[0]
        : item.learning_modules;

      return {
        id: item.id,
        state: item.state,
        dueAt: item.due_at,
        module: {
          id: moduleData?.id ?? "",
          title: moduleData?.title ?? "",
          roleTrack: moduleData?.role_track ?? "general",
          campaignId: moduleData?.campaign_id ?? "",
        },
      };
    });

    await writeRequestAuditLog({
      supabase,
      requestId,
      route,
      action: "assignments_view",
      statusCode: 200,
      userId: user.id,
      metadata: {
        assignmentCount: items.length,
      },
    });

    return { items };
  });
}
