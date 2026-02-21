import { describe, expect, it } from "vitest";

import {
  adoptionGraphQuerySchema,
  adoptionFreshnessQuerySchema,
  auditNarrativeGenerateSchema,
  attestationSchema,
  benchmarkQuerySchema,
  campaignGenerateSchema,
  controlFrameworkImportSchema,
  controlMappingUpdateSchema,
  interventionApproveSchema,
  interventionExecuteSchema,
  interventionListQuerySchema,
  interventionRecommendSchema,
  integrationConnectSchema,
  integrationSyncSchema,
  policyUploadSchema,
  quizAttemptSchema,
} from "@/lib/edtech/validation";

describe("validation schemas", () => {
  it("accepts valid campaign generation payload", () => {
    const result = campaignGenerateSchema.safeParse({
      name: "AI Literacy v1",
      policyIds: ["f8ef8cf3-8f3d-4fdd-8cd7-87f1164ca1e7"],
      roleTracks: ["exec", "builder", "general"],
      dueAt: "2026-03-01T12:00:00.000Z",
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid attestation payload", () => {
    const result = attestationSchema.safeParse({
      signatureName: "",
      accepted: false,
    });

    expect(result.success).toBe(false);
  });

  it("accepts quiz answers payload", () => {
    const result = quizAttemptSchema.safeParse({
      answers: [0, 1, 3],
    });

    expect(result.success).toBe(true);
  });

  it("requires upload title and org id", () => {
    const result = policyUploadSchema.safeParse({
      title: "",
      orgId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("accepts control framework import payload", () => {
    const result = controlFrameworkImportSchema.safeParse({
      templates: ["soc2", "iso27001"],
    });

    expect(result.success).toBe(true);
  });

  it("rejects control mapping payload without target references", () => {
    const result = controlMappingUpdateSchema.safeParse({
      mappings: [
        {
          mappingStrength: "primary",
          active: true,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("accepts integration connect payload with optional scope list", () => {
    const result = integrationConnectSchema.safeParse({
      apiKey: "secret-api-key-12345",
      scopes: ["evidence.write", "controls.read"],
    });

    expect(result.success).toBe(true);
  });

  it("applies integration sync defaults", () => {
    const result = integrationSyncSchema.parse({});

    expect(result.evidenceStatus).toBe("queued");
    expect(result.limit).toBe(200);
  });

  it("accepts adoption graph query with roleTrack filter", () => {
    const result = adoptionGraphQuerySchema.safeParse({
      roleTrack: "builder",
      window: 30,
    });

    expect(result.success).toBe(true);
  });

  it("applies defaults for intervention recommendation payload", () => {
    const result = interventionRecommendSchema.parse({});

    expect(result.maxRecommendations).toBe(25);
  });

  it("validates intervention list and execute payloads", () => {
    const list = interventionListQuerySchema.safeParse({
      status: "approved",
    });
    const execute = interventionExecuteSchema.safeParse({
      idempotencyKey: "manual-key-123456",
    });
    const approve = interventionApproveSchema.safeParse({
      note: "Reviewed by security lead.",
    });

    expect(list.success).toBe(true);
    expect(execute.success).toBe(true);
    expect(approve.success).toBe(true);
  });

  it("validates benchmark and audit narrative query payloads", () => {
    const benchmark = benchmarkQuerySchema.safeParse({
      metric: "control_freshness",
      cohort: "mid_market_saas",
      window: 60,
    });
    const freshness = adoptionFreshnessQuerySchema.safeParse({
      window: 30,
    });
    const narrative = auditNarrativeGenerateSchema.safeParse({
      window: 30,
    });

    expect(benchmark.success).toBe(true);
    expect(freshness.success).toBe(true);
    expect(narrative.success).toBe(true);
  });
});
