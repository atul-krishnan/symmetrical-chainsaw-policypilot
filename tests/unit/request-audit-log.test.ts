import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { writeRequestAuditLog } from "@/lib/edtech/request-audit-log";
import { logError, logInfo } from "@/lib/observability/logger";

vi.mock("@/lib/observability/logger", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

function createSupabaseInsertMock(error: { message: string } | null = null) {
  const insert = vi.fn().mockResolvedValue({ error });

  return {
    supabase: {
      from: vi.fn().mockReturnValue({
        insert,
      }),
    },
    insert,
  };
}

describe("writeRequestAuditLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not emit missing-org telemetry for /api/me routes", async () => {
    const { supabase } = createSupabaseInsertMock();

    await writeRequestAuditLog({
      supabase: supabase as unknown as SupabaseClient,
      requestId: "req-1",
      route: "/api/me/assignments",
      action: "assignments_view",
      statusCode: 200,
      userId: "user-1",
      metadata: { assignmentCount: 0 },
    });

    expect(logInfo).not.toHaveBeenCalledWith(
      "request_audit_log_missing_org_context",
      expect.anything(),
    );
  });

  it("emits missing-org telemetry for org-scoped routes without org context", async () => {
    const { supabase } = createSupabaseInsertMock();

    await writeRequestAuditLog({
      supabase: supabase as unknown as SupabaseClient,
      requestId: "req-2",
      route: "/api/orgs/abc/dashboard",
      action: "dashboard_view",
      statusCode: 200,
      userId: "user-1",
    });

    expect(logInfo).toHaveBeenCalledWith(
      "request_audit_log_missing_org_context",
      expect.objectContaining({
        request_id: "req-2",
        route: "/api/orgs/abc/dashboard",
      }),
    );
  });

  it("emits DB error telemetry when audit insert fails", async () => {
    const { supabase } = createSupabaseInsertMock({ message: "insert failed" });

    await writeRequestAuditLog({
      supabase: supabase as unknown as SupabaseClient,
      requestId: "req-3",
      route: "/api/orgs/abc/dashboard",
      action: "dashboard_view",
      statusCode: 200,
      orgId: "org-1",
      userId: "user-1",
    });

    expect(logError).toHaveBeenCalledWith(
      "request_audit_log_write_failed",
      expect.objectContaining({
        request_id: "req-3",
        route: "/api/orgs/abc/dashboard",
        org_id: "org-1",
      }),
    );
  });
});
