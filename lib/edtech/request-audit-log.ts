import type { SupabaseClient } from "@supabase/supabase-js";

import { logError, logInfo } from "@/lib/observability/logger";

export async function writeRequestAuditLog(input: {
  supabase: SupabaseClient;
  requestId: string;
  orgId?: string;
  userId?: string;
  route: string;
  action: string;
  statusCode: number;
  errorCode?: string;
  metadata?: Record<string, unknown>;
  expectOrgContext?: boolean;
}): Promise<void> {
  const shouldLogMissingOrgContext =
    !input.orgId && (input.expectOrgContext ?? input.route.startsWith("/api/orgs/"));

  if (shouldLogMissingOrgContext) {
    logInfo("request_audit_log_missing_org_context", {
      request_id: input.requestId,
      route: input.route,
      user_id: input.userId,
      status_code: input.statusCode,
      event: "org_context_missing",
    });
  }

  const { error } = await input.supabase.from("request_audit_logs").insert({
    request_id: input.requestId,
    org_id: input.orgId ?? null,
    user_id: input.userId ?? null,
    route: input.route,
    action: input.action,
    status_code: input.statusCode,
    error_code: input.errorCode ?? null,
    metadata_json: input.metadata ?? {},
  });

  if (error) {
    logError("request_audit_log_write_failed", {
      request_id: input.requestId,
      route: input.route,
      org_id: input.orgId,
      user_id: input.userId,
      status_code: input.statusCode,
      error_code: "DB_ERROR",
      error,
    });
  }
}
