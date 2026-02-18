import type { PropsWithChildren } from "react";

import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingNav } from "@/components/layout/marketing-nav";

export function MarketingShell({ children }: PropsWithChildren) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-0 top-0 h-[24rem] w-[24rem] rounded-full bg-[#f7dfbb]/50 blur-3xl" />
        <div className="absolute right-0 top-32 h-[26rem] w-[26rem] rounded-full bg-[#d9ece7]/70 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[22rem] w-[22rem] rounded-full bg-[#efd3c7]/40 blur-3xl" />
      </div>
      <MarketingNav />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}
