import { ApiError } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/route-helpers";
import { requireUserAndClient } from "@/lib/edtech/db";
import { writeRequestAuditLog } from "@/lib/edtech/request-audit-log";

// ---------------------------------------------------------------------------
// GET /api/me/assignments/[assignmentId]
// Returns assignment + module content + quiz questions (without answers)
// ---------------------------------------------------------------------------

export async function GET(
    request: Request,
    context: { params: Promise<{ assignmentId: string }> },
) {
    const { assignmentId } = await context.params;

    return withApiHandler(request, async ({ requestId, route }) => {
        const { supabase, user } = await requireUserAndClient(request);

        // Fetch assignment with module join
        const result = await supabase
            .from("assignments")
            .select(
                `id,state,due_at,started_at,completed_at,
         learning_modules!inner(
           id,title,summary,content_markdown,role_track,pass_score,
           estimated_minutes,campaign_id,
           campaigns!inner(id,name,status)
         )`,
            )
            .eq("id", assignmentId)
            .eq("user_id", user.id)
            .single();

        if (result.error || !result.data) {
            throw new ApiError("NOT_FOUND", "Assignment not found", 404);
        }

        const row = result.data;
        const moduleData = Array.isArray(row.learning_modules)
            ? row.learning_modules[0]
            : row.learning_modules;

        if (!moduleData) {
            throw new ApiError("NOT_FOUND", "Module not found for assignment", 404);
        }

        const campaignData = Array.isArray(moduleData.campaigns)
            ? moduleData.campaigns[0]
            : moduleData.campaigns;

        // Fetch quiz questions — WITHOUT correctChoiceIndex
        const questionsResult = await supabase
            .from("quiz_questions")
            .select("id,prompt,choices,explanation")
            .eq("module_id", moduleData.id)
            .order("created_at", { ascending: true });

        if (questionsResult.error) {
            throw new ApiError("DB_ERROR", questionsResult.error.message, 500);
        }

        const questions = (questionsResult.data ?? []).map((q) => ({
            id: q.id,
            prompt: q.prompt,
            choices: q.choices,
        }));

        // Auto-mark as in_progress if currently assigned
        if (row.state === "assigned") {
            await supabase
                .from("assignments")
                .update({
                    state: "in_progress",
                    started_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq("id", assignmentId)
                .eq("user_id", user.id);
        }

        await writeRequestAuditLog({
            supabase,
            requestId,
            route,
            action: "assignment_view",
            statusCode: 200,
            userId: user.id,
            metadata: { assignmentId, moduleId: moduleData.id },
        });

        return {
            assignment: {
                id: row.id,
                state: row.state === "assigned" ? "in_progress" : row.state,
                dueAt: row.due_at,
                startedAt: row.started_at,
                completedAt: row.completed_at,
            },
            module: {
                id: moduleData.id,
                title: moduleData.title,
                summary: moduleData.summary,
                contentMarkdown: moduleData.content_markdown,
                roleTrack: moduleData.role_track,
                passScore: moduleData.pass_score,
                estimatedMinutes: moduleData.estimated_minutes,
                campaignId: moduleData.campaign_id,
            },
            campaign: campaignData
                ? {
                    id: campaignData.id,
                    name: campaignData.name,
                    status: campaignData.status,
                }
                : null,
            questions,
        };
    });
}
