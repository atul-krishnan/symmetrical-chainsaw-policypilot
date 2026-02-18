import type { CampaignMetrics } from "@/lib/types";

export function computeCampaignMetrics(input: {
  campaignId: string;
  assignmentsTotal: number;
  assignmentsCompleted: number;
  attestationsCount: number;
  averageScore: number;
}): CampaignMetrics {
  const completionRate =
    input.assignmentsTotal > 0
      ? input.assignmentsCompleted / input.assignmentsTotal
      : 0;

  const attestationRate =
    input.assignmentsCompleted > 0
      ? input.attestationsCount / input.assignmentsCompleted
      : 0;

  return {
    campaignId: input.campaignId,
    assignmentsTotal: input.assignmentsTotal,
    assignmentsCompleted: input.assignmentsCompleted,
    completionRate,
    attestationRate,
    averageScore: input.averageScore,
  };
}
