"use client";

import { CircleUserRound, LayoutGrid, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useOrgContext } from "@/lib/edtech/org-context";
import { cn } from "@/lib/utils";

function withOrg(path: string, orgId: string | null): string {
  if (!orgId) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}org=${orgId}`;
}

const NAV_ITEMS = [
  { href: "/product/admin/policies", label: "Policies" },
  { href: "/product/admin/campaigns", label: "Campaigns" },
  { href: "/product/admin/dashboard", label: "Dashboard" },
  { href: "/product/learn", label: "Learner" },
];

export function ProductNav() {
  const { memberships, selectedOrgId, selectedMembership, setSelectedOrgId, loading } = useOrgContext();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[#d7e0ee] bg-white/86 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link className="flex items-center gap-2" href="/product/admin/dashboard">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1f5eff] text-xs font-bold text-white">
            P
          </span>
          <span className="font-display text-2xl text-[#10244a]">PolicyPilot</span>
        </Link>

        <nav aria-label="Product" className="hidden flex-wrap items-center gap-2 text-sm lg:flex">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                className={cn(
                  "rounded-full px-3 py-2 font-semibold",
                  active
                    ? "bg-[#eaf0ff] text-[#1b4ed7]"
                    : "text-[#3e5579] hover:bg-[#f0f5ff] hover:text-[#132d61]",
                )}
                href={withOrg(item.href, selectedOrgId)}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {loading ? (
            <span className="text-xs text-[#5e769d]">Loading workspace...</span>
          ) : memberships.length > 1 ? (
            <label className="flex items-center gap-2 text-xs text-[#4f6486]">
              <LayoutGrid className="h-3.5 w-3.5" />
              <select
                className="h-9 rounded-xl border border-[#d3ddec] bg-white px-2 text-sm text-[#10243e]"
                onChange={(event) => setSelectedOrgId(event.target.value)}
                value={selectedOrgId ?? ""}
              >
                <option value="" disabled>
                  Select org
                </option>
                {memberships.map((membership) => (
                  <option key={membership.orgId} value={membership.orgId}>
                    {membership.orgName} ({membership.role})
                  </option>
                ))}
              </select>
            </label>
          ) : selectedMembership ? (
            <span className="rounded-full border border-[#d6e0ef] bg-[#f7faff] px-3 py-1 text-xs text-[#4f6486]">
              {selectedMembership.orgName} ({selectedMembership.role})
            </span>
          ) : null}

          <Link
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d3ddec] bg-white text-[#203a68] hover:bg-[#f4f8ff]"
            href="/product/auth"
          >
            <CircleUserRound className="h-4 w-4" />
          </Link>
        </div>

        <button
          aria-expanded={open}
          aria-label="Toggle product navigation"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#d7e0ee] text-[#203a68] lg:hidden"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      <div
        className={cn(
          "border-t border-[#d7e0ee] bg-white/96 px-4 py-4 lg:hidden",
          open ? "block" : "hidden",
        )}
      >
        <nav aria-label="Mobile product" className="space-y-2">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                className={cn(
                  "block rounded-xl px-3 py-2 text-sm font-semibold",
                  active
                    ? "bg-[#eaf0ff] text-[#1b4ed7]"
                    : "text-[#3e5579] hover:bg-[#f0f5ff] hover:text-[#132d61]",
                )}
                href={withOrg(item.href, selectedOrgId)}
                key={item.href}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}

          {memberships.length > 1 ? (
            <label className="mt-2 block text-xs text-[#4f6486]">
              Workspace
              <select
                className="mt-1 h-10 w-full rounded-xl border border-[#d3ddec] bg-white px-2 text-sm text-[#10243e]"
                onChange={(event) => setSelectedOrgId(event.target.value)}
                value={selectedOrgId ?? ""}
              >
                <option value="" disabled>
                  Select org
                </option>
                {memberships.map((membership) => (
                  <option key={membership.orgId} value={membership.orgId}>
                    {membership.orgName} ({membership.role})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
