import { ApiError } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/route-helpers";
import { loadControlFreshness } from "@/lib/edtech/adoption-store";
import { requireOrgAccess } from "@/lib/edtech/db";
import { writeRequestAuditLog } from "@/lib/edtech/request-audit-log";
import { adoptionGraphQuerySchema } from "@/lib/edtech/validation";

type GraphEdge = {
  id: string;
  type:
    | "obligation_control"
    | "control_campaign"
    | "control_module"
    | "control_outcome"
    | "control_freshness";
  from: string;
  to: string;
  weight: number;
  metadata: Record<string, unknown>;
};

export async function GET(
  request: Request,
  context: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await context.params;

  return withApiHandler(request, async ({ requestId, route }) => {
    const { supabase, user } = await requireOrgAccess(request, orgId, "manager");

    const url = new URL(request.url);
    const parsedQuery = adoptionGraphQuerySchema.safeParse({
      controlId: url.searchParams.get("controlId") ?? undefined,
      roleTrack: url.searchParams.get("roleTrack") ?? undefined,
      window: url.searchParams.get("window") ?? undefined,
    });

    if (!parsedQuery.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsedQuery.error.issues[0]?.message ?? "Invalid graph query",
        400,
      );
    }

    const loaded = await loadControlFreshness({
      supabase,
      orgId,
      controlIds: parsedQuery.data.controlId ? [parsedQuery.data.controlId] : undefined,
    });

    const controlIds = loaded.controls.map((control) => control.id);
    const mappingsResult = await supabase
      .from("control_mappings")
      .select("id,control_id,campaign_id,module_id,obligation_id,mapping_strength")
      .eq("org_id", orgId)
      .eq("active", true)
      .in("control_id", controlIds.length > 0 ? controlIds : ["00000000-0000-0000-0000-000000000000"]);

    if (mappingsResult.error) {
      throw new ApiError("DB_ERROR", mappingsResult.error.message, 500);
    }

    const mappingRows = mappingsResult.data ?? [];
    const obligationIds = Array.from(
      new Set(
        mappingRows
          .map((mapping) => mapping.obligation_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const campaignIds = Array.from(
      new Set(
        mappingRows
          .map((mapping) => mapping.campaign_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const moduleIds = Array.from(
      new Set(
        mappingRows
          .map((mapping) => mapping.module_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const [obligationsResult, campaignsResult, modulesResult, evidenceResult, persistedEdgesResult] =
      await Promise.all([
        obligationIds.length > 0
          ? supabase
              .from("policy_obligations")
              .select("id,title,detail,role_track")
              .eq("org_id", orgId)
              .in("id", obligationIds)
          : Promise.resolve({ data: [], error: null }),
        campaignIds.length > 0
          ? supabase
              .from("learning_campaigns")
              .select("id,name,status")
              .eq("org_id", orgId)
              .in("id", campaignIds)
          : Promise.resolve({ data: [], error: null }),
        moduleIds.length > 0
          ? supabase
              .from("learning_modules")
              .select("id,title,role_track")
              .eq("org_id", orgId)
              .in("id", moduleIds)
          : Promise.resolve({ data: [], error: null }),
        controlIds.length > 0
          ? supabase
              .from("evidence_objects")
              .select("id,control_id,evidence_status,occurred_at")
              .eq("org_id", orgId)
              .in("control_id", controlIds)
              .gte(
                "occurred_at",
                new Date(Date.now() - (parsedQuery.data.window ?? 30) * 86400000).toISOString(),
              )
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("adoption_edges")
          .select("id,edge_type,obligation_id,control_id,campaign_id,module_id,weight,metadata_json")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

    if (
      obligationsResult.error ||
      campaignsResult.error ||
      modulesResult.error ||
      evidenceResult.error ||
      persistedEdgesResult.error
    ) {
      throw new ApiError(
        "DB_ERROR",
        obligationsResult.error?.message ??
          campaignsResult.error?.message ??
          modulesResult.error?.message ??
          evidenceResult.error?.message ??
          persistedEdgesResult.error?.message ??
          "Failed to build adoption graph",
        500,
      );
    }

    const obligations = (obligationsResult.data ?? []).filter((item) =>
      parsedQuery.data.roleTrack ? item.role_track === parsedQuery.data.roleTrack : true,
    );
    const campaigns = campaignsResult.data ?? [];
    const modules = (modulesResult.data ?? []).filter((item) =>
      parsedQuery.data.roleTrack ? item.role_track === parsedQuery.data.roleTrack : true,
    );

    const evidenceByControl = new Map<string, { total: number; stale: number; rejected: number; synced: number }>();
    for (const row of evidenceResult.data ?? []) {
      if (!row.control_id) continue;
      const current = evidenceByControl.get(row.control_id) ?? {
        total: 0,
        stale: 0,
        rejected: 0,
        synced: 0,
      };
      current.total += 1;
      if (row.evidence_status === "stale") current.stale += 1;
      if (row.evidence_status === "rejected") current.rejected += 1;
      if (row.evidence_status === "synced") current.synced += 1;
      evidenceByControl.set(row.control_id, current);
    }

    const edges: GraphEdge[] = [];

    for (const mapping of mappingRows) {
      if (mapping.obligation_id) {
        edges.push({
          id: `edge-obligation-${mapping.id}`,
          type: "obligation_control",
          from: `obligation:${mapping.obligation_id}`,
          to: `control:${mapping.control_id}`,
          weight: mapping.mapping_strength === "primary" ? 1 : 0.7,
          metadata: {
            mappingStrength: mapping.mapping_strength,
          },
        });
      }

      if (mapping.campaign_id) {
        edges.push({
          id: `edge-campaign-${mapping.id}`,
          type: "control_campaign",
          from: `control:${mapping.control_id}`,
          to: `campaign:${mapping.campaign_id}`,
          weight: mapping.mapping_strength === "primary" ? 1 : 0.75,
          metadata: {},
        });
      }

      if (mapping.module_id) {
        edges.push({
          id: `edge-module-${mapping.id}`,
          type: "control_module",
          from: `control:${mapping.control_id}`,
          to: `module:${mapping.module_id}`,
          weight: mapping.mapping_strength === "primary" ? 1 : 0.8,
          metadata: {},
        });
      }
    }

    for (const control of loaded.controls) {
      const outcome = evidenceByControl.get(control.id) ?? {
        total: 0,
        stale: 0,
        rejected: 0,
        synced: 0,
      };
      const freshness = loaded.computedByControlId.get(control.id);

      edges.push({
        id: `edge-outcome-${control.id}`,
        type: "control_outcome",
        from: `control:${control.id}`,
        to: `outcome:${control.id}`,
        weight: 1,
        metadata: outcome,
      });

      edges.push({
        id: `edge-freshness-${control.id}`,
        type: "control_freshness",
        from: `control:${control.id}`,
        to: `freshness:${control.id}`,
        weight: 1,
        metadata: {
          state: freshness?.state ?? "critical",
          score: freshness?.score ?? 0,
        },
      });
    }

    const persistedEdges =
      (persistedEdgesResult.data ?? []).map((edge) => ({
        id: edge.id,
        type: edge.edge_type,
        obligationId: edge.obligation_id,
        controlId: edge.control_id,
        campaignId: edge.campaign_id,
        moduleId: edge.module_id,
        weight: Number(edge.weight),
        metadata: edge.metadata_json,
      })) ?? [];

    await writeRequestAuditLog({
      supabase,
      requestId,
      route,
      action: "adoption_graph_view",
      statusCode: 200,
      orgId,
      userId: user.id,
      metadata: {
        controls: loaded.controls.length,
        edges: edges.length,
        persistedEdges: persistedEdges.length,
        windowDays: parsedQuery.data.window ?? 30,
      },
    });

    return {
      orgId,
      windowDays: parsedQuery.data.window ?? 30,
      filters: {
        controlId: parsedQuery.data.controlId ?? null,
        roleTrack: parsedQuery.data.roleTrack ?? null,
      },
      nodes: {
        obligations: obligations.map((item) => ({
          id: item.id,
          label: item.title,
          detail: item.detail,
          roleTrack: item.role_track,
        })),
        controls: loaded.controls.map((item) => ({
          id: item.id,
          code: item.code,
          title: item.title,
          riskLevel: item.risk_level,
        })),
        campaigns: campaigns.map((item) => ({
          id: item.id,
          name: item.name,
          status: item.status,
        })),
        modules: modules.map((item) => ({
          id: item.id,
          title: item.title,
          roleTrack: item.role_track,
        })),
        outcomes: loaded.controls.map((item) => ({
          id: `outcome:${item.id}`,
          controlId: item.id,
          ...(evidenceByControl.get(item.id) ?? {
            total: 0,
            stale: 0,
            rejected: 0,
            synced: 0,
          }),
        })),
        freshness: loaded.controls.map((item) => {
          const snapshot = loaded.computedByControlId.get(item.id);
          return {
            id: `freshness:${item.id}`,
            controlId: item.id,
            state: snapshot?.state ?? "critical",
            score: snapshot?.score ?? 0,
            latestEvidenceAt: snapshot?.latestEvidenceAt ?? null,
          };
        }),
      },
      edges,
      persistedEdges,
    };
  });
}
