import { z } from "zod";

export const llmQuizQuestionSchema = z.object({
  prompt: z.string().min(12).max(220),
  choices: z.array(z.string().min(1).max(180)).length(4),
  correctChoiceIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(10).max(320),
});

export const llmModuleSchema = z.object({
  roleTrack: z.enum(["exec", "builder", "general"]),
  title: z.string().min(5).max(120),
  summary: z.string().min(20).max(300),
  contentMarkdown: z.string().min(80).max(5000),
  passScore: z.number().int().min(60).max(100),
  estimatedMinutes: z.number().int().min(3).max(40),
  quizQuestions: z.array(llmQuizQuestionSchema).min(3).max(8),
});

export const llmCampaignDraftSchema = z.object({
  modules: z.array(llmModuleSchema).length(3),
});

export type LlmCampaignDraft = z.infer<typeof llmCampaignDraftSchema>;
