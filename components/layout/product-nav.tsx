import Link from "next/link";

export function ProductNav() {
  return (
    <header className="border-b border-[#cfc2b4] bg-[#fbf6ee]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <Link className="font-display text-2xl text-[#10243e]" href="/">
          PolicyPilot
        </Link>

        <nav aria-label="Product" className="flex flex-wrap items-center gap-2 text-sm">
          <Link className="rounded-full px-3 py-2 text-[#344e68] hover:bg-[#ebe0d1]" href="/product/admin/policies">
            Policies
          </Link>
          <Link className="rounded-full px-3 py-2 text-[#344e68] hover:bg-[#ebe0d1]" href="/product/admin/campaigns">
            Campaigns
          </Link>
          <Link className="rounded-full px-3 py-2 text-[#344e68] hover:bg-[#ebe0d1]" href="/product/admin/dashboard">
            Dashboard
          </Link>
          <Link className="rounded-full px-3 py-2 text-[#344e68] hover:bg-[#ebe0d1]" href="/product/learn">
            Learner view
          </Link>
        </nav>
      </div>
    </header>
  );
}
