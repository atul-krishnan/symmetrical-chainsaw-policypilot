"use client";

import { AlertTriangle, BarChart3, RefreshCcw, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminAccessGate } from "@/components/product/admin-access-gate";
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
  controlCoverage: {
    totalControls: number;
    mappedControls: number;
    coverageRatio: number;
  };
  evidenceStatusCounts: {
    queued: number;
    synced: number;
    rejected: number;
    stale: number;
    superseded: number;
  };
  integrationHealth: Array<{
    provider: string;
    status: string;
    lastSyncAt: string | null;
    healthMessage: string | null;
  }>;
  riskHotspots: Array<{
    controlId: string;
    controlCode: string;
    controlTitle: string;
    riskLevel: string;
    riskIndex: number;
    evidence: {
      queued: number;
      synced: number;
      rejected: number;
      stale: number;
      superseded: number;
    };
  }>;
};

async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  let token = data.session?.access_token ?? null;
  if (!token) {
    const refresh = await supabase.auth.refreshSession();
    token = refresh.data.session?.access_token ?? null;
  }
  return token;
}

export default function DashboardPage() {
  const { selectedMembership, selectedOrgId } = useOrgContext();
  const canView = hasMinimumRole(selectedMembership?.role, "manager");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  const summary = useMemo(() => {
    if (!metrics) return null;
    const c = metrics.campaigns;
    const total = c.reduce((s, x) => s + x.assignmentsTotal, 0);
    const done = c.reduce((s, x) => s + x.assignmentsCompleted, 0);
    const avgComp = c.length > 0 ? c.reduce((s, x) => s + x.completionRate, 0) / c.length : 0;
    const avgAtt = c.length > 0 ? c.reduce((s, x) => s + x.attestationRate, 0) / c.length : 0;
    return { campaigns: c.length, total, done, avgComp, avgAtt };
  }, [metrics]);

  const loadMetrics = useCallback(async () => {
    if (!selectedOrgId || !canView) return;
    setLoading(true);
    setError(null);
    const token = await getAccessToken();
    if (!token) { setError("Sign in to view dashboard."); setLoading(false); return; }

    const res = await fetch(`/api/orgs/${selectedOrgId}/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as MetricsResponse | { error: { message: string } };
    if (!res.ok) { setError("error" in body ? body.error.message : "Failed to load metrics"); setLoading(false); return; }

    setMetrics(body as MetricsResponse);
    setFetchedAt(new Date());
    setLoading(false);
  }, [canView, selectedOrgId]);

  useEffect(() => {
    if (!selectedOrgId || !canView) return;
    const t = window.setTimeout(() => void loadMetrics(), 0);
    return () => window.clearTimeout(t);
  }, [canView, loadMetrics, selectedOrgId]);

  if (!canView) {
    return (
      <AdminAccessGate
        currentRole={selectedMembership?.role}
        orgName={selectedMembership?.orgName}
        requiredRole="manager"
        title="Compliance Dashboard"
      />
    );
  }

  const kpiCards = summary
    ? [
      { label: "Campaigns", value: summary.campaigns, icon: BarChart3 },
      { label: "Total Assignments", value: summary.total, sub: `${summary.done} completed`, icon: TrendingUp },
      { label: "Avg Completion", value: formatPercent(summary.avgComp), icon: TrendingUp },
      { label: "Avg Attestation", value: formatPercent(summary.avgAtt), icon: TrendingUp },
      {
        label: "Control Coverage",
        value: metrics ? formatPercent(metrics.controlCoverage.coverageRatio) : "0%",
        sub: metrics
          ? `${metrics.controlCoverage.mappedControls}/${metrics.controlCoverage.totalControls} mapped`
          : undefined,
        icon: TrendingUp,
      },
    ]
    : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Compliance Dashboard</h1>
          <p className="page-subtitle">
            Monitor completion and attestation across {selectedMembership?.orgName ?? "your workspace"}.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => void loadMetrics()} type="button">
          <RefreshCcw className="h-3.5 w-3.5" />
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      {/* Loading skeleton */}
      {loading && !summary && (
        <div className="kpi-grid">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="stat-card animate-pulse">
              <div className="h-3 w-20 rounded bg-[var(--bg-muted)]" />
              <div className="mt-3 h-8 w-16 rounded bg-[var(--bg-muted)]" />
            </div>
          ))}
        </div>
      )}

      {/* KPI cards */}
      {summary && (
        <div className="kpi-grid">
          {kpiCards.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="stat-card">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {kpi.label}
                  </p>
                  <Icon className="h-4 w-4 text-[var(--text-faint)]" />
                </div>
                <p className="mt-2 text-3xl font-bold tracking-tight text-[var(--text-primary)]">{kpi.value}</p>
                {"sub" in kpi && kpi.sub && (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{kpi.sub}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Campaign table */}
      {metrics && metrics.campaigns.length > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Campaigns</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Assignments</th>
                  <th>Completed</th>
                  <th>Completion</th>
                  <th>Attestation</th>
                  <th>Avg Score</th>
                </tr>
              </thead>
              <tbody>
                {metrics.campaigns.map((c) => (
                  <tr key={c.campaignId}>
                    <td className="font-medium text-[var(--text-primary)]">{c.name}</td>
                    <td>{c.assignmentsTotal}</td>
                    <td>{c.assignmentsCompleted}</td>
                    <td>
                      <span className={c.completionRate >= 0.8 ? "text-[var(--success)] font-medium" : ""}>
                        {formatPercent(c.completionRate)}
                      </span>
                    </td>
                    <td>{formatPercent(c.attestationRate)}</td>
                    <td>{c.averageScore.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* At-risk learners */}
      {metrics && metrics.atRiskLearners && metrics.atRiskLearners.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-5 py-4">
            <AlertTriangle className="h-4 w-4 text-[var(--danger)]" />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              At-Risk Learners ({metrics.atRiskLearners.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Learner</th>
                  <th>Module</th>
                  <th>Track</th>
                  <th>Status</th>
                  <th>Days Overdue</th>
                </tr>
              </thead>
              <tbody>
                {metrics.atRiskLearners.map((l) => (
                  <tr key={l.assignmentId}>
                    <td className="font-medium text-[var(--text-primary)]">{l.userId.slice(0, 8)}…</td>
                    <td>{l.moduleTitle}</td>
                    <td>
                      <span className="status-pill status-pill-info capitalize">{l.roleTrack}</span>
                    </td>
                    <td className="capitalize">{l.state.replace("_", " ")}</td>
                    <td>
                      <span className="font-semibold text-[var(--danger)]">{l.daysOverdue}d</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {metrics && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Evidence Sync Health
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <p>Queued: <strong>{metrics.evidenceStatusCounts.queued}</strong></p>
              <p>Synced: <strong>{metrics.evidenceStatusCounts.synced}</strong></p>
              <p>Rejected: <strong>{metrics.evidenceStatusCounts.rejected}</strong></p>
              <p>Stale: <strong>{metrics.evidenceStatusCounts.stale}</strong></p>
            </div>
            <div className="mt-4 space-y-2">
              {metrics.integrationHealth.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No integration connections yet.</p>
              ) : (
                metrics.integrationHealth.map((integration) => (
                  <div
                    className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
                    key={integration.provider}
                  >
                    <p className="font-medium capitalize text-[var(--text-primary)]">
                      {integration.provider}: {integration.status}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Last sync:{" "}
                      {integration.lastSyncAt
                        ? new Date(integration.lastSyncAt).toLocaleString()
                        : "never"}
                    </p>
                    {integration.healthMessage && (
                      <p className="text-xs text-[var(--text-muted)]">{integration.healthMessage}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Risk Hotspots</h2>
            {metrics.riskHotspots.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--text-muted)]">
                No active control hotspots detected.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {metrics.riskHotspots.map((item) => (
                  <div
                    className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm"
                    key={item.controlId}
                  >
                    <p className="font-medium text-[var(--text-primary)]">
                      {item.controlCode} · {item.controlTitle}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] capitalize">
                      Risk level: {item.riskLevel} · Risk index: {item.riskIndex}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Rejected: {item.evidence.rejected} · Stale: {item.evidence.stale} · Queued: {item.evidence.queued}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audit timestamp */}
      {fetchedAt && (
        <p className="audit-timestamp">
          Data as of {fetchedAt.toLocaleString()} · Refresh for latest
        </p>
      )}
    </div>
  );
}
