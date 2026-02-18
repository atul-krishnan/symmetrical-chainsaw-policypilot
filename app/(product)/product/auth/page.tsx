import type { Metadata } from "next";
import { FileCheck2, ShieldCheck, Users2 } from "lucide-react";
import Image from "next/image";

import { AuthPanel } from "@/components/product/auth-panel";

export const metadata: Metadata = {
  title: "Authentication",
  description: "Sign into your enterprise learning workspace.",
};

export default function AuthPage() {
  return (
    <section className="w-full py-6 sm:py-10">
      <div className="mx-auto grid w-full max-w-7xl gap-5 xl:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
        <AuthPanel />

        <aside className="ink-panel rounded-[1.8rem] p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9dc3ff]">Workspace context</p>
          <h2 className="mt-2 font-display text-3xl text-white sm:text-4xl">Enterprise rollout starts with secure access</h2>
          <p className="mt-3 max-w-2xl text-sm text-[#c2d9fb]">
            After sign-in, PolicyPilot resolves your org membership and routes you to the right workspace automatically.
          </p>

          <Image
            alt="PolicyPilot command center interface preview used during authentication onboarding."
            className="mt-4 w-full rounded-2xl border border-white/25"
            height={560}
            src="/marketing/policy-command-center.svg"
            width={860}
          />

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <p className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs">
              <ShieldCheck className="mb-1 h-4 w-4 text-[#9dc3ff]" />
              Role-gated routes
            </p>
            <p className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs">
              <Users2 className="mb-1 h-4 w-4 text-[#9dc3ff]" />
              Org-aware navigation
            </p>
            <p className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs">
              <FileCheck2 className="mb-1 h-4 w-4 text-[#9dc3ff]" />
              Auditable events
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
