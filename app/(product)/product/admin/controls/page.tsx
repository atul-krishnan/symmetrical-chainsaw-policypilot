"use client";

import { RefreshCcw, UploadCloud } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminAccessGate } from "@/components/product/admin-access-gate";
import { useOrgContext } from "@/lib/edtech/org-context";
import { hasMinimumRole } from "@/lib/edtech/roles";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type TemplateId = "soc2" | "iso27001" | "ai_governance";
type EvidenceStatus = "queued" | "synced" | "rejected" | "stale" | "superseded";
type MappingStrength = "primary" | "supporting";

type ControlsResponse = {
  orgId: string;
  frameworks: Array<{
    id: string;
    name: string;
    version: string;
    source: string;
    created_at: string;
  }>;
  campaigns: Array<{
    id: string;
    name: string;
    status: string;
  }>;
  controls: Array<{
    id: string;
    code: string;
    title: string;
    description: string;
    riskLevel: "low" | "medium" | "high";
    framework: {
      id: string;
      name: string;
      version: string;
    } | null;
    mappingCount: number;
    activeCampaignId: string | null;
    activeMappingStrength: MappingStrength | null;
    evidence: {
      total: number;
      queued: number;
      synced: number;
      rejected: number;
      stale: number;
      superseded: number;
    };
    freshness: {
      state: "fresh" | "aging" | "stale" | "critical";
      score: number;
      latestEvidenceAt: string | null;
    };
    freshnessTrend: number[];
    benchmark: {
      cohortCode: string;
      percentileRank: number | null;
      band: string;
    };
    intervention: {
      activeCount: number;
      latestStatus: string | null;
    };
  }>;
  summary: {
    totalControls: number;
    mappedControls: number;
    coverageRatio: number;
    benchmarkCohort: string;
  };
};

type EvidenceResponse = {
  orgId: string;
  summary: {
    total: number;
    statusCounts: {
      queued: number;
      synced: number;
      rejected: number;
      stale: number;
      superseded: number;
    };
  };
  items: Array<{
    id: string;
    controlId: string | null;
    campaignId: string | null;
    moduleId: string | null;
    evidenceType: string;
    status: EvidenceStatus;
    occurredAt: string;
    checksum: string;
    control: {
      id: string;
      code: string;
      title: string;
    } | null;
    latestSyncEvent: {
      provider: string;
      status: string;
      externalEvidenceId: string | null;
      createdAt: string;
    } | null;
    lineage?: {
      derivedFromEvidenceIds: string[];
      derivedByEvidenceIds: string[];
      supersedesEvidenceIds: string[];
      exportedInEvidenceIds: string[];
    };
  }>;
};

type MappingDraft = {
  campaignId: string;
  mappingStrength: MappingStrength;
};

const TEMPLATE_OPTIONS: Array<{ id: TemplateId; label: string; description: string }> = [
  {
    id: "soc2",
    label: "SOC 2",
    description: "Trust service criteria starter controls for workforce adoption evidence.",
  },
  {
    id: "iso27001",
    label: "ISO 27001",
    description: "Annex-aligned policy adoption controls and awareness expectations.",
  },
  {
    id: "ai_governance",
    label: "AI Governance",
    description: "PolicyPilot custom controls for AI policy behavior and oversight.",
  },
];

const STATUS_FILTER_OPTIONS: Array<{ value: "" | EvidenceStatus; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "queued", label: "Queued" },
  { value: "synced", label: "Synced" },
  { value: "rejected", label: "Rejected" },
  { value: "stale", label: "Stale" },
  { value: "superseded", label: "Superseded" },
];

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

function formatDateTime(input: string): string {
  const dt = new Date(input);
  if (Number.isNaN(dt.getTime())) {
    return "—";
  }
  return dt.toLocaleString();
}

function riskClassName(risk: "low" | "medium" | "high"): string {
  if (risk === "high") return "status-pill status-pill-danger";
  if (risk === "medium") return "status-pill status-pill-info";
  return "status-pill status-pill-success";
}

