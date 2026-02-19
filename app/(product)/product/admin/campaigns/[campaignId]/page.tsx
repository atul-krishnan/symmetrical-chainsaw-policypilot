"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { AdminAccessGate } from "@/components/product/admin-access-gate";
import { SessionStatus } from "@/components/product/session-status";
import { useOrgContext } from "@/lib/edtech/org-context";
import { hasMinimumRole } from "@/lib/edtech/roles";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type QuizQuestion = {
  id?: string;
  moduleId?: string;
  prompt: string;
  choices: string[];
  correctChoiceIndex: number;
  explanation: string;
};

type MediaEmbed = {
  id: string;
  kind: "image" | "video";
  title: string;
  caption: string;
  suggestionPrompt: string;
  assetPath: string | null;
  mimeType: string | null;
  status: "suggested" | "attached";
  order: number;
  assetUrl?: string | null;
};

type Module = {
  id: string;
  roleTrack: string;
  title: string;
  summary: string;
  contentMarkdown: string;
  passScore: number;
  estimatedMinutes: number;
  mediaEmbeds: MediaEmbed[];
  quizNeedsRegeneration: boolean;
  quizQuestions: QuizQuestion[];
};

type Campaign = {
  id: string;
  orgId: string;
  name: string;
  dueAt: string | null;
  status: string;
  flowVersion: 1 | 2;
  roleTracks: string[];
  publishedAt: string | null;
  controlMappingReadiness?: {
    totalControls: number;
    mappedControls: number;
    coverageRatio: number;
    evidenceStatusCounts: {
      queued: number;
      synced: number;
      rejected: number;
      stale: number;
      superseded: number;
    };
  };
};

