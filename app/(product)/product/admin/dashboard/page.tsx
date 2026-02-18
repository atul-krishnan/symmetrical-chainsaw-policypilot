"use client";

import { AlertTriangle, BarChart3, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminAccessGate } from "@/components/product/admin-access-gate";
import { SessionStatus } from "@/components/product/session-status";
import { useOrgContext } from "@/lib/edtech/org-context";
import { hasMinimumRole } from "@/lib/edtech/roles";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatPercent } from "@/lib/utils";

type AtRiskLearner = {
  assignmentId: string;
  userId: string;
  state: string;
  dueAt: string;
  daysOverdue: number;
  moduleTitle: string;
  roleTrack: string;
};

type MetricsResponse = {
  orgId: string;
  campaigns: Array<{
    campaignId: string;
    name: string;
    assignmentsTotal: number;
    assignmentsCompleted: number;
    completionRate: number;
    attestationRate: number;
    averageScore: number;
  }>;
  atRiskLearners: AtRiskLearner[];
};

async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return null;
  }

  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function DashboardPage() {
  const { selectedMembership, selectedOrgId } = useOrgContext();
  const canView = hasMinimumRole(selectedMembership?.role, "manager");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);

  const summary = useMemo(() => {
    if (!metrics) {
      return null;
    }

    const campaigns = metrics.campaigns;
    const assignmentsTotal = campaigns.reduce((sum, campaign) => sum + campaign.assignmentsTotal, 0);
    const assignmentsCompleted = campaigns.reduce(
      (sum, campaign) => sum + campaign.assignmentsCompleted,
      0,
    );
    const avgCompletion =
      campaigns.length > 0
        ? campaigns.reduce((sum, campaign) => sum + campaign.completionRate, 0) / campaigns.length
        : 0;
    const avgAttestation =
      campaigns.length > 0
        ? campaigns.reduce((sum, campaign) => sum + campaign.attestationRate, 0) / campaigns.length
        : 0;

    return {
      campaigns: campaigns.length,
      assignmentsTotal,
      assignmentsCompleted,
      avgCompletion,
      avgAttestation,
    };
  }, [metrics]);

  const loadMetrics = useCallback(async () => {
    if (!selectedOrgId || !canView) {
      return;
    }

    setLoading(true);
    setError(null);

    const token = await getAccessToken();
    if (!token) {
      setError("Sign in before loading dashboard metrics.");
      setLoading(false);
      return;
    }

    const response = await fetch(`/api/orgs/${selectedOrgId}/dashboard`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const body = (await response.json()) as MetricsResponse | { error: { message: string } };

    if (!response.ok) {
      setError("error" in body ? body.error.message : "Failed to load metrics");
      setLoading(false);
      return;
    }

    setMetrics(body as MetricsResponse);
    setLoading(false);
  }, [canView, selectedOrgId]);

  useEffect(() => {
    if (!selectedOrgId || !canView) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadMetrics();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [canView, loadMetrics, selectedOrgId]);

  if (!canView) {
    return (
      <AdminAccessGate
        currentRole={selectedMembership?.role}
        orgName={selectedMembership?.orgName}
        requiredRole="manager"
        title="Compliance dashboard"
      />
    );
  }

  return (
    <section className="mx-auto max-w-6xl space-y-5 rounded-[1.9rem] surface-card p-6 sm:p-7">
      <SessionStatus />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-[#10244a]">Compliance dashboard</h1>
          <p className="mt-2 text-sm text-[#4f6486]">
            Monitor completion and attestation outcomes for {selectedMembership?.orgName ?? "your workspace"}.
          </p>
        </div>

        <button
          className="inline-flex h-10 items-center gap-2 rounded-full border border-[#d2ddef] bg-white px-4 text-sm font-semibold text-[#1f3b67] hover:bg-[#f4f8ff]"
          onClick={() => void loadMetrics()}
          type="button"
        >
          <RefreshCcw className="h-4 w-4" />
          {loading ? "Loading..." : "Refresh metrics"}
        </button>
      </div>

      {error ? <p className="text-sm text-[#a54f3a]">{error}</p> : null}

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl soft-chip p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[#6079a2]">Campaigns</p>
            <p className="mt-2 font-display text-4xl text-[#122d5b]">{summary.campaigns}</p>
          </article>
          <article className="rounded-2xl soft-chip p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[#6079a2]">Assignments</p>
            <p className="mt-2 font-display text-4xl text-[#122d5b]">{summary.assignmentsTotal}</p>
            <p className="text-xs text-[#4f6486]">Completed: {summary.assignmentsCompleted}</p>
          </article>
          <article className="rounded-2xl soft-chip p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[#6079a2]">Avg completion</p>
            <p className="mt-2 font-display text-4xl text-[#122d5b]">{formatPercent(summary.avgCompletion)}</p>
          </article>
          <article className="rounded-2xl soft-chip p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[#6079a2]">Avg attestation</p>
            <p className="mt-2 font-display text-4xl text-[#122d5b]">{formatPercent(summary.avgAttestation)}</p>
          </article>
        </div>
      ) : null}

      {metrics ? (
        <div className="grid gap-4 md:grid-cols-2">
          {metrics.campaigns.map((campaign) => (
            <article className="rounded-2xl soft-chip p-5" key={campaign.campaignId}>
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-3xl text-[#112f60]">{campaign.name}</h2>
                <BarChart3 className="mt-1 h-5 w-5 text-[#1f5eff]" />
              </div>
              <ul className="mt-3 space-y-1 text-sm text-[#455d82]">
                <li>Total assignments: {campaign.assignmentsTotal}</li>
                <li>Completed assignments: {campaign.assignmentsCompleted}</li>
                <li>Completion rate: {formatPercent(campaign.completionRate)}</li>
                <li>Attestation rate: {formatPercent(campaign.attestationRate)}</li>
                <li>Average score: {campaign.averageScore.toFixed(1)}%</li>
              </ul>
            </article>
          ))}
        </div>
      ) : null}

      {/* At-risk learners */}
      {metrics && metrics.atRiskLearners && metrics.atRiskLearners.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[#b84c33]" />
            <h2 className="font-display text-2xl text-[#10244a]">
              At-risk learners ({metrics.atRiskLearners.length})
            </h2>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-[#d2ddef]">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#eef4ff] text-xs uppercase tracking-wider text-[#6079a2]">
                <tr>
                  <th className="px-4 py-3">Learner</th>
                  <th className="px-4 py-3">Module</th>
                  <th className="px-4 py-3">Track</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Days Overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8eef8] bg-white">
                {metrics.atRiskLearners.map((learner) => (
                  <tr key={learner.assignmentId}>
                    <td className="px-4 py-3 text-[#10244a] font-medium">
                      {learner.userId.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3 text-[#4f6486]">{learner.moduleTitle}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-[#e0ecff] px-2 py-0.5 text-[11px] font-bold uppercase text-[#1f5eff]">
                        {learner.roleTrack}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#5b7194]">{learner.state}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-[#b84c33]">
                        {learner.daysOverdue}d
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
