"use client";

import { KeyRound, Mail } from "lucide-react";
import { useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function AuthPanel() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signInWithGoogle = async () => {
    setError(null);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase environment is missing. Configure .env.local first.");
      return;
    }

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/product/admin/dashboard`,
      },
    });
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
        emailRedirectTo: `${window.location.origin}/product/admin/dashboard`,
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
        Use Google SSO or a secure magic link for enterprise login.
      </p>

      <button
        className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#1f5eff] text-sm font-semibold text-white hover:bg-[#154ee6]"
        onClick={signInWithGoogle}
        type="button"
      >
        <KeyRound className="mr-2 h-4 w-4" />
        Continue with Google
      </button>

      <div className="mt-6 space-y-2">
        <label className="text-sm">Work email</label>
        <input
          className="h-11 w-full rounded-xl border border-[#d3deef] bg-white px-3"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@company.com"
          type="email"
          value={email}
        />
        <button
          className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-[#d3deef] bg-white text-sm font-semibold text-[#13253d] hover:bg-[#f4f8ff]"
          onClick={signInWithMagicLink}
          type="button"
        >
          <Mail className="mr-2 h-4 w-4" />
          Send Magic Link
        </button>
      </div>

      {status ? <p className="mt-4 text-sm text-[#12795c]">{status}</p> : null}
      {error ? <p className="mt-4 text-sm text-[#a54f3a]">{error}</p> : null}
    </section>
  );
}
