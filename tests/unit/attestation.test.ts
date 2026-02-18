import { describe, expect, it } from "vitest";

import { buildAttestationChecksum, buildAttestationMetadata } from "@/lib/edtech/attestation";

describe("attestation helpers", () => {
  it("builds deterministic checksum for identical metadata", () => {
    const metadata = buildAttestationMetadata({
      campaignId: "campaign-1",
      userId: "user-1",
      signatureName: "Alex",
      acceptedAtIso: "2026-02-18T10:00:00.000Z",
      userAgent: "test-agent",
      ipAddress: "127.0.0.1",
    });

    const checksumA = buildAttestationChecksum(metadata);
    const checksumB = buildAttestationChecksum(metadata);

    expect(checksumA).toBe(checksumB);
  });
});
