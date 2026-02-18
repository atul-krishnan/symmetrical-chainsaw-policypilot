"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { SessionStatus } from "@/components/product/session-status";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CampaignInfo = {
  id: string;
  name: string;
  totalModules: number;
  completedModules: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getToken(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AttestPage({
  params,
}: {
  params: { campaignId: string };
}) {
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<CampaignInfo | null>(null);
  const [name, setName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attestedAt, setAttestedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load campaign summary + completion status
  const loadCampaign = useCallback(async () => {
    setLoading(true);
    const token = await getToken();
    if (!token) {
      setError("Sign in to complete attestation.");
      setLoading(false);
      return;
    }

    try {
      // Fetch user's assignments for this campaign
      const res = await fetch("/api/me/assignments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error?.message ?? "Failed to load campaign.");
        setLoading(false);
        return;
      }

      const all = (body.items ?? []).filter(
        (a: { module: { campaignId: string } }) =>
          a.module.campaignId === params.campaignId,
      );

      const completed = all.filter(
        (a: { state: string }) => a.state === "completed",
      );

      setCampaign({
        id: params.campaignId,
        name: all.length > 0 ? "Campaign Training" : "Campaign",
        totalModules: all.length,
        completedModules: completed.length,
      });
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [params.campaignId]);

  useEffect(() => {
    void loadCampaign();
  }, [loadCampaign]);

  const submitAttestation = useCallback(async () => {
    setError(null);
    setSubmitting(true);

    const token = await getToken();
    if (!token) {
      setError("Please sign in.");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(
        `/api/me/campaigns/${params.campaignId}/attest`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            signatureName: name,
            accepted: true,
          }),
        },
      );

      const body = await res.json();
      if (!res.ok) {
        setError(body?.error?.message ?? "Attestation failed.");
        setSubmitting(false);
        return;
      }

      setAttestedAt(body.attestedAt);
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }, [name, params.campaignId]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <section className="mx-auto max-w-3xl py-12 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1f5eff]" />
      </section>
    );
  }

  // Success state
  if (attestedAt) {
    return (
      <section className="mx-auto max-w-3xl py-12 px-4 sm:px-6 text-center space-y-5">
        <CheckCircle2 className="mx-auto h-16 w-16 text-[#12795c]" />
        <h1 className="font-display text-3xl text-[#10244a]">
          Attestation Complete ✓
        </h1>
        <p className="text-sm text-[#4f6486]">
          Recorded at {new Date(attestedAt).toLocaleString()}
        </p>
        <Link
          href="/product/learn"
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#1f5eff] px-6 text-sm font-semibold text-white hover:bg-[#154ee6]"
        >
          Return to My Learning
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6 py-6 px-4 sm:px-6">
      <SessionStatus />

      <Link
        href="/product/learn"
        className="inline-flex items-center gap-1 text-sm text-[#1f5eff] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> My Learning
      </Link>

      {/* Header */}
      <div className="rounded-[1.8rem] surface-card p-6 sm:p-7 space-y-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-[#1f5eff]" />
          <h1 className="font-display text-3xl text-[#10244a]">
            Policy Attestation
          </h1>
        </div>

        {campaign && (
          <div className="rounded-xl bg-[#eef4ff] px-4 py-3 text-sm text-[#4f6486]">
            <p>
              You have completed{" "}
              <span className="font-bold text-[#10244a]">
                {campaign.completedModules}/{campaign.totalModules}
              </span>{" "}
              modules for this campaign.
            </p>
            {campaign.completedModules < campaign.totalModules && (
              <p className="mt-1 text-xs text-[#b84c33]">
                Complete all modules before attesting. At least one required.
              </p>
            )}
          </div>
        )}

        {/* Legal language */}
        <div className="rounded-xl border border-[#d3deef] bg-white p-4 text-sm leading-relaxed text-[#3b5068]">
          <p>
            By signing below, I confirm that I have completed the required
            AI policy training modules, understand the obligations described
            in the training content, and will comply with the approved
            controls and practices outlined in my organization&apos;s AI policy.
          </p>
        </div>

        {/* Signature */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-[#10244a]">
            Full name (legal signature)
          </label>
          <input
            type="text"
            className="h-11 w-full rounded-xl border border-[#d3deef] bg-white px-4 text-sm"
            placeholder="Enter your full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label className="flex items-start gap-2 text-sm text-[#3b5068] cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[#d3deef] accent-[#1f5eff]"
            />
            <span>
              I acknowledge that I have read, understood, and will follow the
              AI policy requirements outlined in this training campaign.
            </span>
          </label>

          <p className="text-xs text-[#6079a2]">
            Date: {new Date().toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {error && (
          <p className="text-sm text-[#a04e39] bg-[#fff1ed] rounded-xl px-4 py-3 border border-[#f1cbc2]">
            {error}
          </p>
        )}

        <button
          type="button"
          className="h-11 w-full rounded-xl bg-[#1f5eff] text-sm font-semibold text-white hover:bg-[#154ee6] disabled:opacity-50"
          disabled={!name.trim() || !accepted || submitting}
          onClick={() => void submitAttestation()}
        >
          {submitting ? "Submitting…" : "Submit Attestation"}
        </button>
      </div>
    </section>
  );
}