type CampaignDetail = {
  campaign: Campaign;
  modules: Module[];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLE_TRACK_LABELS: Record<string, string> = {
  exec: "Executive",
  builder: "Builder",
  general: "General",
};

const ROLE_TRACK_COLORS: Record<string, string> = {
  exec: "#1f5eff",
  builder: "#18a7ff",
  general: "#7a9cff",
};

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  draft: { bg: "#eef4ff", text: "#305c9d" },
  published: { bg: "#e8f9f2", text: "#1e7e5e" },
  archived: { bg: "#eff3f8", text: "#526b8f" },
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

function simpleMarkdownToHtml(md: string): string {
  return md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n{2,}/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
}

function normalizeCampaignDetail(input: CampaignDetail): CampaignDetail {
  return {
    campaign: {
      ...input.campaign,
      flowVersion: input.campaign.flowVersion ?? 1,
      controlMappingReadiness: input.campaign.controlMappingReadiness ?? {
        totalControls: 0,
        mappedControls: 0,
        coverageRatio: 0,
        evidenceStatusCounts: {
          queued: 0,
          synced: 0,
          rejected: 0,
          stale: 0,
          superseded: 0,
        },
      },
    },
    modules: input.modules.map((module) => ({
      ...module,
      mediaEmbeds: Array.isArray(module.mediaEmbeds) ? module.mediaEmbeds : [],
      quizNeedsRegeneration: Boolean(module.quizNeedsRegeneration),
    })),
  };
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function CampaignEditorPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { selectedOrgId, selectedMembership } = useOrgContext();
  const canEdit = hasMinimumRole(selectedMembership?.role, "admin");

  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [previewModule, setPreviewModule] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regeneratingModuleId, setRegeneratingModuleId] = useState<string | null>(null);
  const [mediaUploading, setMediaUploading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load campaign data
  const loadCampaign = useCallback(async () => {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    const token = await getToken();
    if (!token) {
      setError("Sign in before loading campaigns.");
      setLoading(false);
      return;
    }

    const response = await fetch(
      `/api/orgs/${selectedOrgId}/campaigns/${campaignId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    const body = await response.json();
    if (!response.ok) {
      setError(body?.error?.message ?? "Failed to load campaign");
      setLoading(false);
      return;
    }

    setDetail(normalizeCampaignDetail(body as CampaignDetail));
    setLoading(false);
  }, [selectedOrgId, campaignId]);

  useEffect(() => {
    if (!selectedOrgId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadCampaign();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadCampaign, selectedOrgId]);

  // Save draft
  const saveDraft = async () => {
    if (!detail) return;
    if (!selectedOrgId) {
      setError("Select an organization workspace before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);

    const token = await getToken();
    if (!token) {
      setError("Sign in required.");
      setSaving(false);
      return;
    }

    const response = await fetch(
      `/api/orgs/${selectedOrgId}/campaigns/${campaignId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: detail.campaign.name,
          dueAt: detail.campaign.dueAt,
          modules: detail.modules.map((m) => ({
            id: m.id,
            title: m.title,
            summary: m.summary,
            contentMarkdown: m.contentMarkdown,
            passScore: m.passScore,
            estimatedMinutes: m.estimatedMinutes,
            mediaEmbeds: m.mediaEmbeds.map((embed) => ({
              id: embed.id,
              kind: embed.kind,
              title: embed.title,
              caption: embed.caption,
              suggestionPrompt: embed.suggestionPrompt,
              assetPath: embed.assetPath,
              mimeType: embed.mimeType,
              status: embed.status,
              order: embed.order,
            })),
            quizQuestions: m.quizQuestions.map((q) => ({
              id: q.id,
              prompt: q.prompt,
              choices: q.choices,
              correctChoiceIndex: q.correctChoiceIndex,
              explanation: q.explanation,
            })),
          })),
        }),
      },
    );

    const body = await response.json();
    if (!response.ok) {
      setError(body?.error?.message ?? "Save failed");
    } else {
      setSuccess("Draft saved successfully.");
    }
    setSaving(false);
  };

  // Publish campaign
  const publishCampaign = async () => {
    if (!detail) return;
    if (!selectedOrgId) {
      setError("Select an organization workspace before publishing.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);

    const token = await getToken();
    if (!token) {
      setError("Sign in required.");
      setSaving(false);
      return;
    }

    const response = await fetch(
      `/api/orgs/${selectedOrgId}/campaigns/${campaignId}/publish`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      },
    );

    const body = await response.json();
    if (!response.ok) {
      setError(body?.error?.message ?? "Publish failed");
    } else {
      setSuccess("Campaign published successfully!");
      setDetail((prev) =>
        prev
          ? { ...prev, campaign: { ...prev.campaign, status: "published" } }
          : null,
      );
    }
    setSaving(false);
  };

  // ---------------------------------------------------------------------------
  // Module field updaters
  // ---------------------------------------------------------------------------

  const updateModule = (moduleIndex: number, field: keyof Module, value: unknown) => {
    setDetail((prev) => {
      if (!prev) return null;
      const modules = [...prev.modules];
      modules[moduleIndex] = { ...modules[moduleIndex], [field]: value };
      return { ...prev, modules };
    });
  };

  const updateQuestion = (
    moduleIndex: number,
    qIndex: number,
    field: keyof QuizQuestion,
    value: unknown,
  ) => {
    setDetail((prev) => {
      if (!prev) return null;
      const modules = [...prev.modules];
      const questions = [...modules[moduleIndex].quizQuestions];
      questions[qIndex] = { ...questions[qIndex], [field]: value };
      modules[moduleIndex] = { ...modules[moduleIndex], quizQuestions: questions };
      return { ...prev, modules };
    });
  };

  const updateChoice = (
    moduleIndex: number,
    qIndex: number,
    choiceIndex: number,
    value: string,
  ) => {
    setDetail((prev) => {
      if (!prev) return null;
      const modules = [...prev.modules];
      const questions = [...modules[moduleIndex].quizQuestions];
      const choices = [...questions[qIndex].choices];
      choices[choiceIndex] = value;
      questions[qIndex] = { ...questions[qIndex], choices };
      modules[moduleIndex] = { ...modules[moduleIndex], quizQuestions: questions };
      return { ...prev, modules };
    });
  };

  const addQuestion = (moduleIndex: number) => {
    setDetail((prev) => {
      if (!prev) return null;
      const modules = [...prev.modules];
      const questions = [
        ...modules[moduleIndex].quizQuestions,
        {
          prompt: "",
          choices: ["", "", "", ""],
          correctChoiceIndex: 0,
          explanation: "",
        },
      ];
      modules[moduleIndex] = { ...modules[moduleIndex], quizQuestions: questions };
      return { ...prev, modules };
    });
  };

  const removeQuestion = (moduleIndex: number, qIndex: number) => {
    setDetail((prev) => {
      if (!prev) return null;
      const modules = [...prev.modules];
      const questions = modules[moduleIndex].quizQuestions.filter((_, i) => i !== qIndex);
      modules[moduleIndex] = { ...modules[moduleIndex], quizQuestions: questions };
      return { ...prev, modules };
    });
  };

  const updateMediaEmbed = (
    moduleIndex: number,
    embedIndex: number,
    field: keyof MediaEmbed,
    value: unknown,
  ) => {
    setDetail((prev) => {
      if (!prev) return null;
      const modules = [...prev.modules];
      const embeds = [...modules[moduleIndex].mediaEmbeds];
      embeds[embedIndex] = { ...embeds[embedIndex], [field]: value } as MediaEmbed;
      modules[moduleIndex] = { ...modules[moduleIndex], mediaEmbeds: embeds };
      return { ...prev, modules };
    });
  };

  const regenerateQuiz = async (moduleId: string) => {
    if (!selectedOrgId) {
      setError("Select an organization workspace before regenerating.");
      return;
    }

    const token = await getToken();
    if (!token) {
      setError("Sign in required.");
      return;
    }

    setRegeneratingModuleId(moduleId);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(
        `/api/orgs/${selectedOrgId}/campaigns/${campaignId}/modules/${moduleId}/quiz/regenerate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const body = await response.json();
      if (!response.ok) {
        setError(body?.error?.message ?? "Failed to regenerate quiz.");
        return;
      }

      setSuccess("Quiz regenerated from current learning material.");
      await loadCampaign();
    } catch {
      setError("Network error while regenerating quiz.");
    } finally {
      setRegeneratingModuleId(null);
    }
  };

  const uploadMedia = async (moduleId: string, embedId: string, file: File | null) => {
    if (!file) return;
    if (!selectedOrgId) {
      setError("Select an organization workspace before uploading media.");
      return;
    }

    const token = await getToken();
    if (!token) {
      setError("Sign in required.");
      return;
    }

    const key = `${moduleId}:${embedId}`;
    setMediaUploading((prev) => ({ ...prev, [key]: true }));
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append("embedId", embedId);
    formData.append("file", file);
    try {
      const response = await fetch(
        `/api/orgs/${selectedOrgId}/campaigns/${campaignId}/modules/${moduleId}/media`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );

      const body = await response.json();
      if (!response.ok) {
        setError(body?.error?.message ?? "Failed to upload media.");
        return;
      }

      setSuccess("Media uploaded and attached to module.");
      await loadCampaign();
    } catch {
      setError("Network error while uploading media.");
    } finally {
      setMediaUploading((prev) => ({ ...prev, [key]: false }));
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const campaign = detail?.campaign;
  const modules = detail?.modules ?? [];
  const currentModule = modules[activeTab];
  const isDraft = campaign?.status === "draft";
  const badge = STATUS_BADGE[campaign?.status ?? "draft"] ?? STATUS_BADGE.draft;

  if (!canEdit) {
    return (
      <AdminAccessGate
        currentRole={selectedMembership?.role}
        orgName={selectedMembership?.orgName}
        requiredRole="admin"
        title="Campaign editor"
      />
    );
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6 py-6 px-4 sm:px-6">
      <SessionStatus />

      {!detail && (
        <div className="rounded-[1.8rem] surface-card p-6 space-y-4">
          <h1 className="font-display text-4xl text-[#10244a]">Campaign Editor</h1>
          <p className="text-sm text-[#4f6486]">
            Campaign ID:{" "}
            <code className="text-xs bg-[#eef4ff] px-1.5 py-0.5 rounded-md">
              {campaignId}
            </code>
          </p>
          <p className="text-sm text-[#4f6486]">
            Workspace:{" "}
            <span className="font-semibold text-[#10244a]">
              {selectedMembership?.orgName ?? "Select an organization in the top nav"}
            </span>
          </p>
          {selectedOrgId ? (
            <p className="text-sm text-[#4f6486]">
              {loading
                ? "Loading campaign content..."
                : "Campaign content not loaded yet. Next action: retry."}
            </p>
          ) : (
            <p className="text-sm text-[#a04e39]">
              Next action: choose an organization workspace from the top navigation.
            </p>
          )}
          {selectedOrgId && !loading ? (
            <button
              className="h-11 rounded-xl bg-[#1f5eff] px-6 text-sm font-semibold text-white hover:bg-[#154ee6]"
              onClick={() => void loadCampaign()}
              type="button"
            >
              Retry load
            </button>
          ) : null}
        </div>
      )}

      {error && (
        <p className="text-sm text-[#a04e39] bg-[#fff1ed] rounded-xl px-4 py-3 border border-[#f1cbc2]">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-[#12795c] bg-[#e8f9f2] rounded-xl px-4 py-3 border border-[#bde8d3]">
          {success}
        </p>
      )}

      {/* Campaign loaded — editor UI */}
      {detail && campaign && (
        <>
          {/* Campaign header */}
          <div className="rounded-[1.8rem] surface-card p-6">
            <div className="flex flex-wrap items-start gap-4 justify-between">
              <div className="flex-1 min-w-[16rem] space-y-3">
                <div className="flex items-center gap-3">
                  <h1 className="font-display text-3xl text-[#10244a]">
                    Campaign Editor
                  </h1>
                  <span
                    className="inline-block rounded-full px-3 py-0.5 text-xs font-semibold uppercase tracking-wide"
                    style={{ background: badge.bg, color: badge.text }}
                  >
                    {campaign.status}
                  </span>
                </div>

                {isDraft ? (
                  <input
                    className="h-10 w-full rounded-xl border border-[#d3deef] bg-white px-3 font-display text-lg text-[#10244a]"
                    value={campaign.name}
                    onChange={(e) =>
                      setDetail((prev) =>
                        prev
                          ? { ...prev, campaign: { ...prev.campaign, name: e.target.value } }
                          : null,
                      )
                    }
                  />
                ) : (
                  <p className="font-display text-lg text-[#10244a]">
                    {campaign.name}
                  </p>
                )}

                <div className="flex flex-wrap gap-4 text-xs text-[#4f6486]">
                  <span>
                    Due:{" "}
                    {isDraft ? (
                      <input
                        type="date"
                        className="ml-1 rounded-lg border border-[#d3deef] bg-white px-2 py-0.5 text-xs"
                        value={campaign.dueAt ? campaign.dueAt.slice(0, 10) : ""}
                        onChange={(e) =>
                          setDetail((prev) =>
                            prev
                              ? {
                                ...prev,
                                campaign: {
                                  ...prev.campaign,
                                  dueAt: e.target.value
                                    ? new Date(e.target.value).toISOString()
                                    : null,
                                },
                              }
                              : null,
                          )
                        }
                      />
                    ) : (
                      <span className="font-medium">
                        {campaign.dueAt
                          ? new Date(campaign.dueAt).toLocaleDateString()
                          : "—"}
                      </span>
                    )}
                  </span>
                  <span>
                    Modules: <span className="font-medium">{modules.length}</span>
                  </span>
                  <span>
                    Flow: <span className="font-medium">V{campaign.flowVersion ?? 1}</span>
                  </span>
                  <span>
                    Tracks:{" "}
                    {campaign.roleTracks.map((t) => (
                      <span
                        key={t}
                        className="inline-block ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                        style={{ background: ROLE_TRACK_COLORS[t] ?? "#888" }}
                      >
                        {ROLE_TRACK_LABELS[t] ?? t}
                      </span>
                    ))}
                  </span>
                </div>

                {campaign.controlMappingReadiness && (
                  <div className="rounded-xl border border-[#d3deef] bg-[#f7faff] px-4 py-3 text-xs text-[#3f577a]">
                    <p className="font-semibold text-[#10244a]">Control Impact Preview</p>
                    <div className="mt-1 flex flex-wrap gap-3">
                      <span>
                        Mapped controls:{" "}
                        <strong>
                          {campaign.controlMappingReadiness.mappedControls}/
                          {campaign.controlMappingReadiness.totalControls}
                        </strong>
                      </span>
                      <span>
                        Coverage:{" "}
                        <strong>
                          {(campaign.controlMappingReadiness.coverageRatio * 100).toFixed(1)}%
                        </strong>
                      </span>
                      <span>
                        Synced evidence:{" "}
                        <strong>{campaign.controlMappingReadiness.evidenceStatusCounts.synced}</strong>
                      </span>
                      <span>
                        Stale evidence:{" "}
                        <strong>{campaign.controlMappingReadiness.evidenceStatusCounts.stale}</strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              {isDraft && (
                <div className="flex gap-2 pt-1">
                  <button
                    className="h-10 rounded-xl border border-[#d3deef] bg-white px-5 text-sm font-semibold text-[#10244a] hover:bg-[#f4f8ff] disabled:opacity-50"
                    disabled={saving}
                    onClick={saveDraft}
                    type="button"
                  >
                    {saving ? "Saving…" : "Save Draft"}
                  </button>
                  <button
                    className="h-10 rounded-xl bg-[#1f5eff] px-5 text-sm font-semibold text-white hover:bg-[#154ee6] disabled:opacity-50"
                    disabled={saving}
                    onClick={publishCampaign}
                    type="button"
                  >
                    Publish
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Module tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {modules.map((m, i) => {
              const isActive = activeTab === i;
              const trackColor = ROLE_TRACK_COLORS[m.roleTrack] ?? "#888";
              return (
                <button
                  key={m.id}
                  className="flex items-center gap-2 whitespace-nowrap rounded-t-xl px-4 py-2.5 text-sm font-semibold transition-all"
                  onClick={() => setActiveTab(i)}
                  style={{
                    background: isActive ? "#ffffff" : "#eef4ff",
                    color: isActive ? "#10244a" : "#5b7194",
                    borderBottom: isActive
                      ? "2px solid transparent"
                      : "2px solid #d3deef",
                    borderLeft: isActive
                      ? `3px solid ${trackColor}`
                      : "3px solid transparent",
                  }}
                  type="button"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: trackColor }}
                  />
                  {ROLE_TRACK_LABELS[m.roleTrack] ?? m.roleTrack}
                </button>
              );
            })}
          </div>

          {/* Active module editor */}
          {currentModule && (
            <div className="rounded-[1.8rem] surface-card p-6 space-y-6">
              {/* Module metadata */}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-[#10244a]">Module Title</span>
                  <input
                    className="h-10 w-full rounded-xl border border-[#d3deef] bg-white px-3 disabled:opacity-60"
                    disabled={!isDraft}
                    value={currentModule.title}
                    onChange={(e) =>
                      updateModule(activeTab, "title", e.target.value)
                    }
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 text-sm">
                    <span className="font-semibold text-[#10244a]">
                      Pass Score
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        className="h-10 flex-1 rounded-xl border border-[#d3deef] bg-white px-3 disabled:opacity-60"
                        disabled={!isDraft}
                        type="number"
                        min={60}
                        max={100}
                        value={currentModule.passScore}
                        onChange={(e) =>
                          updateModule(
                            activeTab,
                            "passScore",
                            Number(e.target.value),
                          )
                        }
                      />
                      <span className="text-xs text-[#4f6486]">%</span>
                    </div>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-semibold text-[#10244a]">
                      Est. Minutes
                    </span>
                    <input
                      className="h-10 w-full rounded-xl border border-[#d3deef] bg-white px-3 disabled:opacity-60"
                      disabled={!isDraft}
                      type="number"
                      min={3}
                      max={45}
                      value={currentModule.estimatedMinutes}
                      onChange={(e) =>
                        updateModule(
                          activeTab,
                          "estimatedMinutes",
                          Number(e.target.value),
                        )
                      }
                    />
                  </label>
                </div>
              </div>

              <label className="block space-y-1 text-sm">
                <span className="font-semibold text-[#10244a]">Summary</span>
                <textarea
                  className="w-full rounded-xl border border-[#d3deef] bg-white px-3 py-2 text-sm leading-relaxed disabled:opacity-60"
                  disabled={!isDraft}
                  rows={2}
                  value={currentModule.summary}
                  onChange={(e) =>
                    updateModule(activeTab, "summary", e.target.value)
                  }
                />
              </label>

              {/* Content markdown — edit / preview toggle */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#10244a]">
                    Content (Markdown)
                  </span>
                  <button
                    className="text-xs font-medium text-[#1f5eff] hover:underline"
                    onClick={() =>
                      setPreviewModule(
                        previewModule === activeTab ? null : activeTab,
                      )
                    }
                    type="button"
                  >
                    {previewModule === activeTab ? "← Edit" : "Preview →"}
                  </button>
                </div>

                {previewModule === activeTab ? (
                  <div
                    className="prose prose-sm max-w-none rounded-xl border border-[#d3deef] bg-white p-4"
                    dangerouslySetInnerHTML={{
                      __html: simpleMarkdownToHtml(
                        currentModule.contentMarkdown,
                      ),
                    }}
                  />
                ) : (
                  <textarea
                    className="w-full rounded-xl border border-[#d3deef] bg-white px-3 py-2 font-mono text-[13px] leading-relaxed disabled:opacity-60"
                    disabled={!isDraft}
                    rows={12}
                    value={currentModule.contentMarkdown}
                    onChange={(e) =>
                      updateModule(
                        activeTab,
                        "contentMarkdown",
                        e.target.value,
                      )
                    }
                  />
                )}
              </div>

              {currentModule.mediaEmbeds.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-xl text-[#10244a]">Learning Media</h3>
                    <p className="text-xs text-[#4f6486]">
                      Suggested assets to improve learning clarity before assessment.
                    </p>
                  </div>

                  <div className="grid gap-3">
                    {[...currentModule.mediaEmbeds]
                      .sort((a, b) => a.order - b.order)
                      .map((embed) => {
                        const embedIndex = currentModule.mediaEmbeds.findIndex(
                          (item) => item.id === embed.id,
                        );
                        if (embedIndex === -1) return null;

                        const uploadKey = `${currentModule.id}:${embed.id}`;
                        const isUploading = Boolean(mediaUploading[uploadKey]);
                        const accept =
                          embed.kind === "image"
                            ? "image/png,image/jpeg,image/webp,image/gif"
                            : "video/mp4,video/webm,video/quicktime";

                        return (
                          <div
                            key={embed.id}
                            className="rounded-xl border border-[#d3deef] bg-white p-4 space-y-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-[#eef4ff] px-2.5 py-0.5 text-[11px] font-semibold uppercase text-[#305c9d]">
                                {embed.kind}
                              </span>
                              <span className="rounded-full bg-[#eff3f8] px-2.5 py-0.5 text-[11px] font-semibold uppercase text-[#526b8f]">
                                {embed.status}
                              </span>
                            </div>

                            {embed.assetUrl && embed.kind === "image" && (
                              <img
                                alt={embed.title}
                                className="max-h-52 rounded-lg border border-[#d3deef] object-contain"
                                src={embed.assetUrl}
                              />
                            )}
                            {embed.assetUrl && embed.kind === "video" && (
                              <video
                                className="max-h-52 w-full rounded-lg border border-[#d3deef]"
                                controls
                                src={embed.assetUrl}
                              />
                            )}

                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="space-y-1 text-sm">
                                <span className="font-medium text-[#10244a]">Title</span>
                                <input
                                  className="h-9 w-full rounded-lg border border-[#d3deef] bg-white px-2 disabled:opacity-60"
                                  disabled={!isDraft}
                                  value={embed.title}
                                  onChange={(e) =>
                                    updateMediaEmbed(activeTab, embedIndex, "title", e.target.value)
                                  }
                                />
                              </label>
                              <label className="space-y-1 text-sm">
                                <span className="font-medium text-[#10244a]">Order</span>
                                <input
                                  className="h-9 w-full rounded-lg border border-[#d3deef] bg-white px-2 disabled:opacity-60"
                                  disabled={!isDraft}
                                  min={0}
                                  type="number"
                                  value={embed.order}
                                  onChange={(e) =>
                                    updateMediaEmbed(
                                      activeTab,
                                      embedIndex,
                                      "order",
                                      Number(e.target.value),
                                    )
                                  }
                                />
                              </label>
                            </div>

                            <label className="block space-y-1 text-sm">
                              <span className="font-medium text-[#10244a]">Caption</span>
                              <textarea
                                className="w-full rounded-lg border border-[#d3deef] bg-white px-3 py-2 text-sm leading-relaxed disabled:opacity-60"
                                disabled={!isDraft}
                                rows={2}
                                value={embed.caption}
                                onChange={(e) =>
                                  updateMediaEmbed(activeTab, embedIndex, "caption", e.target.value)
                                }
                              />
                            </label>

                            <label className="block space-y-1 text-sm">
                              <span className="font-medium text-[#10244a]">Suggestion Prompt</span>
                              <textarea
                                className="w-full rounded-lg border border-[#d3deef] bg-white px-3 py-2 text-sm leading-relaxed disabled:opacity-60"
                                disabled={!isDraft}
                                rows={2}
                                value={embed.suggestionPrompt}
                                onChange={(e) =>
                                  updateMediaEmbed(
                                    activeTab,
                                    embedIndex,
                                    "suggestionPrompt",
                                    e.target.value,
                                  )
                                }
                              />
                            </label>

                            {isDraft && (
                              <div className="space-y-2">
                                <label className="block text-sm font-medium text-[#10244a]">
                                  Upload {embed.kind === "image" ? "image" : "video"}
                                </label>
                                <input
                                  accept={accept}
                                  className="block w-full rounded-lg border border-[#d3deef] bg-white px-2 py-2 text-sm"
                                  onChange={(e) =>
                                    void uploadMedia(
                                      currentModule.id,
                                      embed.id,
                                      e.target.files?.[0] ?? null,
                                    )
                                  }
                                  type="file"
                                />
                                {isUploading && (
                                  <p className="text-xs text-[#4f6486]">Uploading...</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Quiz questions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl text-[#10244a]">
                    Quiz Questions ({currentModule.quizQuestions.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    {isDraft && (
                      <button
                        className="rounded-lg border border-[#1f5eff] px-3 py-1.5 text-xs font-semibold text-[#1f5eff] hover:bg-[#eef4ff] disabled:opacity-60"
                        disabled={regeneratingModuleId === currentModule.id}
                        onClick={() => void regenerateQuiz(currentModule.id)}
                        type="button"
                      >
                        {regeneratingModuleId === currentModule.id
                          ? "Regenerating..."
                          : "Regenerate Quiz from Material"}
                      </button>
                    )}
                    {isDraft && currentModule.quizQuestions.length < 8 && (
                      <button
                        className="rounded-lg border border-[#1f5eff] px-3 py-1.5 text-xs font-semibold text-[#1f5eff] hover:bg-[#e8f9f2]"
                        onClick={() => addQuestion(activeTab)}
                        type="button"
                      >
                        + Add Question
                      </button>
                    )}
                  </div>
                </div>

                {isDraft && currentModule.quizNeedsRegeneration && (
                  <p className="rounded-lg border border-[#f1cbc2] bg-[#fff1ed] px-4 py-2 text-sm text-[#a04e39]">
                    Learning material changed after the last sync. Regenerate quiz to realign assessment with content.
                  </p>
                )}

                {currentModule.quizQuestions.map((q, qi) => (
                  <div
                    className="rounded-xl border border-[#d4c9bb] bg-[#faf5ec] p-4 space-y-3"
                    key={q.id ?? `new-${qi}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#1f5eff] text-xs font-bold text-white">
                        {qi + 1}
                      </span>
                      {isDraft && currentModule.quizQuestions.length > 1 && (
                        <button
                          className="text-xs text-[#a04e39] hover:underline"
                          onClick={() => removeQuestion(activeTab, qi)}
                          type="button"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <label className="block space-y-1 text-sm">
                      <span className="font-medium text-[#10244a]">Prompt</span>
                      <input
                        className="h-10 w-full rounded-xl border border-[#d3deef] bg-white px-3 disabled:opacity-60"
                        disabled={!isDraft}
                        value={q.prompt}
                        onChange={(e) =>
                          updateQuestion(
                            activeTab,
                            qi,
                            "prompt",
                            e.target.value,
                          )
                        }
                      />
                    </label>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {q.choices.map((choice, ci) => (
                        <label
                          key={ci}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="radio"
                            name={`q-${activeTab}-${qi}-correct`}
                            checked={q.correctChoiceIndex === ci}
                            disabled={!isDraft}
                            onChange={() =>
                              updateQuestion(
                                activeTab,
                                qi,
                                "correctChoiceIndex",
                                ci,
                              )
                            }
                            className="accent-[#1f5eff]"
                          />
                          <input
                            className="h-9 flex-1 rounded-lg border bg-white px-2 text-sm disabled:opacity-60"
                            style={{
                              borderColor:
                                q.correctChoiceIndex === ci
                                  ? "#1f5eff"
                                  : "#d3deef",
                            }}
                            disabled={!isDraft}
                            value={choice}
                            onChange={(e) =>
                              updateChoice(
                                activeTab,
                                qi,
                                ci,
                                e.target.value,
                              )
                            }
                            placeholder={`Choice ${ci + 1}`}
                          />
                        </label>
                      ))}
                    </div>

                    <label className="block space-y-1 text-sm">
                      <span className="font-medium text-[#10244a]">
                        Explanation
                      </span>
                      <textarea
                        className="w-full rounded-xl border border-[#d3deef] bg-white px-3 py-2 text-sm leading-relaxed disabled:opacity-60"
                        disabled={!isDraft}
                        rows={2}
                        value={q.explanation}
                        onChange={(e) =>
                          updateQuestion(
                            activeTab,
                            qi,
                            "explanation",
                            e.target.value,
                          )
                        }
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom action bar */}
          {isDraft && (
            <div className="sticky bottom-4 flex justify-end gap-2 rounded-xl border border-[#d3deef] bg-white/90 p-3 backdrop-blur-md">
              <button
                className="h-10 rounded-xl border border-[#d3deef] bg-white px-5 text-sm font-semibold text-[#10244a] hover:bg-[#f4f8ff] disabled:opacity-50"
                disabled={saving}
                onClick={saveDraft}
                type="button"
              >
                {saving ? "Saving…" : "Save Draft"}
              </button>
              <button
                className="h-10 rounded-xl bg-[#1f5eff] px-5 text-sm font-semibold text-white hover:bg-[#154ee6] disabled:opacity-50"
                disabled={saving}
                onClick={publishCampaign}
                type="button"
              >
                Publish Campaign
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
