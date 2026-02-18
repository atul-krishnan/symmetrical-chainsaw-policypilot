"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  Clock,
  Loader2,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Question = { id: string; prompt: string; choices: string[] };
type Module = {
  id: string;
  title: string;
  summary: string;
  contentMarkdown: string;
  roleTrack: string;
  passScore: number;
  estimatedMinutes: number;
  campaignId: string;
};
type Campaign = { id: string; name: string; status: string } | null;
type DetailResponse = {
  assignment: { id: string; state: string; dueAt: string | null; startedAt: string | null; completedAt: string | null };
  module: Module;
  campaign: Campaign;
  questions: Question[];
};
type AttemptResult = {
  scorePct: number;
  passed: boolean;
  campaignId: string;
  details: Array<{ questionId: string; correct: boolean }>;
};

type Step = "read" | "quiz" | "result";

const TRACK_LABEL: Record<string, string> = { exec: "Executive", builder: "Builder", general: "General" };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AssignmentPage() {
  const params = useParams<{ assignmentId: string }>();
  const assignmentId = Array.isArray(params.assignmentId)
    ? params.assignmentId[0] ?? ""
    : params.assignmentId ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DetailResponse | null>(null);
  const [step, setStep] = useState<Step>("read");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true); setError(null);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setError("Supabase not configured."); setLoading(false); return; }
    const { data: session } = await supabase.auth.getSession();
    let token = session.session?.access_token;
    if (!token) { const r = await supabase.auth.refreshSession(); token = r.data.session?.access_token ?? undefined; }
    if (!token) { setError("Sign in to view this module."); setLoading(false); return; }
    try {
      if (!assignmentId) { setError("Assignment id missing."); return; }
      const res = await fetch(`/api/me/assignments/${assignmentId}`, { headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json();
      if (!res.ok) { setError(body?.error?.message ?? "Failed to load."); setLoading(false); return; }
      setData(body as DetailResponse);
    } catch { setError("Network error."); } finally { setLoading(false); }
  }, [assignmentId]);

  useEffect(() => { void loadDetail(); }, [loadDetail]);

  const submitQuiz = useCallback(async () => {
    if (!data) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return;
    setSubmitting(true); setError(null);
    const orderedAnswers = data.questions.map((q) => answers[q.id] ?? 0);
    try {
      const res = await fetch(`/api/me/modules/${data.module.id}/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ answers: orderedAnswers }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body?.error?.message ?? "Submission failed."); setSubmitting(false); return; }
      setResult(body as AttemptResult);
      setStep("result");
    } catch { setError("Network error."); } finally { setSubmitting(false); }
  }, [data, answers]);

  // -----------------------------------------------------------------------
  // Renders
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
        <p className="mt-3 text-sm text-[var(--text-muted)]">Loading module…</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <p className="text-sm text-[var(--danger)]">{error}</p>
        <Link href="/product/learn" className="mt-4 inline-flex items-center gap-1 text-sm text-[var(--accent)] hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to assignments
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const { module: mod, campaign, questions } = data;
  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id] !== undefined);

  const steps: { key: Step; label: string }[] = [
    { key: "read", label: "1. Read" },
    { key: "quiz", label: "2. Quiz" },
    { key: "result", label: "3. Result" },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-5 py-2">
      <Link href="/product/learn" className="inline-flex items-center gap-1 text-sm text-[var(--accent)] hover:underline">
        <ArrowLeft className="h-4 w-4" /> My Learning
      </Link>

      {/* Header */}
      <div className="card p-6">
        <div className="space-y-1">
          {campaign && (
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">{campaign.name}</p>
          )}
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{mod.title}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
            <span className="status-pill status-pill-info capitalize">
              {TRACK_LABEL[mod.roleTrack] ?? mod.roleTrack}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> ~{mod.estimatedMinutes} min
            </span>
            <span>Pass: {mod.passScore}%</span>
          </div>
        </div>

        {/* Stepper */}
        <div className="mt-5 flex gap-1">
          {steps.map((s) => {
            const active = step === s.key;
            const done =
              (s.key === "read" && (step === "quiz" || step === "result")) ||
              (s.key === "quiz" && step === "result");
            return (
              <button
                key={s.key}
                type="button"
                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${active
                    ? "bg-[var(--accent)] text-white"
                    : done
                      ? "bg-[var(--success-bg)] text-[var(--success)] border border-[var(--success-border)]"
                      : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
                  }`}
                onClick={() => {
                  if (s.key === "result" && !result) return;
                  setStep(s.key);
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      {/* Read */}
      {step === "read" && (
        <div className="card p-6 space-y-5">
          {mod.summary && (
            <p className="text-sm leading-relaxed text-[var(--text-secondary)] border-l-4 border-[var(--accent)] pl-4">
              {mod.summary}
            </p>
          )}
          <div
            className="prose prose-sm max-w-none text-[var(--text-primary)]"
            dangerouslySetInnerHTML={{ __html: simpleMarkdown(mod.contentMarkdown) }}
          />
          <button className="btn btn-primary" onClick={() => setStep("quiz")} type="button">
            <BookOpenCheck className="h-4 w-4" />
            Start Quiz ({questions.length} questions)
          </button>
        </div>
      )}

      {/* Quiz */}
      {step === "quiz" && (
        <div className="space-y-4">
          {questions.map((q, qi) => (
            <div key={q.id} className="card p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                Question {qi + 1}
              </p>
              <p className="text-sm font-medium text-[var(--text-primary)]">{q.prompt}</p>
              <div className="grid gap-2">
                {q.choices.map((choice, ci) => {
                  const selected = answers[q.id] === ci;
                  return (
                    <button
                      key={ci}
                      type="button"
                      className={`flex items-center gap-3 rounded-lg px-4 py-3 text-left text-sm transition-colors border ${selected
                          ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--text-primary)] font-medium"
                          : "border-[var(--border)] bg-white text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
                        }`}
                      onClick={() => setAnswers((p) => ({ ...p, [q.id]: ci }))}
                    >
                      <span
                        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${selected
                            ? "bg-[var(--accent)] text-white"
                            : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
                          }`}
                      >
                        {String.fromCharCode(65 + ci)}
                      </span>
                      {choice}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex gap-3">
            <button className="btn btn-secondary" onClick={() => setStep("read")} type="button">
              Back to Content
            </button>
            <button
              className="btn btn-primary"
              disabled={!allAnswered || submitting}
              onClick={() => void submitQuiz()}
              type="button"
            >
              {submitting ? "Submitting…" : "Submit Answers"}
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {step === "result" && result && (
        <div className="card p-8 text-center space-y-5">
          {result.passed ? (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--success-bg)] border border-[var(--success-border)]">
                <CheckCircle2 className="h-8 w-8 text-[var(--success)]" />
              </div>
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">Passed! 🎉</h2>
            </>
          ) : (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--danger-bg)] border border-[var(--danger-border)]">
                <XCircle className="h-8 w-8 text-[var(--danger)]" />
              </div>
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">Not yet — try again</h2>
            </>
          )}

          <p className="text-base text-[var(--text-muted)]">
            Score: <span className="font-bold text-[var(--text-primary)]">{result.scorePct}%</span>
            {" · "}Pass threshold: {data.module.passScore}%
          </p>

          <div className="flex flex-wrap justify-center gap-3 mt-4">
            {result.passed ? (
              <Link href={`/product/attest/${result.campaignId}`} className="btn btn-primary">
                Continue to Attestation
              </Link>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => { setAnswers({}); setResult(null); setStep("quiz"); }}
              >
                <RotateCcw className="h-4 w-4" /> Retry Quiz
              </button>
            )}
            <Link href="/product/learn" className="btn btn-secondary">
              Back to My Learning
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Simple markdown → HTML
// ---------------------------------------------------------------------------

function simpleMarkdown(md: string): string {
  if (!md) return "";
  const escaped = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold mt-4 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n{2,}/g, '<br class="my-2" />');
}
