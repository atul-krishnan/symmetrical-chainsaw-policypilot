"use client";

import { BarChart3, RefreshCcw, Sparkles, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminAccessGate } from "@/components/product/admin-access-gate";
import { useOrgContext } from "@/lib/edtech/org-context";
import { hasMinimumRole } from "@/lib/edtech/roles";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatPercent } from "@/lib/utils";

type FreshnessResponse = {
  orgId: string;
  windowDays: number;
  summary: {
    freshControls: number;
    totalControls: number;
    freshCoverageRatio: number;
    staleControls: number;
    criticalControls: number;
  };
  benchmark: {
    cohortCode: string;
    orgMetricValue: number | null;
    cohortMetricValue: number | null;
    percentileRank: number | null;
    delta: number | null;
    band: string;
  };
  items: Array<{
    controlId: string;
    controlCode: string;
    controlTitle: string;
    riskLevel: string;
    freshness: {
      state: "fresh" | "aging" | "stale" | "critical";
      score: number;
      latestEvidenceAt: string | null;
      syncedCount: number;
      staleCount: number;
      rejectedCount: number;
    } | null;
    trend: number[];
  }>;
};

type GraphResponse = {
  nodes: {
    obligations: Array<{ id: string }>;
    controls: Array<{ id: string }>;
    campaigns: Array<{ id: string }>;
    modules: Array<{ id: string }>;
    outcomes: Array<{ id: string }>;
    freshness: Array<{ id: string }>;
  };
  edges: Array<{ id: string; type: string }>;
  persistedEdges: Array<{ id: string; type: string }>;
};

