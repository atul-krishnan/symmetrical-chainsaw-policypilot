import { randomUUID } from "node:crypto";

import { ApiError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { withApiHandler } from "@/lib/api/route-helpers";
import { requireOrgAccess } from "@/lib/edtech/db";
import { writeRequestAuditLog } from "@/lib/edtech/request-audit-log";
import { campaignUpdateSchema } from "@/lib/edtech/validation";

// ---------------------------------------------------------------------------
// GET /api/orgs/:orgId/campaigns/:campaignId
// Returns full campaign detail with modules and quiz questions.
// ---------------------------------------------------------------------------

export async function GET(
  request: Request,
  context: { params: Promise<{ orgId: string; campaignId: string }> },
) {
  const { orgId, campaignId } = await context.params;

  return withApiHandler(request, async () => {
    const { supabase } = await requireOrgAccess(request, orgId, "learner");

    const campaignResult = await supabase
      .from("learning_campaigns")
      .select("*")
      .eq("id", campaignId)
      .eq("org_id", orgId)
      .single();

    if (campaignResult.error || !campaignResult.data) {
      throw new ApiError("NOT_FOUND", "Campaign not found", 404);
    }

    const modulesResult = await supabase
      .from("learning_modules")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("org_id", orgId)
      .order("role_track");

    if (modulesResult.error) {
      throw new ApiError("DB_ERROR", modulesResult.error.message, 500);
    }

    const moduleIds = (modulesResult.data ?? []).map((m) => m.id);

    let questionsData: Array<Record<string, unknown>> = [];
    if (moduleIds.length > 0) {
      const questionsResult = await supabase
        .from("quiz_questions")
        .select("*")
        .eq("org_id", orgId)
        .in("module_id", moduleIds)
        .order("created_at");

      if (questionsResult.error) {
        throw new ApiError("DB_ERROR", questionsResult.error.message, 500);
      }
      questionsData = questionsResult.data ?? [];
    }

    const questionsByModule = new Map<string, typeof questionsData>();
    for (const q of questionsData) {
      const mid = q.module_id as string;
      if (!questionsByModule.has(mid)) {
        questionsByModule.set(mid, []);
      }
      questionsByModule.get(mid)!.push(q);
    }

    const campaign = campaignResult.data;

    return {
      campaign: {
        id: campaign.id,
        orgId: campaign.org_id,
        name: campaign.name,
        dueAt: campaign.due_at,
        policyIds: campaign.policy_ids,
        roleTracks: campaign.role_tracks,
        status: campaign.status,
        publishedAt: campaign.published_at,
        createdBy: campaign.created_by,
        createdAt: campaign.created_at,
        updatedAt: campaign.updated_at,
      },
      modules: (modulesResult.data ?? []).map((m) => ({
        id: m.id,
        campaignId: m.campaign_id,
        orgId: m.org_id,
        roleTrack: m.role_track,
        title: m.title,
        summary: m.summary,
        contentMarkdown: m.content_markdown,
        passScore: m.pass_score,
        estimatedMinutes: m.estimated_minutes,
        createdAt: m.created_at,
        updatedAt: m.updated_at,
        quizQuestions: (questionsByModule.get(m.id) ?? []).map((q) => ({
          id: q.id,
          moduleId: q.module_id,
          prompt: q.prompt,
          choices: q.choices_json,
          correctChoiceIndex: q.correct_choice_index,
          explanation: q.explanation,
          createdAt: q.created_at,
        })),
      })),
    };
  });
}

// ---------------------------------------------------------------------------
// PUT /api/orgs/:orgId/campaigns/:campaignId
// Updates campaign metadata, modules, and optionally quiz questions.
// ---------------------------------------------------------------------------

export async function PUT(
  request: Request,
  context: { params: Promise<{ orgId: string; campaignId: string }> },
) {
  const { orgId, campaignId } = await context.params;

  return withApiHandler(request, async ({ requestId, route }) => {
    const { supabase, user } = await requireOrgAccess(request, orgId, "admin");

    const payload = await parseJsonBody<unknown>(request);
    const parsed = campaignUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid update payload",
        400,
      );
    }

    const campaignResult = await supabase
      .from("learning_campaigns")
      .select("id,status")
      .eq("id", campaignId)
      .eq("org_id", orgId)
      .single();

    if (campaignResult.error || !campaignResult.data) {
      throw new ApiError("NOT_FOUND", "Campaign not found", 404);
    }

    if (campaignResult.data.status !== "draft") {
      throw new ApiError("CONFLICT", "Only draft campaigns can be edited", 409);
    }

    if (parsed.data.name || parsed.data.dueAt !== undefined) {
      const updateResult = await supabase
        .from("learning_campaigns")
        .update({
          name: parsed.data.name,
          due_at: parsed.data.dueAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaignId)
        .eq("org_id", orgId);

      if (updateResult.error) {
        throw new ApiError("DB_ERROR", updateResult.error.message, 500);
      }
    }

    if (parsed.data.modules) {
      for (const moduleInput of parsed.data.modules) {
        const moduleUpdate = await supabase
          .from("learning_modules")
          .update({
            title: moduleInput.title,
            summary: moduleInput.summary,
            content_markdown: moduleInput.contentMarkdown,
            pass_score: moduleInput.passScore,
            estimated_minutes: moduleInput.estimatedMinutes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", moduleInput.id)
          .eq("campaign_id", campaignId)
          .eq("org_id", orgId);

        if (moduleUpdate.error) {
          throw new ApiError("DB_ERROR", moduleUpdate.error.message, 500);
        }

        // Handle quiz questions if provided
        if (moduleInput.quizQuestions) {
          for (const q of moduleInput.quizQuestions) {
            if (q.id) {
              // Update existing question
              const qUpdate = await supabase
                .from("quiz_questions")
                .update({
                  prompt: q.prompt,
                  choices_json: q.choices,
                  correct_choice_index: q.correctChoiceIndex,
                  explanation: q.explanation,
                })
                .eq("id", q.id)
                .eq("module_id", moduleInput.id)
                .eq("org_id", orgId);

              if (qUpdate.error) {
                throw new ApiError("DB_ERROR", qUpdate.error.message, 500);
              }
            } else {
              // Insert new question
              const qInsert = await supabase.from("quiz_questions").insert({
                id: randomUUID(),
                org_id: orgId,
                module_id: moduleInput.id,
                prompt: q.prompt,
                choices_json: q.choices,
                correct_choice_index: q.correctChoiceIndex,
                explanation: q.explanation,
              });

              if (qInsert.error) {
                throw new ApiError("DB_ERROR", qInsert.error.message, 500);
              }
            }
          }
        }
      }
    }

    await writeRequestAuditLog({
      supabase,
      requestId,
      route,
      action: "campaign_update",
      statusCode: 200,
      orgId,
      userId: user.id,
      metadata: {
        campaignId,
        updatedModules: parsed.data.modules?.length ?? 0,
      },
    });

    return {
      campaignId,
      ok: true,
    };
  });
}
