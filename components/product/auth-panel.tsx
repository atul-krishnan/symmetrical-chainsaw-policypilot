"use client";

import { KeyRound, Lock, LogIn, Mail, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type MembershipPayload = {
  memberships: Array<{
    orgId: string;
    role: "owner" | "admin" | "manager" | "learner";
  }>;
};

export function AuthPanel() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const getAccessToken = async (): Promise<string | null> => {
      const { data } = await supabase.auth.getSession();
      const currentToken = data.session?.access_token;
      if (currentToken) return currentToken;
      const refresh = await supabase.auth.refreshSession();
      return refresh.data.session?.access_token ?? null;
    };

    const resolvePostAuthRoute = async (token: string): Promise<string> => {
      const response = await fetch("/api/me/org-memberships", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return "/product/admin/dashboard";
      const body = (await response.json()) as MembershipPayload;
      if (!Array.isArray(body.memberships) || body.memberships.length === 0) return "/product/admin/dashboard";
      if (body.memberships.length === 1) {
        const membership = body.memberships[0];
        if (membership.role === "learner") return `/product/learn?org=${membership.orgId}`;
        return `/product/admin/dashboard?org=${membership.orgId}`;
      }
      return "/product/admin/dashboard";
    };

    let active = true;
    void getAccessToken().then(async (token) => {
      if (!active || !token) return;
      const route = await resolvePostAuthRoute(token);
      if (active) router.replace(route);
    });

    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.access_token || !active) return;
      const route = await resolvePostAuthRoute(session.access_token);
      if (active) router.replace(route);
    });

    return () => { active = false; data.subscription.unsubscribe(); };
  }, [router]);

  const signInWithGoogle = async () => {
    setError(null); setStatus(null);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setError("Supabase not configured."); return; }
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/product/auth` },
    });
    if (e) setError(`${e.message}. Enable Google provider in Supabase Auth settings.`);
  };

  const signInWithPassword = async () => {
    setError(null); setStatus(null);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setError("Supabase not configured."); return; }
    if (!email.trim()) { setError("Enter your email address."); return; }
    if (!password) { setError("Enter your password."); return; }
    setLoading(true);
    const { error: e } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (e) setError(e.message);
  };

  const signInWithMagicLink = async () => {
    setError(null); setStatus(null);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setError("Supabase not configured."); return; }
    if (!email.trim()) { setError("Enter a valid work email."); return; }
    const { error: e } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/product/auth` },
    });
    if (e) { setError(e.message); return; }
    setStatus("Magic link sent — check your inbox.");
  };

  return (
    <div className="flex w-full max-w-[920px] overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-lg">
      {/* Left brand panel */}
      <div className="hidden w-[380px] shrink-0 flex-col justify-between bg-[var(--bg-sidebar)] p-8 lg:flex">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent)] text-sm font-bold text-white">
              P
            </div>
            <span className="text-lg font-bold text-white">PolicyPilot</span>
          </div>
          <h2 className="mt-8 text-2xl font-bold leading-tight text-white">
            Enterprise AI Compliance Training
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Transform policy documents into role-ready training modules with auditable attestation workflows.
          </p>
        </div>

        {/* Testimonial */}
        <div className="mt-8 rounded-xl border border-slate-700 bg-slate-800/50 p-5">
          <p className="text-sm italic text-slate-300">
            &ldquo;PolicyPilot cut our compliance onboarding from 3 weeks to 2 days — with full audit trails.&rdquo;
          </p>
          <p className="mt-3 text-xs font-semibold text-slate-400">
            — VP Academic Affairs, University of Pacific Northwest
          </p>
        </div>

        {/* Trust badges */}
        <div className="mt-6 flex items-center gap-4 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Shield className="h-3.5 w-3.5" />
            SOC 2 Ready
          </span>
          <span>•</span>
          <span>AES-256 Encryption</span>
          <span>•</span>
          <span>RBAC</span>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col justify-center p-6 sm:p-10">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Sign in to your workspace
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Use Google SSO, email &amp; password, or a secure magic link.
        </p>

        {/* Google SSO */}
        <button
          className="btn btn-primary btn-lg mt-6 w-full"
          onClick={signInWithGoogle}
          type="button"
        >
          <KeyRound className="h-4 w-4" />
          Continue with Google
        </button>

        {/* Divider */}
        <div className="relative my-6 flex items-center">
          <div className="flex-1 border-t border-[var(--border)]" />
          <span className="mx-3 text-xs text-[var(--text-faint)]">or sign in with email</span>
          <div className="flex-1 border-t border-[var(--border)]" />
        </div>

        {/* Email + Password form */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-[var(--text-primary)]">Email</label>
            <input
              className="mt-1 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:border-[var(--accent)]"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              type="email"
              value={email}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--text-primary)]">Password</label>
            <div className="relative mt-1">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
              <input
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-white pl-10 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:border-[var(--accent)]"
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void signInWithPassword(); }}
                placeholder="Enter password"
                type="password"
                value={password}
              />
            </div>
          </div>

          <button
            className="btn btn-primary w-full"
            disabled={loading}
            onClick={() => void signInWithPassword()}
            type="button"
          >
            <LogIn className="h-4 w-4" />
            {loading ? "Signing in…" : "Sign In"}
          </button>

          <button
            className="btn btn-secondary w-full"
            onClick={signInWithMagicLink}
            type="button"
          >
            <Mail className="h-4 w-4" />
            Send Magic Link Instead
          </button>
        </div>

        {status && (
          <p className="mt-4 rounded-lg border border-[var(--success-border)] bg-[var(--success-bg)] px-4 py-2 text-sm text-[var(--success)]">
            {status}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        <p className="mt-6 text-center text-xs text-[var(--text-faint)]">
          Your data is encrypted at rest and in transit. By signing in, you agree to the Terms of Service.
        </p>
      </div>
    </div>
  );
}
