import { describe, expect, it } from "vitest";

import { buildCampaignCsv } from "@/lib/edtech/audit-export";

describe("buildCampaignCsv", () => {
  it("serializes rows with escaped values", () => {
    const csv = buildCampaignCsv([
      {
        assignment_id: "a1",
        value: 'contains "quote"',
      },
    ]);

    expect(csv).toContain("assignment_id,value");
    expect(csv).toContain('"contains ""quote"""');
  });
});
