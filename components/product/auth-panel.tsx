"use client";

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

    setStatus("Magic link sent. Open your inbox to continue.");
  };

  return (
    <section className="mx-auto max-w-xl rounded-[1.8rem] border border-[#cfc2b5] bg-[#fff8ef] p-7">
      <h1 className="font-display text-4xl text-[#10243e]">Access your pilot workspace</h1>
      <p className="mt-2 text-sm text-[#495f77]">
        Sign in with Google or use a secure magic link.
      </p>

      <button
        className="mt-6 h-11 w-full rounded-xl bg-[#0e8c89] text-sm font-semibold text-white hover:bg-[#0c7673]"
        onClick={signInWithGoogle}
        type="button"
      >
        Continue with Google
      </button>

      <div className="mt-6 space-y-2">
        <label className="text-sm">Work email</label>
        <input
          className="h-11 w-full rounded-xl border border-[#c9bcac] bg-white px-3"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@company.com"
          type="email"
          value={email}
        />
        <button
          className="h-11 w-full rounded-xl border border-[#c9bcac] bg-[#f4e9da] text-sm font-semibold text-[#13253d] hover:bg-[#eedfcb]"
          onClick={signInWithMagicLink}
          type="button"
        >
          Send Magic Link
        </button>
      </div>

      {status ? <p className="mt-4 text-sm text-[#0d756e]">{status}</p> : null}
      {error ? <p className="mt-4 text-sm text-[#a54f3a]">{error}</p> : null}
    </section>
  );
}
