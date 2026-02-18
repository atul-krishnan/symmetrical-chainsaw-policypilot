import { z } from "zod";

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

export const storageMimeSchema = z.enum([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);
