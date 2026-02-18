"use client";

import gsap from "gsap";
import { CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";

import { ButtonLink } from "@/components/ui/button-link";

export function HeroSection() {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wrapperRef.current) {
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".hero-reveal",
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8, stagger: 0.06, ease: "power3.out" },
      );
    }, wrapperRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className="px-4 pb-12 pt-14 sm:px-6 lg:px-8" ref={wrapperRef}>
      <div className="mx-auto max-w-7xl rounded-[2rem] border border-[#ccbfae] bg-[#fff8ef] p-8 shadow-[0_24px_60px_rgba(15,34,56,0.12)] lg:p-12">
        <p className="hero-reveal inline-flex items-center gap-2 rounded-full border border-[#b9cfc8] bg-[#e7f5f2] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0f5f5d]">
          <Sparkles className="h-3.5 w-3.5" />
          Enterprise AI Compliance L&D
        </p>

        <h1 className="hero-reveal mt-5 max-w-4xl font-display text-4xl leading-[1.03] text-[#10243e] sm:text-5xl lg:text-7xl">
          From AI policy docs to role-ready training in under 45 minutes
        </h1>

        <p className="hero-reveal mt-5 max-w-2xl text-base leading-relaxed text-[#475e78]">
          Upload your policy once. Publish role-specific modules, quizzes, and attestations with audit-ready exports for legal and security review.
        </p>

        <div className="hero-reveal mt-7 flex flex-wrap gap-3">
          <ButtonLink className="bg-[#0e8c89] text-white hover:bg-[#0c7472]" href="/product/auth">
            Launch Pilot Workspace
          </ButtonLink>
          <ButtonLink className="border border-[#c4b7a6] bg-[#f4e9da] text-[#10243e] hover:bg-[#efe0cd]" href="/pilot">
            View 6-Week Pilot
          </ButtonLink>
        </div>

        <div className="hero-reveal mt-8 grid gap-3 text-sm text-[#314a65] sm:grid-cols-3">
          <p className="rounded-xl border border-[#d6c9b8] bg-[#fdf6ec] px-4 py-3">
            <ShieldCheck className="mb-2 h-4 w-4" />
            Policy-first generation with strict schemas
          </p>
          <p className="rounded-xl border border-[#d6c9b8] bg-[#fdf6ec] px-4 py-3">
            <CheckCircle2 className="mb-2 h-4 w-4" />
            Completion + attestation tracking per role
          </p>
          <p className="rounded-xl border border-[#d6c9b8] bg-[#fdf6ec] px-4 py-3">
            <CheckCircle2 className="mb-2 h-4 w-4" />
            CSV and signed PDF evidence exports
          </p>
        </div>
      </div>
    </section>
  );
}