async function getToken(): Promise<string | null> {
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

function formatDate(input: string | null): string {
  if (!input) return "—";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export default function AdoptionCommandCenterPage() {
  const { selectedMembership, selectedOrgId } = useOrgContext();
  const canView = hasMinimumRole(selectedMembership?.role, "manager");

  const [windowDays, setWindowDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshness, setFreshness] = useState<FreshnessResponse | null>(null);
  const [graph, setGraph] = useState<GraphResponse | null>(null);

  const load = useCallback(async () => {
    if (!selectedOrgId || !canView) return;
    setLoading(true);
    setError(null);

    const token = await getToken();
    if (!token) {
      setError("Sign in required.");
      setLoading(false);
      return;
    }

    const [freshRes, graphRes] = await Promise.all([
      fetch(`/api/orgs/${selectedOrgId}/adoption/freshness?window=${windowDays}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`/api/orgs/${selectedOrgId}/adoption/graph?window=${windowDays}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    const freshBody = (await freshRes.json()) as FreshnessResponse | { error: { message: string } };
    const graphBody = (await graphRes.json()) as GraphResponse | { error: { message: string } };

    if (!freshRes.ok) {
      setError("error" in freshBody ? freshBody.error.message : "Failed to load freshness.");
      setLoading(false);
      return;
    }
    if (!graphRes.ok) {
      setError("error" in graphBody ? graphBody.error.message : "Failed to load graph.");
      setLoading(false);
      return;
    }

    setFreshness(freshBody as FreshnessResponse);
    setGraph(graphBody as GraphResponse);
    setLoading(false);
  }, [canView, selectedOrgId, windowDays]);

  useEffect(() => {
    if (!selectedOrgId || !canView) return;
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [canView, load, selectedOrgId]);

  const sortedByRisk = useMemo(() => {
    const items = freshness?.items ?? [];
    return [...items]
      .sort((a, b) => (a.freshness?.score ?? 0) - (b.freshness?.score ?? 0))
      .slice(0, 10);
  }, [freshness?.items]);

  if (!canView) {
    return (
      <AdminAccessGate
        currentRole={selectedMembership?.role}
        orgName={selectedMembership?.orgName}
        requiredRole="manager"
        title="Adoption Command Center"
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Adoption Command Center</h1>
          <p className="page-subtitle">Track control freshness, adoption drift, and benchmark position.</p>
        </div>
        <div className="flex gap-2">
          <select
            className="h-9 rounded-lg border border-[var(--border)] bg-white px-2 text-sm"
            onChange={(event) => setWindowDays(Number(event.target.value))}
            value={windowDays}
          >
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
          <button className="btn btn-secondary btn-sm" onClick={() => void load()} type="button">
            <RefreshCcw className="h-3.5 w-3.5" />
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      {freshness && (
        <div className="kpi-grid">
          <div className="stat-card">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Fresh Coverage
            </p>
            <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">
              {formatPercent(freshness.summary.freshCoverageRatio)}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {freshness.summary.freshControls}/{freshness.summary.totalControls} controls
            </p>
          </div>
          <div className="stat-card">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Stale + Critical
            </p>
            <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">
              {freshness.summary.staleControls + freshness.summary.criticalControls}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              stale {freshness.summary.staleControls} · critical {freshness.summary.criticalControls}
            </p>
          </div>
          <div className="stat-card">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Benchmark Delta
            </p>
            <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">
              {freshness.benchmark.delta === null ? "—" : `${(freshness.benchmark.delta * 100).toFixed(1)}pp`}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              cohort: {freshness.benchmark.cohortCode}
            </p>
          </div>
          <div className="stat-card">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Percentile
            </p>
            <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">
              {freshness.benchmark.percentileRank === null ? "—" : `${freshness.benchmark.percentileRank.toFixed(0)}th`}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              band: {freshness.benchmark.band}
            </p>
          </div>
        </div>
      )}

      {graph && (
        <div className="card p-5">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Adoption Graph Coverage</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-lg border border-[var(--border)] p-3 text-sm">
              <p className="text-xs text-[var(--text-muted)]">Obligations</p>
              <p className="font-semibold text-[var(--text-primary)]">{graph.nodes.obligations.length}</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-3 text-sm">
              <p className="text-xs text-[var(--text-muted)]">Controls</p>
              <p className="font-semibold text-[var(--text-primary)]">{graph.nodes.controls.length}</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-3 text-sm">
              <p className="text-xs text-[var(--text-muted)]">Campaigns</p>
              <p className="font-semibold text-[var(--text-primary)]">{graph.nodes.campaigns.length}</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-3 text-sm">
              <p className="text-xs text-[var(--text-muted)]">Modules</p>
              <p className="font-semibold text-[var(--text-primary)]">{graph.nodes.modules.length}</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-3 text-sm">
              <p className="text-xs text-[var(--text-muted)]">Computed Edges</p>
              <p className="font-semibold text-[var(--text-primary)]">{graph.edges.length}</p>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-3 text-sm">
              <p className="text-xs text-[var(--text-muted)]">Persisted Edges</p>
              <p className="font-semibold text-[var(--text-primary)]">{graph.persistedEdges.length}</p>
            </div>
          </div>
        </div>
      )}

      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Animated Policy Videos
          </h2>
          <span className="status-pill status-pill-info">Coming Soon</span>
        </div>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          We are working on role-specific animated explainers generated from approved module content to improve adoption and retention.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-5 py-4">
          <TrendingUp className="h-4 w-4 text-[var(--accent)]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)]">At-Risk Controls</h2>
        </div>
        {sortedByRisk.length === 0 ? (
          <p className="p-5 text-sm text-[var(--text-muted)]">No controls found for this window.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Control</th>
                  <th>Freshness</th>
                  <th>Score</th>
                  <th>Latest Evidence</th>
                  <th>Signals</th>
                </tr>
              </thead>
              <tbody>
                {sortedByRisk.map((item) => (
                  <tr key={item.controlId}>
                    <td>
                      <p className="font-medium text-[var(--text-primary)]">{item.controlCode}</p>
                      <p className="text-xs text-[var(--text-muted)]">{item.controlTitle}</p>
                    </td>
                    <td>
                      <span className="status-pill status-pill-info capitalize">
                        {item.freshness?.state ?? "critical"}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                        <span className="font-medium text-[var(--text-primary)]">
                          {(item.freshness?.score ?? 0).toFixed(1)}
                        </span>
                      </div>
                    </td>
                    <td className="text-xs">{formatDate(item.freshness?.latestEvidenceAt ?? null)}</td>
                    <td className="text-xs">
                      synced {item.freshness?.syncedCount ?? 0} · stale {item.freshness?.staleCount ?? 0} · rejected{" "}
                      {item.freshness?.rejectedCount ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[var(--accent)]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)]">North Star KPI</h2>
        </div>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Percent of in-scope controls with fresh workforce evidence since the latest policy change.
        </p>
      </div>
    </div>
  );
}
