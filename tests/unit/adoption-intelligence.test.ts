import { describe, expect, it } from "vitest";

import {
  buildControlImpactForecast,
  computeControlFreshness,
  recommendInterventions,
  summarizeFreshness,
} from "@/lib/edtech/adoption-intelligence";

describe("adoption intelligence helpers", () => {
  it("computes critical freshness when evidence is stale and rejected", () => {
    const result = computeControlFreshness({
      controlId: "11111111-1111-1111-1111-111111111111",
      lastPolicyUpdateAt: new Date(Date.now() - 20 * 86400000).toISOString(),
      evidenceRows: [
        {
          control_id: "11111111-1111-1111-1111-111111111111",
          evidence_status: "rejected",
          occurred_at: new Date(Date.now() - 18 * 86400000).toISOString(),
          evidence_type: "quiz_attempt",
          metadata_json: {},
        },
        {
          control_id: "11111111-1111-1111-1111-111111111111",
          evidence_status: "stale",
          occurred_at: new Date(Date.now() - 22 * 86400000).toISOString(),
          evidence_type: "attestation",
          metadata_json: {},
        },
      ],
    });

    expect(result.state).toBe("critical");
    expect(result.score).toBeLessThan(60);
  });

  it("recommends interventions for critical controls", () => {
    const freshness = computeControlFreshness({
      controlId: "22222222-2222-2222-2222-222222222222",
      lastPolicyUpdateAt: new Date(Date.now() - 16 * 86400000).toISOString(),
      evidenceRows: [
        {
          control_id: "22222222-2222-2222-2222-222222222222",
          evidence_status: "rejected",
          occurred_at: new Date(Date.now() - 16 * 86400000).toISOString(),
          evidence_type: "quiz_attempt",
          metadata_json: {},
        },
      ],
    });

    const recommendations = recommendInterventions({
      controlId: "22222222-2222-2222-2222-222222222222",
      controlCode: "SOC2:CC2.2",
      controlTitle: "Communication of responsibilities",
      riskLevel: "high",
      roleTrack: "builder",
      freshness,
    });

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.some((item) => item.recommendationType === "manager_escalation")).toBe(
      true,
    );
  });

  it("builds control impact forecast and summary", () => {
    const fresh = computeControlFreshness({
      controlId: "33333333-3333-3333-3333-333333333333",
      lastPolicyUpdateAt: null,
      evidenceRows: [
        {
          control_id: "33333333-3333-3333-3333-333333333333",
          evidence_status: "synced",
          occurred_at: new Date().toISOString(),
          evidence_type: "attestation",
          metadata_json: {},
        },
      ],
    });

    const stale = computeControlFreshness({
      controlId: "44444444-4444-4444-4444-444444444444",
      lastPolicyUpdateAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      evidenceRows: [],
    });

    const summary = summarizeFreshness([fresh, stale]);
    expect(summary.totalControls).toBe(2);
    expect(summary.freshControls).toBe(1);

    const forecast = buildControlImpactForecast({
      mappedControlIds: [fresh.controlId, stale.controlId],
      freshnessByControlId: new Map([
        [fresh.controlId, fresh],
        [stale.controlId, stale],
      ]),
    });

    expect(forecast.totalMappedControls).toBe(2);
    expect(forecast.staleOrCriticalControls).toBeGreaterThan(0);
  });
});
