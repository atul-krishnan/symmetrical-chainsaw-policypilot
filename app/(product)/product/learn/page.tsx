"use client";

import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { SessionStatus } from "@/components/product/session-status";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AssignmentItem = {
  id: string;
  state: "assigned" | "in_progress" | "completed" | "overdue";
  dueAt: string | null;
  module: {
    id: string;
    title: string;
    roleTrack: string;
    campaignId: string;
  };
};

type AssignmentResponse = { items: AssignmentItem[] };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TRACK_COLORS: Record<string, { bg: string; text: string }> = {
  exec: { bg: "#e0ecff", text: "#1f5eff" },
  builder: { bg: "#ddf5ff", text: "#0d7fa6" },
  general: { bg: "#eee8ff", text: "#6b4fcf" },
};

const STATE_META: Record<
  string,
  { label: string; icon: typeof Clock; color: string }
> = {
  assigned: { label: "Not started", icon: BookOpen, color: "#5b7194" },
  in_progress: { label: "In progress", icon: Loader2, color: "#1f5eff" },
  completed: { label: "Completed", icon: CheckCircle2, color: "#12795c" },
  overdue: { label: "Overdue", icon: Clock, color: "#b84c33" },
};

function formatDue(iso: string | null): string {
  if (!iso) return "No due date";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntilDue(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LearnInboxPage() {
  const [items, setItems] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured in this environment.");
      setLoading(false);
      return;
    }

    const { data } = await supabase.auth.getSession();
    let token = data.session?.access_token;
    if (!token) {
      const refresh = await supabase.auth.refreshSession();
      token = refresh.data.session?.access_token ?? undefined;
    }

    if (!token) {
      setError("Sign in before viewing assignments.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/me/assignments", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const body = (await res.json()) as
        | AssignmentResponse
        | { error: { message: string } };

      if (!res.ok) {
        setError(
          "error" in body ? body.error.message : "Failed to load assignments",
        );
        setLoading(false);
        return;
      }

      setItems((body as AssignmentResponse).items);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Group items by state
  const inProgress = items.filter((i) => i.state === "in_progress");
  const assigned = items.filter(
    (i) => i.state === "assigned" || i.state === "overdue",
  );
  const completed = items.filter((i) => i.state === "completed");

  return (
    <section className="mx-auto max-w-5xl space-y-6 py-6 px-4 sm:px-6">
      <SessionStatus />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl text-[#10244a]">
            My Learning
          </h1>
          <p className="mt-2 text-sm text-[#4f6486]">
            Complete your assigned modules and submit attestation.
          </p>
        </div>
        <button
          className="inline-flex h-10 items-center gap-2 rounded-full border border-[#d2ddef] bg-white px-4 text-sm font-semibold text-[#1f3b67] hover:bg-[#f4f8ff]"
          onClick={() => void load()}
          type="button"
        >
          <RefreshCcw className="h-4 w-4" />
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-[#a04e39] bg-[#fff1ed] rounded-xl px-4 py-3 border border-[#f1cbc2]">
          {error}
        </p>
      )}

      {/* Loading skeleton */}
      {loading && items.length === 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-36 animate-pulse rounded-2xl bg-[#eef4ff]"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && !error && (
        <div className="rounded-[1.8rem] surface-card p-8 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-[#b4c7e0]" />
          <h2 className="mt-4 font-display text-2xl text-[#10244a]">
            No assignments yet
          </h2>
          <p className="mt-2 text-sm text-[#4f6486]">
            When your admin publishes a campaign, your modules will appear here.
          </p>
        </div>
      )}

      {/* In Progress */}
      {inProgress.length > 0 && (
        <AssignmentGroup title="In Progress" items={inProgress} />
      )}

      {/* Assigned / Overdue */}
      {assigned.length > 0 && (
        <AssignmentGroup title="Assigned" items={assigned} />
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <AssignmentGroup title="Completed" items={completed} />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AssignmentGroup({
  title,
  items,
}: {
  title: string;
  items: AssignmentItem[];
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6079a2]">
        {title} ({items.length})
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <AssignmentCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function AssignmentCard({ item }: { item: AssignmentItem }) {
  const track = TRACK_COLORS[item.module.roleTrack] ?? TRACK_COLORS.general;
  const meta = STATE_META[item.state] ?? STATE_META.assigned;
  const Icon = meta.icon;
  const days = daysUntilDue(item.dueAt);
  const isOverdue = item.state === "overdue" || (days !== null && days < 0);
  const isCompleted = item.state === "completed";

  const cta = isCompleted
    ? "Review"
    : item.state === "in_progress"
      ? "Continue"
      : "Start Module";

  return (
    <article className="flex flex-col justify-between rounded-2xl surface-card p-5 transition-shadow hover:shadow-md">
      <div className="space-y-3">
        {/* Track badge */}
        <span
          className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider"
          style={{ background: track.bg, color: track.text }}
        >
          {item.module.roleTrack}
        </span>

        {/* Title */}
        <h3 className="font-display text-xl leading-tight text-[#10244a]">
          {item.module.title}
        </h3>

        {/* Status + Due */}
        <div className="flex items-center gap-3 text-xs">
          <span
            className="inline-flex items-center gap-1 font-medium"
            style={{ color: meta.color }}
          >
            <Icon className="h-3.5 w-3.5" />
            {meta.label}
          </span>
          <span
            className="text-[#5b7194]"
            style={isOverdue ? { color: "#b84c33", fontWeight: 600 } : {}}
          >
            {isOverdue && days !== null
              ? `${Math.abs(days)}d overdue`
              : formatDue(item.dueAt)}
          </span>
        </div>
      </div>

      {/* CTA */}
      <Link
        className={`mt-4 inline-flex h-10 items-center justify-center rounded-xl text-sm font-semibold transition-colors ${isCompleted
            ? "border border-[#d3deef] bg-white text-[#10244a] hover:bg-[#f4f8ff]"
            : "bg-[#1f5eff] text-white hover:bg-[#154ee6]"
          }`}
        href={`/product/learn/${item.id}`}
      >
        {cta}
      </Link>
    </article>
  );
}
