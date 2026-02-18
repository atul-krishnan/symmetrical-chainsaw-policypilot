"use client";

import { useState } from "react";

import { SessionStatus } from "@/components/product/session-status";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function PoliciesPage() {
  const [orgId, setOrgId] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setStatus(null);

    if (!orgId || !title || !file) {
      setError("Enter organization ID, title, and choose a supported policy file.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured in this environment.");
      return;
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setError("Please sign in before uploading policy files.");
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("file", file);

    const response = await fetch(`/api/orgs/${orgId}/policies`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const body = (await response.json()) as
      | { policyId: string; parseStatus: string }
      | { error: { message: string } };

    if (!response.ok) {
      setError("error" in body ? body.error.message : "Upload failed");
      return;
    }

    const successBody = body as { policyId: string; parseStatus: string };
    setStatus(`Policy uploaded successfully. Parse status: ${successBody.parseStatus}`);
  };

  return (
    <section className="mx-auto max-w-5xl rounded-[1.8rem] border border-[#cfc2b5] bg-[#fff8ef] p-6">
      <SessionStatus />
      <h1 className="mt-2 font-display text-4xl text-[#10243e]">Policy ingestion</h1>
      <p className="mt-2 text-sm text-[#4f6379]">Upload a policy document to extract obligations and seed a campaign draft.</p>

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
          <span>Policy title</span>
          <input
            className="h-11 rounded-xl border border-[#c9bcac] bg-white px-3"
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span>File (PDF, DOCX, TXT)</span>
          <input
            accept=".pdf,.docx,.txt"
            className="rounded-xl border border-[#c9bcac] bg-white px-3 py-2"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            type="file"
          />
        </label>

        <button
          className="mt-2 h-11 rounded-xl bg-[#0e8c89] text-sm font-semibold text-white hover:bg-[#0c7573]"
          onClick={submit}
          type="button"
        >
          Upload and Parse
        </button>
      </div>

      {status ? <p className="mt-4 text-sm text-[#0b746e]">{status}</p> : null}
      {error ? <p className="mt-4 text-sm text-[#a04e39]">{error}</p> : null}
    </section>
  );
}
