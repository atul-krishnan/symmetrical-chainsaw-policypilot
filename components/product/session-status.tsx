"use client";

import { useEffect, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

export function SessionStatus() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) {
          setEmail(data.session?.user?.email ?? null);
        }
      })
      .catch(() => {
        if (mounted) {
          setEmail(null);
        }
      });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return (
    <p className="text-xs uppercase tracking-[0.18em] text-[#5e748e]">
      {email ? `Signed in as ${email}` : "Not signed in"}
    </p>
  );
}
