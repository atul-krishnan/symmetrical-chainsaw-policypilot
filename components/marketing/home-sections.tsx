import { AlertTriangle, BookOpenCheck, Gauge, UsersRound } from "lucide-react";

import { ButtonLink } from "@/components/ui/button-link";

const PILLARS = [
  {
    icon: BookOpenCheck,
    title: "Policy to publish",
    body: "Convert dense policy text into practical modules, role by role.",
  },
  {
    icon: UsersRound,
    title: "Role relevance",
    body: "Separate learning tracks for executives, builders, and all other employees.",
  },
  {
    icon: Gauge,
    title: "Operational speed",
    body: "Publish campaigns fast, track completion, and send reminders in one workspace.",
  },
  {
    icon: AlertTriangle,
    title: "Audit readiness",
    body: "Produce evidence exports with signed summaries for compliance review.",
  },
];

export function HomeSections() {
  return (
    <div className="space-y-10 pb-24">
      <section className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-[#ccbfae] bg-[#f4ece0] p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#5a6c82]">Messaging pillars</p>
          <h2 className="mt-3 font-display text-4xl text-[#10243e] sm:text-5xl">Built for legal, security, and L&D alignment</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <article className="rounded-2xl border border-[#d5c9bc] bg-[#fff8ef] p-5" key={pillar.title}>
                  <Icon className="h-5 w-5 text-[#0e8c89]" />
                  <h3 className="mt-3 font-display text-3xl text-[#11243d]">{pillar.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#4e6278]">{pillar.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 rounded-[2rem] border border-[#ccbfae] bg-[#11243d] p-8 text-[#f6f0e8] lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8fc9c7]">Commercial package</p>
            <h2 className="mt-3 font-display text-4xl sm:text-5xl">6-week paid pilot with measurable outcomes</h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#c9d5e4]">
              We optimize for completion and attestation outcomes, with a clear path to annual deployment.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink className="bg-[#0e8c89] text-white hover:bg-[#0c7472]" href="/pilot">
                Review Scope
              </ButtonLink>
              <ButtonLink className="border border-white/20 bg-white/10 text-white hover:bg-white/20" href="/roi">
                Estimate ROI
              </ButtonLink>
            </div>
          </div>

          <aside className="rounded-2xl border border-white/20 bg-white/10 p-5 text-sm">
            <h3 className="font-display text-2xl">Pilot includes</h3>
            <ul className="mt-3 space-y-2 text-[#d8e3ee]">
              <li>Up to 500 learners</li>
              <li>3 role tracks</li>
              <li>1 active campaign</li>
              <li>CSV + signed PDF exports</li>
              <li>Weekly operational check-ins</li>
            </ul>
          </aside>
        </div>
      </section>
    </div>
  );
}
