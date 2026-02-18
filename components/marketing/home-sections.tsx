"use client";

import gsap from "gsap";
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Gauge,
  Quote,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useRef } from "react";

import { ButtonLink } from "@/components/ui/button-link";

const PILLARS = [
  {
    icon: BookOpenCheck,
    title: "Policy to publish",
    body: "Turn policy obligations into structured learning modules without manual re-authoring.",
  },
  {
    icon: UsersRound,
    title: "Role relevance",
    body: "Separate tracks for executives, builders, and general employees with role-appropriate language.",
  },
  {
    icon: Gauge,
    title: "Operational speed",
    body: "Generate, review, publish, and nudge in one workflow designed for lean L&D teams.",
  },
  {
    icon: AlertTriangle,
    title: "Audit readiness",
    body: "Capture quiz outcomes and attestation checksums with export packages legal teams can verify.",
  },
];

const STEPS = [
  {
    label: "Upload",
    description: "Import AI policy docs (PDF, DOCX, TXT) into your secure org workspace.",
  },
  {
    label: "Generate",
    description: "Create role-based modules and quizzes from obligations with human review before publish.",
  },
  {
    label: "Publish",
    description: "Assign campaigns, send reminders, and track completion + attestation rates in real time.",
  },
  {
    label: "Export",
    description: "Download CSV and signed PDF evidence bundles for internal and external compliance checks.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "PolicyPilot helped us convert 62 pages of AI governance guidance into role-specific training modules in under one afternoon.",
    name: "Elena Morris",
    title: "Head of Compliance",
    company: "Finory Bank",
    impact: "98% completion in 21 days",
    initials: "EM",
  },
  {
    quote:
      "The lineage view made it clear where each policy clause landed, so our legal reviewers approved the campaign on the first pass.",
    name: "Ravi Patel",
    title: "Security Program Director",
    company: "Northbyte Systems",
    impact: "Audit prep reduced by 43%",
    initials: "RP",
  },
  {
    quote:
      "Our team finally had one evidence bundle for leadership, HR, and auditors. No manual spreadsheet stitching anymore.",
    name: "Jordan Lee",
    title: "L&D Operations Lead",
    company: "Vantage Health",
    impact: "Signed evidence in 30 seconds",
    initials: "JL",
  },
];

const OPERATING_MODEL = [
  {
    icon: Clock3,
    title: "Week 1",
    body: "Policy upload, obligation extraction, legal calibration, and first campaign draft.",
  },
  {
    icon: CheckCircle2,
    title: "Week 2 to 4",
    body: "Publish to workforce, monitor completion, run nudge cadence, and adjust copy where needed.",
  },
  {
    icon: FileCheck2,
    title: "Week 5 to 6",
    body: "Finalize attestations and export evidence packs for security reviews and customer audit requests.",
  },
];

const FAQS = [
  {
    q: "How quickly can an enterprise launch a pilot?",
    a: "Most teams launch their first campaign in under one week. The first 48 hours are usually policy ingestion and review alignment.",
  },
  {
    q: "Do we need LMS or SCIM integration to start?",
    a: "No. For MVP pilots, PolicyPilot runs as a standalone workspace with magic-link and Google authentication.",
  },
  {
    q: "What evidence do compliance teams get?",
    a: "CSV audit rows, signed PDF summaries, per-user assignment states, quiz outcomes, and checksum metadata for verification.",
  },
];

