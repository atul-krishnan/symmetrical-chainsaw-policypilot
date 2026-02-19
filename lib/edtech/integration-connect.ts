import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/errors";
import { maskApiKey } from "@/lib/edtech/integration-sync";

export async function upsertIntegrationConnection(input: {
  supabase: SupabaseClient;
  orgId: string;
  provider: "vanta" | "drata";
  userId: string;
  apiKey: string;
  accountId?: string;
  workspaceId?: string;
  scopes?: string[];
}): Promise<{
  provider: "vanta" | "drata";
  status: "connected";
  scopes: string[];
  apiKeyLast4: string;
}> {
  const masked = maskApiKey(input.apiKey);

  const defaultScopes =
    input.provider === "vanta"
      ? ["evidence.write", "controls.read"]
      : ["evidence.write", "frameworks.read"];

  const scopes = input.scopes && input.scopes.length > 0 ? input.scopes : defaultScopes;

  const result = await input.supabase
    .from("integration_connections")
    .upsert(
      {
        org_id: input.orgId,
        provider: input.provider,
        status: "connected",
        scopes_json: scopes,
        config_json: {
          credentialHash: masked.hash,
          credentialLast4: masked.last4,
          accountId: input.accountId ?? null,
          workspaceId: input.workspaceId ?? null,
        },
        health_message: "Connected",
        updated_by: input.userId,
        created_by: input.userId,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "org_id,provider",
      },
    );

  if (result.error) {
    throw new ApiError("DB_ERROR", result.error.message, 500);
  }

  return {
    provider: input.provider,
    status: "connected",
    scopes,
    apiKeyLast4: masked.last4,
  };
}
