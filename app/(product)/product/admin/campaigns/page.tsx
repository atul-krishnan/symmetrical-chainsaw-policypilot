"use client";

import { useState } from "react";

import { SessionStatus } from "@/components/product/session-status";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function CampaignsPage() {
  const [orgId, setOrgId] = useState("");
  const [name, setName] = useState("AI Literacy Baseline");
  const [policyIds, setPolicyIds] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setError(null);
    setStatus(null);

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured in this environment.");
      return;
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setError("Sign in before generating campaigns.");
      return;
    }

    const response = await fetch(`/api/orgs/${orgId}/campaigns/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name,
        policyIds: policyIds
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        roleTracks: ["exec", "builder", "general"],
        dueAt: dueAt || null,
      }),
    });

    const body = (await response.json()) as
      | { campaignId: string; status: string }
      | { error: { message: string } };

    if (!response.ok) {
      setError("error" in body ? body.error.message : "Campaign generation failed");
      return;
    }

    const successBody = body as { campaignId: string; status: string };
    setStatus(`Campaign ${successBody.campaignId} created with status ${successBody.status}.`);
  };

  return (
    <section className="mx-auto max-w-5xl rounded-[1.8rem] border border-[#cfc2b5] bg-[#fff8ef] p-6">
      <SessionStatus />
      <h1 className="mt-2 font-display text-4xl text-[#10243e]">Campaign generation</h1>
      <p className="mt-2 text-sm text-[#4f6379]">Create a draft campaign from parsed policy obligations.</p>

      <div className="mt-6 grid gap-3">
        <label className="space-y-1 text-sm">
          <span>Organization ID</span>
          <input
            className="h-11 rounded-xl border border-[#c9bcac] bg-white px-3"
            onChange={(event) => setOrgId(event.target.value)}
            value={orgId}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Campaign name</span>
          <input
            className="h-11 rounded-xl border border-[#c9bcac] bg-white px-3"
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Policy IDs (comma-separated)</span>
          <input
            className="h-11 rounded-xl border border-[#c9bcac] bg-white px-3"
            onChange={(event) => setPolicyIds(event.target.value)}
            value={policyIds}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Due at (ISO datetime)</span>
          <input
            className="h-11 rounded-xl border border-[#c9bcac] bg-white px-3"
            onChange={(event) => setDueAt(event.target.value)}
            placeholder="2026-03-01T12:00:00.000Z"
            value={dueAt}
          />
        </label>

        <button
          className="mt-2 h-11 rounded-xl bg-[#0e8c89] text-sm font-semibold text-white hover:bg-[#0c7573]"
          onClick={generate}
          type="button"
        >
          Generate Draft Campaign
        </button>
      </div>

      {status ? <p className="mt-4 text-sm text-[#0b746e]">{status}</p> : null}
      {error ? <p className="mt-4 text-sm text-[#a04e39]">{error}</p> : null}
    </section>
  );
}
