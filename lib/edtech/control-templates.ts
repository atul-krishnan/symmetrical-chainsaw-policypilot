import { randomUUID } from "node:crypto";

import type { ControlRiskLevel } from "@/lib/types";

export type ControlTemplateId = "soc2" | "iso27001" | "ai_governance";

type TemplateControl = {
  code: string;
  title: string;
  description: string;
  riskLevel: ControlRiskLevel;
};

type ControlFrameworkTemplate = {
  id: ControlTemplateId;
  name: string;
  version: string;
  source: "template";
  controls: TemplateControl[];
};

const TEMPLATES: Record<ControlTemplateId, ControlFrameworkTemplate> = {
  soc2: {
    id: "soc2",
    name: "SOC 2",
    version: "2017",
    source: "template",
    controls: [
      {
        code: "CC1.2",
        title: "Board and oversight accountability",
        description:
          "Leadership demonstrates commitment to integrity and ethical values in control execution.",
        riskLevel: "high",
      },
      {
        code: "CC2.2",
        title: "Communication of responsibilities",
        description:
          "Personnel are informed of control responsibilities and expected policy behaviors.",
        riskLevel: "medium",
      },
      {
        code: "CC7.2",
        title: "Security event response readiness",
        description:
          "Relevant personnel are trained to identify and respond to security incidents.",
        riskLevel: "high",
      },
    ],
  },
  iso27001: {
    id: "iso27001",
    name: "ISO 27001",
    version: "2022",
    source: "template",
    controls: [
      {
        code: "A.6.3",
        title: "Information security awareness",
        description:
          "Personnel receive security awareness and role-relevant policy training at planned intervals.",
        riskLevel: "high",
      },
      {
        code: "A.5.1",
        title: "Policies for information security",
        description:
          "Information security policies are approved, communicated, and acknowledged.",
        riskLevel: "high",
      },
      {
        code: "A.8.2",
        title: "Information classification handling",
        description:
          "Users apply classification and handling rules consistently in daily workflows.",
        riskLevel: "medium",
      },
    ],
  },
  ai_governance: {
    id: "ai_governance",
    name: "AI Governance",
    version: "policy-pilot-v1",
    source: "template",
    controls: [
      {
        code: "AI-01",
        title: "Approved AI usage boundaries",
        description:
          "Workforce follows approved use cases, data boundaries, and escalation controls for AI systems.",
        riskLevel: "high",
      },
      {
        code: "AI-02",
        title: "Human review and accountability",
        description:
          "High-impact AI outcomes require documented human oversight and sign-off.",
        riskLevel: "high",
      },
      {
        code: "AI-03",
        title: "Evidence of policy adoption",
        description:
          "Organization can produce role-level completion, assessment, and attestation evidence for AI policy adoption.",
        riskLevel: "medium",
      },
    ],
  },
};

export function getControlFrameworkTemplate(templateId: ControlTemplateId): ControlFrameworkTemplate {
  return TEMPLATES[templateId];
}

export function listControlFrameworkTemplates(): ControlFrameworkTemplate[] {
  return [TEMPLATES.soc2, TEMPLATES.iso27001, TEMPLATES.ai_governance];
}

export function buildFrameworkImportRows(input: {
  orgId: string;
  createdBy: string;
  templateIds: ControlTemplateId[];
}): Array<{
  framework: {
    id: string;
    org_id: string;
    name: string;
    version: string;
    source: "template";
    metadata_json: Record<string, unknown>;
    created_by: string;
  };
  controls: Array<{
    id: string;
    org_id: string;
    framework_id: string;
    code: string;
    title: string;
    description: string;
    risk_level: ControlRiskLevel;
    metadata_json: Record<string, unknown>;
    created_by: string;
  }>;
}> {
  return input.templateIds.map((templateId) => {
    const template = getControlFrameworkTemplate(templateId);
    const frameworkId = randomUUID();

    return {
      framework: {
        id: frameworkId,
        org_id: input.orgId,
        name: template.name,
        version: template.version,
        source: "template",
        metadata_json: {
          templateId,
        },
        created_by: input.createdBy,
      },
      controls: template.controls.map((control) => ({
        id: randomUUID(),
        org_id: input.orgId,
        framework_id: frameworkId,
        code: `${template.name}:${control.code}`,
        title: control.title,
        description: control.description,
        risk_level: control.riskLevel,
        metadata_json: {
          templateId,
          templateControlCode: control.code,
        },
        created_by: input.createdBy,
      })),
    };
  });
}
