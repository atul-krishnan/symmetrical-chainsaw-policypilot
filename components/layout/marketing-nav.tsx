"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ButtonLink } from "@/components/ui/button-link";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/pilot", label: "Pilot" },
  { href: "/security", label: "Security" },
  { href: "/roi", label: "ROI" },
  { href: "/product/admin/dashboard", label: "Dashboard" },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[#ccbfae] bg-[#f8f2e8]/90 backdrop-blur-lg">
      <div className="mx-auto flex h-18 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link className="font-display text-2xl text-[#11253e]" href="/">
          PolicyPilot
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              className="text-sm font-medium text-[#425770] hover:text-[#0f2238]"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
          <ButtonLink className="bg-[#0e8c89] text-white hover:bg-[#0b7572]" href="/product/auth">
            Start Pilot
          </ButtonLink>
        </nav>

        <button
          aria-expanded={open}
          aria-label="Toggle navigation"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#ccbfae] text-[#11253e] md:hidden"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      <div
        className={cn(
          "border-t border-[#ccbfae] bg-[#f8f2e8] px-4 py-4 md:hidden",
          open ? "block" : "hidden",
        )}
      >
        <nav aria-label="Mobile primary" className="space-y-2">
          {NAV_ITEMS.map((item) => (
            <Link
              className="block rounded-lg px-3 py-2 text-sm font-medium text-[#425770] hover:bg-[#eadfcf]"
              href={item.href}
              key={item.href}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <ButtonLink
            className="mt-2 w-full bg-[#0e8c89] text-center text-white"
            href="/product/auth"
          >
            Start Pilot
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}
