import { randomUUID } from "node:crypto";

import { ApiError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { withApiHandler } from "@/lib/api/route-helpers";
import { requireOrgAccess } from "@/lib/edtech/db";
import { writeRequestAuditLog } from "@/lib/edtech/request-audit-log";
import { controlMappingUpdateSchema } from "@/lib/edtech/validation";

export async function PUT(
  request: Request,
  context: { params: Promise<{ orgId: string; controlId: string }> },
) {
  const { orgId, controlId } = await context.params;

  return withApiHandler(request, async ({ requestId, route }) => {
    const { supabase, user } = await requireOrgAccess(request, orgId, "admin");

    const controlResult = await supabase
      .from("controls")
      .select("id")
      .eq("id", controlId)
      .eq("org_id", orgId)
      .single();

    if (controlResult.error || !controlResult.data) {
      throw new ApiError("NOT_FOUND", "Control not found", 404);
    }

    const payload = await parseJsonBody<unknown>(request);
    const parsed = controlMappingUpdateSchema.safeParse(payload);

    if (!parsed.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid control mapping payload",
        400,
      );
    }

    const deactivateExisting = await supabase
      .from("control_mappings")
      .update({
        active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId)
      .eq("control_id", controlId)
      .eq("active", true);

    if (deactivateExisting.error) {
      throw new ApiError("DB_ERROR", deactivateExisting.error.message, 500);
    }

    if (parsed.data.mappings.length > 0) {
      const insertResult = await supabase.from("control_mappings").insert(
        parsed.data.mappings.map((mapping) => ({
          id: randomUUID(),
          org_id: orgId,
          control_id: controlId,
          campaign_id: mapping.campaignId ?? null,
          module_id: mapping.moduleId ?? null,
          policy_id: mapping.policyId ?? null,
          obligation_id: mapping.obligationId ?? null,
          mapping_strength: mapping.mappingStrength,
          active: mapping.active,
          metadata_json: {},
          created_by: user.id,
          updated_at: new Date().toISOString(),
        })),
      );

      if (insertResult.error) {
        throw new ApiError("DB_ERROR", insertResult.error.message, 500);
      }
    }

    await writeRequestAuditLog({
      supabase,
      requestId,
      route,
      action: "control_mapping_update",
      statusCode: 200,
      orgId,
      userId: user.id,
      metadata: {
        controlId,
        mappingCount: parsed.data.mappings.length,
      },
    });

    return {
      ok: true,
      controlId,
      mappingCount: parsed.data.mappings.length,
    };
  });
}
