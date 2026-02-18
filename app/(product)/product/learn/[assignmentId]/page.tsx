"use client";

import Link from "next/link";
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

import { SessionStatus } from "@/components/product/session-status";
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
type Assignment = {
  id: string;
  state: string;
  dueAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
};
type Campaign = { id: string; name: string; status: string } | null;
type DetailResponse = {
  assignment: Assignment;
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

const TRACK_LABEL: Record<string, string> = {
  exec: "Executive",
  builder: "Builder",
  general: "General",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AssignmentPage({
  params,
}: {
  params: { assignmentId: string };
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DetailResponse | null>(null);
  const [step, setStep] = useState<Step>("read");

  // Quiz state
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }

    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) {
      setError("Sign in to view this module.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/me/assignments/${params.assignmentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error?.message ?? "Failed to load assignment.");
        setLoading(false);
        return;
      }
      setData(body as DetailResponse);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [params.assignmentId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const submitQuiz = useCallback(async () => {
    if (!data) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return;

    setSubmitting(true);
    setError(null);

    const orderedAnswers = data.questions.map((q) => answers[q.id] ?? 0);

    try {
      const res = await fetch(`/api/me/modules/${data.module.id}/attempts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ answers: orderedAnswers }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error?.message ?? "Submission failed.");
        setSubmitting(false);
        return;
      }
      setResult(body as AttemptResult);
      setStep("result");
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }, [data, answers]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <section className="mx-auto max-w-4xl py-12 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#1f5eff]" />
        <p className="mt-3 text-sm text-[#5b7194]">Loading module…</p>
      </section>
    );
  }

  if (error && !data) {
    return (
      <section className="mx-auto max-w-4xl py-12 text-center">
        <p className="text-sm text-[#a04e39]">{error}</p>
        <Link
          href="/product/learn"
          className="mt-4 inline-flex items-center gap-1 text-sm text-[#1f5eff] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to assignments
        </Link>
      </section>
    );
  }

  if (!data) return null;

  const { module: mod, campaign, questions } = data;
  const allAnswered =
    questions.length > 0 &&
    questions.every((q) => answers[q.id] !== undefined);

  return (
    <section className="mx-auto max-w-4xl space-y-6 py-6 px-4 sm:px-6">
      <SessionStatus />

      {/* Back link */}
      <Link
        href="/product/learn"
        className="inline-flex items-center gap-1 text-sm text-[#1f5eff] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> My Learning
      </Link>

      {/* Header card */}
      <div className="rounded-[1.8rem] surface-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            {campaign && (
              <p className="text-xs uppercase tracking-[0.16em] text-[#6079a2]">
                {campaign.name}
              </p>
            )}
            <h1 className="font-display text-3xl sm:text-4xl text-[#10244a]">
              {mod.title}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-[#5b7194]">
              <span
                className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-[#e0ecff] text-[#1f5eff]"
              >
                {TRACK_LABEL[mod.roleTrack] ?? mod.roleTrack}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> ~{mod.estimatedMinutes} min
              </span>
              <span>Pass score: {mod.passScore}%</span>
            </div>
          </div>
        </div>

        {/* Step navigation */}
        <div className="mt-5 flex gap-1">
          {(["read", "quiz", "result"] as Step[]).map((s, i) => {
            const label = ["1. Read", "2. Quiz", "3. Result"][i];
            const active = step === s;
            const done =
              (s === "read" && (step === "quiz" || step === "result")) ||
              (s === "quiz" && step === "result");
            return (
              <button
                key={s}
                type="button"
                className={`flex-1 rounded-xl py-2 text-xs font-semibold transition-colors ${active
                  ? "bg-[#1f5eff] text-white"
                  : done
                    ? "bg-[#dff0df] text-[#12795c]"
                    : "bg-[#eef4ff] text-[#5b7194]"
                  }`}
                onClick={() => {
                  if (s === "result" && !result) return;
                  setStep(s);
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="text-sm text-[#a04e39] bg-[#fff1ed] rounded-xl px-4 py-3 border border-[#f1cbc2]">
          {error}
        </p>
      )}

      {/* Step: Read */}
      {step === "read" && (
        <div className="rounded-[1.8rem] surface-card p-6 sm:p-7 space-y-5">
          {mod.summary && (
            <p className="text-sm leading-relaxed text-[#4f6486] border-l-4 border-[#1f5eff] pl-4">
              {mod.summary}
            </p>
          )}

          <div className="prose prose-sm max-w-none text-[#1e2b3d]">
            <div
              dangerouslySetInnerHTML={{
                __html: simpleMarkdown(mod.contentMarkdown),
              }}
            />
          </div>

          <button
            type="button"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#1f5eff] px-6 text-sm font-semibold text-white hover:bg-[#154ee6]"
            onClick={() => setStep("quiz")}
          >
            <BookOpenCheck className="h-4 w-4" />
            Start Quiz ({questions.length} questions)
          </button>
        </div>
      )}

      {/* Step: Quiz */}
      {step === "quiz" && (
        <div className="space-y-4">
          {questions.map((q, qi) => (
            <div
              key={q.id}
              className="rounded-2xl surface-card p-5 space-y-3"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-[#6079a2]">
                Question {qi + 1}
              </p>
              <p className="text-sm font-medium text-[#10244a]">{q.prompt}</p>
              <div className="grid gap-2">
                {q.choices.map((choice, ci) => {
                  const selected = answers[q.id] === ci;
                  return (
                    <button
                      key={ci}
                      type="button"
                      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition-colors border ${selected
                        ? "border-[#1f5eff] bg-[#e8f0ff] text-[#10244a] font-medium"
                        : "border-[#d3deef] bg-white text-[#3b5068] hover:bg-[#f4f8ff]"
                        }`}
                      onClick={() =>
                        setAnswers((prev) => ({ ...prev, [q.id]: ci }))
                      }
                    >
                      <span
                        className={`inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${selected
                          ? "bg-[#1f5eff] text-white"
                          : "bg-[#eef4ff] text-[#5b7194]"
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
            <button
              type="button"
              className="h-11 rounded-xl border border-[#d3deef] bg-white px-5 text-sm font-semibold text-[#10244a] hover:bg-[#f4f8ff]"
              onClick={() => setStep("read")}
            >
              Back to Content
            </button>
            <button
              type="button"
              className="h-11 rounded-xl bg-[#1f5eff] px-6 text-sm font-semibold text-white hover:bg-[#154ee6] disabled:opacity-50"
              disabled={!allAnswered || submitting}
              onClick={() => void submitQuiz()}
            >
              {submitting ? "Submitting…" : "Submit Answers"}
            </button>
          </div>
        </div>
      )}

      {/* Step: Result */}
      {step === "result" && result && (
        <div className="rounded-[1.8rem] surface-card p-6 sm:p-7 text-center space-y-5">
          {result.passed ? (
            <>
              <CheckCircle2 className="mx-auto h-16 w-16 text-[#12795c]" />
              <h2 className="font-display text-3xl text-[#10244a]">
                Passed! 🎉
              </h2>
            </>
          ) : (
            <>
              <XCircle className="mx-auto h-16 w-16 text-[#b84c33]" />
              <h2 className="font-display text-3xl text-[#10244a]">
                Not yet — try again
              </h2>
            </>
          )}

          <p className="text-lg text-[#4f6486]">
            Score: <span className="font-bold text-[#10244a]">{result.scorePct}%</span>
            {" · "}
            Pass threshold: {data.module.passScore}%
          </p>

          <div className="flex flex-wrap justify-center gap-3 mt-4">
            {result.passed ? (
              <Link
                href={`/product/attest/${result.campaignId}`}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#1f5eff] px-6 text-sm font-semibold text-white hover:bg-[#154ee6]"
              >
                Continue to Attestation
              </Link>
            ) : (
              <button
                type="button"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#1f5eff] px-6 text-sm font-semibold text-white hover:bg-[#154ee6]"
                onClick={() => {
                  setAnswers({});
                  setResult(null);
                  setStep("quiz");
                }}
              >
                <RotateCcw className="h-4 w-4" /> Retry Quiz
              </button>
            )}
            <Link
              href="/product/learn"
              className="inline-flex h-11 items-center rounded-xl border border-[#d3deef] bg-white px-5 text-sm font-semibold text-[#10244a] hover:bg-[#f4f8ff]"
            >
              Back to My Learning
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Simple markdown → HTML (covers headings, bold, italic, lists, paragraphs)
// ---------------------------------------------------------------------------

function simpleMarkdown(md: string): string {
  if (!md) return "";
  const escaped = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold mt-4 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n{2,}/g, '<br class="my-2" />');
}
