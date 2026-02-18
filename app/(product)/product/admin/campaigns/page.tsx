"use client";

import Link from "next/link";
import { CalendarClock, PlusCircle, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminAccessGate } from "@/components/product/admin-access-gate";
import { useOrgContext } from "@/lib/edtech/org-context";
import { hasMinimumRole } from "@/lib/edtech/roles";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type PolicyListResponse = {
  items: Array<{ id: string; title: string; parseStatus: string }>;
};

type DashboardResponse = {
  campaigns: Array<{
    campaignId: string;
    name: string;
    completionRate: number;
    attestationRate: number;
  }>;
};

async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function withOrg(path: string, orgId: string | null): string {
  if (!orgId) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}org=${orgId}`;
}

export default function CampaignsPage() {
  const { selectedMembership, selectedOrgId } = useOrgContext();
  const canView = hasMinimumRole(selectedMembership?.role, "manager");
  const canGenerate = hasMinimumRole(selectedMembership?.role, "admin");

  const [name, setName] = useState("AI Literacy Baseline");
  const [dueAt, setDueAt] = useState("");
  const [selectedPolicyIds, setSelectedPolicyIds] = useState<string[]>([]);
  const [policies, setPolicies] = useState<PolicyListResponse["items"]>([]);
  const [campaigns, setCampaigns] = useState<DashboardResponse["campaigns"]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const readyPolicies = useMemo(
    () => policies.filter((p) => p.parseStatus === "ready"),
    [policies],
  );

  const loadAdminData = useCallback(async () => {
    if (!selectedOrgId || !canView) return;
    setError(null);
    const token = await getAccessToken();
    if (!token) { setError("Sign in first."); return; }
    setLoading(true);
    const [pRes, dRes] = await Promise.all([
      fetch(`/api/orgs/${selectedOrgId}/policies`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/orgs/${selectedOrgId}/dashboard`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const pBody = (await pRes.json()) as PolicyListResponse | { error: { message: string } };
    const dBody = (await dRes.json()) as DashboardResponse | { error: { message: string } };
    if (!pRes.ok) { setError("error" in pBody ? pBody.error.message : "Failed to load policies."); setLoading(false); return; }
    if (!dRes.ok) { setError("error" in dBody ? dBody.error.message : "Failed to load campaigns."); setLoading(false); return; }
    setPolicies((pBody as PolicyListResponse).items);
    setCampaigns((dBody as DashboardResponse).campaigns);
    setSelectedPolicyIds((c) => c.filter((id) => (pBody as PolicyListResponse).items.some((i) => i.id === id)));
    setLoading(false);
  }, [canView, selectedOrgId]);

  useEffect(() => {
    if (!selectedOrgId || !canView) return;
    const t = window.setTimeout(() => void loadAdminData(), 0);
    return () => window.clearTimeout(t);
  }, [canView, loadAdminData, selectedOrgId]);

  const generate = async () => {
    setError(null); setStatus(null);
    if (!canGenerate) { setError("Admin/owner role required."); return; }
    if (!selectedOrgId) { setError("Select a workspace."); return; }
    if (selectedPolicyIds.length === 0) { setError("Select at least one parsed policy."); return; }
    const token = await getAccessToken();
    if (!token) { setError("Sign in first."); return; }
    const res = await fetch(`/api/orgs/${selectedOrgId}/campaigns/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, policyIds: selectedPolicyIds, roleTracks: ["exec", "builder", "general"], dueAt: dueAt || null }),
    });
    const body = (await res.json()) as { campaignId: string; status: string } | { error: { message: string } };
    if (!res.ok) { setError("error" in body ? body.error.message : "Generation failed"); return; }
    const s = body as { campaignId: string; status: string };
    setStatus(`Campaign created (${s.campaignId}). Review modules before publishing.`);
    setDueAt("");
    await loadAdminData();
  };

  const togglePolicy = (id: string) => {
    setSelectedPolicyIds((c) => c.includes(id) ? c.filter((x) => x !== id) : [...c, id]);
  };

  if (!canView) {
    return <AdminAccessGate currentRole={selectedMembership?.role} orgName={selectedMembership?.orgName} requiredRole="manager" title="Campaign Workspace" />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Campaigns</h1>
          <p className="page-subtitle">Create and manage training campaigns for {selectedMembership?.orgName ?? "your workspace"}.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => void loadAdminData()} type="button">
          <RefreshCcw className="h-3.5 w-3.5" />
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Generate + info */}
      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">New Draft Campaign</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Build role-ready training modules from parsed policy obligations.</p>

          <div className="mt-5 grid gap-4">
            <div>
              <label className="text-sm font-medium text-[var(--text-primary)]">Campaign name</label>
              <input
                className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
                onChange={(e) => setName(e.target.value)}
                value={name}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-primary)]">Due date</label>
              <div className="relative mt-1">
                <CalendarClock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
                <input
                  className="h-10 w-full rounded-lg border border-[var(--border)] bg-white pl-9 pr-3 text-sm"
                  onChange={(e) => setDueAt(e.target.value)}
                  placeholder="2026-03-01T12:00:00.000Z"
                  value={dueAt}
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-[var(--text-primary)]">Source Policies</p>
              {readyPolicies.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">Upload and parse at least one policy first.</p>
              ) : (
                <div className="grid gap-2">
                  {readyPolicies.map((p) => (
                    <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 hover:bg-[var(--bg-muted)] cursor-pointer" key={p.id}>
                      <input
                        checked={selectedPolicyIds.includes(p.id)}
                        className="accent-[var(--accent)]"
                        onChange={() => togglePolicy(p.id)}
                        type="checkbox"
                      />
                      <span className="text-sm text-[var(--text-primary)]">{p.title}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <button className="btn btn-primary" disabled={!canGenerate} onClick={() => void generate()} type="button">
              <PlusCircle className="h-4 w-4" />
              Generate Draft Campaign
            </button>
            {!canGenerate && <p className="text-xs text-[var(--text-faint)]">Admin/owner role required.</p>}
          </div>
        </div>

        <aside className="card border-[var(--bg-sidebar)] bg-[var(--bg-sidebar)] p-6 text-sm text-slate-300">
          <h3 className="text-base font-semibold text-white">Publishing Checklist</h3>
          <ul className="mt-3 space-y-2 text-slate-400">
            <li>Review module copy for policy precision.</li>
            <li>Validate pass score thresholds before publish.</li>
            <li>Publish with an Idempotency-Key for safe retries.</li>
            <li>Track completion and attestation in dashboard.</li>
          </ul>
        </aside>
      </div>

      {status && <p className="rounded-lg border border-[var(--success-border)] bg-[var(--success-bg)] px-4 py-2 text-sm text-[var(--success)]">{status}</p>}
      {error && <p className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-2 text-sm text-[var(--danger)]">{error}</p>}

      {/* Campaigns table */}
      <div className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Recent Campaigns</h2>
        </div>
        {campaigns.length === 0 ? (
          <p className="p-5 text-sm text-[var(--text-muted)]">No campaigns found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Completion</th>
                  <th>Attestation</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.campaignId}>
                    <td className="font-medium text-[var(--text-primary)]">{c.name}</td>
                    <td>{(c.completionRate * 100).toFixed(1)}%</td>
                    <td>{(c.attestationRate * 100).toFixed(1)}%</td>
                    <td>
                      <Link className="btn btn-ghost btn-sm" href={withOrg(`/product/admin/campaigns/${c.campaignId}`, selectedOrgId)}>
                        Open →
                      </Link>
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
