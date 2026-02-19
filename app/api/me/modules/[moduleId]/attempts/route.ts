import { randomUUID } from "node:crypto";

import { ApiError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { withApiHandler } from "@/lib/api/route-helpers";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { requireUserAndClient } from "@/lib/edtech/db";
import { createEvidenceObjects } from "@/lib/edtech/evidence";
import { gradeQuiz } from "@/lib/edtech/quiz-grader";
import { enforceRateLimit } from "@/lib/edtech/rate-limit";
import { writeRequestAuditLog } from "@/lib/edtech/request-audit-log";
import { isMissingOptionalSchemaError } from "@/lib/edtech/schema-compat";
import { quizAttemptSchema } from "@/lib/edtech/validation";
import { logInfo } from "@/lib/observability/logger";

export async function POST(
  request: Request,
  context: { params: Promise<{ moduleId: string }> },
) {
  const { moduleId } = await context.params;

  return withApiHandler(request, async ({ requestId, route }) => {
    const { supabase, user } = await requireUserAndClient(request);

    const limit = enforceRateLimit(`${user.id}:quiz_attempt:${moduleId}`);
    if (!limit.allowed) {
      throw new ApiError(
        "RATE_LIMITED",
        `Too many quiz attempts. Retry in ${Math.ceil((limit.retryAfterMs ?? 0) / 1000)} seconds.`,
        429,
      );
    }

    const payload = await parseJsonBody<unknown>(request);
    const parsed = quizAttemptSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid attempt payload",
        400,
      );
    }

    const moduleResult = await supabase
      .from("learning_modules")
      .select("id,org_id,campaign_id,pass_score")
      .eq("id", moduleId)
      .single();

    if (moduleResult.error || !moduleResult.data) {
      throw new ApiError("NOT_FOUND", "Module not found", 404);
    }

    const assignmentResult = await supabase
      .from("assignments")
      .select("id,state,material_acknowledged_at")
      .eq("module_id", moduleId)
      .eq("campaign_id", moduleResult.data.campaign_id)
      .eq("org_id", moduleResult.data.org_id)
      .eq("user_id", user.id)
      .single();

    if (assignmentResult.error || !assignmentResult.data) {
      throw new ApiError("AUTH_ERROR", "No assignment found for this module", 403);
    }

    const campaignResult = await supabase
      .from("learning_campaigns")
      .select("flow_version")
      .eq("id", moduleResult.data.campaign_id)
      .eq("org_id", moduleResult.data.org_id)
      .single();

    if (campaignResult.error || !campaignResult.data) {
      throw new ApiError("NOT_FOUND", "Campaign not found for module", 404);
    }

    if (
      campaignResult.data.flow_version === 2 &&
      !assignmentResult.data.material_acknowledged_at
    ) {
      throw new ApiError(
        "CONFLICT",
        "Acknowledge the learning material before starting the quiz.",
        409,
      );
    }

    const questionResult = await supabase
      .from("quiz_questions")
      .select("id,correct_choice_index")
      .eq("module_id", moduleId)
      .order("created_at", { ascending: true });

    if (questionResult.error) {
      throw new ApiError("DB_ERROR", questionResult.error.message, 500);
    }

    const questions = (questionResult.data ?? []).map((question) => ({
      id: question.id,
      correctChoiceIndex: question.correct_choice_index,
    }));

    if (questions.length === 0) {
      throw new ApiError("CONFLICT", "Module has no quiz questions", 409);
    }

    const grading = gradeQuiz(questions, parsed.data.answers, moduleResult.data.pass_score);

    const attemptId = randomUUID();
    const attemptInsert = await supabase.from("module_attempts").insert({
      id: attemptId,
      org_id: moduleResult.data.org_id,
      module_id: moduleId,
      campaign_id: moduleResult.data.campaign_id,
      user_id: user.id,
      answers_json: parsed.data.answers,
      score_pct: grading.scorePct,
      passed: grading.passed,
    });

    if (attemptInsert.error) {
      throw new ApiError("DB_ERROR", attemptInsert.error.message, 500);
    }

    const nextState = grading.passed ? "completed" : "in_progress";
    const assignmentUpdate = await supabase
      .from("assignments")
      .update({
        state: nextState,
        started_at:
          assignmentResult.data.state === "assigned"
            ? new Date().toISOString()
            : undefined,
        completed_at: grading.passed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", assignmentResult.data.id)
      .eq("user_id", user.id);

    if (assignmentUpdate.error) {
      throw new ApiError("DB_ERROR", assignmentUpdate.error.message, 500);
    }

    try {
      await createEvidenceObjects({
        supabase,
        orgId: moduleResult.data.org_id,
        campaignId: moduleResult.data.campaign_id,
        moduleId,
        assignmentId: assignmentResult.data.id,
        userId: user.id,
        evidenceType: "quiz_attempt",
        sourceTable: "module_attempts",
        sourceId: attemptId,
        confidenceScore: 0.92,
        qualityScore: grading.passed ? 92 : 78,
        metadata: {
          scorePct: grading.scorePct,
          passed: grading.passed,
        },
      });

      if (grading.passed) {
        await createEvidenceObjects({
          supabase,
          orgId: moduleResult.data.org_id,
          campaignId: moduleResult.data.campaign_id,
          moduleId,
          assignmentId: assignmentResult.data.id,
          userId: user.id,
          evidenceType: "quiz_pass",
          sourceTable: "module_attempts",
          sourceId: attemptId,
          confidenceScore: 0.95,
          qualityScore: 95,
          metadata: {
            scorePct: grading.scorePct,
            passed: true,
          },
        });
      }
    } catch (error) {
      if (!isMissingOptionalSchemaError(error)) {
        throw error;
      }
    }

    logInfo("quiz_attempt_recorded", {
      request_id: requestId,
      route,
      org_id: moduleResult.data.org_id,
      user_id: user.id,
      event: grading.passed ? ANALYTICS_EVENTS.quizPassed : ANALYTICS_EVENTS.quizSubmitted,
      status_code: 200,
    });

    await writeRequestAuditLog({
      supabase,
      requestId,
      route,
      action: "quiz_attempt",
      statusCode: 200,
      orgId: moduleResult.data.org_id,
      userId: user.id,
      metadata: {
        moduleId,
        scorePct: grading.scorePct,
        passed: grading.passed,
      },
    });

    return {
      moduleId,
      campaignId: moduleResult.data.campaign_id,
      scorePct: grading.scorePct,
      passed: grading.passed,
      details: grading.details,
    };
  });
}
