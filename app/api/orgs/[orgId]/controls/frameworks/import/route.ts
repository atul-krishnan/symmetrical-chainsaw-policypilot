import { ApiError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { withApiHandler } from "@/lib/api/route-helpers";
import { getControlFrameworkTemplate } from "@/lib/edtech/control-templates";
import { requireOrgAccess } from "@/lib/edtech/db";
import { writeRequestAuditLog } from "@/lib/edtech/request-audit-log";
import { controlFrameworkImportSchema } from "@/lib/edtech/validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await context.params;

  return withApiHandler(request, async ({ requestId, route }) => {
    const { supabase, user } = await requireOrgAccess(request, orgId, "admin");

    const payload = await parseJsonBody<unknown>(request);
    const parsed = controlFrameworkImportSchema.safeParse(payload);

    if (!parsed.success) {
      throw new ApiError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid framework import payload",
        400,
      );
    }

    let importedFrameworks = 0;
    let importedControls = 0;

    for (const templateId of parsed.data.templates) {
      const template = getControlFrameworkTemplate(templateId);

      const frameworkUpsert = await supabase
        .from("control_frameworks")
        .upsert(
          {
            org_id: orgId,
            name: template.name,
            version: template.version,
            source: "template",
            metadata_json: { templateId },
            created_by: user.id,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "org_id,name,version",
          },
        )
        .select("id")
        .single();

      if (frameworkUpsert.error || !frameworkUpsert.data) {
        throw new ApiError(
          "DB_ERROR",
          frameworkUpsert.error?.message ?? "Unable to import framework",
          500,
        );
      }

      importedFrameworks += 1;

      const controlsUpsert = await supabase.from("controls").upsert(
        template.controls.map((control) => ({
          org_id: orgId,
          framework_id: frameworkUpsert.data.id,
          code: `${template.name}:${control.code}`,
          title: control.title,
          description: control.description,
          risk_level: control.riskLevel,
          metadata_json: {
            templateId,
            templateControlCode: control.code,
          },
          created_by: user.id,
          updated_at: new Date().toISOString(),
        })),
        {
          onConflict: "org_id,code",
        },
      );

      if (controlsUpsert.error) {
        throw new ApiError("DB_ERROR", controlsUpsert.error.message, 500);
      }

      importedControls += template.controls.length;
    }

    await writeRequestAuditLog({
      supabase,
      requestId,
      route,
      action: "control_framework_import",
      statusCode: 200,
      orgId,
      userId: user.id,
      metadata: {
        templates: parsed.data.templates,
        importedFrameworks,
        importedControls,
      },
    });

    return {
      ok: true,
      importedFrameworks,
      importedControls,
    };
  });
}
