"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type CampaignInfo = {
  id: string;
  name: string;
  totalModules: number;
  completedModules: number;
};

async function getToken(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  let token = data.session?.access_token ?? null;
  if (token) return token;
  const refresh = await supabase.auth.refreshSession();
  token = refresh.data.session?.access_token ?? null;
  return token;
}

export default function AttestPage() {
  const params = useParams<{ campaignId: string }>();
  const campaignId = Array.isArray(params.campaignId)
    ? params.campaignId[0] ?? ""
    : params.campaignId ?? "";

  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<CampaignInfo | null>(null);
  const [name, setName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attestedAt, setAttestedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCampaign = useCallback(async () => {
    if (!campaignId) { setError("Campaign id missing."); setLoading(false); return; }
    setLoading(true);
    const token = await getToken();
    if (!token) { setError("Sign in to complete attestation."); setLoading(false); return; }
    try {
      const res = await fetch("/api/me/assignments", { headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json();
      if (!res.ok) { setError(body?.error?.message ?? "Failed to load."); setLoading(false); return; }
      const all = (body.items ?? []).filter((a: { module: { campaignId: string } }) => a.module.campaignId === campaignId);
      const completed = all.filter((a: { state: string }) => a.state === "completed");
      setCampaign({ id: campaignId, name: all.length > 0 ? "Campaign Training" : "Campaign", totalModules: all.length, completedModules: completed.length });
    } catch { setError("Network error."); } finally { setLoading(false); }
  }, [campaignId]);

  useEffect(() => { void loadCampaign(); }, [loadCampaign]);

  const submitAttestation = useCallback(async () => {
    setError(null); setSubmitting(true);
    if (!campaignId) { setError("Campaign id missing."); setSubmitting(false); return; }
    const token = await getToken();
    if (!token) { setError("Please sign in."); setSubmitting(false); return; }
    try {
      const res = await fetch(`/api/me/campaigns/${campaignId}/attest`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ signatureName: name, accepted: true }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body?.error?.message ?? "Attestation failed."); setSubmitting(false); return; }
      setAttestedAt(body.attestedAt);
    } catch { setError("Network error."); } finally { setSubmitting(false); }
  }, [campaignId, name]);

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  // Success
  if (attestedAt) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center space-y-5">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--success-bg)] border border-[var(--success-border)]">
          <CheckCircle2 className="h-8 w-8 text-[var(--success)]" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Attestation Complete</h1>
        <p className="text-sm text-[var(--text-muted)]">
          Recorded at {new Date(attestedAt).toLocaleString()}
        </p>
        <p className="text-xs text-[var(--text-faint)]">
          Reference: {campaignId.slice(0, 8)}…
        </p>
        <Link href="/product/learn" className="btn btn-primary inline-flex">
          Return to My Learning
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-4">
      <Link href="/product/learn" className="inline-flex items-center gap-1 text-sm text-[var(--accent)] hover:underline">
        <ArrowLeft className="h-4 w-4" /> My Learning
      </Link>

      <div className="card p-6 sm:p-8 space-y-5">
        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-light)]">
            <ShieldCheck className="h-5 w-5 text-[var(--accent)]" />
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Policy Attestation</h1>
        </div>

        {/* Progress */}
        {campaign && (
          <div className="rounded-lg bg-[var(--bg-muted)] px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">Module progress</span>
              <span className="font-semibold text-[var(--text-primary)]">
                {campaign.completedModules}/{campaign.totalModules}
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-white">
              <div
                className="h-2 rounded-full bg-[var(--accent)] transition-all"
                style={{ width: `${campaign.totalModules > 0 ? (campaign.completedModules / campaign.totalModules) * 100 : 0}%` }}
              />
            </div>
            {campaign.completedModules < campaign.totalModules && (
              <p className="mt-2 text-xs text-[var(--warning)]">
                Complete all modules before attesting.
              </p>
            )}
          </div>
        )}

        {/* Legal */}
        <div className="rounded-lg border border-[var(--border)] bg-white p-4 text-sm leading-relaxed text-[var(--text-secondary)]">
          <p>
            By signing below, I confirm that I have completed the required
            AI policy training modules, understand the obligations described
            in the training content, and will comply with the approved
            controls and practices outlined in my organization&apos;s AI policy.
          </p>
        </div>

        {/* Signature */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-[var(--text-primary)]">Full name (legal signature)</label>
            <input
              type="text"
              className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded accent-[var(--accent)]"
            />
            <span>
              I acknowledge that I have read, understood, and will follow the
              AI policy requirements outlined in this training campaign.
            </span>
          </label>

          <p className="text-xs text-[var(--text-faint)]">
            Date: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        {error && (
          <p className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        <button
          type="button"
          className="btn btn-primary w-full"
          disabled={!name.trim() || !accepted || submitting}
          onClick={() => void submitAttestation()}
        >
          {submitting ? "Submitting…" : "Submit Attestation"}
        </button>
      </div>
    </div>
  );
}