export function HomeSections() {
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
        ".home-reveal",
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.75, ease: "power3.out", stagger: 0.09 },
      );
      gsap.fromTo(
        ".home-image-float",
        { y: 0 },
        { y: -9, repeat: -1, yoyo: true, duration: 4, ease: "sine.inOut", stagger: 0.25 },
      );
      gsap.fromTo(
        ".testimonial-card",
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.72, ease: "power3.out", delay: 0.38, stagger: 0.12 },
      );
    }, wrapperRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className="space-y-10 pb-24" ref={wrapperRef}>
      <section className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 rounded-[2.1rem] surface-card p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
          <div>
            <p className="home-reveal text-xs font-semibold uppercase tracking-[0.22em] text-[#5e77a0]">Messaging pillars</p>
            <h2 className="home-reveal mt-3 max-w-3xl font-display text-4xl text-[#10244a] sm:text-5xl">
              Built for legal, security, and L&D teams that need one source of truth
            </h2>
            <div className="mt-7 grid gap-4 md:grid-cols-2">
              {PILLARS.map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <article className="home-reveal rounded-2xl soft-chip p-5" key={pillar.title}>
                    <Icon className="h-5 w-5 text-[#1f5eff]" />
                    <h3 className="mt-3 font-display text-3xl text-[#112a55]">{pillar.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#4e6588]">{pillar.body}</p>
                  </article>
                );
              })}
            </div>
          </div>

          <aside className="home-reveal rounded-3xl border border-[#cedbee] bg-[linear-gradient(170deg,#f4f8ff_0%,#e6f0ff_52%,#f8fbff_100%)] p-4 shadow-[0_18px_42px_rgba(18,53,112,0.13)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4063a1]">Visual context</p>
            <h3 className="mt-2 font-display text-3xl text-[#133067]">Compliance operations snapshot</h3>
            <Image
              alt="Dashboard illustration showing role tracks, campaign health, and evidence export cards."
              className="home-image-float mt-4 w-full rounded-2xl border border-[#b9cceb] bg-white/90"
              height={620}
              priority={false}
              src="/marketing/compliance-ops.svg"
              width={920}
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <p className="rounded-xl border border-[#c7d8f0] bg-white/90 px-3 py-2 text-sm font-medium text-[#294a7a]">
                47 obligations mapped to learning modules
              </p>
              <p className="rounded-xl border border-[#c7d8f0] bg-white/90 px-3 py-2 text-sm font-medium text-[#294a7a]">
                3 role tracks published from one policy source
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 rounded-[2.1rem] border border-[#ccd9ed] bg-[#0f2d66] p-8 text-[#f3f7ff] shadow-[0_26px_58px_rgba(10,38,89,0.22)] lg:grid-cols-[1.2fr_0.8fr]">
          <div className="home-reveal">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8fc3ff]">Commercial package</p>
            <h2 className="mt-3 max-w-2xl font-display text-4xl sm:text-5xl">6-week paid pilot with measurable outcomes</h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#c8d9f8]">
              We focus on two outcomes your stakeholders will care about on day one: completion rate and attestation rate.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink className="bg-[#1f5eff] text-white hover:bg-[#154ee6]" href="/pilot">
                Pilot pricing and scope
              </ButtonLink>
              <ButtonLink className="border border-white/30 bg-white/8 text-white hover:bg-white/18" href="/roi">
                Estimate ROI
              </ButtonLink>
            </div>
          </div>

          <aside className="home-reveal rounded-2xl border border-white/18 bg-white/8 p-5 text-sm backdrop-blur-sm">
            <Image
              alt="Illustrated timeline of policy upload, generation, campaign launch, and evidence export."
              className="home-image-float w-full rounded-xl border border-white/25 bg-white/6"
              height={460}
              priority={false}
              src="/marketing/training-journey.svg"
              width={720}
            />
            <h3 className="font-display text-2xl">Pilot delivery path</h3>
            <ol className="mt-3 space-y-3 text-[#d8e5ff]">
              {STEPS.map((step) => (
                <li key={step.label}>
                  <p className="font-semibold text-white">{step.label}</p>
                  <p>{step.description}</p>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2.1rem] border border-[#ced9eb] bg-[linear-gradient(170deg,#eef5ff_0%,#f9fcff_100%)] p-8 shadow-[0_20px_48px_rgba(17,50,109,0.12)]">
          <p className="home-reveal text-xs font-semibold uppercase tracking-[0.22em] text-[#5675a8]">Product lineage map</p>
          <h2 className="home-reveal mt-3 max-w-4xl font-display text-4xl text-[#10244a] sm:text-5xl">
            One policy source branches into role tracks, campaign logic, and evidence outputs
          </h2>
          <p className="home-reveal mt-4 max-w-3xl text-sm leading-relaxed text-[#4f6588]">
            This tree makes the product flow explicit: ingest source guidance once, then branch into obligation modeling, role-focused delivery, and traceable outcomes.
          </p>

          <div className="home-reveal mt-7 overflow-hidden rounded-3xl border border-[#cad9f0] bg-white p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:p-4">
            <Image
              alt="Product lineage map showing one policy source branching into role tracks, campaign logic, and evidence outputs."
              className="w-full rounded-2xl border border-[#d5dfef]"
              height={1024}
              priority={false}
              src="/marketing/product-lineage-map.png"
              width={1536}
            />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <article className="home-reveal rounded-2xl border border-[#d5e0f2] bg-white/90 p-4">
              <h3 className="font-display text-2xl text-[#15366b]">1. Parse policy</h3>
              <p className="mt-1 text-sm text-[#4b6389]">Model obligations and control statements from a single canonical policy document.</p>
            </article>
            <article className="home-reveal rounded-2xl border border-[#d5e0f2] bg-white/90 p-4">
              <h3 className="font-display text-2xl text-[#15366b]">2. Branch by role</h3>
              <p className="mt-1 text-sm text-[#4b6389]">Generate separate learning tracks, quiz gates, and message copy for each persona.</p>
            </article>
            <article className="home-reveal rounded-2xl border border-[#d5e0f2] bg-white/90 p-4">
              <h3 className="font-display text-2xl text-[#15366b]">3. Prove outcomes</h3>
              <p className="mt-1 text-sm text-[#4b6389]">Trigger reminders, capture attestations, and export signed audit artifacts in one run.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[0.92fr_1.08fr]">
          <aside className="home-reveal rounded-[2rem] border border-[#cddbef] bg-white p-6 shadow-[0_16px_38px_rgba(17,51,107,0.1)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#5f79a4]">Testimonials</p>
            <h2 className="mt-3 font-display text-4xl text-[#10244a] sm:text-5xl">Teams report faster launch cycles with clearer governance</h2>
            <p className="mt-4 text-sm leading-relaxed text-[#4f6588]">
              Customer feedback highlights the same pattern: lower authoring effort, faster reviewer sign-off, and a cleaner path to audit-ready evidence.
            </p>
            <Image
              alt="Illustration of training and compliance stakeholders sharing positive feedback."
              className="home-image-float mt-5 w-full rounded-2xl border border-[#bfd2ee]"
              height={420}
              priority={false}
              src="/marketing/team-trust.svg"
              width={640}
            />
          </aside>

          <div className="grid gap-4">
            {TESTIMONIALS.map((item) => (
              <article className="testimonial-card rounded-2xl border border-[#d3deef] bg-white p-5 shadow-[0_10px_26px_rgba(16,43,94,0.08)]" key={item.name}>
                <Quote className="h-5 w-5 text-[#2a63e8]" />
                <p className="mt-3 text-sm leading-relaxed text-[#3f5f8e]">&ldquo;{item.quote}&rdquo;</p>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#bfd0ed] bg-[#eef4ff] text-sm font-semibold text-[#1f4eb7]">
                      {item.initials}
                    </div>
                    <div>
                      <p className="font-semibold text-[#163468]">{item.name}</p>
                      <p className="text-xs text-[#5a739d]">
                        {item.title}, {item.company}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full border border-[#c2d4f2] bg-[#edf4ff] px-3 py-1 text-xs font-semibold text-[#1f55ca]">
                    {item.impact}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="home-reveal rounded-[2rem] border border-[#c9d8f0] bg-white p-6 shadow-[0_16px_38px_rgba(15,45,98,0.11)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#5b77a5]">Operating cadence</p>
            <h2 className="mt-3 max-w-2xl font-display text-4xl text-[#10244a] sm:text-5xl">
              What enterprise rollout looks like in practice
            </h2>
            <div className="mt-6 space-y-3">
              {OPERATING_MODEL.map((item) => {
                const Icon = item.icon;
                return (
                  <div className="rounded-xl soft-chip p-4" key={item.title}>
                    <div className="flex items-center gap-2 text-[#1f54cf]">
                      <Icon className="h-4 w-4" />
                      <p className="text-sm font-semibold uppercase tracking-[0.14em]">{item.title}</p>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-[#4e6488]">{item.body}</p>
                  </div>
                );
              })}
            </div>
          </article>

          <aside className="home-reveal ink-panel rounded-[2rem] p-5">
            <Image
              alt="Pilot playbook illustration showing weekly operating rhythm across stakeholders."
              className="home-image-float w-full rounded-2xl border border-white/30"
              height={540}
              priority={false}
              src="/marketing/pilot-playbook.svg"
              width={820}
            />
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <p className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm">
                Daily completion snapshot for managers
              </p>
              <p className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm">
                Weekly evidence review for compliance
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-[#cddcf0] bg-white p-8 shadow-[0_14px_36px_rgba(16,45,95,0.1)]">
          <p className="home-reveal text-xs font-semibold uppercase tracking-[0.22em] text-[#5d78a4]">FAQ</p>
          <h2 className="home-reveal mt-3 max-w-3xl font-display text-4xl text-[#10244a] sm:text-5xl">
            Questions enterprise buyers ask before pilot kickoff
          </h2>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {FAQS.map((item) => (
              <article className="home-reveal rounded-xl soft-chip p-4" key={item.q}>
                <h3 className="text-base font-semibold text-[#15386f]">{item.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#4e6588]">{item.a}</p>
              </article>
            ))}
          </div>

          <div className="home-reveal mt-7 rounded-2xl border border-[#c6d7f3] bg-[linear-gradient(135deg,#eff5ff,#f9fcff)] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#5f79a5]">Next step</p>
            <p className="mt-2 max-w-2xl font-display text-3xl text-[#10244a]">
              Bring one policy pack and one pilot org. We handle the operational path from there.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <ButtonLink className="bg-[#1f5eff] text-white hover:bg-[#154ee6]" href="/pilot">
                Review pilot deliverables
              </ButtonLink>
              <ButtonLink className="border border-[#cfdcf2] bg-white text-[#173363] hover:bg-[#f4f8ff]" href="/product/auth">
                Open workspace
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
