"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";

import { SessionStatus } from "@/components/product/session-status";
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

type Module = {
  id: string;
  roleTrack: string;
  title: string;
  summary: string;
  contentMarkdown: string;
  passScore: number;
  estimatedMinutes: number;
  quizQuestions: QuizQuestion[];
};

type Campaign = {
  id: string;
  orgId: string;
  name: string;
  dueAt: string | null;
  status: string;
  roleTracks: string[];
  publishedAt: string | null;
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
  exec: "#d9902f",
  builder: "#0e8c89",
  general: "#7c5cbf",
};

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  draft: { bg: "#f0e6d2", text: "#9a7b4f" },
  published: { bg: "#d4f0e0", text: "#1a7a4c" },
  archived: { bg: "#e8e0d6", text: "#6b5e50" },
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

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function CampaignEditorPage() {
  const { campaignId } = useParams<{ campaignId: string }>();

  const [orgId, setOrgId] = useState("");
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [previewModule, setPreviewModule] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load campaign data
  const loadCampaign = useCallback(async () => {
    if (!orgId) return;
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
      `/api/orgs/${orgId}/campaigns/${campaignId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    const body = await response.json();
    if (!response.ok) {
      setError(body?.error?.message ?? "Failed to load campaign");
      setLoading(false);
      return;
    }

    setDetail(body as CampaignDetail);
    setLoading(false);
  }, [orgId, campaignId]);

  // Save draft
  const saveDraft = async () => {
    if (!detail) return;
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
      `/api/orgs/${orgId}/campaigns/${campaignId}`,
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
      `/api/orgs/${orgId}/campaigns/${campaignId}/publish`,
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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const campaign = detail?.campaign;
  const modules = detail?.modules ?? [];
  const currentModule = modules[activeTab];
  const isDraft = campaign?.status === "draft";
  const badge = STATUS_BADGE[campaign?.status ?? "draft"] ?? STATUS_BADGE.draft;

  return (
    <section className="mx-auto max-w-6xl space-y-6 py-6 px-4 sm:px-6">
      <SessionStatus />

      {/* Org ID loader (before campaign is loaded) */}
      {!detail && (
        <div className="rounded-[1.8rem] border border-[#cfc2b5] bg-[#fff8ef] p-6 space-y-4">
          <h1 className="font-display text-4xl text-[#10243e]">Campaign Editor</h1>
          <p className="text-sm text-[#4f6379]">
            Campaign ID:{" "}
            <code className="text-xs bg-[#f0e6d2] px-1.5 py-0.5 rounded-md">
              {campaignId}
            </code>
          </p>

          <div className="flex flex-wrap gap-3 items-end">
            <label className="space-y-1 text-sm flex-1 min-w-[18rem]">
              <span>Organization ID</span>
              <input
                className="h-11 w-full rounded-xl border border-[#c9bcac] bg-white px-3"
                onChange={(e) => setOrgId(e.target.value)}
                value={orgId}
                placeholder="Enter your org ID"
              />
            </label>
            <button
              className="h-11 rounded-xl bg-[#0e8c89] px-6 text-sm font-semibold text-white hover:bg-[#0c7573] disabled:opacity-50"
              disabled={!orgId || loading}
              onClick={loadCampaign}
              type="button"
            >
              {loading ? "Loading…" : "Load Campaign"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-[#a04e39] bg-[#fdf0ec] rounded-xl px-4 py-3 border border-[#e8c5ba]">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-[#0b746e] bg-[#e6f5f0] rounded-xl px-4 py-3 border border-[#b5ddd3]">
          {success}
        </p>
      )}

      {/* Campaign loaded — editor UI */}
      {detail && campaign && (
        <>
          {/* Campaign header */}
          <div className="rounded-[1.8rem] border border-[#cfc2b5] bg-[#fff8ef] p-6">
            <div className="flex flex-wrap items-start gap-4 justify-between">
              <div className="flex-1 min-w-[16rem] space-y-3">
                <div className="flex items-center gap-3">
                  <h1 className="font-display text-3xl text-[#10243e]">
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
                    className="h-10 w-full rounded-xl border border-[#c9bcac] bg-white px-3 font-display text-lg text-[#10243e]"
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
                  <p className="font-display text-lg text-[#10243e]">
                    {campaign.name}
                  </p>
                )}

                <div className="flex flex-wrap gap-4 text-xs text-[#4f6379]">
                  <span>
                    Due:{" "}
                    {isDraft ? (
                      <input
                        type="date"
                        className="ml-1 rounded-lg border border-[#c9bcac] bg-white px-2 py-0.5 text-xs"
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
              </div>

              {/* Action buttons */}
              {isDraft && (
                <div className="flex gap-2 pt-1">
                  <button
                    className="h-10 rounded-xl border border-[#c9bcac] bg-white px-5 text-sm font-semibold text-[#10243e] hover:bg-[#f4ecdf] disabled:opacity-50"
                    disabled={saving}
                    onClick={saveDraft}
                    type="button"
                  >
                    {saving ? "Saving…" : "Save Draft"}
                  </button>
                  <button
                    className="h-10 rounded-xl bg-[#0e8c89] px-5 text-sm font-semibold text-white hover:bg-[#0c7573] disabled:opacity-50"
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
                    background: isActive ? "#fff8ef" : "#f0e6d2",
                    color: isActive ? "#10243e" : "#6b5c4a",
                    borderBottom: isActive
                      ? "2px solid transparent"
                      : "2px solid #cfc2b5",
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
            <div className="rounded-[1.8rem] border border-[#cfc2b5] bg-[#fff8ef] p-6 space-y-6">
              {/* Module metadata */}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-semibold text-[#10243e]">Module Title</span>
                  <input
                    className="h-10 w-full rounded-xl border border-[#c9bcac] bg-white px-3 disabled:opacity-60"
                    disabled={!isDraft}
                    value={currentModule.title}
                    onChange={(e) =>
                      updateModule(activeTab, "title", e.target.value)
                    }
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 text-sm">
                    <span className="font-semibold text-[#10243e]">
                      Pass Score
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        className="h-10 flex-1 rounded-xl border border-[#c9bcac] bg-white px-3 disabled:opacity-60"
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
                      <span className="text-xs text-[#4f6379]">%</span>
                    </div>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-semibold text-[#10243e]">
                      Est. Minutes
                    </span>
                    <input
                      className="h-10 w-full rounded-xl border border-[#c9bcac] bg-white px-3 disabled:opacity-60"
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
                <span className="font-semibold text-[#10243e]">Summary</span>
                <textarea
                  className="w-full rounded-xl border border-[#c9bcac] bg-white px-3 py-2 text-sm leading-relaxed disabled:opacity-60"
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
                  <span className="text-sm font-semibold text-[#10243e]">
                    Content (Markdown)
                  </span>
                  <button
                    className="text-xs font-medium text-[#0e8c89] hover:underline"
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
                    className="prose prose-sm max-w-none rounded-xl border border-[#c9bcac] bg-white p-4"
                    dangerouslySetInnerHTML={{
                      __html: simpleMarkdownToHtml(
                        currentModule.contentMarkdown,
                      ),
                    }}
                  />
                ) : (
                  <textarea
                    className="w-full rounded-xl border border-[#c9bcac] bg-white px-3 py-2 font-mono text-[13px] leading-relaxed disabled:opacity-60"
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

              {/* Quiz questions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl text-[#10243e]">
                    Quiz Questions ({currentModule.quizQuestions.length})
                  </h3>
                  {isDraft && currentModule.quizQuestions.length < 8 && (
                    <button
                      className="rounded-lg border border-[#0e8c89] px-3 py-1.5 text-xs font-semibold text-[#0e8c89] hover:bg-[#e6f5f0]"
                      onClick={() => addQuestion(activeTab)}
                      type="button"
                    >
                      + Add Question
                    </button>
                  )}
                </div>

                {currentModule.quizQuestions.map((q, qi) => (
                  <div
                    className="rounded-xl border border-[#d4c9bb] bg-[#faf5ec] p-4 space-y-3"
                    key={q.id ?? `new-${qi}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#0e8c89] text-xs font-bold text-white">
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
                      <span className="font-medium text-[#10243e]">Prompt</span>
                      <input
                        className="h-10 w-full rounded-xl border border-[#c9bcac] bg-white px-3 disabled:opacity-60"
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
                            className="accent-[#0e8c89]"
                          />
                          <input
                            className="h-9 flex-1 rounded-lg border bg-white px-2 text-sm disabled:opacity-60"
                            style={{
                              borderColor:
                                q.correctChoiceIndex === ci
                                  ? "#0e8c89"
                                  : "#c9bcac",
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
                      <span className="font-medium text-[#10243e]">
                        Explanation
                      </span>
                      <textarea
                        className="w-full rounded-xl border border-[#c9bcac] bg-white px-3 py-2 text-sm leading-relaxed disabled:opacity-60"
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
            <div className="sticky bottom-4 flex justify-end gap-2 rounded-xl border border-[#cfc2b5] bg-[#fff8efdd] p-3 backdrop-blur-md">
              <button
                className="h-10 rounded-xl border border-[#c9bcac] bg-white px-5 text-sm font-semibold text-[#10243e] hover:bg-[#f4ecdf] disabled:opacity-50"
                disabled={saving}
                onClick={saveDraft}
                type="button"
              >
                {saving ? "Saving…" : "Save Draft"}
              </button>
              <button
                className="h-10 rounded-xl bg-[#0e8c89] px-5 text-sm font-semibold text-white hover:bg-[#0c7573] disabled:opacity-50"
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
