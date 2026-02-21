import type { ControlRiskLevel, FreshnessState, RoleTrack } from "@/lib/types";

type ControlEvidenceRow = {
  control_id: string | null;
  evidence_status: "queued" | "synced" | "rejected" | "stale" | "superseded" | null;
  occurred_at: string;
  evidence_type?: string | null;
  metadata_json?: Record<string, unknown> | null;
};

export type ControlFreshnessComputed = {
  controlId: string;
  state: FreshnessState;
  score: number;
  latestEvidenceAt: string | null;
  lastPolicyUpdateAt: string | null;
  syncedCount: number;
  staleCount: number;
  rejectedCount: number;
  freshEvidenceCount: number;
  medianAckHours: number | null;
};

export type ControlImpactForecast = {
  totalMappedControls: number;
  freshControls: number;
  staleOrCriticalControls: number;
  projectedFreshCoverageAfterPublish: number;
  riskLabel: "low" | "medium" | "high";
};

export type InterventionProposal = {
  recommendationType:
    | "reminder_cadence"
    | "role_refresher_module"
    | "manager_escalation"
    | "attestation_refresh";
  rationale: string;
  expectedImpactPct: number;
  confidenceScore: number;
  metadata: Record<string, unknown>;
};

function hoursBetween(olderIso: string, newerIso: string): number {
  const older = new Date(olderIso).getTime();
  const newer = new Date(newerIso).getTime();
  if (Number.isNaN(older) || Number.isNaN(newer) || newer <= older) {
    return 0;
  }
  return (newer - older) / 3600000;
}

function daysSince(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const value = new Date(iso).getTime();
  if (Number.isNaN(value)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - value) / 86400000);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));
  }
  return Number(sorted[mid].toFixed(2));
}

function inferFreshnessState(input: {
  latestEvidenceAt: string | null;
  lastPolicyUpdateAt: string | null;
  staleCount: number;
  rejectedCount: number;
}): FreshnessState {
  const evidenceAgeDays = daysSince(input.latestEvidenceAt);
  const policyAgeDays = daysSince(input.lastPolicyUpdateAt);
  const policyHasMoreRecentChange =
    input.latestEvidenceAt && input.lastPolicyUpdateAt
      ? new Date(input.lastPolicyUpdateAt).getTime() > new Date(input.latestEvidenceAt).getTime()
      : false;

  if (!input.latestEvidenceAt) return "critical";
  if (input.rejectedCount > 0 && evidenceAgeDays > 7) return "critical";
  if (policyHasMoreRecentChange && policyAgeDays > 2) return "stale";
  if (input.staleCount >= 3 || evidenceAgeDays > 30) return "critical";
  if (input.staleCount >= 1 || evidenceAgeDays > 14) return "stale";
  if (evidenceAgeDays > 7) return "aging";
  return "fresh";
}

function inferFreshnessScore(input: {
  state: FreshnessState;
  syncedCount: number;
  staleCount: number;
  rejectedCount: number;
  latestEvidenceAt: string | null;
  lastPolicyUpdateAt: string | null;
}): number {
  const base = (() => {
    if (input.state === "fresh") return 92;
    if (input.state === "aging") return 75;
    if (input.state === "stale") return 52;
    return 28;
  })();

  const evidenceAgePenalty = Math.min(35, Math.floor(daysSince(input.latestEvidenceAt)));
  const policyLagPenalty = input.lastPolicyUpdateAt
    ? Math.min(25, Math.floor(daysSince(input.lastPolicyUpdateAt) / 2))
    : 0;
  const stalePenalty = input.staleCount * 6;
  const rejectedPenalty = input.rejectedCount * 8;
  const syncedBoost = Math.min(20, input.syncedCount * 2);

  const score = base - evidenceAgePenalty - policyLagPenalty - stalePenalty - rejectedPenalty + syncedBoost;
  return Math.max(0, Math.min(100, score));
}

export function computeControlFreshness(input: {
  controlId: string;
  evidenceRows: ControlEvidenceRow[];
  lastPolicyUpdateAt: string | null;
}): ControlFreshnessComputed {
  let latestEvidenceAt: string | null = null;
  let syncedCount = 0;
  let staleCount = 0;
  let rejectedCount = 0;
  let freshEvidenceCount = 0;
  const ackDurations: number[] = [];

  const nowIso = new Date().toISOString();

  for (const row of input.evidenceRows) {
    if (!latestEvidenceAt || new Date(row.occurred_at).getTime() > new Date(latestEvidenceAt).getTime()) {
      latestEvidenceAt = row.occurred_at;
    }

    if (row.evidence_status === "synced") syncedCount += 1;
    if (row.evidence_status === "stale") staleCount += 1;
    if (row.evidence_status === "rejected") rejectedCount += 1;

    const ageDays = daysSince(row.occurred_at);
    if (ageDays <= 14 && (row.evidence_status === "queued" || row.evidence_status === "synced")) {
      freshEvidenceCount += 1;
    }

    if (row.evidence_type === "material_acknowledgment") {
      const metadata = row.metadata_json ?? {};
      const startedAtRaw = metadata.startedAt;
      if (typeof startedAtRaw === "string") {
        ackDurations.push(hoursBetween(startedAtRaw, row.occurred_at));
      } else {
        ackDurations.push(hoursBetween(row.occurred_at, nowIso));
      }
    }
  }

  const state = inferFreshnessState({
    latestEvidenceAt,
    lastPolicyUpdateAt: input.lastPolicyUpdateAt,
    staleCount,
    rejectedCount,
  });

  const score = inferFreshnessScore({
    state,
    syncedCount,
    staleCount,
    rejectedCount,
    latestEvidenceAt,
    lastPolicyUpdateAt: input.lastPolicyUpdateAt,
  });

  return {
    controlId: input.controlId,
    state,
    score,
    latestEvidenceAt,
    lastPolicyUpdateAt: input.lastPolicyUpdateAt,
    syncedCount,
    staleCount,
    rejectedCount,
    freshEvidenceCount,
    medianAckHours: median(ackDurations),
  };
}

