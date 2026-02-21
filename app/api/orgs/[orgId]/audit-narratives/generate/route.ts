import { ApiError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { withApiHandler } from "@/lib/api/route-helpers";
import { summarizeFreshness } from "@/lib/edtech/adoption-intelligence";
import { loadControlFreshness } from "@/lib/edtech/adoption-store";
import { requireOrgAccess } from "@/lib/edtech/db";
import { writeRequestAuditLog } from "@/lib/edtech/request-audit-log";
import { auditNarrativeGenerateSchema } from "@/lib/edtech/validation";

function toNarrative(input: {
  orgName: string;
  windowDays: number;
  freshness: ReturnType<typeof summarizeFreshness>;
  evidenceStatusCounts: { queued: number; synced: number; rejected: number; stale: number; superseded: number };
  interventionStatusCounts: { proposed: number; approved: number; executing: number; completed: number; dismissed: number };
  controlCode?: string | null;
  campaignName?: string | null;
}): string {
  const scopeBits: string[] = [];
  if (input.controlCode) scopeBits.push(`control ${input.controlCode}`);
  if (input.campaignName) scopeBits.push(`campaign "${input.campaignName}"`);
  const scopeText = scopeBits.length > 0 ? scopeBits.join(" and ") : "all mapped controls";

  return [
    `Audit narrative for ${input.orgName} (${input.windowDays}-day window).`,
    "",
    `Scope: ${scopeText}.`,
    `Fresh controls: ${input.freshness.freshControls}/${input.freshness.totalControls} (${(input.freshness.freshCoverageRatio * 100).toFixed(1)}%).`,
    `Stale controls: ${input.freshness.staleControls}; critical controls: ${input.freshness.criticalControls}.`,
    "",
    "Evidence status summary:",
    `- queued: ${input.evidenceStatusCounts.queued}`,
    `- synced: ${input.evidenceStatusCounts.synced}`,
    `- rejected: ${input.evidenceStatusCounts.rejected}`,
    `- stale: ${input.evidenceStatusCounts.stale}`,
    `- superseded: ${input.evidenceStatusCounts.superseded}`,
    "",
    "Intervention workflow summary:",
    `- proposed: ${input.interventionStatusCounts.proposed}`,
    `- approved: ${input.interventionStatusCounts.approved}`,
    `- executing: ${input.interventionStatusCounts.executing}`,
    `- completed: ${input.interventionStatusCounts.completed}`,
    `- dismissed: ${input.interventionStatusCounts.dismissed}`,
    "",
    "Interpretation:",
    input.freshness.criticalControls > 0
      ? "Critical adoption risk remains concentrated in controls with stale or rejected evidence. Prioritize approved interventions and role refresher remediations."
      : "Control adoption posture is stable. Continue cadence and monitor freshness drift after policy updates.",
  ].join("\n");
}

export async function POST(
  request: Request,
  context: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await context.params;

  return withApiHandler(request, async ({ requestId, route }) => {
    const { supabase, user } = await requireOrgAccess(request, orgId, "manager");

    const payload = await parseJsonBody<unknown>(request).catch(() => ({}));
    const parsed = auditNarrativeGenerateSchema.safeParse(payload ?? {});
    if (!parsed.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid narrative payload",
        400,
      );
    }

    const controlsScope = parsed.data.controlId ? [parsed.data.controlId] : undefined;
    const loaded = await loadControlFreshness({
      supabase,
      orgId,
      controlIds: controlsScope,
    });
    const freshnessSummary = summarizeFreshness(Array.from(loaded.computedByControlId.values()));

    let evidenceQuery = supabase
      .from("evidence_objects")
      .select("evidence_status")
      .eq("org_id", orgId)
      .gte(
        "occurred_at",
        new Date(Date.now() - (parsed.data.window ?? 30) * 86400000).toISOString(),
      );

    if (parsed.data.controlId) {
      evidenceQuery = evidenceQuery.eq("control_id", parsed.data.controlId);
    }
    if (parsed.data.campaignId) {
      evidenceQuery = evidenceQuery.eq("campaign_id", parsed.data.campaignId);
    }

    const [evidenceResult, interventionsResult, orgResult, campaignResult] = await Promise.all([
      evidenceQuery,
      supabase
        .from("intervention_recommendations")
        .select("status")
        .eq("org_id", orgId)
        .limit(500),
      supabase.from("organizations").select("name").eq("id", orgId).single(),
      parsed.data.campaignId
        ? supabase
            .from("learning_campaigns")
            .select("name")
            .eq("org_id", orgId)
            .eq("id", parsed.data.campaignId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (evidenceResult.error || interventionsResult.error || orgResult.error || campaignResult.error) {
      throw new ApiError(
        "DB_ERROR",
        evidenceResult.error?.message ??
          interventionsResult.error?.message ??
          orgResult.error?.message ??
          campaignResult.error?.message ??
          "Unable to generate audit narrative",
        500,
      );
    }

    const evidenceStatusCounts = {
      queued: 0,
      synced: 0,
      rejected: 0,
      stale: 0,
      superseded: 0,
    };
    for (const row of evidenceResult.data ?? []) {
      if (row.evidence_status in evidenceStatusCounts) {
        evidenceStatusCounts[row.evidence_status as keyof typeof evidenceStatusCounts] += 1;
      }
    }

    const interventionStatusCounts = {
      proposed: 0,
      approved: 0,
      executing: 0,
      completed: 0,
      dismissed: 0,
    };
    for (const row of interventionsResult.data ?? []) {
      if (row.status in interventionStatusCounts) {
        interventionStatusCounts[row.status as keyof typeof interventionStatusCounts] += 1;
      }
    }

    const selectedControl = parsed.data.controlId
      ? loaded.controls.find((control) => control.id === parsed.data.controlId)
      : null;

    const narrative = toNarrative({
      orgName: orgResult.data?.name ?? "Organization",
      windowDays: parsed.data.window ?? 30,
      freshness: freshnessSummary,
      evidenceStatusCounts,
      interventionStatusCounts,
      controlCode: selectedControl?.code ?? null,
      campaignName: campaignResult.data?.name ?? null,
    });

    await writeRequestAuditLog({
      supabase,
      requestId,
      route,
      action: "audit_narrative_generate",
      statusCode: 200,
      orgId,
      userId: user.id,
      metadata: {
        controlId: parsed.data.controlId ?? null,
        campaignId: parsed.data.campaignId ?? null,
        windowDays: parsed.data.window ?? 30,
      },
    });

    return {
      orgId,
      generatedAt: new Date().toISOString(),
      scope: {
        controlId: parsed.data.controlId ?? null,
        campaignId: parsed.data.campaignId ?? null,
        windowDays: parsed.data.window ?? 30,
      },
      freshnessSummary,
      evidenceStatusCounts,
      interventionStatusCounts,
      narrative,
    };
  });
}
