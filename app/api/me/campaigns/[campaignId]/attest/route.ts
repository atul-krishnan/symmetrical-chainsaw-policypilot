import { randomUUID } from "node:crypto";

import { ApiError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { withApiHandler } from "@/lib/api/route-helpers";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { buildAttestationChecksum, buildAttestationMetadata } from "@/lib/edtech/attestation";
import { requireUserAndClient } from "@/lib/edtech/db";
import { createEvidenceObjects } from "@/lib/edtech/evidence";
import { enforceRateLimit } from "@/lib/edtech/rate-limit";
import { writeRequestAuditLog } from "@/lib/edtech/request-audit-log";
import { attestationSchema } from "@/lib/edtech/validation";
import { logInfo } from "@/lib/observability/logger";

export async function POST(
  request: Request,
  context: { params: Promise<{ campaignId: string }> },
) {
  const { campaignId } = await context.params;

  return withApiHandler(request, async ({ requestId, route }) => {
    const { user, supabase } = await requireUserAndClient(request);

    const limit = enforceRateLimit(`${user.id}:attest:${campaignId}`);
    if (!limit.allowed) {
      throw new ApiError(
        "RATE_LIMITED",
        `Attestation rate limit reached. Retry in ${Math.ceil((limit.retryAfterMs ?? 0) / 1000)} seconds.`,
        429,
      );
    }

    const payload = await parseJsonBody<unknown>(request);
    const parsed = attestationSchema.safeParse(payload);

    if (!parsed.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid attestation payload",
        400,
      );
    }

    const campaignResult = await supabase
      .from("learning_campaigns")
      .select("id,org_id,status")
      .eq("id", campaignId)
      .single();

    if (campaignResult.error || !campaignResult.data) {
      throw new ApiError("NOT_FOUND", "Campaign not found", 404);
    }

    const completedAssignmentResult = await supabase
      .from("assignments")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("org_id", campaignResult.data.org_id)
      .eq("user_id", user.id)
      .eq("state", "completed")
      .limit(1)
      .single();

    if (completedAssignmentResult.error || !completedAssignmentResult.data) {
      throw new ApiError(
        "CONFLICT",
        "You must complete at least one module before attesting.",
        409,
      );
    }

    const acceptedAtIso = new Date().toISOString();
    const metadata = buildAttestationMetadata({
      campaignId,
      userId: user.id,
      signatureName: parsed.data.signatureName,
      acceptedAtIso,
      userAgent: request.headers.get("user-agent") ?? "unknown",
      ipAddress: request.headers.get("x-forwarded-for") ?? "0.0.0.0",
    });

    const checksum = buildAttestationChecksum(metadata);

    const upsertResult = await supabase
      .from("attestations")
      .upsert(
        {
          id: randomUUID(),
          org_id: campaignResult.data.org_id,
          campaign_id: campaignId,
          user_id: user.id,
          signature_name: parsed.data.signatureName,
          accepted: true,
          checksum,
          metadata_json: metadata,
        },
        { onConflict: "campaign_id,user_id" },
      )
      .select("created_at")
      .single();

    if (upsertResult.error || !upsertResult.data) {
      throw new ApiError(
        "DB_ERROR",
        upsertResult.error?.message ?? "Attestation could not be saved",
        500,
      );
    }

    await createEvidenceObjects({
      supabase,
      orgId: campaignResult.data.org_id,
      campaignId,
      userId: user.id,
      evidenceType: "attestation",
      sourceTable: "attestations",
      sourceId: `${campaignId}:${user.id}`,
      occurredAtIso: acceptedAtIso,
      confidenceScore: 0.98,
      qualityScore: 96,
      metadata: {
        checksum,
        signatureName: parsed.data.signatureName,
      },
    });

    logInfo("attestation_completed", {
      request_id: requestId,
      route,
      org_id: campaignResult.data.org_id,
      user_id: user.id,
      event: ANALYTICS_EVENTS.attestationCompleted,
      status_code: 200,
    });

    await writeRequestAuditLog({
      supabase,
      requestId,
      route,
      action: "attestation_submit",
      statusCode: 200,
      orgId: campaignResult.data.org_id,
      userId: user.id,
      metadata: {
        campaignId,
        checksum,
      },
    });

    return {
      campaignId,
      attestedAt: upsertResult.data.created_at,
      checksum,
    };
  });
}
