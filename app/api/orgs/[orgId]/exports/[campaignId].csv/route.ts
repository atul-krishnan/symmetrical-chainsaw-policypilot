import { ApiError, toErrorResponse } from "@/lib/api/errors";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { buildCampaignCsv } from "@/lib/edtech/audit-export";
import { buildAttestationChecksum } from "@/lib/edtech/attestation";
import { requireOrgAccess } from "@/lib/edtech/db";
import { createEvidenceObjects } from "@/lib/edtech/evidence";
import { writeRequestAuditLog } from "@/lib/edtech/request-audit-log";
import {
  isMissingOptionalSchemaError,
  shouldIgnoreOptionalSchemaErrors,
} from "@/lib/edtech/schema-compat";
import { logError, logInfo } from "@/lib/observability/logger";
import { createRequestContext } from "@/lib/observability/request-context";

export async function GET(
  request: Request,
  context: { params: Promise<{ orgId: string; campaignId: string }> },
) {
  const { orgId, campaignId } = await context.params;
  const routeContext = createRequestContext(request);

  try {
    const { supabase, user } = await requireOrgAccess(request, orgId, "admin");

    const [
      campaignResult,
      assignmentResult,
      attemptResult,
      attestationResult,
      mappingsResult,
      syncEventsResult,
    ] = await Promise.all([
      supabase
        .from("learning_campaigns")
        .select("id,name")
        .eq("id", campaignId)
        .eq("org_id", orgId)
        .single(),
      supabase
        .from("assignments")
        .select("id,user_id,module_id,state,completed_at")
        .eq("org_id", orgId)
        .eq("campaign_id", campaignId),
      supabase
        .from("module_attempts")
        .select("user_id,module_id,score_pct,passed,created_at")
        .eq("org_id", orgId)
        .eq("campaign_id", campaignId),
      supabase
        .from("attestations")
        .select("user_id,created_at,checksum")
        .eq("org_id", orgId)
        .eq("campaign_id", campaignId),
      supabase
        .from("control_mappings")
        .select("control_id,campaign_id,module_id,active")
        .eq("org_id", orgId)
        .eq("active", true),
      supabase
        .from("integration_sync_events")
        .select("evidence_object_id,provider,status,created_at")
        .eq("org_id", orgId),
    ]);

    if (campaignResult.error || !campaignResult.data) {
      throw new ApiError("NOT_FOUND", "Campaign not found", 404);
    }

    if (assignmentResult.error || attemptResult.error || attestationResult.error) {
      throw new ApiError(
        "DB_ERROR",
        assignmentResult.error?.message ??
          attemptResult.error?.message ??
          attestationResult.error?.message ??
          "Export query failed",
        500,
      );
    }

    const optionalSchemaErrors = [mappingsResult.error, syncEventsResult.error];
    const optionalSchemaMissing = shouldIgnoreOptionalSchemaErrors(optionalSchemaErrors);

    if (optionalSchemaErrors.some((item) => Boolean(item)) && !optionalSchemaMissing) {
      throw new ApiError(
        "DB_ERROR",
        mappingsResult.error?.message ??
          syncEventsResult.error?.message ??
          "Export query failed",
        500,
      );
    }

    const assignments = assignmentResult.data ?? [];
    const attempts = attemptResult.data ?? [];
    const attestations = attestationResult.data ?? [];
    const mappings = optionalSchemaMissing ? [] : mappingsResult.data ?? [];

    const controlIdsByModule = new Map<string, string[]>();
    const controlIdsByCampaign = new Map<string, string[]>();
    for (const mapping of mappings) {
      if (mapping.module_id) {
        const existing = controlIdsByModule.get(mapping.module_id) ?? [];
        existing.push(mapping.control_id);
        controlIdsByModule.set(mapping.module_id, existing);
      }
      if (mapping.campaign_id) {
        const existing = controlIdsByCampaign.get(mapping.campaign_id) ?? [];
        existing.push(mapping.control_id);
        controlIdsByCampaign.set(mapping.campaign_id, existing);
      }
    }

    const latestSyncByProvider = new Map<string, string>();
    for (const event of (optionalSchemaMissing ? [] : syncEventsResult.data ?? [])) {
      if (!latestSyncByProvider.has(event.provider)) {
        latestSyncByProvider.set(event.provider, event.status);
      }
    }
    const syncStatus =
      latestSyncByProvider.size > 0
        ? Array.from(latestSyncByProvider.entries())
            .map(([provider, status]) => `${provider}:${status}`)
            .join("|")
        : "";

    const rows = assignments.map((assignment) => {
      const latestAttempt = attempts
        .filter(
          (attempt) =>
            attempt.user_id === assignment.user_id && attempt.module_id === assignment.module_id,
        )
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      const attestation = attestations.find((item) => item.user_id === assignment.user_id);

      const moduleControlIds = controlIdsByModule.get(assignment.module_id) ?? [];
      const campaignControlIds = controlIdsByCampaign.get(campaignId) ?? [];
      const controlIds = Array.from(new Set([...moduleControlIds, ...campaignControlIds]));

      return {
        assignment_id: assignment.id,
        user_id: assignment.user_id,
        module_id: assignment.module_id,
        control_ids: controlIds.join("|"),
        state: assignment.state,
        completed_at: assignment.completed_at ?? "",
        latest_score_pct: latestAttempt?.score_pct ?? "",
        latest_passed: latestAttempt?.passed ?? "",
        attested_at: attestation?.created_at ?? "",
        attestation_checksum: attestation?.checksum ?? "",
        sync_status: syncStatus,
      };
    });

    const csv = buildCampaignCsv(rows);
    const checksum = buildAttestationChecksum({ campaignId, rowsCount: rows.length, csv });

    const exportInsert = await supabase
      .from("audit_exports")
      .insert({
        org_id: orgId,
        campaign_id: campaignId,
        file_type: "csv",
        checksum,
        generated_by: user.id,
      })
      .select("id")
      .single();

    if (exportInsert.error || !exportInsert.data) {
      throw new ApiError("DB_ERROR", exportInsert.error?.message ?? "Export insert failed", 500);
    }

    try {
      await createEvidenceObjects({
        supabase,
        orgId,
        campaignId,
        userId: user.id,
        evidenceType: "campaign_export",
        sourceTable: "audit_exports",
        sourceId: exportInsert.data.id,
        confidenceScore: 0.99,
        qualityScore: 96,
        metadata: {
          exportType: "csv",
          checksum,
          rowsCount: rows.length,
        },
      });
    } catch (error) {
      if (!isMissingOptionalSchemaError(error)) {
        throw error;
      }
    }

    await writeRequestAuditLog({
      supabase,
      requestId: routeContext.requestId,
      route: routeContext.route,
      action: "export_csv",
      statusCode: 200,
      orgId,
      userId: user.id,
      metadata: {
        campaignId,
        checksum,
      },
    });

    logInfo("csv_export_generated", {
      request_id: routeContext.requestId,
      route: routeContext.route,
      org_id: orgId,
      user_id: user.id,
      event: ANALYTICS_EVENTS.exportGenerated,
      status_code: 200,
    });

    return new Response(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${campaignId}-audit.csv"`,
        "x-request-id": routeContext.requestId,
        "x-evidence-checksum": checksum,
      },
    });
  } catch (error) {
    const response = toErrorResponse(error, routeContext.requestId);

    logError("csv_export_failed", {
      request_id: routeContext.requestId,
      route: routeContext.route,
      status_code: response.status,
      error_code: error instanceof ApiError ? error.code : "INTERNAL_ERROR",
      error,
    });

    response.headers.set("x-request-id", routeContext.requestId);
    return response;
  }
}
