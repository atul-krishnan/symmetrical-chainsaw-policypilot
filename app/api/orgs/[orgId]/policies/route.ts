import { randomUUID } from "node:crypto";

import { ApiError } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/route-helpers";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { runtimeEnv } from "@/lib/env";
import { enforceRateLimit } from "@/lib/edtech/rate-limit";
import { writeRequestAuditLog } from "@/lib/edtech/request-audit-log";
import { extractObligations, extractTextFromFile } from "@/lib/edtech/policy-parser";
import { policyUploadSchema, storageMimeSchema } from "@/lib/edtech/validation";
import { logInfo } from "@/lib/observability/logger";
import { requireOrgAccess } from "@/lib/edtech/db";

export async function GET(
  request: Request,
  context: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await context.params;

  return withApiHandler(request, async ({ requestId, route }) => {
    const { supabase, user } = await requireOrgAccess(request, orgId, "manager");

    const { data, error } = await supabase
      .from("policy_documents")
      .select("id,title,file_mime_type,parse_status,created_at,updated_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new ApiError("DB_ERROR", error.message, 500);
    }

    await writeRequestAuditLog({
      supabase,
      requestId,
      route,
      action: "policy_list",
      statusCode: 200,
      orgId,
      userId: user.id,
    });

    return {
      items:
        data?.map((item) => ({
          id: item.id,
          title: item.title,
          fileMimeType: item.file_mime_type,
          parseStatus: item.parse_status,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        })) ?? [],
    };
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await context.params;

  return withApiHandler(request, async ({ requestId, route }) => {
    const { supabase, user } = await requireOrgAccess(request, orgId, "admin");

    const rate = enforceRateLimit(`${orgId}:${user.id}:policy_upload`);
    if (!rate.allowed) {
      throw new ApiError(
        "RATE_LIMITED",
        `Rate limit reached. Retry in ${Math.ceil((rate.retryAfterMs ?? 0) / 1000)} seconds.`,
        429,
      );
    }

    const formData = await request.formData();
    const title = `${formData.get("title") ?? ""}`.trim();
    const file = formData.get("file");

    const parsedInput = policyUploadSchema.safeParse({ title, orgId });
    if (!parsedInput.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsedInput.error.issues[0]?.message ?? "Invalid upload payload",
        400,
      );
    }

    if (!(file instanceof File)) {
      throw new ApiError("VALIDATION_ERROR", "Policy file is required", 400);
    }

    const mimeResult = storageMimeSchema.safeParse(file.type);
    if (!mimeResult.success) {
      throw new ApiError("VALIDATION_ERROR", "Only PDF, DOCX, and TXT files are supported", 400);
    }

    if (file.size > runtimeEnv.maxPolicyUploadMb * 1024 * 1024) {
      throw new ApiError(
        "VALIDATION_ERROR",
        `File too large. Max size is ${runtimeEnv.maxPolicyUploadMb}MB.`,
        400,
      );
    }

    const policyId = randomUUID();
    const fileExtension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const filePath = `org/${orgId}/${policyId}.${fileExtension}`;

    const insertResult = await supabase
      .from("policy_documents")
      .insert({
        id: policyId,
        org_id: orgId,
        title,
        file_path: filePath,
        file_mime_type: file.type,
        parse_status: "pending",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (insertResult.error || !insertResult.data) {
      throw new ApiError(
        "DB_ERROR",
        insertResult.error?.message ?? "Failed to insert policy metadata",
        500,
      );
    }

    const uploadResult = await supabase.storage
      .from("policy-files")
      .upload(filePath, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type,
        upsert: false,
      });

    if (uploadResult.error) {
      throw new ApiError("STORAGE_ERROR", uploadResult.error.message, 500);
    }

    let parseStatus: "ready" | "failed" = "ready";
    let parsedText = "";
    let obligations: ReturnType<typeof extractObligations> = [];

    try {
      parsedText = await extractTextFromFile(file);
      obligations = extractObligations(parsedText, orgId, policyId);
    } catch {
      parseStatus = "failed";
    }

    const updateResult = await supabase
      .from("policy_documents")
      .update({
        parse_status: parseStatus,
        parsed_text: parseStatus === "ready" ? parsedText : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", policyId)
      .eq("org_id", orgId);

    if (updateResult.error) {
      throw new ApiError("DB_ERROR", updateResult.error.message, 500);
    }

    if (parseStatus === "ready" && obligations.length > 0) {
      const obligationRows = obligations.map((obligation) => ({
        org_id: orgId,
        policy_id: policyId,
        title: obligation.title,
        detail: obligation.detail,
        severity: obligation.severity,
        role_track: obligation.roleTrack,
      }));

      const obligationInsert = await supabase.from("policy_obligations").insert(obligationRows);
      if (obligationInsert.error) {
        throw new ApiError("DB_ERROR", obligationInsert.error.message, 500);
      }
    }

    logInfo("policy_processed", {
      request_id: requestId,
      route,
      org_id: orgId,
      user_id: user.id,
      event: ANALYTICS_EVENTS.policyUploaded,
      status_code: 201,
    });

    await writeRequestAuditLog({
      supabase,
      requestId,
      route,
      action: "policy_upload",
      statusCode: 201,
      orgId,
      userId: user.id,
      metadata: {
        policyId,
        parseStatus,
        obligationsCount: obligations.length,
      },
    });

    return {
      policyId,
      parseStatus,
    };
  });
}
