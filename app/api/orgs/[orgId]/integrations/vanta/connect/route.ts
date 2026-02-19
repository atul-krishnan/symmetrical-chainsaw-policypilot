import { ApiError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { withApiHandler } from "@/lib/api/route-helpers";
import { requireOrgAccess } from "@/lib/edtech/db";
import { upsertIntegrationConnection } from "@/lib/edtech/integration-connect";
import { writeRequestAuditLog } from "@/lib/edtech/request-audit-log";
import { isMissingOptionalSchemaError } from "@/lib/edtech/schema-compat";
import { integrationConnectSchema } from "@/lib/edtech/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await context.params;

  return withApiHandler(request, async ({ requestId, route }) => {
    const { supabase, user } = await requireOrgAccess(request, orgId, "admin");

    const payload = await parseJsonBody<unknown>(request);
    const parsed = integrationConnectSchema.safeParse(payload);

    if (!parsed.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid Vanta connection payload",
        400,
      );
    }

    let connection;
    try {
      connection = await upsertIntegrationConnection({
        supabase,
        orgId,
        provider: "vanta",
        userId: user.id,
        apiKey: parsed.data.apiKey,
        accountId: parsed.data.accountId,
        workspaceId: parsed.data.workspaceId,
        scopes: parsed.data.scopes,
      });
    } catch (error) {
      if (isMissingOptionalSchemaError(error)) {
        throw new ApiError(
          "CONFLICT",
          "Controls & integrations schema is not applied yet. Run migration 20260220_edtech_controls_integrations.sql.",
          409,
        );
      }
      throw error;
    }

    await writeRequestAuditLog({
      supabase,
      requestId,
      route,
      action: "integration_connect",
      statusCode: 200,
      orgId,
      userId: user.id,
      metadata: {
        provider: "vanta",
        scopes: connection.scopes,
      },
    });

    return {
      ok: true,
      connection,
    };
  });
}
