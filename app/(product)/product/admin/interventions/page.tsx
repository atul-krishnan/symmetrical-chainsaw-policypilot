"use client";

import { Play, RefreshCcw, ShieldCheck, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminAccessGate } from "@/components/product/admin-access-gate";
import { useOrgContext } from "@/lib/edtech/org-context";
import { hasMinimumRole } from "@/lib/edtech/roles";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type InterventionStatus = "proposed" | "approved" | "executing" | "completed" | "dismissed";

type InterventionsResponse = {
  orgId: string;
  summary: {
    total: number;
    statusCounts: Record<InterventionStatus, number>;
  };
  items: Array<{
    id: string;
    controlId: string;
    recommendationType: string;
    status: InterventionStatus;
    rationale: string;
    expectedImpactPct: number;
    confidenceScore: number;
    createdAt: string;
    control: {
      id: string;
      code: string;
      title: string;
      riskLevel: string;
    } | null;
    latestExecution: {
      id: string;
      executionStatus: string;
      errorMessage: string | null;
      startedAt: string | null;
      finishedAt: string | null;
      createdAt: string;
    } | null;
  }>;
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

function fmtDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

const STATUS_OPTIONS: Array<{ label: string; value: "" | InterventionStatus }> = [
  { label: "All statuses", value: "" },
  { label: "Proposed", value: "proposed" },
  { label: "Approved", value: "approved" },
  { label: "Executing", value: "executing" },
  { label: "Completed", value: "completed" },
  { label: "Dismissed", value: "dismissed" },
];

export default function InterventionInboxPage() {
  const { selectedMembership, selectedOrgId } = useOrgContext();
  const canView = hasMinimumRole(selectedMembership?.role, "manager");
  const canManage = hasMinimumRole(selectedMembership?.role, "admin");

  const [statusFilter, setStatusFilter] = useState<"" | InterventionStatus>("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [data, setData] = useState<InterventionsResponse | null>(null);

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

    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);

    const response = await fetch(`/api/orgs/${selectedOrgId}/interventions?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await response.json()) as InterventionsResponse | { error: { message: string } };
    if (!response.ok) {
      setError("error" in body ? body.error.message : "Failed to load interventions.");
      setLoading(false);
      return;
    }

    setData(body as InterventionsResponse);
    setLoading(false);
  }, [canView, selectedOrgId, statusFilter]);

  useEffect(() => {
    if (!selectedOrgId || !canView) return;
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [canView, load, selectedOrgId]);

  const generateRecommendations = async () => {
    if (!selectedOrgId || !canManage) return;
    setGenerating(true);
    setError(null);
    setStatus(null);

    const token = await getToken();
    if (!token) {
      setError("Sign in required.");
      setGenerating(false);
      return;
    }

    const response = await fetch(`/api/orgs/${selectedOrgId}/interventions/recommend`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ maxRecommendations: 25 }),
    });

    const body = (await response.json()) as { generated: number } | { error: { message: string } };
    if (!response.ok) {
      setError("error" in body ? body.error.message : "Failed to generate recommendations.");
      setGenerating(false);
      return;
    }

    setStatus(`Generated ${(body as { generated: number }).generated} intervention recommendation(s).`);
    await load();
    setGenerating(false);
  };

  const approve = async (id: string) => {
    if (!selectedOrgId || !canManage) return;
    setWorkingId(id);
    setError(null);
    setStatus(null);

    const token = await getToken();
    if (!token) {
      setError("Sign in required.");
      setWorkingId(null);
      return;
    }

    const response = await fetch(`/api/orgs/${selectedOrgId}/interventions/${id}/approve`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const body = (await response.json()) as { ok: true } | { error: { message: string } };
    if (!response.ok) {
      setError("error" in body ? body.error.message : "Approval failed.");
      setWorkingId(null);
      return;
    }

    setStatus("Intervention approved.");
    await load();
    setWorkingId(null);
  };

  const execute = async (id: string) => {
    if (!selectedOrgId || !canManage) return;
    setWorkingId(id);
    setError(null);
    setStatus(null);

    const token = await getToken();
    if (!token) {
      setError("Sign in required.");
      setWorkingId(null);
      return;
    }

    const response = await fetch(`/api/orgs/${selectedOrgId}/interventions/${id}/execute`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const body = (await response.json()) as { ok: true } | { error: { message: string } };
    if (!response.ok) {
      setError("error" in body ? body.error.message : "Execution failed.");
      setWorkingId(null);
      return;
    }

    setStatus("Intervention executed.");
    await load();
    setWorkingId(null);
  };

  const summary = useMemo(() => data?.summary.statusCounts ?? null, [data?.summary.statusCounts]);

  if (!canView) {
    return (
      <AdminAccessGate
        currentRole={selectedMembership?.role}
        orgName={selectedMembership?.orgName}
        requiredRole="manager"
        title="Intervention Inbox"
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Intervention Inbox</h1>
          <p className="page-subtitle">Review, approve, and execute remediation recommendations.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={() => void load()} type="button">
            <RefreshCcw className="h-3.5 w-3.5" />
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            className="btn btn-primary btn-sm"
            disabled={!canManage || generating}
            onClick={() => void generateRecommendations()}
            type="button"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {generating ? "Generating…" : "Generate Recommendations"}
          </button>
        </div>
      </div>

      {status && (
        <p className="rounded-lg border border-[var(--success-border)] bg-[var(--success-bg)] px-4 py-2 text-sm text-[var(--success)]">
          {status}
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Queue Status</h2>
          <select
            className="h-9 rounded-lg border border-[var(--border)] bg-white px-2 text-sm"
            onChange={(event) => setStatusFilter(event.target.value as "" | InterventionStatus)}
            value={statusFilter}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {summary && (
          <div className="mt-3 grid gap-2 sm:grid-cols-5 text-sm">
            <p>Proposed: <strong>{summary.proposed}</strong></p>
            <p>Approved: <strong>{summary.approved}</strong></p>
            <p>Executing: <strong>{summary.executing}</strong></p>
            <p>Completed: <strong>{summary.completed}</strong></p>
            <p>Dismissed: <strong>{summary.dismissed}</strong></p>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Recommendations</h2>
        </div>
        {(data?.items.length ?? 0) === 0 ? (
          <p className="p-5 text-sm text-[var(--text-muted)]">No interventions found for this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Control</th>
                  <th>Recommendation</th>
                  <th>Status</th>
                  <th>Expected Lift</th>
                  <th>Confidence</th>
                  <th>Execution</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <p className="font-medium text-[var(--text-primary)]">
                        {item.control?.code ?? "Unmapped"}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">{item.control?.title ?? "—"}</p>
                    </td>
                    <td>
                      <p className="text-xs font-medium text-[var(--text-primary)] capitalize">
                        {item.recommendationType.replaceAll("_", " ")}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">{item.rationale}</p>
                    </td>
                    <td>
                      <span className="status-pill status-pill-info capitalize">{item.status}</span>
                    </td>
                    <td>{item.expectedImpactPct.toFixed(1)}%</td>
                    <td>{(item.confidenceScore * 100).toFixed(1)}%</td>
                    <td className="text-xs">
                      {item.latestExecution
                        ? `${item.latestExecution.executionStatus} (${fmtDate(item.latestExecution.finishedAt ?? item.latestExecution.createdAt)})`
                        : "Not executed"}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        {item.status === "proposed" && (
                          <button
                            className="btn btn-ghost btn-sm"
                            disabled={!canManage || workingId === item.id}
                            onClick={() => void approve(item.id)}
                            type="button"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Approve
                          </button>
                        )}
                        {(item.status === "approved" || item.status === "executing") && (
                          <button
                            className="btn btn-ghost btn-sm"
                            disabled={!canManage || workingId === item.id}
                            onClick={() => void execute(item.id)}
                            type="button"
                          >
                            <Play className="h-3.5 w-3.5" />
                            Execute
                          </button>
                        )}
                        {item.status === "completed" && (
                          <span className="text-xs text-[var(--text-muted)]">Completed {fmtDate(item.createdAt)}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
