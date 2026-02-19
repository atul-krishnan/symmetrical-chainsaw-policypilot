import { ApiError } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/route-helpers";
import { requireOrgAccess } from "@/lib/edtech/db";
import { writeRequestAuditLog } from "@/lib/edtech/request-audit-log";
import { shouldIgnoreOptionalSchemaErrors } from "@/lib/edtech/schema-compat";
import { integrationProviderSchema } from "@/lib/edtech/validation";

export async function GET(
  request: Request,
  context: { params: Promise<{ orgId: string; provider: string }> },
) {
  const { orgId, provider } = await context.params;

  return withApiHandler(request, async ({ requestId, route }) => {
    const { supabase, user } = await requireOrgAccess(request, orgId, "manager");

    const providerParsed = integrationProviderSchema.safeParse(provider);
    if (!providerParsed.success) {
      throw new ApiError("VALIDATION_ERROR", "Unsupported integration provider", 400);
    }

    const [connectionResult, jobsResult] = await Promise.all([
      supabase
        .from("integration_connections")
        .select("id,provider,status,scopes_json,config_json,health_message,last_sync_at,updated_at")
        .eq("org_id", orgId)
        .eq("provider", providerParsed.data)
        .maybeSingle(),
      supabase
        .from("integration_sync_jobs")
        .select("id,status,trigger,stats_json,error_message,started_at,finished_at,created_at")
        .eq("org_id", orgId)
        .eq("provider", providerParsed.data)
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

    const optionalSchemaMissing = shouldIgnoreOptionalSchemaErrors([
      connectionResult.error,
      jobsResult.error,
    ]);

    if ((connectionResult.error || jobsResult.error) && !optionalSchemaMissing) {
      throw new ApiError(
        "DB_ERROR",
        connectionResult.error?.message ?? jobsResult.error?.message ?? "Failed to load sync jobs",
        500,
      );
    }

    const jobs = optionalSchemaMissing ? [] : jobsResult.data ?? [];

    const jobIds = jobs.map((job) => job.id);
    const latestEventsByJob = new Map<string, { provider: string; status: string; createdAt: string }>();

    if (jobIds.length > 0) {
      const eventsResult = await supabase
        .from("integration_sync_events")
        .select("sync_job_id,provider,status,created_at")
        .eq("org_id", orgId)
        .eq("provider", providerParsed.data)
        .in("sync_job_id", jobIds)
        .order("created_at", { ascending: false });

      if (eventsResult.error) {
        if (!shouldIgnoreOptionalSchemaErrors([eventsResult.error])) {
          throw new ApiError("DB_ERROR", eventsResult.error.message, 500);
        }
      }

      for (const event of eventsResult.data ?? []) {
        if (!latestEventsByJob.has(event.sync_job_id)) {
          latestEventsByJob.set(event.sync_job_id, {
            provider: event.provider,
            status: event.status,
            createdAt: event.created_at,
          });
        }
      }
    }

    await writeRequestAuditLog({
      supabase,
      requestId,
      route,
      action: "integration_sync_jobs_view",
      statusCode: 200,
      orgId,
      userId: user.id,
      metadata: {
        provider: providerParsed.data,
        jobs: jobs.length,
      },
    });

    return {
      orgId,
      provider: providerParsed.data,
      connection: connectionResult.data
        ? {
            provider: connectionResult.data.provider,
            status: connectionResult.data.status,
            scopes: Array.isArray(connectionResult.data.scopes_json)
              ? connectionResult.data.scopes_json
              : [],
            credentialLast4:
              typeof connectionResult.data.config_json === "object" &&
              connectionResult.data.config_json !== null &&
              "credentialLast4" in connectionResult.data.config_json
                ? (connectionResult.data.config_json as { credentialLast4?: string })
                    .credentialLast4 ?? null
                : null,
            healthMessage: connectionResult.data.health_message,
            lastSyncAt: connectionResult.data.last_sync_at,
            updatedAt: connectionResult.data.updated_at,
          }
        : null,
      migrationPending: optionalSchemaMissing,
      jobs: jobs.map((job) => ({
        id: job.id,
        status: job.status,
        trigger: job.trigger,
        stats: job.stats_json,
        errorMessage: job.error_message,
        startedAt: job.started_at,
        finishedAt: job.finished_at,
        createdAt: job.created_at,
        latestEvent: latestEventsByJob.get(job.id) ?? null,
      })),
    };
  });
}
