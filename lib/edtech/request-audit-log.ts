import type { SupabaseClient } from "@supabase/supabase-js";

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
}): Promise<void> {
  await input.supabase.from("request_audit_logs").insert({
    request_id: input.requestId,
    org_id: input.orgId ?? null,
    user_id: input.userId ?? null,
    route: input.route,
    action: input.action,
    status_code: input.statusCode,
    error_code: input.errorCode ?? null,
    metadata_json: input.metadata ?? {},
  });
}
