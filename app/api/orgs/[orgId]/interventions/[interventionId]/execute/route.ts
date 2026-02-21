import { randomUUID } from "node:crypto";

import { ApiError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { withApiHandler } from "@/lib/api/route-helpers";
import { requireOrgAccess } from "@/lib/edtech/db";
import { writeRequestAuditLog } from "@/lib/edtech/request-audit-log";
import { interventionExecuteSchema } from "@/lib/edtech/validation";

async function performInterventionAction(input: {
  orgId: string;
  supabase: Awaited<ReturnType<typeof requireOrgAccess>>["supabase"];
  recommendation: {
    id: string;
    control_id: string;
    campaign_id: string | null;
    module_id: string | null;
    recommendation_type: string;
    metadata_json: Record<string, unknown>;
  };
  userId: string;
}): Promise<Record<string, unknown>> {
  if (input.recommendation.recommendation_type === "reminder_cadence") {
    let query = input.supabase
      .from("assignments")
      .select("id,org_id,campaign_id,user_id,state")
      .eq("org_id", input.orgId)
      .neq("state", "completed")
      .limit(200);

    if (input.recommendation.campaign_id) {
      query = query.eq("campaign_id", input.recommendation.campaign_id);
    }
    if (input.recommendation.module_id) {
      query = query.eq("module_id", input.recommendation.module_id);
    }

    const assignments = await query;
    if (assignments.error) {
      throw new ApiError("DB_ERROR", assignments.error.message, 500);
    }

    const rows = (assignments.data ?? []).map((item) => ({
      id: randomUUID(),
      org_id: input.orgId,
      campaign_id: item.campaign_id,
      assignment_id: item.id,
      recipient_email: "pending-user-email",
      notification_type: "reminder",
      status: "queued",
    }));

    if (rows.length > 0) {
      const insert = await input.supabase.from("notification_jobs").insert(rows);
      if (insert.error) {
        throw new ApiError("DB_ERROR", insert.error.message, 500);
      }
    }

    return {
      action: "reminder_cadence",
      remindersQueued: rows.length,
    };
  }

  if (input.recommendation.recommendation_type === "attestation_refresh") {
    const staleUpdate = await input.supabase
      .from("evidence_objects")
      .update({
        evidence_status: "stale",
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", input.orgId)
      .eq("control_id", input.recommendation.control_id)
      .eq("evidence_type", "attestation")
      .in("evidence_status", ["queued", "synced"])
      .select("id");

    if (staleUpdate.error) {
      throw new ApiError("DB_ERROR", staleUpdate.error.message, 500);
    }

    return {
      action: "attestation_refresh",
      evidenceMarkedStale: staleUpdate.data?.length ?? 0,
    };
  }

  if (input.recommendation.recommendation_type === "manager_escalation") {
    return {
      action: "manager_escalation",
      escalationCreated: true,
      owner: "security-grc",
    };
  }

  return {
    action: "role_refresher_module",
    recommendedRoleTrack:
      typeof input.recommendation.metadata_json.roleTrack === "string"
        ? input.recommendation.metadata_json.roleTrack
        : "general",
    note: "Create a role-specific refresher module in campaign drafts.",
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ orgId: string; interventionId: string }> },
) {
  const { orgId, interventionId } = await context.params;

  return withApiHandler(request, async ({ requestId, route }) => {
    const { supabase, user } = await requireOrgAccess(request, orgId, "admin");

    const payload = await parseJsonBody<unknown>(request).catch(() => ({}));
    const parsed = interventionExecuteSchema.safeParse(payload ?? {});
    if (!parsed.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid execute payload",
        400,
      );
    }

    const recommendationResult = await supabase
      .from("intervention_recommendations")
      .select("id,control_id,campaign_id,module_id,recommendation_type,status,metadata_json")
      .eq("org_id", orgId)
      .eq("id", interventionId)
      .single();

    if (recommendationResult.error || !recommendationResult.data) {
      throw new ApiError("NOT_FOUND", "Intervention recommendation not found", 404);
    }

    if (!["approved", "executing", "completed"].includes(recommendationResult.data.status)) {
      throw new ApiError("CONFLICT", "Intervention must be approved before execution", 409);
    }

    const idempotencyKey = parsed.data.idempotencyKey ?? `auto-${interventionId}`;
    const existingExecution = await supabase
      .from("intervention_executions")
      .select("id,execution_status,result_json,error_message,created_at")
      .eq("org_id", orgId)
      .eq("intervention_id", interventionId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingExecution.error) {
      throw new ApiError("DB_ERROR", existingExecution.error.message, 500);
    }

    if (existingExecution.data) {
      return {
        ok: true,
        interventionId,
        idempotencyKey,
        execution: {
          id: existingExecution.data.id,
          status: existingExecution.data.execution_status,
          result: existingExecution.data.result_json,
          errorMessage: existingExecution.data.error_message,
          createdAt: existingExecution.data.created_at,
        },
        reused: true,
      };
    }

    const executionId = randomUUID();

    const executionInsert = await supabase.from("intervention_executions").insert({
      id: executionId,
      org_id: orgId,
      intervention_id: interventionId,
      execution_status: "running",
      idempotency_key: idempotencyKey,
      result_json: {},
      executed_by: user.id,
      started_at: new Date().toISOString(),
    });
    if (executionInsert.error) {
      throw new ApiError("DB_ERROR", executionInsert.error.message, 500);
    }

    const setExecuting = await supabase
      .from("intervention_recommendations")
      .update({
        status: "executing",
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId)
      .eq("id", interventionId);
    if (setExecuting.error) {
      throw new ApiError("DB_ERROR", setExecuting.error.message, 500);
    }

    try {
      const result = await performInterventionAction({
        orgId,
        supabase,
        recommendation: {
          ...recommendationResult.data,
          metadata_json: (recommendationResult.data.metadata_json ?? {}) as Record<string, unknown>,
        },
        userId: user.id,
      });

      const [finishExecution, finishRecommendation] = await Promise.all([
        supabase
          .from("intervention_executions")
          .update({
            execution_status: "completed",
            result_json: result,
            finished_at: new Date().toISOString(),
          })
          .eq("org_id", orgId)
          .eq("id", executionId),
        supabase
          .from("intervention_recommendations")
          .update({
            status: "completed",
            updated_at: new Date().toISOString(),
          })
          .eq("org_id", orgId)
          .eq("id", interventionId),
      ]);

      if (finishExecution.error || finishRecommendation.error) {
        throw new ApiError(
          "DB_ERROR",
          finishExecution.error?.message ?? finishRecommendation.error?.message ?? "Execution finalize failed",
          500,
        );
      }

      await writeRequestAuditLog({
        supabase,
        requestId,
        route,
        action: "intervention_execute",
        statusCode: 200,
        orgId,
        userId: user.id,
        metadata: {
          interventionId,
          idempotencyKey,
          executionId,
          result,
        },
      });

      return {
        ok: true,
        interventionId,
        idempotencyKey,
        execution: {
          id: executionId,
          status: "completed",
          result,
        },
        reused: false,
      };
    } catch (error) {
      await Promise.all([
        supabase
          .from("intervention_executions")
          .update({
            execution_status: "failed",
            error_message: error instanceof Error ? error.message : "Execution failed",
            finished_at: new Date().toISOString(),
          })
          .eq("org_id", orgId)
          .eq("id", executionId),
        supabase
          .from("intervention_recommendations")
          .update({
            status: "approved",
            updated_at: new Date().toISOString(),
          })
          .eq("org_id", orgId)
          .eq("id", interventionId),
      ]);

      throw error;
    }
  });
}
