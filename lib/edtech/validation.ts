import { z } from "zod";
import { moduleMediaEmbedSchema } from "@/lib/edtech/types";

export const orgRoleSchema = z.enum(["owner", "admin", "manager", "learner"]);
export const roleTrackSchema = z.enum(["exec", "builder", "general"]);

export const policyUploadSchema = z.object({
  title: z.string().min(3).max(140),
  orgId: z.string().uuid(),
});

export const campaignGenerateSchema = z.object({
  name: z.string().min(3).max(160),
  policyIds: z.array(z.string().uuid()).min(1).max(8),
  roleTracks: z.array(roleTrackSchema).min(1).max(3),
  dueAt: z.string().datetime().optional().nullable(),
});

export const quizQuestionUpdateSchema = z.object({
  id: z.string().uuid().optional(),
  prompt: z.string().min(12).max(220),
  choices: z.array(z.string().min(1).max(180)).length(4),
  correctChoiceIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(10).max(320),
});

export const campaignUpdateSchema = z.object({
  name: z.string().min(3).max(160).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  modules: z
    .array(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(3).max(120),
        summary: z.string().min(10).max(300),
        contentMarkdown: z.string().min(80).max(8000),
        passScore: z.number().int().min(60).max(100),
        estimatedMinutes: z.number().int().min(3).max(45),
        mediaEmbeds: z.array(moduleMediaEmbedSchema).min(0).max(12).optional(),
        quizQuestions: z.array(quizQuestionUpdateSchema).min(1).max(8).optional(),
      }),
    )
    .min(1)
    .max(3)
    .optional(),
});

export const quizAttemptSchema = z.object({
  answers: z.array(z.number().int().min(0).max(3)).min(1).max(20),
});

export const attestationSchema = z.object({
  signatureName: z.string().min(2).max(120),
  accepted: z.literal(true),
});

export const nudgeSendSchema = z.object({
  mode: z.enum(["all_pending", "overdue_only"]).default("all_pending"),
});

export const moduleMediaUploadSchema = z.object({
  embedId: z.string().uuid(),
});

export const controlFrameworkTemplateSchema = z.enum(["soc2", "iso27001", "ai_governance"]);

export const controlFrameworkImportSchema = z.object({
  templates: z.array(controlFrameworkTemplateSchema).min(1).max(3),
});

export const controlMappingInputSchema = z
  .object({
    campaignId: z.string().uuid().nullable().optional(),
    moduleId: z.string().uuid().nullable().optional(),
    policyId: z.string().uuid().nullable().optional(),
    obligationId: z.string().uuid().nullable().optional(),
    mappingStrength: z.enum(["primary", "supporting"]).default("supporting"),
    active: z.boolean().default(true),
  })
  .refine(
    (value) =>
      Boolean(value.campaignId || value.moduleId || value.policyId || value.obligationId),
    {
      message: "Each mapping must include at least one target reference",
    },
  );

export const controlMappingUpdateSchema = z.object({
  mappings: z.array(controlMappingInputSchema).max(64),
});

export const evidenceQuerySchema = z.object({
  controlId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  status: z.enum(["queued", "synced", "rejected", "stale", "superseded"]).optional(),
});

export const integrationConnectSchema = z.object({
  apiKey: z.string().min(8).max(300),
  accountId: z.string().min(2).max(120).optional(),
  workspaceId: z.string().min(2).max(120).optional(),
  scopes: z.array(z.string().min(1).max(120)).max(20).optional(),
});

export const integrationProviderSchema = z.enum(["vanta", "drata"]);

export const integrationSyncSchema = z.object({
  evidenceStatus: z
    .enum(["queued", "stale", "rejected", "synced", "superseded"])
    .default("queued"),
  limit: z.number().int().min(1).max(500).default(200),
});

export const bootstrapOwnerSchema = z.object({
  orgName: z.string().trim().min(3).max(80).optional(),
});

export const storageMimeSchema = z.enum([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);
