"use client";

import { Link2, RefreshCcw, Send, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminAccessGate } from "@/components/product/admin-access-gate";
import { useOrgContext } from "@/lib/edtech/org-context";
import { hasMinimumRole } from "@/lib/edtech/roles";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type Provider = "vanta" | "drata";
type EvidenceStatus = "queued" | "synced" | "rejected" | "stale" | "superseded";

type SyncJob = {
  id: string;
  status: string;
  trigger: string;
  stats: {
    attempted?: number;
    synced?: number;
    rejected?: number;
  } | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  latestEvent: {
    provider: string;
    status: string;
    createdAt: string;
  } | null;
};

type ProviderResponse = {
  orgId: string;
  provider: Provider;
  connection: {
    provider: Provider;
    status: string;
    scopes: string[];
    credentialLast4: string | null;
    healthMessage: string | null;
    lastSyncAt: string | null;
    updatedAt: string;
  } | null;
  jobs: SyncJob[];
};

type ProviderUiState = {
  connection: ProviderResponse["connection"];
  jobs: SyncJob[];
  apiKey: string;
  accountId: string;
  workspaceId: string;
  scopes: string;
  syncStatus: EvidenceStatus;
  syncLimit: number;
  busyConnect: boolean;
  busySync: boolean;
  error: string | null;
  success: string | null;
};

const PROVIDERS: Provider[] = ["vanta", "drata"];

function initialProviderUiState(): ProviderUiState {
  return {
    connection: null,
    jobs: [],
    apiKey: "",
    accountId: "",
    workspaceId: "",
    scopes: "",
    syncStatus: "queued",
    syncLimit: 200,
    busyConnect: false,
    busySync: false,
    error: null,
    success: null,
  };
}

async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return null;
  }

  const { data } = await supabase.auth.getSession();
  let token = data.session?.access_token ?? null;
  if (!token) {
    const refreshed = await supabase.auth.refreshSession();
    token = refreshed.data.session?.access_token ?? null;
  }

  return token;
}

function formatDateTime(input: string | null): string {
  if (!input) return "—";
  const dt = new Date(input);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString();
}

function providerLabel(provider: Provider): string {
  return provider === "vanta" ? "Vanta" : "Drata";
}

