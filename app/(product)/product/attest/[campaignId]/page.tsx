"use client";

import { useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function AttestPage({
  params,
}: {
  params: { campaignId: string };
}) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitAttestation = async () => {
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
      setError("Please sign in first.");
      return;
    }

    const response = await fetch(`/api/me/campaigns/${params.campaignId}/attest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        signatureName: name,
        accepted: true,
      }),
    });

    const body = (await response.json()) as
      | { attestedAt: string }
      | { error: { message: string } };

    if (!response.ok) {
      setError("error" in body ? body.error.message : "Attestation failed");
      return;
    }

    setStatus(`Attestation completed at ${(body as { attestedAt: string }).attestedAt}`);
  };

  return (
    <section className="mx-auto max-w-4xl rounded-[1.8rem] border border-[#cfc2b5] bg-[#fff8ef] p-6">
      <h1 className="font-display text-4xl text-[#10243e]">Attestation</h1>
      <p className="mt-2 text-sm text-[#4f6379]">Campaign ID: {params.campaignId}</p>
      <p className="mt-2 text-sm leading-relaxed text-[#4f6379]">
        By signing below, you confirm that you completed the required training and will follow approved AI policy controls.
      </p>

      <label className="mt-5 block space-y-1 text-sm">
        <span>Signature name</span>
        <input
          className="h-11 w-full rounded-xl border border-[#c9bcac] bg-white px-3"
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
      </label>

      <button
        className="mt-4 h-11 rounded-xl bg-[#0e8c89] px-5 text-sm font-semibold text-white hover:bg-[#0c7573]"
        onClick={submitAttestation}
        type="button"
      >
        Submit Attestation
      </button>

      {status ? <p className="mt-4 text-sm text-[#0b746e]">{status}</p> : null}
      {error ? <p className="mt-4 text-sm text-[#a04e39]">{error}</p> : null}
    </section>
  );
}
