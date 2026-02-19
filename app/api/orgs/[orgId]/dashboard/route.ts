import { ApiError } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/route-helpers";
import { computeCampaignMetrics } from "@/lib/edtech/dashboard";
import { requireOrgAccess } from "@/lib/edtech/db";
import { writeRequestAuditLog } from "@/lib/edtech/request-audit-log";
import { shouldIgnoreOptionalSchemaErrors } from "@/lib/edtech/schema-compat";

type EvidenceStatusCounters = {
  queued: number;
  synced: number;
  rejected: number;
  stale: number;
  superseded: number;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await context.params;

  return withApiHandler(request, async ({ requestId, route }) => {
    const { supabase, user } = await requireOrgAccess(request, orgId, "manager");

    const campaignResult = await supabase
      .from("learning_campaigns")
      .select("id,name")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (campaignResult.error) {
      throw new ApiError("DB_ERROR", campaignResult.error.message, 500);
    }

    const campaigns = campaignResult.data ?? [];
    const campaignMetrics = await Promise.all(
      campaigns.map(async (campaign) => {
        const [assignments, attempts, attestations] = await Promise.all([
          supabase
            .from("assignments")
            .select("id,state")
            .eq("org_id", orgId)
            .eq("campaign_id", campaign.id),
          supabase
            .from("module_attempts")
            .select("score_pct")
            .eq("org_id", orgId)
            .eq("campaign_id", campaign.id),
          supabase
            .from("attestations")
            .select("id")
            .eq("org_id", orgId)
            .eq("campaign_id", campaign.id),
        ]);

        if (assignments.error || attempts.error || attestations.error) {
          throw new ApiError(
            "DB_ERROR",
            assignments.error?.message ?? attempts.error?.message ?? attestations.error?.message ?? "Failed to load dashboard metrics",
            500,
          );
        }

        const assignmentRows = assignments.data ?? [];
        const attemptsRows = attempts.data ?? [];
        const attestationRows = attestations.data ?? [];

        const averageScore =
          attemptsRows.length > 0
            ? attemptsRows.reduce((total, attempt) => total + attempt.score_pct, 0) /
            attemptsRows.length
            : 0;

        const metrics = computeCampaignMetrics({
          campaignId: campaign.id,
          assignmentsTotal: assignmentRows.length,
          assignmentsCompleted: assignmentRows.filter((item) => item.state === "completed").length,
          attestationsCount: attestationRows.length,
          averageScore,
        });

        return {
          name: campaign.name,
          ...metrics,
        };
      }),
    );

    const [controlsResult, mappingsResult, evidenceResult, connectionsResult] = await Promise.all([
      supabase
        .from("controls")
        .select("id,code,title,risk_level")
        .eq("org_id", orgId),
      supabase
        .from("control_mappings")
        .select("control_id")
        .eq("org_id", orgId)
        .eq("active", true),
      supabase
        .from("evidence_objects")
        .select("control_id,evidence_status")
        .eq("org_id", orgId),
      supabase
        .from("integration_connections")
        .select("provider,status,last_sync_at,health_message")
        .eq("org_id", orgId),
    ]);

    const optionalSchemaErrors = [
      controlsResult.error,
      mappingsResult.error,
      evidenceResult.error,
      connectionsResult.error,
    ];
    const optionalSchemaMissing = shouldIgnoreOptionalSchemaErrors(optionalSchemaErrors);

    if (optionalSchemaErrors.some((item) => Boolean(item)) && !optionalSchemaMissing) {
      throw new ApiError(
        "DB_ERROR",
        controlsResult.error?.message ??
          mappingsResult.error?.message ??
          evidenceResult.error?.message ??
          connectionsResult.error?.message ??
          "Failed to load control metrics",
        500,
      );
    }

    const controls = optionalSchemaMissing ? [] : controlsResult.data ?? [];
    const mappings = optionalSchemaMissing ? [] : mappingsResult.data ?? [];
    const mappedControlIds = new Set(mappings.map((item) => item.control_id));
    const controlCoverage = {
      totalControls: controls.length,
      mappedControls: mappedControlIds.size,
      coverageRatio: controls.length > 0 ? mappedControlIds.size / controls.length : 0,
    };

    const evidenceStatusCounts: EvidenceStatusCounters = {
      queued: 0,
      synced: 0,
      rejected: 0,
      stale: 0,
      superseded: 0,
    };
    const evidenceByControl = new Map<string, EvidenceStatusCounters>();

    for (const evidence of optionalSchemaMissing ? [] : evidenceResult.data ?? []) {
      const status = evidence.evidence_status;
      if (status && status in evidenceStatusCounts) {
        evidenceStatusCounts[status as keyof EvidenceStatusCounters] += 1;
      }

      if (!evidence.control_id) continue;
      const current = evidenceByControl.get(evidence.control_id) ?? {
        queued: 0,
        synced: 0,
        rejected: 0,
        stale: 0,
        superseded: 0,
      };
      if (status && status in current) {
        current[status as keyof EvidenceStatusCounters] += 1;
      }
      evidenceByControl.set(evidence.control_id, current);
    }

    const riskWeightByLevel = { low: 1, medium: 2, high: 3 } as const;
    const riskHotspots = controls
      .map((control) => {
        const evidence = evidenceByControl.get(control.id) ?? {
          queued: 0,
          synced: 0,
          rejected: 0,
          stale: 0,
          superseded: 0,
        };

        const riskLevel =
          typeof control.risk_level === "string" && control.risk_level in riskWeightByLevel
            ? (control.risk_level as keyof typeof riskWeightByLevel)
            : "medium";
        const baseRisk = riskWeightByLevel[riskLevel];
        const riskIndex = baseRisk * (evidence.rejected * 3 + evidence.stale * 2 + evidence.queued);

        return {
          controlId: control.id,
          controlCode: control.code,
          controlTitle: control.title,
          riskLevel,
          riskIndex,
          evidence,
        };
      })
      .filter((item) => item.riskIndex > 0)
      .sort((a, b) => b.riskIndex - a.riskIndex)
      .slice(0, 10);

    const integrationHealth = (optionalSchemaMissing ? [] : connectionsResult.data ?? []).map((item) => ({
      provider: item.provider,
      status: item.status,
      lastSyncAt: item.last_sync_at,
      healthMessage: item.health_message,
    }));

    // At-risk learners: overdue or still pending
    const atRiskResult = await supabase
      .from("assignments")
      .select(
        "id,user_id,state,due_at,learning_modules!inner(title,role_track)",
      )
      .eq("org_id", orgId)
      .neq("state", "completed")
      .not("due_at", "is", null)
      .lt("due_at", new Date().toISOString())
      .order("due_at", { ascending: true })
      .limit(50);

    const atRiskLearners = (atRiskResult.data ?? []).map((row) => {
      const mod = Array.isArray(row.learning_modules)
        ? row.learning_modules[0]
        : row.learning_modules;
      const dueDate = row.due_at ? new Date(row.due_at) : null;
      const daysOverdue = dueDate
        ? Math.max(0, Math.ceil((Date.now() - dueDate.getTime()) / 86400000))
        : 0;

      return {
        assignmentId: row.id,
        userId: row.user_id,
        state: row.state,
        dueAt: row.due_at,
        daysOverdue,
        moduleTitle: mod?.title ?? "Unknown",
        roleTrack: mod?.role_track ?? "general",
      };
    });

    await writeRequestAuditLog({
      supabase,
      requestId,
      route,
      action: "dashboard_view",
      statusCode: 200,
      orgId,
      userId: user.id,
      metadata: {
        campaigns: campaignMetrics.length,
      },
    });

    return {
      orgId,
      campaigns: campaignMetrics,
      atRiskLearners,
      controlCoverage,
      evidenceStatusCounts,
      integrationHealth,
      riskHotspots,
    };
  });
}
