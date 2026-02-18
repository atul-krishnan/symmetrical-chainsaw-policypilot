"use client";

import { CircleUserRound, Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { ButtonLink } from "@/components/ui/button-link";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/pilot", label: "Pilot" },
  { href: "/security", label: "Security" },
  { href: "/roi", label: "ROI" },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-[#d7e0ee] bg-white/78 backdrop-blur-xl">
      <div className="mx-auto flex h-18 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link className="flex items-center gap-2" href="/">
          <Image
            alt="PolicyPilot logo"
            height={32}
            src="/logo.png"
            width={32}
          />
          <span className="font-display text-2xl text-[#10244a]">PolicyPilot</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-2 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold",
                  active
                    ? "bg-[#eaf0ff] text-[#1b4ed7]"
                    : "text-[#3e5579] hover:bg-[#f0f5ff] hover:text-[#132d61]",
                )}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d3ddec] bg-white text-[#203a68] hover:bg-[#f4f8ff]"
            href="/product/auth"
          >
            <CircleUserRound className="h-4 w-4" />
          </Link>
          <ButtonLink className="bg-[#1f5eff] text-white hover:bg-[#154ee6]" href="/product/auth">
            Login
          </ButtonLink>
        </div>

        <button
          aria-expanded={open}
          aria-label="Toggle navigation"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#d7e0ee] text-[#203a68] md:hidden"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      <div
        className={cn(
          "border-t border-[#d7e0ee] bg-white/96 px-4 py-4 md:hidden",
          open ? "block" : "hidden",
        )}
      >
        <nav aria-label="Mobile primary" className="space-y-2">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                className={cn(
                  "block rounded-xl px-3 py-2 text-sm font-semibold",
                  active
                    ? "bg-[#eaf0ff] text-[#1b4ed7]"
                    : "text-[#3e5579] hover:bg-[#f0f5ff] hover:text-[#132d61]",
                )}
                href={item.href}
                key={item.href}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}
          <ButtonLink
            className="mt-2 w-full bg-[#1f5eff] text-center text-white"
            href="/product/auth"
          >
            Login
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}
