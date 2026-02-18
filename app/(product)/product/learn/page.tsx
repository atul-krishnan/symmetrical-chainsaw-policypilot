"use client";

import { useState } from "react";

import { SessionStatus } from "@/components/product/session-status";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type AssignmentResponse = {
  items: Array<{
    id: string;
    state: string;
    dueAt: string | null;
    module: {
      id: string;
      title: string;
      roleTrack: string;
      campaignId: string;
    };
  }>;
};

export default function LearnInboxPage() {
  const [items, setItems] = useState<AssignmentResponse["items"]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadAssignments = async () => {
    setError(null);

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured in this environment.");
      return;
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setError("Sign in before loading assignments.");
      return;
    }

    const response = await fetch("/api/me/assignments", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const body = (await response.json()) as AssignmentResponse | { error: { message: string } };

    if (!response.ok) {
      setError("error" in body ? body.error.message : "Failed to load assignments");
      return;
    }

    setItems((body as AssignmentResponse).items);
  };

  return (
    <section className="mx-auto max-w-5xl rounded-[1.8rem] border border-[#cfc2b5] bg-[#fff8ef] p-6">
      <SessionStatus />
      <h1 className="mt-2 font-display text-4xl text-[#10243e]">Learner assignments</h1>
      <p className="mt-2 text-sm text-[#4f6379]">Open your assigned modules and complete attestation steps.</p>

      <button
        className="mt-5 h-11 rounded-xl bg-[#0e8c89] px-5 text-sm font-semibold text-white hover:bg-[#0c7573]"
        onClick={loadAssignments}
        type="button"
      >
        Refresh Assignments
      </button>

      {error ? <p className="mt-4 text-sm text-[#a04e39]">{error}</p> : null}

      <div className="mt-6 space-y-3">
        {items.map((item) => (
          <article className="rounded-xl border border-[#d0c4b8] bg-[#f5ecdf] p-4" key={item.id}>
            <h2 className="font-display text-2xl text-[#10243e]">{item.module.title}</h2>
            <p className="mt-1 text-sm text-[#4d6178]">
              Track: {item.module.roleTrack} | State: {item.state}
            </p>
            <a
              className="mt-3 inline-flex rounded-full border border-[#c7baab] bg-white px-4 py-2 text-sm font-semibold text-[#13263f] hover:bg-[#f4eadc]"
              href={`/product/learn/${item.id}`}
            >
              Open module
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
