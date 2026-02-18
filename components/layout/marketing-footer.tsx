import Image from "next/image";
import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-t border-[#d8e2f2] bg-white/86 px-4 py-12 backdrop-blur-lg sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-7xl gap-6 text-sm md:grid-cols-[1.2fr_0.45fr_0.35fr] md:items-start">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Image
              alt="PolicyPilot logo"
              height={32}
              src="/logo.png"
              width={32}
            />
            <p className="font-display text-2xl text-[#10244a]">PolicyPilot</p>
          </div>
          <p className="mt-2 max-w-xl text-[#476082]">
            Enterprise AI policy operations platform for turning governance requirements into completed, auditable training.
          </p>
          <p className="text-xs text-[#637fa6]">Core promise: from policy docs to role-ready training in under 45 minutes.</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5e79a5]">Product</p>
          <div className="mt-3 flex flex-col gap-2 text-[#3f5881]">
            <Link className="hover:text-[#184fdf]" href="/pilot">Pilot package</Link>
            <Link className="hover:text-[#184fdf]" href="/security">Security posture</Link>
            <Link className="hover:text-[#184fdf]" href="/roi">ROI calculator</Link>
            <Link className="hover:text-[#184fdf]" href="/product/auth">Workspace login</Link>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5e79a5]">Operations</p>
          <div className="mt-3 flex flex-col gap-2 text-[#3f5881]">
            <span>Audit-ready exports</span>
            <span>Role-based assignments</span>
            <span>Checksum verification</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