export default function IntegrationsPage() {
  const { selectedMembership, selectedOrgId } = useOrgContext();
  const canView = hasMinimumRole(selectedMembership?.role, "manager");
  const canManage = hasMinimumRole(selectedMembership?.role, "admin");

  const [activeProvider, setActiveProvider] = useState<Provider>("vanta");
  const [providerState, setProviderState] = useState<Record<Provider, ProviderUiState>>({
    vanta: initialProviderUiState(),
    drata: initialProviderUiState(),
  });
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const patchProvider = useCallback((provider: Provider, patch: Partial<ProviderUiState>) => {
    setProviderState((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        ...patch,
      },
    }));
  }, []);

  const loadProvider = useCallback(async (provider: Provider, token?: string) => {
    if (!selectedOrgId || !canView) {
      return;
    }

    const effectiveToken = token ?? (await getAccessToken());
    if (!effectiveToken) {
      patchProvider(provider, { error: "Sign in required." });
      return;
    }

    const response = await fetch(`/api/orgs/${selectedOrgId}/integrations/${provider}/sync-jobs`, {
      headers: { Authorization: `Bearer ${effectiveToken}` },
    });

    const body = (await response.json()) as ProviderResponse | { error: { message: string } };
    if (!response.ok) {
      patchProvider(provider, {
        error: "error" in body ? body.error.message : "Failed to load integration.",
      });
      return;
    }

    const parsed = body as ProviderResponse;
    patchProvider(provider, {
      connection: parsed.connection,
      jobs: parsed.jobs,
      error: null,
    });
  }, [canView, patchProvider, selectedOrgId]);

  const loadAll = useCallback(async () => {
    if (!selectedOrgId || !canView) {
      return;
    }

    setLoading(true);
    setGlobalError(null);

    const token = await getAccessToken();
    if (!token) {
      setGlobalError("Sign in required.");
      setLoading(false);
      return;
    }

    await Promise.all(PROVIDERS.map((provider) => loadProvider(provider, token)));
    setLoading(false);
  }, [canView, loadProvider, selectedOrgId]);

  useEffect(() => {
    if (!selectedOrgId || !canView) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadAll();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [canView, loadAll, selectedOrgId]);

  const updateField = <K extends keyof ProviderUiState>(provider: Provider, field: K, value: ProviderUiState[K]) => {
    patchProvider(provider, { [field]: value } as Partial<ProviderUiState>);
  };

  const connectProvider = async (provider: Provider) => {
    if (!canManage) {
      patchProvider(provider, { error: "Admin role required for connector updates." });
      return;
    }
    if (!selectedOrgId) {
      patchProvider(provider, { error: "Select an organization workspace first." });
      return;
    }

    const state = providerState[provider];
    if (!state.apiKey.trim()) {
      patchProvider(provider, { error: "API key is required to connect." });
      return;
    }

    patchProvider(provider, { busyConnect: true, error: null, success: null });

    const token = await getAccessToken();
    if (!token) {
      patchProvider(provider, { busyConnect: false, error: "Sign in required." });
      return;
    }

    const payload: {
      apiKey: string;
      accountId?: string;
      workspaceId?: string;
      scopes?: string[];
    } = {
      apiKey: state.apiKey.trim(),
    };

    if (state.accountId.trim()) {
      payload.accountId = state.accountId.trim();
    }
    if (state.workspaceId.trim()) {
      payload.workspaceId = state.workspaceId.trim();
    }

    const scopes = state.scopes
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (scopes.length > 0) {
      payload.scopes = scopes;
    }

    const response = await fetch(`/api/orgs/${selectedOrgId}/integrations/${provider}/connect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json()) as
      | {
        ok: true;
        connection: {
          apiKeyLast4: string;
          scopes: string[];
        };
      }
      | { error: { message: string } };

    if (!response.ok) {
      patchProvider(provider, {
        busyConnect: false,
        error: "error" in body ? body.error.message : "Failed to connect integration.",
      });
      return;
    }

    const result = body as {
      connection: {
        apiKeyLast4: string;
        scopes: string[];
      };
    };

    patchProvider(provider, {
      apiKey: "",
      busyConnect: false,
      success: `Connected. Credential ending ${result.connection.apiKeyLast4}.`,
      error: null,
    });

    await loadProvider(provider, token);
  };

  const syncProvider = async (provider: Provider) => {
    if (!canManage) {
      patchProvider(provider, { error: "Admin role required for sync operations." });
      return;
    }
    if (!selectedOrgId) {
      patchProvider(provider, { error: "Select an organization workspace first." });
      return;
    }

    const state = providerState[provider];

    patchProvider(provider, { busySync: true, error: null, success: null });

    const token = await getAccessToken();
    if (!token) {
      patchProvider(provider, { busySync: false, error: "Sign in required." });
      return;
    }

    const response = await fetch(`/api/orgs/${selectedOrgId}/integrations/${provider}/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        evidenceStatus: state.syncStatus,
        limit: state.syncLimit,
      }),
    });

    const body = (await response.json()) as
      | {
        ok: true;
        attempted: number;
        synced: number;
        rejected: number;
      }
      | { error: { message: string } };

    if (!response.ok) {
      patchProvider(provider, {
        busySync: false,
        error: "error" in body ? body.error.message : "Failed to run sync.",
      });
      return;
    }

    const result = body as { attempted: number; synced: number; rejected: number };

    patchProvider(provider, {
      busySync: false,
      success: `Sync finished. Attempted ${result.attempted}, synced ${result.synced}, rejected ${result.rejected}.`,
      error: null,
    });

    await loadProvider(provider, token);
  };

  const current = providerState[activeProvider];

  const providerSummary = useMemo(
    () =>
      PROVIDERS.map((provider) => ({
        provider,
        label: providerLabel(provider),
        status: providerState[provider].connection?.status ?? "disconnected",
        lastSyncAt: providerState[provider].connection?.lastSyncAt ?? null,
      })),
    [providerState],
  );

  if (!canView) {
    return (
      <AdminAccessGate
        currentRole={selectedMembership?.role}
        orgName={selectedMembership?.orgName}
        requiredRole="manager"
        title="Integrations"
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Integrations</h1>
          <p className="page-subtitle">
            Connect Vanta and Drata, then push adoption evidence with sync status tracking.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => void loadAll()} type="button">
          <RefreshCcw className="h-3.5 w-3.5" />
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {globalError && (
        <p className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-2 text-sm text-[var(--danger)]">
          {globalError}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {providerSummary.map((item) => (
          <button
            className={`rounded-xl border px-4 py-3 text-left ${
              item.provider === activeProvider
                ? "border-[var(--accent)] bg-[var(--bg-muted)]"
                : "border-[var(--border)] bg-white"
            }`}
            key={item.provider}
            onClick={() => setActiveProvider(item.provider)}
            type="button"
          >
            <p className="text-sm font-semibold text-[var(--text-primary)]">{item.label}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)] capitalize">Status: {item.status}</p>
            <p className="text-xs text-[var(--text-muted)]">Last sync: {formatDateTime(item.lastSyncAt)}</p>
          </button>
        ))}
      </div>

      {current.error && (
        <p className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-2 text-sm text-[var(--danger)]">
          {current.error}
        </p>
      )}
      {current.success && (
        <p className="rounded-lg border border-[var(--success-border)] bg-[var(--success-bg)] px-4 py-2 text-sm text-[var(--success)]">
          {current.success}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-6">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-[var(--text-muted)]" />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {providerLabel(activeProvider)} Connection
            </h2>
          </div>

          <div className="mt-4 space-y-3">
            <p className="text-sm text-[var(--text-muted)]">
              Current status: <strong className="capitalize text-[var(--text-primary)]">{current.connection?.status ?? "disconnected"}</strong>
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Last credential: {current.connection?.credentialLast4 ? `••••${current.connection.credentialLast4}` : "Not connected"}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Health: {current.connection?.healthMessage ?? "No health message available."}
            </p>

            <div>
              <label className="text-sm font-medium text-[var(--text-primary)]">API key</label>
              <input
                className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
                onChange={(event) => updateField(activeProvider, "apiKey", event.target.value)}
                type="password"
                value={current.apiKey}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-[var(--text-primary)]">Account ID (optional)</label>
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
                  onChange={(event) => updateField(activeProvider, "accountId", event.target.value)}
                  value={current.accountId}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--text-primary)]">Workspace ID (optional)</label>
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
                  onChange={(event) => updateField(activeProvider, "workspaceId", event.target.value)}
                  value={current.workspaceId}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--text-primary)]">Scopes (comma separated)</label>
              <input
                className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
                onChange={(event) => updateField(activeProvider, "scopes", event.target.value)}
                placeholder="evidence.write, controls.read"
                value={current.scopes}
              />
            </div>

            <button
              className="btn btn-primary"
              disabled={!canManage || current.busyConnect}
              onClick={() => void connectProvider(activeProvider)}
              type="button"
            >
              <ShieldCheck className="h-4 w-4" />
              {current.busyConnect ? "Connecting…" : `Connect ${providerLabel(activeProvider)}`}
            </button>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-[var(--text-muted)]" />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Evidence Sync</h2>
          </div>

          <div className="mt-4 grid gap-3">
            <div>
              <label className="text-sm font-medium text-[var(--text-primary)]">Evidence status to push</label>
              <select
                className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
                onChange={(event) => updateField(activeProvider, "syncStatus", event.target.value as EvidenceStatus)}
                value={current.syncStatus}
              >
                <option value="queued">Queued</option>
                <option value="stale">Stale</option>
                <option value="rejected">Rejected</option>
                <option value="synced">Synced</option>
                <option value="superseded">Superseded</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--text-primary)]">Batch size</label>
              <input
                className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
                max={500}
                min={1}
                onChange={(event) => updateField(activeProvider, "syncLimit", Number(event.target.value) || 1)}
                type="number"
                value={current.syncLimit}
              />
            </div>

            <button
              className="btn btn-primary"
              disabled={!canManage || current.busySync}
              onClick={() => void syncProvider(activeProvider)}
              type="button"
            >
              <Send className="h-4 w-4" />
              {current.busySync ? "Syncing…" : "Run Sync Now"}
            </button>

            <p className="text-xs text-[var(--text-muted)]">
              Sync updates evidence statuses and writes connector event logs for reconciliation.
            </p>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            {providerLabel(activeProvider)} Sync Jobs
          </h2>
        </div>

        {current.jobs.length === 0 ? (
          <p className="p-5 text-sm text-[var(--text-muted)]">No sync jobs found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Status</th>
                  <th>Trigger</th>
                  <th>Stats</th>
                  <th>Latest Event</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {current.jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="text-xs">{formatDateTime(job.startedAt ?? job.createdAt)}</td>
                    <td className="capitalize">{job.status}</td>
                    <td className="capitalize">{job.trigger}</td>
                    <td className="text-xs">
                      attempted: {job.stats?.attempted ?? 0} · synced: {job.stats?.synced ?? 0} · rejected: {job.stats?.rejected ?? 0}
                    </td>
                    <td className="text-xs">
                      {job.latestEvent
                        ? `${job.latestEvent.status} (${formatDateTime(job.latestEvent.createdAt)})`
                        : "—"}
                    </td>
                    <td className="text-xs text-[var(--danger)]">{job.errorMessage ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!canManage && (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] px-4 py-3 text-xs text-[var(--text-muted)]">
          You have read-only access. Admin/owner role is required to connect providers and run sync jobs.
        </p>
      )}
    </div>
  );
}
