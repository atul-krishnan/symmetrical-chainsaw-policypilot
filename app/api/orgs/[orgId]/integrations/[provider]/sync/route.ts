import { ApiError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { withApiHandler } from "@/lib/api/route-helpers";
import { requireOrgAccess } from "@/lib/edtech/db";
import { runIntegrationEvidenceSync } from "@/lib/edtech/integration-sync";
import { writeRequestAuditLog } from "@/lib/edtech/request-audit-log";
import { integrationProviderSchema, integrationSyncSchema } from "@/lib/edtech/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ orgId: string; provider: string }> },
) {
  const { orgId, provider } = await context.params;

  return withApiHandler(request, async ({ requestId, route }) => {
    const { supabase, user } = await requireOrgAccess(request, orgId, "admin");

    const providerParsed = integrationProviderSchema.safeParse(provider);
    if (!providerParsed.success) {
      throw new ApiError("VALIDATION_ERROR", "Unsupported integration provider", 400);
    }

    const payload = await parseJsonBody<unknown>(request).catch(() => ({}));
    const parsed = integrationSyncSchema.safeParse(payload ?? {});

    if (!parsed.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid sync payload",
        400,
      );
    }

    const result = await runIntegrationEvidenceSync({
      supabase,
      orgId,
      provider: providerParsed.data,
      userId: user.id,
      evidenceStatus: parsed.data.evidenceStatus,
      limit: parsed.data.limit,
    });

    await writeRequestAuditLog({
      supabase,
      requestId,
      route,
      action: "integration_sync",
      statusCode: 200,
      orgId,
      userId: user.id,
      metadata: {
        provider: providerParsed.data,
        syncJobId: result.syncJobId,
        attempted: result.attempted,
        synced: result.synced,
        rejected: result.rejected,
      },
    });

    return {
      ok: true,
      provider: providerParsed.data,
      ...result,
    };
  });
}
