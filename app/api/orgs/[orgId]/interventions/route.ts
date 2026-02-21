import { randomUUID } from "node:crypto";

import { ApiError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { withApiHandler } from "@/lib/api/route-helpers";
import { recommendInterventions } from "@/lib/edtech/adoption-intelligence";
import { loadControlFreshness, upsertFreshnessSnapshots } from "@/lib/edtech/adoption-store";
import { requireOrgAccess } from "@/lib/edtech/db";
import { writeRequestAuditLog } from "@/lib/edtech/request-audit-log";
import { interventionListQuerySchema, interventionRecommendSchema } from "@/lib/edtech/validation";

export async function GET(
  request: Request,
  context: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await context.params;

  return withApiHandler(request, async ({ requestId, route }) => {
    const { supabase, user } = await requireOrgAccess(request, orgId, "manager");

    const url = new URL(request.url);
    const parsedQuery = interventionListQuerySchema.safeParse({
      status: url.searchParams.get("status") ?? undefined,
      controlId: url.searchParams.get("controlId") ?? undefined,
    });
    if (!parsedQuery.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsedQuery.error.issues[0]?.message ?? "Invalid intervention query",
        400,
      );
    }

    let query = supabase
      .from("intervention_recommendations")
      .select(
        "id,control_id,campaign_id,module_id,recommendation_type,status,rationale,expected_impact_pct,confidence_score,metadata_json,proposed_by,approved_by,approved_at,dismissed_at,created_at,updated_at,controls(id,code,title,risk_level),learning_campaigns(id,name),learning_modules(id,title,role_track)",
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(300);

    if (parsedQuery.data.status) {
      query = query.eq("status", parsedQuery.data.status);
    }
    if (parsedQuery.data.controlId) {
      query = query.eq("control_id", parsedQuery.data.controlId);
    }

    const recommendations = await query;
    if (recommendations.error) {
      throw new ApiError("DB_ERROR", recommendations.error.message, 500);
    }

    const recommendationIds = (recommendations.data ?? []).map((item) => item.id);
    const executionsByRecommendation = new Map<
      string,
      {
        id: string;
        executionStatus: string;
        errorMessage: string | null;
        startedAt: string | null;
        finishedAt: string | null;
        createdAt: string;
      }
    >();

    if (recommendationIds.length > 0) {
      const executionsResult = await supabase
        .from("intervention_executions")
        .select("id,intervention_id,execution_status,error_message,started_at,finished_at,created_at")
        .eq("org_id", orgId)
        .in("intervention_id", recommendationIds)
        .order("created_at", { ascending: false });

      if (executionsResult.error) {
        throw new ApiError("DB_ERROR", executionsResult.error.message, 500);
      }

      for (const execution of executionsResult.data ?? []) {
        if (!executionsByRecommendation.has(execution.intervention_id)) {
          executionsByRecommendation.set(execution.intervention_id, {
            id: execution.id,
            executionStatus: execution.execution_status,
            errorMessage: execution.error_message,
            startedAt: execution.started_at,
            finishedAt: execution.finished_at,
            createdAt: execution.created_at,
          });
        }
      }
    }

    const statusCounts = {
      proposed: 0,
      approved: 0,
      executing: 0,
      completed: 0,
      dismissed: 0,
    };

    for (const row of recommendations.data ?? []) {
      if (row.status in statusCounts) {
        statusCounts[row.status as keyof typeof statusCounts] += 1;
      }
    }

    await writeRequestAuditLog({
      supabase,
      requestId,
      route,
      action: "interventions_view",
      statusCode: 200,
      orgId,
      userId: user.id,
      metadata: {
        count: recommendations.data?.length ?? 0,
        filters: parsedQuery.data,
      },
    });

    return {
      orgId,
      summary: {
        total: recommendations.data?.length ?? 0,
        statusCounts,
      },
      items: (recommendations.data ?? []).map((row) => {
        const control = Array.isArray(row.controls) ? row.controls[0] : row.controls;
        const campaign = Array.isArray(row.learning_campaigns)
          ? row.learning_campaigns[0]
          : row.learning_campaigns;
        const moduleEntry = Array.isArray(row.learning_modules)
          ? row.learning_modules[0]
          : row.learning_modules;
        return {
          id: row.id,
          controlId: row.control_id,
          campaignId: row.campaign_id,
          moduleId: row.module_id,
          recommendationType: row.recommendation_type,
          status: row.status,
          rationale: row.rationale,
          expectedImpactPct: Number(row.expected_impact_pct),
          confidenceScore: Number(row.confidence_score),
          metadata: row.metadata_json,
          proposedBy: row.proposed_by,
          approvedBy: row.approved_by,
          approvedAt: row.approved_at,
          dismissedAt: row.dismissed_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          control: control
            ? {
                id: control.id,
                code: control.code,
                title: control.title,
                riskLevel: control.risk_level,
              }
            : null,
          campaign: campaign
            ? {
                id: campaign.id,
                name: campaign.name,
              }
            : null,
          module: moduleEntry
            ? {
                id: moduleEntry.id,
                title: moduleEntry.title,
                roleTrack: moduleEntry.role_track,
              }
            : null,
          latestExecution: executionsByRecommendation.get(row.id) ?? null,
        };
      }),
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

    const payload = await parseJsonBody<unknown>(request).catch(() => ({}));
    const parsed = interventionRecommendSchema.safeParse(payload ?? {});
    if (!parsed.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid recommendation payload",
        400,
      );
    }

    const loaded = await loadControlFreshness({
      supabase,
      orgId,
      controlIds: parsed.data.controlId ? [parsed.data.controlId] : undefined,
    });

    const moduleIds = Array.from(
      new Set(
        Array.from(loaded.mappedModuleIdsByControlId.values()).flat(),
      ),
    );
    const roleTrackByModuleId = new Map<string, "exec" | "builder" | "general">();
    if (moduleIds.length > 0) {
      const moduleResult = await supabase
        .from("learning_modules")
        .select("id,role_track")
        .eq("org_id", orgId)
        .in("id", moduleIds);
      if (moduleResult.error) {
        throw new ApiError("DB_ERROR", moduleResult.error.message, 500);
      }
      for (const moduleRow of moduleResult.data ?? []) {
        roleTrackByModuleId.set(moduleRow.id, moduleRow.role_track);
      }
    }

    const existingResult = await supabase
      .from("intervention_recommendations")
      .select("control_id,recommendation_type,status")
      .eq("org_id", orgId)
      .in("status", ["proposed", "approved", "executing"]);
    if (existingResult.error) {
      throw new ApiError("DB_ERROR", existingResult.error.message, 500);
    }

    const existingSet = new Set(
      (existingResult.data ?? []).map((row) => `${row.control_id}:${row.recommendation_type}`),
    );

    const freshnessComputed = Array.from(loaded.computedByControlId.values());
    await upsertFreshnessSnapshots({
      supabase,
      orgId,
      computed: freshnessComputed,
    });

    const rowsToInsert: Array<Record<string, unknown>> = [];
    for (const control of loaded.controls) {
      const freshness = loaded.computedByControlId.get(control.id);
      if (!freshness) continue;

      const mappedCampaignIds = loaded.mappedCampaignIdsByControlId.get(control.id) ?? [];
      const mappedModuleIds = loaded.mappedModuleIdsByControlId.get(control.id) ?? [];
      const roleTrack = mappedModuleIds
        .map((moduleId) => roleTrackByModuleId.get(moduleId))
        .find((value): value is "exec" | "builder" | "general" => Boolean(value)) ?? null;

      const proposals = recommendInterventions({
        controlId: control.id,
        controlCode: control.code,
        controlTitle: control.title,
        riskLevel: control.risk_level,
        roleTrack,
        freshness,
      });

      for (const proposal of proposals) {
        const dedupeKey = `${control.id}:${proposal.recommendationType}`;
        if (existingSet.has(dedupeKey)) continue;
        if (rowsToInsert.length >= (parsed.data.maxRecommendations ?? 25)) break;

        rowsToInsert.push({
          id: randomUUID(),
          org_id: orgId,
          control_id: control.id,
          campaign_id: parsed.data.campaignId ?? mappedCampaignIds[0] ?? null,
          module_id: parsed.data.moduleId ?? mappedModuleIds[0] ?? null,
          recommendation_type: proposal.recommendationType,
          status: "proposed",
          rationale: proposal.rationale,
          expected_impact_pct: proposal.expectedImpactPct,
          confidence_score: proposal.confidenceScore,
          metadata_json: {
            ...proposal.metadata,
            freshnessState: freshness.state,
            freshnessScore: freshness.score,
          },
          proposed_by: user.id,
          updated_at: new Date().toISOString(),
        });
        existingSet.add(dedupeKey);
      }
    }

    if (rowsToInsert.length > 0) {
      const insertResult = await supabase.from("intervention_recommendations").insert(rowsToInsert);
      if (insertResult.error) {
        throw new ApiError("DB_ERROR", insertResult.error.message, 500);
      }
    }

    await writeRequestAuditLog({
      supabase,
      requestId,
      route,
      action: "intervention_recommend",
      statusCode: 200,
      orgId,
      userId: user.id,
      metadata: {
        requestedControlId: parsed.data.controlId ?? null,
        generated: rowsToInsert.length,
      },
    });

    return {
      ok: true,
      generated: rowsToInsert.length,
      maxRecommendations: parsed.data.maxRecommendations ?? 25,
    };
  });
}
