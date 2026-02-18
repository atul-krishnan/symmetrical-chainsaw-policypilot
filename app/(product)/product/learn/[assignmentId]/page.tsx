"use client";

import { useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function AssignmentPage({
  params,
}: {
  params: { assignmentId: string };
}) {
  const [moduleId, setModuleId] = useState("");
  const [answers, setAnswers] = useState("0,1,2");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitAttempt = async () => {
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

    const response = await fetch(`/api/me/modules/${moduleId}/attempts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        answers: answers
          .split(",")
          .map((item) => Number(item.trim()))
          .filter((item) => Number.isInteger(item)),
      }),
    });

    const body = (await response.json()) as
      | { scorePct: number; passed: boolean; campaignId: string }
      | { error: { message: string } };

    if (!response.ok) {
      setError("error" in body ? body.error.message : "Attempt failed");
      return;
    }

    const attempt = body as { scorePct: number; passed: boolean; campaignId: string };
    setStatus(
      `Score ${attempt.scorePct}%. ${attempt.passed ? "Passed" : "Retry required"}. Continue to attestation: /product/attest/${attempt.campaignId}`,
    );
  };

  return (
    <section className="mx-auto max-w-5xl rounded-[1.8rem] border border-[#cfc2b5] bg-[#fff8ef] p-6">
      <h1 className="font-display text-4xl text-[#10243e]">Module attempt</h1>
      <p className="mt-2 text-sm text-[#4f6379]">Assignment ID: {params.assignmentId}</p>

      <div className="mt-6 grid gap-3">
        <label className="space-y-1 text-sm">
          <span>Module ID</span>
          <input
            className="h-11 rounded-xl border border-[#c9bcac] bg-white px-3"
            onChange={(event) => setModuleId(event.target.value)}
            value={moduleId}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Answers (comma-separated indexes)</span>
          <input
            className="h-11 rounded-xl border border-[#c9bcac] bg-white px-3"
            onChange={(event) => setAnswers(event.target.value)}
            value={answers}
          />
        </label>
        <button
          className="h-11 rounded-xl bg-[#0e8c89] text-sm font-semibold text-white hover:bg-[#0c7573]"
          onClick={submitAttempt}
          type="button"
        >
          Submit Quiz Attempt
        </button>
      </div>

      {status ? <p className="mt-4 text-sm text-[#0b746e]">{status}</p> : null}
      {error ? <p className="mt-4 text-sm text-[#a04e39]">{error}</p> : null}
    </section>
  );
}
