import { AlertTriangle, BookOpenCheck, Gauge, UsersRound } from "lucide-react";

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

export function HomeSections() {
  return (
    <div className="space-y-10 pb-24">
      <section className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2.1rem] surface-card p-8 lg:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#5e77a0]">Messaging pillars</p>
          <h2 className="mt-3 max-w-3xl font-display text-4xl text-[#10244a] sm:text-5xl">
            Built for legal, security, and L&D teams that need one source of truth
          </h2>
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <article className="rounded-2xl soft-chip p-5" key={pillar.title}>
                  <Icon className="h-5 w-5 text-[#1f5eff]" />
                  <h3 className="mt-3 font-display text-3xl text-[#112a55]">{pillar.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#4e6588]">{pillar.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 rounded-[2.1rem] border border-[#ccd9ed] bg-[#0f2d66] p-8 text-[#f3f7ff] shadow-[0_26px_58px_rgba(10,38,89,0.22)] lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8fc3ff]">Commercial package</p>
            <h2 className="mt-3 max-w-2xl font-display text-4xl sm:text-5xl">6-week paid pilot with measurable outcomes</h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#c8d9f8]">
              We focus on two outcomes your stakeholders will care about on day one: completion rate and attestation rate.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink className="bg-[#1f5eff] text-white hover:bg-[#154ee6]" href="/pilot">
                Review pilot scope
              </ButtonLink>
              <ButtonLink className="border border-white/30 bg-white/8 text-white hover:bg-white/18" href="/roi">
                Estimate ROI
              </ButtonLink>
            </div>
          </div>

          <aside className="rounded-2xl border border-white/18 bg-white/8 p-5 text-sm backdrop-blur-sm">
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
    </div>
  );
}
