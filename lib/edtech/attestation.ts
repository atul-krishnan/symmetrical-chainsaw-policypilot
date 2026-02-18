import { createHash, createHmac } from "node:crypto";

import { runtimeEnv } from "@/lib/env";

export function buildAttestationMetadata(input: {
  campaignId: string;
  userId: string;
  signatureName: string;
  acceptedAtIso: string;
  userAgent: string;
  ipAddress: string;
}): Record<string, string> {
  return {
    campaignId: input.campaignId,
    userId: input.userId,
    signatureName: input.signatureName,
    acceptedAtIso: input.acceptedAtIso,
    userAgentHash: createHash("sha256").update(input.userAgent).digest("hex"),
    ipHash: createHash("sha256").update(input.ipAddress).digest("hex"),
  };
}

export function buildAttestationChecksum(metadata: Record<string, unknown>): string {
  if (!runtimeEnv.attestationSigningSecret) {
    return createHash("sha256").update(JSON.stringify(metadata)).digest("hex");
  }

  return createHmac("sha256", runtimeEnv.attestationSigningSecret)
    .update(JSON.stringify(metadata))
    .digest("hex");
}