export function summarizeFreshness(computed: ControlFreshnessComputed[]): {
  freshControls: number;
  totalControls: number;
  freshCoverageRatio: number;
  staleControls: number;
  criticalControls: number;
} {
  const totalControls = computed.length;
  const freshControls = computed.filter((item) => item.state === "fresh").length;
  const staleControls = computed.filter((item) => item.state === "stale").length;
  const criticalControls = computed.filter((item) => item.state === "critical").length;
  return {
    freshControls,
    totalControls,
    freshCoverageRatio: totalControls > 0 ? freshControls / totalControls : 0,
    staleControls,
    criticalControls,
  };
}

export function buildControlImpactForecast(input: {
  mappedControlIds: string[];
  freshnessByControlId: Map<string, ControlFreshnessComputed>;
}): ControlImpactForecast {
  const totalMappedControls = input.mappedControlIds.length;
  let freshControls = 0;
  let staleOrCriticalControls = 0;

  for (const controlId of input.mappedControlIds) {
    const snapshot = input.freshnessByControlId.get(controlId);
    if (!snapshot) {
      staleOrCriticalControls += 1;
      continue;
    }

    if (snapshot.state === "fresh") {
      freshControls += 1;
    } else if (snapshot.state === "stale" || snapshot.state === "critical") {
      staleOrCriticalControls += 1;
    }
  }

  const projectedFreshCoverageAfterPublish =
    totalMappedControls > 0 ? (freshControls + staleOrCriticalControls * 0.65) / totalMappedControls : 0;

  const riskLabel: "low" | "medium" | "high" =
    staleOrCriticalControls === 0
      ? "low"
      : staleOrCriticalControls / Math.max(1, totalMappedControls) >= 0.5
        ? "high"
        : "medium";

  return {
    totalMappedControls,
    freshControls,
    staleOrCriticalControls,
    projectedFreshCoverageAfterPublish,
    riskLabel,
  };
}

export function recommendInterventions(input: {
  controlId: string;
  controlCode: string;
  controlTitle: string;
  riskLevel: ControlRiskLevel;
  roleTrack: RoleTrack | null;
  freshness: ControlFreshnessComputed;
}): InterventionProposal[] {
  const proposals: InterventionProposal[] = [];
  const state = input.freshness.state;

  if (state === "aging" || state === "stale" || state === "critical") {
    proposals.push({
      recommendationType: "reminder_cadence",
      rationale:
        "Learner evidence freshness is declining. Increase reminder cadence for pending assignments tied to this control.",
      expectedImpactPct: state === "aging" ? 8 : 14,
      confidenceScore: state === "aging" ? 0.68 : 0.76,
      metadata: {
        state,
        controlCode: input.controlCode,
      },
    });
  }

  if (state === "stale" || state === "critical") {
    proposals.push({
      recommendationType: "attestation_refresh",
      rationale:
        "Control evidence is stale relative to policy expectations. Trigger attestation refresh to re-establish current control intent.",
      expectedImpactPct: 11,
      confidenceScore: 0.73,
      metadata: {
        staleCount: input.freshness.staleCount,
        rejectedCount: input.freshness.rejectedCount,
      },
    });
  }

  if (state === "critical" || input.freshness.rejectedCount >= 2) {
    proposals.push({
      recommendationType: "manager_escalation",
      rationale:
        "Critical freshness and rejection signals indicate operational control risk. Escalate to role managers for remediation ownership.",
      expectedImpactPct: 18,
      confidenceScore: 0.81,
      metadata: {
        riskLevel: input.riskLevel,
        roleTrack: input.roleTrack,
      },
    });

    proposals.push({
      recommendationType: "role_refresher_module",
      rationale:
        "Role-level behavior appears drifted from policy. Publish a focused refresher module for the impacted cohort.",
      expectedImpactPct: 21,
      confidenceScore: 0.79,
      metadata: {
        roleTrack: input.roleTrack,
      },
    });
  }

  return proposals.slice(0, 3);
}

export function scoreToTrendSparkline(score: number): number[] {
  const bounded = Math.max(0, Math.min(100, score));
  const floor = Math.max(0, bounded - 18);
  return [
    Number((floor + 2).toFixed(1)),
    Number((floor + 5).toFixed(1)),
    Number((floor + 8).toFixed(1)),
    Number((bounded - 4).toFixed(1)),
    Number((bounded - 2).toFixed(1)),
    Number((bounded - 1).toFixed(1)),
    Number(bounded.toFixed(1)),
  ];
}

export function benchmarkBand(percentile: number | null): string {
  if (percentile === null || Number.isNaN(percentile)) return "insufficient-data";
  if (percentile >= 80) return "top";
  if (percentile >= 60) return "strong";
  if (percentile >= 40) return "average";
  if (percentile >= 20) return "watch";
  return "at-risk";
}
