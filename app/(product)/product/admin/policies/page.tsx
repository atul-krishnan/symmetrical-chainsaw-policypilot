"use client";

import { RefreshCcw, Upload } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AdminAccessGate } from "@/components/product/admin-access-gate";
import { useOrgContext } from "@/lib/edtech/org-context";
import { hasMinimumRole } from "@/lib/edtech/roles";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type PolicyListResponse = {
  items: Array<{
    id: string;
    title: string;
    fileMimeType: string;
    parseStatus: string;
    createdAt: string;
    updatedAt: string;
  }>;
};

async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function statusPillClass(status: string): string {
  if (status === "ready") return "status-pill-success";
  if (status === "failed") return "status-pill-danger";
  return "status-pill-info";
}

export default function PoliciesPage() {
  const { selectedMembership, selectedOrgId } = useOrgContext();
  const canView = hasMinimumRole(selectedMembership?.role, "manager");
  const canUpload = hasMinimumRole(selectedMembership?.role, "admin");

  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [policies, setPolicies] = useState<PolicyListResponse["items"]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPolicies = useCallback(async () => {
    if (!selectedOrgId || !canView) return;
    setError(null);
    const token = await getAccessToken();
    if (!token) { setError("Please sign in."); return; }
    setLoadingPolicies(true);
    const res = await fetch(`/api/orgs/${selectedOrgId}/policies`, { headers: { Authorization: `Bearer ${token}` } });
    const body = (await res.json()) as PolicyListResponse | { error: { message: string } };
    if (!res.ok) { setError("error" in body ? body.error.message : "Failed to load."); setLoadingPolicies(false); return; }
    setPolicies((body as PolicyListResponse).items);
    setLoadingPolicies(false);
  }, [canView, selectedOrgId]);

  useEffect(() => {
    if (!selectedOrgId || !canView) return;
    const t = window.setTimeout(() => void loadPolicies(), 0);
    return () => window.clearTimeout(t);
  }, [canView, loadPolicies, selectedOrgId]);

  const submit = async () => {
    setError(null); setStatus(null);
    if (!canUpload) { setError("Only admin/owner roles can upload."); return; }
    if (!selectedOrgId) { setError("Select a workspace first."); return; }
    if (!title || !file) { setError("Provide a title and file."); return; }
    const token = await getAccessToken();
    if (!token) { setError("Please sign in."); return; }
    const fd = new FormData();
    fd.append("title", title);
    fd.append("file", file);
    const res = await fetch(`/api/orgs/${selectedOrgId}/policies`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const body = (await res.json()) as { policyId: string; parseStatus: string } | { error: { message: string } };
    if (!res.ok) { setError("error" in body ? body.error.message : "Upload failed"); return; }
    const s = body as { policyId: string; parseStatus: string };
    setStatus(`Policy uploaded. Parse status: ${s.parseStatus}`);
    setTitle(""); setFile(null);
    void loadPolicies();
  };

  if (!canView) {
    return (
      <AdminAccessGate currentRole={selectedMembership?.role} orgName={selectedMembership?.orgName} requiredRole="manager" title="Policy Workspace" />
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Policies</h1>
          <p className="page-subtitle">
            Upload policy documents for {selectedMembership?.orgName ?? "your workspace"} and convert obligations into training inputs.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => void loadPolicies()} type="button">
          <RefreshCcw className="h-3.5 w-3.5" />
          {loadingPolicies ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Upload + info */}
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Upload New Policy</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Supported: PDF, DOCX, TXT</p>

          <div className="mt-5 grid gap-4">
            <div>
              <label className="text-sm font-medium text-[var(--text-primary)]">Policy title</label>
              <input
                className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
                onChange={(e) => setTitle(e.target.value)}
                value={title}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-primary)]">File</label>
              <input
                accept=".pdf,.docx,.txt"
                className="mt-1 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm w-full"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                type="file"
              />
            </div>
            <button
              className="btn btn-primary"
              disabled={!canUpload}
              onClick={submit}
              type="button"
            >
              <Upload className="h-4 w-4" />
              Upload and Parse
            </button>
            {!canUpload && (
              <p className="text-xs text-[var(--text-faint)]">Upload restricted to admin/owner roles.</p>
            )}
          </div>
        </div>

        <aside className="card border-[var(--bg-sidebar)] bg-[var(--bg-sidebar)] p-6 text-sm text-slate-300">
          <h3 className="text-base font-semibold text-white">Operational Notes</h3>
          <ul className="mt-3 space-y-2 text-slate-400">
            <li>File type and extension must match.</li>
            <li>Uploads are org-scoped and stored in secure buckets.</li>
            <li>Parse failures show as &quot;failed&quot; with retry guidance.</li>
            <li>After parse: generate campaign draft.</li>
          </ul>
        </aside>
      </div>

      {status && <p className="rounded-lg border border-[var(--success-border)] bg-[var(--success-bg)] px-4 py-2 text-sm text-[var(--success)]">{status}</p>}
      {error && <p className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-2 text-sm text-[var(--danger)]">{error}</p>}

      {/* Policies table */}
      <div className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Recent Policies</h2>
        </div>
        {policies.length === 0 ? (
          <p className="p-5 text-sm text-[var(--text-muted)]">No policy documents uploaded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Type</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  <tr key={p.id}>
                    <td className="font-medium text-[var(--text-primary)]">{p.title}</td>
                    <td>
                      <span className={`status-pill ${statusPillClass(p.parseStatus)}`}>
                        {p.parseStatus}
                      </span>
                    </td>
                    <td className="text-xs">{p.fileMimeType}</td>
                    <td className="text-xs">{new Date(p.createdAt).toLocaleDateString()}</td>
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
