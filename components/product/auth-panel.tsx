"use client";

import { KeyRound, Lock, LogIn, Mail } from "lucide-react";
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
    if (!supabase) {
      return;
    }

    const getAccessToken = async (): Promise<string | null> => {
      const { data } = await supabase.auth.getSession();
      const currentToken = data.session?.access_token;
      if (currentToken) {
        return currentToken;
      }

      const refresh = await supabase.auth.refreshSession();
      return refresh.data.session?.access_token ?? null;
    };

    const resolvePostAuthRoute = async (token: string): Promise<string> => {
      const response = await fetch("/api/me/org-memberships", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        return "/product/admin/dashboard";
      }

      const body = (await response.json()) as MembershipPayload;
      if (!Array.isArray(body.memberships) || body.memberships.length === 0) {
        return "/product/admin/dashboard";
      }

      if (body.memberships.length === 1) {
        const membership = body.memberships[0];
        if (membership.role === "learner") {
          return `/product/learn?org=${membership.orgId}`;
        }

        return `/product/admin/dashboard?org=${membership.orgId}`;
      }

      return "/product/admin/dashboard";
    };

    let active = true;
    void getAccessToken().then(async (token) => {
      if (!active || !token) {
        return;
      }

      const route = await resolvePostAuthRoute(token);
      if (active) {
        router.replace(route);
      }
    });

    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.access_token || !active) {
        return;
      }

      const route = await resolvePostAuthRoute(session.access_token);
      if (active) {
        router.replace(route);
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [router]);

  const signInWithGoogle = async () => {
    setError(null);
    setStatus(null);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase environment is missing. Configure .env.local first.");
      return;
    }

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/product/auth`,
      },
    });

    if (oauthError) {
      setError(
        `${oauthError.message}. Next action: enable Google provider in Supabase Auth settings.`,
      );
    }
  };

  const signInWithPassword = async () => {
    setError(null);
    setStatus(null);

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase environment is missing. Configure .env.local first.");
      return;
    }

    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }

    if (!password) {
      setError("Enter your password.");
      return;
    }

    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    // Auth state change listener will handle redirect
  };

  const signInWithMagicLink = async () => {
    setError(null);
    setStatus(null);

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase environment is missing. Configure .env.local first.");
      return;
    }

    if (!email.trim()) {
      setError("Enter a valid work email before requesting the link.");
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/product/auth`,
      },
    });

    if (signInError) {
      setError(signInError.message);
      return;
    }

    setStatus("Magic link sent. Next action: open your inbox and use the secure sign-in link.");
  };

  return (
    <section className="mx-auto max-w-xl rounded-[1.8rem] surface-card p-7">
      <h1 className="font-display text-4xl text-[#10244a]">Access your pilot workspace</h1>
      <p className="mt-2 text-sm text-[#495f77]">
        Use Google SSO, email &amp; password, or a secure magic link.
      </p>

      <button
        className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#1f5eff] text-sm font-semibold text-white hover:bg-[#154ee6]"
        onClick={signInWithGoogle}
        type="button"
      >
        <KeyRound className="mr-2 h-4 w-4" />
        Continue with Google
      </button>

      <div className="relative my-6 flex items-center">
        <div className="flex-1 border-t border-[#d3deef]" />
        <span className="mx-3 text-xs text-[#6079a2]">or sign in with email</span>
        <div className="flex-1 border-t border-[#d3deef]" />
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-[#10244a]">Email</label>
          <input
            className="mt-1 h-11 w-full rounded-xl border border-[#d3deef] bg-white px-3 text-sm"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            type="email"
            value={email}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[#10244a]">Password</label>
          <div className="relative mt-1">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6079a2]" />
            <input
              className="h-11 w-full rounded-xl border border-[#d3deef] bg-white pl-10 pr-3 text-sm"
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void signInWithPassword();
              }}
              placeholder="Enter password"
              type="password"
              value={password}
            />
          </div>
        </div>

        <button
          className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#1f5eff] text-sm font-semibold text-white hover:bg-[#154ee6] disabled:opacity-50"
          disabled={loading}
          onClick={() => void signInWithPassword()}
          type="button"
        >
          <LogIn className="mr-2 h-4 w-4" />
          {loading ? "Signing in…" : "Sign In"}
        </button>

        <button
          className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-[#d3deef] bg-white text-sm font-semibold text-[#13253d] hover:bg-[#f4f8ff]"
          onClick={signInWithMagicLink}
          type="button"
        >
          <Mail className="mr-2 h-4 w-4" />
          Send Magic Link Instead
        </button>
      </div>

      {status ? <p className="mt-4 text-sm text-[#12795c]">{status}</p> : null}
      {error ? <p className="mt-4 text-sm text-[#a54f3a]">{error}</p> : null}
    </section>
  );
}
