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

const TRACK_COLORS: Record<string, string> = {
  exec: "status-pill-warning",
  builder: "status-pill-info",
  general: "status-pill-neutral",
};

const STATE_META: Record<
  string,
  { label: string; icon: typeof Clock; cls: string }
> = {
  assigned: { label: "Not started", icon: BookOpen, cls: "text-[var(--text-muted)]" },
  in_progress: { label: "In progress", icon: Loader2, cls: "text-[var(--accent)]" },
  completed: { label: "Completed", icon: CheckCircle2, cls: "text-[var(--success)]" },
  overdue: { label: "Overdue", icon: Clock, cls: "text-[var(--danger)]" },
};

function formatDue(iso: string | null): string {
  if (!iso) return "No due date";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntilDue(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
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
    if (!supabase) { setError("Supabase is not configured."); setLoading(false); return; }

    const { data } = await supabase.auth.getSession();
    let token = data.session?.access_token;
    if (!token) {
      const refresh = await supabase.auth.refreshSession();
      token = refresh.data.session?.access_token ?? undefined;
    }
    if (!token) { setError("Sign in to view your assignments."); setLoading(false); return; }

    try {
      const res = await fetch("/api/me/assignments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json()) as AssignmentResponse | { error: { message: string } };
      if (!res.ok) { setError("error" in body ? body.error.message : "Failed to load"); setLoading(false); return; }
      setItems((body as AssignmentResponse).items);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const inProgress = items.filter((i) => i.state === "in_progress");
  const assigned = items.filter((i) => i.state === "assigned" || i.state === "overdue");
  const completed = items.filter((i) => i.state === "completed");
  const totalDone = completed.length;
  const totalAll = items.length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">My Learning</h1>
          <p className="page-subtitle">Complete your assigned modules and submit attestation.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => void load()} type="button">
          <RefreshCcw className="h-3.5 w-3.5" />
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Progress bar */}
      {!loading && totalAll > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-[var(--text-primary)]">Overall Progress</span>
            <span className="font-semibold text-[var(--text-primary)]">{totalDone}/{totalAll} completed</span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-[var(--bg-muted)]">
            <div
              className="h-2 rounded-full bg-[var(--accent)] transition-all duration-500"
              style={{ width: `${totalAll > 0 ? (totalDone / totalAll) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      {/* Loading */}
      {loading && items.length === 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="card h-40 animate-pulse p-5">
              <div className="h-3 w-16 rounded bg-[var(--bg-muted)]" />
              <div className="mt-3 h-5 w-3/4 rounded bg-[var(--bg-muted)]" />
              <div className="mt-auto h-9 w-full rounded-lg bg-[var(--bg-muted)]" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && !error && (
        <div className="card p-12 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-[var(--text-faint)]" />
          <h2 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">No assignments yet</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            When your admin publishes a campaign, your modules will appear here.
          </p>
        </div>
      )}

      {/* Groups */}
      {inProgress.length > 0 && <AssignmentGroup title="In Progress" items={inProgress} />}
      {assigned.length > 0 && <AssignmentGroup title="Assigned" items={assigned} />}
      {completed.length > 0 && <AssignmentGroup title="Completed" items={completed} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AssignmentGroup({ title, items }: { title: string; items: AssignmentItem[] }) {
  return (
    <div className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
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
  const trackCls = TRACK_COLORS[item.module.roleTrack] ?? "status-pill-neutral";
  const meta = STATE_META[item.state] ?? STATE_META.assigned;
  const Icon = meta.icon;
  const days = daysUntilDue(item.dueAt);
  const isOverdue = item.state === "overdue" || (days !== null && days < 0);
  const isCompleted = item.state === "completed";

  const cta = isCompleted ? "Review" : item.state === "in_progress" ? "Continue" : "Start Module";

  return (
    <article className="card flex flex-col justify-between p-5 transition-shadow hover:shadow-md">
      <div className="space-y-3">
        <span className={`status-pill ${trackCls} capitalize`}>
          {item.module.roleTrack}
        </span>

        <h3 className="text-base font-semibold leading-tight text-[var(--text-primary)]">
          {item.module.title}
        </h3>

        <div className="flex items-center gap-3 text-xs">
          <span className={`inline-flex items-center gap-1 font-medium ${meta.cls}`}>
            <Icon className="h-3.5 w-3.5" />
            {meta.label}
          </span>
          <span className={isOverdue ? "font-semibold text-[var(--danger)]" : "text-[var(--text-muted)]"}>
            {isOverdue && days !== null
              ? `${Math.abs(days)}d overdue`
              : formatDue(item.dueAt)}
          </span>
        </div>
      </div>

      <Link
        className={`mt-4 btn ${isCompleted ? "btn-secondary" : "btn-primary"} w-full justify-center`}
        href={`/product/learn/${item.id}`}
      >
        {cta}
      </Link>
    </article>
  );
}
