import { describe, expect, it } from "vitest";

import { maskApiKey } from "@/lib/edtech/integration-sync";

describe("integration sync helpers", () => {
  it("hashes API key and returns last four characters", () => {
    const result = maskApiKey("test-key-123456");

    expect(result.hash).toHaveLength(64);
    expect(result.last4).toBe("3456");
  });

  it("trims whitespace before hashing and extracting suffix", () => {
    const first = maskApiKey("test-key-abcdef");
    const second = maskApiKey("  test-key-abcdef   ");

    expect(first.hash).toBe(second.hash);
    expect(second.last4).toBe("cdef");
  });
});
