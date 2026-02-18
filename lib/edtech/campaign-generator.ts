import OpenAI from "openai";

import { runtimeEnv } from "@/lib/env";
import { llmCampaignDraftSchema, type LlmCampaignDraft } from "@/lib/edtech/types";
import type { RoleTrack } from "@/lib/types";

type GenerateDraftInput = {
  campaignName: string;
  obligations: Array<{ detail: string; roleTrack: RoleTrack }>;
  roleTracks: RoleTrack[];
};

function fallbackDraft(input: GenerateDraftInput): LlmCampaignDraft {
  const obligationByRole = input.obligations.reduce<Record<RoleTrack, string[]>>(
    (acc, item) => {
      acc[item.roleTrack].push(item.detail);
      return acc;
    },
    { exec: [], builder: [], general: [] },
  );

  const orderedTracks: RoleTrack[] = ["exec", "builder", "general"];

  return {
    modules: orderedTracks.map((roleTrack, index) => {
      const highlights = obligationByRole[roleTrack].slice(0, 3);
      const bulletList =
        highlights.length > 0
          ? highlights.map((item) => `- ${item}`).join("\n")
          : "- Follow approved AI use cases and escalate uncertainty early.";

      return {
        roleTrack,
        title: `${input.campaignName}: ${roleTrack[0].toUpperCase()}${roleTrack.slice(1)} Readiness`,
        summary: `Key policy expectations for ${roleTrack} teams with practical actions and decision rules.`,
        contentMarkdown: `## Why this matters\n\nYour role has direct accountability for compliant AI usage.\n\n## Required behavior\n\n${bulletList}\n\n## What to do when unsure\n\nEscalate to legal/security before sharing data or deploying changes.`,
        passScore: 80,
        estimatedMinutes: 10 + index * 2,
        quizQuestions: [
          {
            prompt: "What is the safest first action when a policy requirement is unclear?",
            choices: [
              "Proceed quickly and document later",
              "Escalate to policy owner or security/legal reviewer",
              "Ask a teammate for informal approval",
              "Skip the task permanently",
            ],
            correctChoiceIndex: 1,
            explanation: "Escalation creates auditable, approved decision making for uncertain cases.",
          },
          {
            prompt: "Which approach best aligns with enterprise AI policy controls?",
            choices: [
              "Use unapproved tools for urgent deadlines",
              "Share sensitive inputs in public chatbots",
              "Follow approved tools, data boundaries, and review gates",
              "Disable logs to reduce noise",
            ],
            correctChoiceIndex: 2,
            explanation: "Approved toolchains and boundary controls are core policy requirements.",
          },
          {
            prompt: "Why are attestations required at the end of training?",
            choices: [
              "To increase slide count",
              "To replace legal review",
              "To create auditable proof of policy acknowledgement",
              "To block all AI work",
            ],
            correctChoiceIndex: 2,
            explanation: "Attestations provide formal evidence for audits and governance reviews.",
          },
        ],
      };
    }),
  };
}

async function generateWithOpenAi(input: GenerateDraftInput): Promise<LlmCampaignDraft | null> {
  if (!runtimeEnv.openAiApiKey) {
    return null;
  }

  const client = new OpenAI({ apiKey: runtimeEnv.openAiApiKey });

  const prompt = `Create 3 role-specific modules (exec, builder, general).\nCampaign name: ${input.campaignName}.\nPolicy obligations:\n${input.obligations
    .slice(0, 24)
    .map((obligation) => `- [${obligation.roleTrack}] ${obligation.detail}`)
    .join("\n")}`;

  const response = await client.responses.create({
    model: runtimeEnv.openAiModel,
    input: [
      {
        role: "system",
        content:
          "You are an enterprise compliance curriculum designer. Output strict JSON only matching the provided schema.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "campaign_draft",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["modules"],
          properties: {
            modules: {
              type: "array",
              minItems: 3,
              maxItems: 3,
              items: {
                type: "object",
                additionalProperties: false,
                required: [
                  "roleTrack",
                  "title",
                  "summary",
                  "contentMarkdown",
                  "passScore",
                  "estimatedMinutes",
                  "quizQuestions",
                ],
                properties: {
                  roleTrack: { type: "string", enum: ["exec", "builder", "general"] },
                  title: { type: "string", minLength: 5, maxLength: 120 },
                  summary: { type: "string", minLength: 20, maxLength: 300 },
                  contentMarkdown: { type: "string", minLength: 80, maxLength: 5000 },
                  passScore: { type: "integer", minimum: 60, maximum: 100 },
                  estimatedMinutes: { type: "integer", minimum: 3, maximum: 40 },
                  quizQuestions: {
                    type: "array",
                    minItems: 3,
                    maxItems: 8,
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: [
                        "prompt",
                        "choices",
                        "correctChoiceIndex",
                        "explanation",
                      ],
                      properties: {
                        prompt: { type: "string", minLength: 12, maxLength: 220 },
                        choices: {
                          type: "array",
                          minItems: 4,
                          maxItems: 4,
                          items: { type: "string", minLength: 1, maxLength: 180 },
                        },
                        correctChoiceIndex: { type: "integer", minimum: 0, maximum: 3 },
                        explanation: { type: "string", minLength: 10, maxLength: 320 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  } as never);

  const output = (response as { output_text?: string }).output_text;
  if (!output) {
    return null;
  }

  const parsed = llmCampaignDraftSchema.safeParse(JSON.parse(output));
  return parsed.success ? parsed.data : null;
}

export async function generateCampaignDraft(input: GenerateDraftInput): Promise<LlmCampaignDraft> {
  const aiDraft = await generateWithOpenAi(input).catch(() => null);

  if (aiDraft) {
    return aiDraft;
  }

  return fallbackDraft(input);
}
