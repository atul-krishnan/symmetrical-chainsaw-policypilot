import { ApiError } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/route-helpers";
import { summarizeFreshness } from "@/lib/edtech/adoption-intelligence";
import { loadControlFreshness, resolveBenchmarkDelta } from "@/lib/edtech/adoption-store";
import { requireOrgAccess } from "@/lib/edtech/db";
import { writeRequestAuditLog } from "@/lib/edtech/request-audit-log";
import { adoptionFreshnessQuerySchema } from "@/lib/edtech/validation";

export async function GET(
  request: Request,
  context: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await context.params;

  return withApiHandler(request, async ({ requestId, route }) => {
    const { supabase, user } = await requireOrgAccess(request, orgId, "manager");

    const url = new URL(request.url);
    const parsedQuery = adoptionFreshnessQuerySchema.safeParse({
      window: url.searchParams.get("window") ?? undefined,
    });

    if (!parsedQuery.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsedQuery.error.issues[0]?.message ?? "Invalid freshness query",
        400,
      );
    }

    const loaded = await loadControlFreshness({
      supabase,
      orgId,
    });

    const computed = Array.from(loaded.computedByControlId.values());
    const summary = summarizeFreshness(computed);
    const benchmark = await resolveBenchmarkDelta({
      supabase,
      orgId,
      metricName: "control_freshness",
    });

    await writeRequestAuditLog({
      supabase,
      requestId,
      route,
      action: "adoption_freshness_view",
      statusCode: 200,
      orgId,
      userId: user.id,
      metadata: {
        controls: loaded.controls.length,
        windowDays: parsedQuery.data.window ?? 30,
      },
    });

    return {
      orgId,
      windowDays: parsedQuery.data.window ?? 30,
      summary,
      benchmark,
      items: loaded.controls.map((control) => {
        const freshness = loaded.computedByControlId.get(control.id);
        const trend = loaded.trendByControlId.get(control.id) ?? [];
        return {
          controlId: control.id,
          controlCode: control.code,
          controlTitle: control.title,
          riskLevel: control.risk_level,
          mappedCampaignIds: loaded.mappedCampaignIdsByControlId.get(control.id) ?? [],
          mappedModuleIds: loaded.mappedModuleIdsByControlId.get(control.id) ?? [],
          freshness: freshness
            ? {
                state: freshness.state,
                score: freshness.score,
                latestEvidenceAt: freshness.latestEvidenceAt,
                lastPolicyUpdateAt: freshness.lastPolicyUpdateAt,
                syncedCount: freshness.syncedCount,
                staleCount: freshness.staleCount,
                rejectedCount: freshness.rejectedCount,
                freshEvidenceCount: freshness.freshEvidenceCount,
                medianAckHours: freshness.medianAckHours,
              }
            : null,
          trend,
        };
      }),
    };
  });
}
