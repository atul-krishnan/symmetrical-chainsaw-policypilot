import { describe, expect, it } from "vitest";

import {
  attestationSchema,
  campaignGenerateSchema,
  controlFrameworkImportSchema,
  controlMappingUpdateSchema,
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
});
