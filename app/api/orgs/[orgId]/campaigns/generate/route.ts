import { randomUUID } from "node:crypto";

import { ApiError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { withApiHandler } from "@/lib/api/route-helpers";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { generateCampaignDraft } from "@/lib/edtech/campaign-generator";
import { requireOrgAccess } from "@/lib/edtech/db";
import { enforceRateLimit } from "@/lib/edtech/rate-limit";
import { writeRequestAuditLog } from "@/lib/edtech/request-audit-log";
import { campaignGenerateSchema } from "@/lib/edtech/validation";
import { logInfo } from "@/lib/observability/logger";

export async function POST(
  request: Request,
  context: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await context.params;

  return withApiHandler(request, async ({ requestId, route }) => {
    const { supabase, user } = await requireOrgAccess(request, orgId, "admin");

    const limit = enforceRateLimit(`${orgId}:${user.id}:campaign_generate`);
    if (!limit.allowed) {
      throw new ApiError(
        "RATE_LIMITED",
        `Generation rate limit reached. Retry in ${Math.ceil((limit.retryAfterMs ?? 0) / 1000)} seconds.`,
        429,
      );
    }

    const payload = await parseJsonBody<unknown>(request);
    const parsed = campaignGenerateSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid campaign payload",
        400,
      );
    }

    const obligationsResult = await supabase
      .from("policy_obligations")
      .select("detail,role_track")
      .eq("org_id", orgId)
      .in("policy_id", parsed.data.policyIds);

    if (obligationsResult.error) {
      throw new ApiError("DB_ERROR", obligationsResult.error.message, 500);
    }

    const obligations =
      obligationsResult.data?.map((item) => ({
        detail: item.detail,
        roleTrack: item.role_track as "exec" | "builder" | "general",
      })) ?? [];

    if (obligations.length === 0) {
      throw new ApiError("VALIDATION_ERROR", "No obligations found for selected policy IDs", 400);
    }

    const draft = await generateCampaignDraft({
      campaignName: parsed.data.name,
      obligations,
      roleTracks: parsed.data.roleTracks,
    });

    const campaignId = randomUUID();

    const campaignInsert = await supabase
      .from("learning_campaigns")
      .insert({
        id: campaignId,
        org_id: orgId,
        name: parsed.data.name,
        due_at: parsed.data.dueAt ?? null,
        policy_ids: parsed.data.policyIds,
        role_tracks: parsed.data.roleTracks,
        status: "draft",
        created_by: user.id,
      })
      .select("id,status")
      .single();

    if (campaignInsert.error || !campaignInsert.data) {
      throw new ApiError(
        "DB_ERROR",
        campaignInsert.error?.message ?? "Unable to create campaign",
        500,
      );
    }

    const modulesToInsert = draft.modules.map((module) => ({
      id: randomUUID(),
      org_id: orgId,
      campaign_id: campaignId,
      role_track: module.roleTrack,
      title: module.title,
      summary: module.summary,
      content_markdown: module.contentMarkdown,
      pass_score: module.passScore,
      estimated_minutes: module.estimatedMinutes,
    }));

    const moduleInsert = await supabase
      .from("learning_modules")
      .insert(modulesToInsert)
      .select("id,role_track");

    if (moduleInsert.error || !moduleInsert.data) {
      throw new ApiError(
        "DB_ERROR",
        moduleInsert.error?.message ?? "Unable to insert modules",
        500,
      );
    }

    const moduleByRole = new Map(moduleInsert.data.map((item) => [item.role_track, item.id]));

    const questionsToInsert = draft.modules.flatMap((module) => {
      const moduleId = moduleByRole.get(module.roleTrack);
      if (!moduleId) {
        return [];
      }

      return module.quizQuestions.map((question) => ({
        id: randomUUID(),
        org_id: orgId,
        module_id: moduleId,
        prompt: question.prompt,
        choices_json: question.choices,
        correct_choice_index: question.correctChoiceIndex,
        explanation: question.explanation,
      }));
    });

    const questionInsert = await supabase.from("quiz_questions").insert(questionsToInsert);
    if (questionInsert.error) {
      throw new ApiError("DB_ERROR", questionInsert.error.message, 500);
    }

    logInfo("campaign_generated", {
      request_id: requestId,
      route,
      org_id: orgId,
      user_id: user.id,
      event: ANALYTICS_EVENTS.campaignGenerated,
      status_code: 201,
    });

    await writeRequestAuditLog({
      supabase,
      requestId,
      route,
      action: "campaign_generate",
      statusCode: 201,
      orgId,
      userId: user.id,
      metadata: {
        campaignId,
        modules: draft.modules.length,
      },
    });

    return {
      campaignId,
      status: campaignInsert.data.status,
    };
  });
}
