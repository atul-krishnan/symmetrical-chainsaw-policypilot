import { ApiError, toErrorResponse } from "@/lib/api/errors";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { buildSignedPdfSummary } from "@/lib/edtech/audit-export";
import { computeCampaignMetrics } from "@/lib/edtech/dashboard";
import { requireOrgAccess } from "@/lib/edtech/db";
import { writeRequestAuditLog } from "@/lib/edtech/request-audit-log";
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

    const [campaignResult, assignmentResult, attemptResult, attestationResult, orgResult] =
      await Promise.all([
        supabase
          .from("learning_campaigns")
          .select("id,name")
          .eq("id", campaignId)
          .eq("org_id", orgId)
          .single(),
        supabase
          .from("assignments")
          .select("id,state")
          .eq("org_id", orgId)
          .eq("campaign_id", campaignId),
        supabase
          .from("module_attempts")
          .select("score_pct")
          .eq("org_id", orgId)
          .eq("campaign_id", campaignId),
        supabase
          .from("attestations")
          .select("id")
          .eq("org_id", orgId)
          .eq("campaign_id", campaignId),
        supabase.from("organizations").select("name").eq("id", orgId).single(),
      ]);

    if (campaignResult.error || !campaignResult.data) {
      throw new ApiError("NOT_FOUND", "Campaign not found", 404);
    }

    if (
      assignmentResult.error ||
      attemptResult.error ||
      attestationResult.error ||
      orgResult.error ||
      !orgResult.data
    ) {
      throw new ApiError(
        "DB_ERROR",
        assignmentResult.error?.message ??
          attemptResult.error?.message ??
          attestationResult.error?.message ??
          orgResult.error?.message ??
          "Export query failed",
        500,
      );
    }

    const assignments = assignmentResult.data ?? [];
    const attempts = attemptResult.data ?? [];
    const attestations = attestationResult.data ?? [];

    const averageScore =
      attempts.length > 0
        ? attempts.reduce((total, attempt) => total + attempt.score_pct, 0) / attempts.length
        : 0;

    const metrics = computeCampaignMetrics({
      campaignId,
      assignmentsTotal: assignments.length,
      assignmentsCompleted: assignments.filter((item) => item.state === "completed").length,
      attestationsCount: attestations.length,
      averageScore,
    });

    const pdf = await buildSignedPdfSummary({
      orgName: orgResult.data.name,
      campaignName: campaignResult.data.name,
      metrics,
      generatedAtIso: new Date().toISOString(),
      generatedBy: user.id,
    });

    const exportInsert = await supabase.from("audit_exports").insert({
      org_id: orgId,
      campaign_id: campaignId,
      file_type: "pdf",
      checksum: pdf.checksum,
      generated_by: user.id,
    });

    if (exportInsert.error) {
      throw new ApiError("DB_ERROR", exportInsert.error.message, 500);
    }

    await writeRequestAuditLog({
      supabase,
      requestId: routeContext.requestId,
      route: routeContext.route,
      action: "export_pdf",
      statusCode: 200,
      orgId,
      userId: user.id,
      metadata: {
        campaignId,
        checksum: pdf.checksum,
      },
    });

    logInfo("pdf_export_generated", {
      request_id: routeContext.requestId,
      route: routeContext.route,
      org_id: orgId,
      user_id: user.id,
      event: ANALYTICS_EVENTS.exportGenerated,
      status_code: 200,
    });

    return new Response(Buffer.from(pdf.bytes), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${campaignId}-summary.pdf"`,
        "x-request-id": routeContext.requestId,
        "x-evidence-checksum": pdf.checksum,
      },
    });
  } catch (error) {
    const response = toErrorResponse(error, routeContext.requestId);

    logError("pdf_export_failed", {
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
