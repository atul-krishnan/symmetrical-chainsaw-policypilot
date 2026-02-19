import { describe, expect, it } from "vitest";

import {
  buildFrameworkImportRows,
  getControlFrameworkTemplate,
  listControlFrameworkTemplates,
} from "@/lib/edtech/control-templates";

describe("control framework templates", () => {
  it("lists baseline templates", () => {
    const templates = listControlFrameworkTemplates();

    expect(templates).toHaveLength(3);
    expect(templates.map((template) => template.id).sort()).toEqual([
      "ai_governance",
      "iso27001",
      "soc2",
    ]);
  });

  it("returns SOC 2 template details", () => {
    const template = getControlFrameworkTemplate("soc2");

    expect(template.name).toBe("SOC 2");
    expect(template.controls.length).toBeGreaterThan(0);
    expect(template.controls[0]?.code).toContain("CC");
  });

  it("builds framework import rows with prefixed control codes", () => {
    const rows = buildFrameworkImportRows({
      orgId: "8cc9ec19-440f-4cf8-a4e3-65737f4b9a46",
      createdBy: "5dd08f34-a2ec-4c9f-bf3f-f0ce3db20f9e",
      templateIds: ["soc2", "ai_governance"],
    });

    expect(rows).toHaveLength(2);

    const soc2 = rows[0];
    const aiGov = rows[1];

    expect(soc2.framework.name).toBe("SOC 2");
    expect(aiGov.framework.name).toBe("AI Governance");

    expect(soc2.controls.every((control) => control.code.startsWith("SOC 2:"))).toBe(true);
    expect(aiGov.controls.every((control) => control.code.startsWith("AI Governance:"))).toBe(true);
  });
});
