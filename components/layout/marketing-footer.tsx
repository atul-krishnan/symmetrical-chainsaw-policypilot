import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-t border-[#ccbfae] bg-[#efe6d9] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 text-sm text-[#445d78] md:flex-row md:items-center md:justify-between">
        <p>PolicyPilot helps enterprise teams operationalize AI governance at scale.</p>
        <div className="flex gap-4">
          <Link href="/security">Security</Link>
          <Link href="/pilot">Pilot package</Link>
          <Link href="/roi">ROI</Link>
        </div>
      </div>
    </footer>
  );
}
