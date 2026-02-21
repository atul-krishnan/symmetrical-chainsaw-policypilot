import { ApiError } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/route-helpers";
import {
  isAdoptionIntelligenceSchemaMissingError,
  resolveBenchmarkDelta,
} from "@/lib/edtech/adoption-store";
import { requireOrgAccess } from "@/lib/edtech/db";
import { writeRequestAuditLog } from "@/lib/edtech/request-audit-log";
import { benchmarkQuerySchema } from "@/lib/edtech/validation";

export async function GET(
  request: Request,
  context: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await context.params;

  return withApiHandler(request, async ({ requestId, route }) => {
    const { supabase, user } = await requireOrgAccess(request, orgId, "manager");

    const url = new URL(request.url);
    const parsedQuery = benchmarkQuerySchema.safeParse({
      metric: url.searchParams.get("metric") ?? undefined,
      cohort: url.searchParams.get("cohort") ?? undefined,
      window: url.searchParams.get("window") ?? undefined,
    });

    if (!parsedQuery.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsedQuery.error.issues[0]?.message ?? "Invalid benchmark query",
        400,
      );
    }

    const [cohortsResult, metric] = await Promise.all([
      supabase
        .from("benchmark_cohorts")
        .select("id,code,label,description,min_sample_size,active")
        .eq("active", true)
        .order("label", { ascending: true }),
      resolveBenchmarkDelta({
        supabase,
        orgId,
        metricName: parsedQuery.data.metric,
        cohortCode: parsedQuery.data.cohort,
      }),
    ]);

    let compatMode = metric.compatMode;
    if (cohortsResult.error && !isAdoptionIntelligenceSchemaMissingError(cohortsResult.error)) {
      throw new ApiError("DB_ERROR", cohortsResult.error.message, 500);
    }
    if (isAdoptionIntelligenceSchemaMissingError(cohortsResult.error)) {
      compatMode = true;
    }
    const cohorts = compatMode ? [] : (cohortsResult.data ?? []);

    await writeRequestAuditLog({
      supabase,
      requestId,
      route,
      action: "benchmark_view",
      statusCode: 200,
      orgId,
      userId: user.id,
      metadata: {
        metric: parsedQuery.data.metric,
        cohort: metric.cohortCode,
        compatMode,
      },
    });

    return {
      orgId,
      metric: parsedQuery.data.metric,
      windowDays: parsedQuery.data.window ?? 30,
      selectedCohort: metric.cohortCode,
      cohorts: cohorts.map((cohort) => ({
        id: cohort.id,
        code: cohort.code,
        label: cohort.label,
        description: cohort.description,
        minSampleSize: cohort.min_sample_size,
      })),
      result: metric,
      compatMode,
    };
  });
}