export default function ControlsPage() {
  const { selectedMembership, selectedOrgId } = useOrgContext();
  const canView = hasMinimumRole(selectedMembership?.role, "manager");
  const canManage = hasMinimumRole(selectedMembership?.role, "admin");

  const [selectedTemplates, setSelectedTemplates] = useState<TemplateId[]>(["soc2", "ai_governance"]);
  const [controlsData, setControlsData] = useState<ControlsResponse | null>(null);
  const [evidenceData, setEvidenceData] = useState<EvidenceResponse | null>(null);
  const [mappingDrafts, setMappingDrafts] = useState<Record<string, MappingDraft>>({});

  const [controlFilter, setControlFilter] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | EvidenceStatus>("");

  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [savingControlId, setSavingControlId] = useState<string | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const controls = controlsData?.controls ?? [];
  const campaigns = controlsData?.campaigns ?? [];

  const loadData = useCallback(async () => {
    if (!selectedOrgId || !canView) {
      return;
    }

    setLoading(true);
    setError(null);

    const token = await getAccessToken();
    if (!token) {
      setError("Sign in required.");
      setLoading(false);
      return;
    }

    const query = new URLSearchParams();
    if (controlFilter) query.set("controlId", controlFilter);
    if (campaignFilter) query.set("campaignId", campaignFilter);
    if (statusFilter) query.set("status", statusFilter);

    const [controlsRes, evidenceRes] = await Promise.all([
      fetch(`/api/orgs/${selectedOrgId}/controls`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`/api/orgs/${selectedOrgId}/evidence${query.toString() ? `?${query.toString()}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    const controlsBody = (await controlsRes.json()) as ControlsResponse | { error: { message: string } };
    const evidenceBody = (await evidenceRes.json()) as EvidenceResponse | { error: { message: string } };

    if (!controlsRes.ok) {
      setError("error" in controlsBody ? controlsBody.error.message : "Failed to load controls.");
      setLoading(false);
      return;
    }

    if (!evidenceRes.ok) {
      setError("error" in evidenceBody ? evidenceBody.error.message : "Failed to load evidence.");
      setLoading(false);
      return;
    }

    const parsedControls = controlsBody as ControlsResponse;
    const parsedEvidence = evidenceBody as EvidenceResponse;

    setControlsData(parsedControls);
    setEvidenceData(parsedEvidence);
    setMappingDrafts((prev) => {
      const next = { ...prev };
      for (const item of parsedControls.controls) {
        next[item.id] = {
          campaignId: item.activeCampaignId ?? "",
          mappingStrength: item.activeMappingStrength ?? "supporting",
        };
      }
      return next;
    });

    setLoading(false);
  }, [campaignFilter, canView, controlFilter, selectedOrgId, statusFilter]);

  useEffect(() => {
    if (!selectedOrgId || !canView) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [canView, loadData, selectedOrgId]);

  const toggleTemplate = (template: TemplateId) => {
    setSelectedTemplates((current) => {
      if (current.includes(template)) {
        return current.filter((item) => item !== template);
      }
      return [...current, template];
    });
  };

  const importFrameworks = async () => {
    if (!canManage) {
      setError("Admin role required for framework import.");
      return;
    }
    if (!selectedOrgId) {
      setError("Select an organization workspace first.");
      return;
    }
    if (selectedTemplates.length === 0) {
      setError("Select at least one framework template.");
      return;
    }

    setImporting(true);
    setError(null);
    setStatus(null);

    const token = await getAccessToken();
    if (!token) {
      setError("Sign in required.");
      setImporting(false);
      return;
    }

    const response = await fetch(`/api/orgs/${selectedOrgId}/controls/frameworks/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ templates: selectedTemplates }),
    });

    const body = (await response.json()) as
      | {
        ok: true;
        importedFrameworks: number;
        importedControls: number;
      }
      | { error: { message: string } };

    if (!response.ok) {
      setError("error" in body ? body.error.message : "Framework import failed.");
      setImporting(false);
      return;
    }

    const result = body as { importedFrameworks: number; importedControls: number };
    setStatus(
      `Imported ${result.importedFrameworks} framework(s) and ${result.importedControls} controls.`,
    );

    await loadData();
    setImporting(false);
  };

  const setCampaignDraft = (controlId: string, campaignId: string) => {
    setMappingDrafts((prev) => ({
      ...prev,
      [controlId]: {
        campaignId,
        mappingStrength: prev[controlId]?.mappingStrength ?? "supporting",
      },
    }));
  };

  const setStrengthDraft = (controlId: string, mappingStrength: MappingStrength) => {
    setMappingDrafts((prev) => ({
      ...prev,
      [controlId]: {
        campaignId: prev[controlId]?.campaignId ?? "",
        mappingStrength,
      },
    }));
  };

  const saveMapping = async (controlId: string, clear: boolean) => {
    if (!canManage) {
      setError("Admin role required for mapping updates.");
      return;
    }
    if (!selectedOrgId) {
      setError("Select an organization workspace first.");
      return;
    }

    const draft = mappingDrafts[controlId] ?? { campaignId: "", mappingStrength: "supporting" as const };

    if (!clear && !draft.campaignId) {
      setError("Select a campaign before saving a control mapping.");
      return;
    }

    const mappings = clear || !draft.campaignId
      ? []
      : [
        {
          campaignId: draft.campaignId,
          mappingStrength: draft.mappingStrength,
          active: true,
        },
      ];

    setSavingControlId(controlId);
    setError(null);
    setStatus(null);

    const token = await getAccessToken();
    if (!token) {
      setError("Sign in required.");
      setSavingControlId(null);
      return;
    }

    const response = await fetch(`/api/orgs/${selectedOrgId}/controls/${controlId}/mappings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ mappings }),
    });

    const body = (await response.json()) as
      | { ok: true; mappingCount: number }
      | { error: { message: string } };

    if (!response.ok) {
      setError("error" in body ? body.error.message : "Failed to update mapping.");
      setSavingControlId(null);
      return;
    }

    setStatus(
      clear
        ? "Control mappings cleared."
        : `Control mapping updated (${(body as { mappingCount: number }).mappingCount} mapping).`,
    );
    await loadData();
    setSavingControlId(null);
  };

  const generateNarrative = async () => {
    if (!selectedOrgId) {
      setError("Select an organization workspace first.");
      return;
    }

    setNarrativeLoading(true);
    setError(null);
    setStatus(null);

    const token = await getAccessToken();
    if (!token) {
      setError("Sign in required.");
      setNarrativeLoading(false);
      return;
    }

    const response = await fetch(`/api/orgs/${selectedOrgId}/audit-narratives/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        controlId: controlFilter || undefined,
        campaignId: campaignFilter || undefined,
        window: 30,
      }),
    });

    const body = (await response.json()) as
      | { narrative: string }
      | { error: { message: string } };

    if (!response.ok) {
      setError("error" in body ? body.error.message : "Failed to generate narrative.");
      setNarrativeLoading(false);
      return;
    }

    setNarrative((body as { narrative: string }).narrative);
    setNarrativeLoading(false);
  };

  const visibleEvidence = useMemo(() => (evidenceData?.items ?? []).slice(0, 50), [evidenceData]);

  if (!canView) {
    return (
      <AdminAccessGate
        currentRole={selectedMembership?.role}
        orgName={selectedMembership?.orgName}
        requiredRole="manager"
        title="Controls & Evidence"
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Controls & Evidence</h1>
          <p className="page-subtitle">
            Map learning outcomes to controls and monitor auditable evidence health.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => void loadData()} type="button">
          <RefreshCcw className="h-3.5 w-3.5" />
          {loading ? "Refreshing…" : "Refresh"}
        </button>
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

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Import Control Frameworks</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Seed your control library before mapping campaigns and evidence streams.
          </p>

          <div className="mt-4 grid gap-3">
            {TEMPLATE_OPTIONS.map((template) => (
              <label
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] bg-white px-3 py-2"
                key={template.id}
              >
                <input
                  checked={selectedTemplates.includes(template.id)}
                  className="mt-1 accent-[var(--accent)]"
                  onChange={() => toggleTemplate(template.id)}
                  type="checkbox"
                />
                <span>
                  <span className="block text-sm font-semibold text-[var(--text-primary)]">{template.label}</span>
                  <span className="block text-xs text-[var(--text-muted)]">{template.description}</span>
                </span>
              </label>
            ))}
          </div>

          <button
            className="btn btn-primary mt-4"
            disabled={!canManage || importing}
            onClick={() => void importFrameworks()}
            type="button"
          >
            <UploadCloud className="h-4 w-4" />
            {importing ? "Importing…" : "Import Selected Frameworks"}
          </button>

          {!canManage && (
            <p className="mt-2 text-xs text-[var(--text-faint)]">Admin/owner role required for imports.</p>
          )}
        </div>

        <aside className="card p-6">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Coverage Snapshot</h3>
          <div className="mt-3 space-y-1 text-sm text-[var(--text-muted)]">
            <p>
              Controls: <strong className="text-[var(--text-primary)]">{controlsData?.summary.totalControls ?? 0}</strong>
            </p>
            <p>
              Mapped: <strong className="text-[var(--text-primary)]">{controlsData?.summary.mappedControls ?? 0}</strong>
            </p>
            <p>
              Coverage: <strong className="text-[var(--text-primary)]">
                {(((controlsData?.summary.coverageRatio ?? 0) * 100).toFixed(1))}%
              </strong>
            </p>
            <p>
              Benchmark cohort: <strong className="text-[var(--text-primary)]">{controlsData?.summary.benchmarkCohort ?? "mid_market_saas"}</strong>
            </p>
          </div>

          <h4 className="mt-5 text-sm font-semibold text-[var(--text-primary)]">Evidence Status</h4>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[var(--text-muted)]">
            <p>Queued: <strong>{evidenceData?.summary.statusCounts.queued ?? 0}</strong></p>
            <p>Synced: <strong>{evidenceData?.summary.statusCounts.synced ?? 0}</strong></p>
            <p>Rejected: <strong>{evidenceData?.summary.statusCounts.rejected ?? 0}</strong></p>
            <p>Stale: <strong>{evidenceData?.summary.statusCounts.stale ?? 0}</strong></p>
          </div>

          <p className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2 text-xs text-[var(--text-muted)]">
            This page is the control-evidence system of record; downstream connectors consume these evidence objects.
          </p>
        </aside>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Control Library</h2>
        </div>

        {controls.length === 0 ? (
          <p className="p-5 text-sm text-[var(--text-muted)]">No controls found. Import templates to begin.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Control</th>
                  <th>Risk</th>
                  <th>Framework</th>
                  <th>Mappings</th>
                  <th>Evidence</th>
                  <th>Freshness</th>
                  <th>Benchmark</th>
                  <th>Interventions</th>
                  <th>Quick Map</th>
                </tr>
              </thead>
              <tbody>
                {controls.map((control) => {
                  const draft = mappingDrafts[control.id] ?? { campaignId: "", mappingStrength: "supporting" as const };
                  const saving = savingControlId === control.id;
                  const canSave = canManage && !saving && Boolean(draft.campaignId);
                  const canClear = canManage && !saving && control.mappingCount > 0;
                  return (
                    <tr key={control.id}>
                      <td>
                        <p className="font-medium text-[var(--text-primary)]">{control.code}</p>
                        <p className="text-xs text-[var(--text-muted)]">{control.title}</p>
                      </td>
                      <td>
                        <span className={`${riskClassName(control.riskLevel)} capitalize`}>{control.riskLevel}</span>
                      </td>
                      <td className="text-xs">
                        {control.framework
                          ? `${control.framework.name} ${control.framework.version}`
                          : "Custom"}
                      </td>
                      <td>{control.mappingCount}</td>
                      <td className="text-xs">
                        <p>Synced: {control.evidence.synced}</p>
                        <p>Rejected: {control.evidence.rejected}</p>
                        <p>Stale: {control.evidence.stale}</p>
                      </td>
                      <td className="text-xs">
                        <p className="capitalize font-medium">{control.freshness.state}</p>
                        <p>Score: {control.freshness.score.toFixed(1)}</p>
                        <p className="text-[var(--text-faint)]">
                          Last: {formatDateTime(control.freshness.latestEvidenceAt ?? "")}
                        </p>
                      </td>
                      <td className="text-xs">
                        <p>
                          Percentile:{" "}
                          <strong>
                            {control.benchmark.percentileRank === null
                              ? "—"
                              : `${control.benchmark.percentileRank.toFixed(0)}th`}
                          </strong>
                        </p>
                        <p className="capitalize text-[var(--text-muted)]">{control.benchmark.band}</p>
                      </td>
                      <td className="text-xs">
                        <p>Active: {control.intervention.activeCount}</p>
                        <p className="capitalize">{control.intervention.latestStatus ?? "none"}</p>
                      </td>
                      <td>
                        <div className="grid gap-1.5 sm:grid-cols-[minmax(140px,1fr)_120px_auto_auto] sm:items-center">
                          <select
                            className="h-8 rounded-md border border-[var(--border)] bg-white px-2 text-xs"
                            disabled={!canManage || campaigns.length === 0 || saving}
                            onChange={(event) => setCampaignDraft(control.id, event.target.value)}
                            value={draft.campaignId}
                          >
                            <option value="">No campaign</option>
                            {campaigns.map((campaign) => (
                              <option key={campaign.id} value={campaign.id}>
                                {campaign.name}
                              </option>
                            ))}
                          </select>

                          <select
                            className="h-8 rounded-md border border-[var(--border)] bg-white px-2 text-xs"
                            disabled={!canManage || saving}
                            onChange={(event) => setStrengthDraft(control.id, event.target.value as MappingStrength)}
                            value={draft.mappingStrength}
                          >
                            <option value="primary">Primary</option>
                            <option value="supporting">Supporting</option>
                          </select>

                          <button
                            className="btn btn-ghost btn-sm"
                            disabled={!canSave}
                            onClick={() => void saveMapping(control.id, false)}
                            type="button"
                          >
                            Save
                          </button>

                          <button
                            className="btn btn-ghost btn-sm"
                            disabled={!canClear}
                            onClick={() => void saveMapping(control.id, true)}
                            type="button"
                          >
                            Clear
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Evidence Explorer</h2>
          <div className="grid gap-2 sm:grid-cols-4">
            <select
              className="h-9 rounded-lg border border-[var(--border)] bg-white px-2 text-sm"
              onChange={(event) => setControlFilter(event.target.value)}
              value={controlFilter}
            >
              <option value="">All controls</option>
              {controls.map((control) => (
                <option key={control.id} value={control.id}>
                  {control.code}
                </option>
              ))}
            </select>

            <select
              className="h-9 rounded-lg border border-[var(--border)] bg-white px-2 text-sm"
              onChange={(event) => setCampaignFilter(event.target.value)}
              value={campaignFilter}
            >
              <option value="">All campaigns</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>

            <select
              className="h-9 rounded-lg border border-[var(--border)] bg-white px-2 text-sm"
              onChange={(event) => setStatusFilter(event.target.value as "" | EvidenceStatus)}
              value={statusFilter}
            >
              {STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => void generateNarrative()}
              type="button"
            >
              {narrativeLoading ? "Generating…" : "Generate Narrative"}
            </button>
          </div>
        </div>

        {visibleEvidence.length === 0 ? (
          <p className="p-5 text-sm text-[var(--text-muted)]">No evidence objects found for the current filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Occurred</th>
                  <th>Control</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Lineage</th>
                  <th>Latest Sync</th>
                </tr>
              </thead>
              <tbody>
                {visibleEvidence.map((item) => (
                  <tr key={item.id}>
                    <td className="text-xs">{formatDateTime(item.occurredAt)}</td>
                    <td className="text-xs">
                      {item.control ? `${item.control.code} · ${item.control.title}` : "Unmapped"}
                    </td>
                    <td className="text-xs">{item.evidenceType}</td>
                    <td>
                      <span className="status-pill status-pill-info capitalize">{item.status}</span>
                    </td>
                    <td className="text-xs">
                      <p>Derived from: {item.lineage?.derivedFromEvidenceIds.length ?? 0}</p>
                      <p>Supersedes: {item.lineage?.supersedesEvidenceIds.length ?? 0}</p>
                    </td>
                    <td className="text-xs">
                      {item.latestSyncEvent
                        ? `${item.latestSyncEvent.provider}: ${item.latestSyncEvent.status} (${formatDateTime(item.latestSyncEvent.createdAt)})`
                        : "Not synced yet"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {narrative && (
        <div className="card p-5">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Audit Narrative</h3>
          <pre className="mt-3 whitespace-pre-wrap text-xs leading-5 text-[var(--text-muted)]">
            {narrative}
          </pre>
        </div>
      )}

      {!canManage && (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] px-4 py-3 text-xs text-[var(--text-muted)]">
          You have read-only access. Admin/owner role is required to import frameworks and update mappings.
        </p>
      )}
    </div>
  );
}
