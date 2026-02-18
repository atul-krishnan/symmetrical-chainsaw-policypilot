import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pilot Package",
  description: "6-week paid pilot package for enterprise AI compliance training rollout.",
};

export default function PilotPage() {
  return (
    <section className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl rounded-[2rem] border border-[#ccbfae] bg-[#fff8ef] p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#60738a]">Commercial offer</p>
        <h1 className="mt-3 font-display text-5xl text-[#10243e]">6-week paid pilot</h1>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[#4d6178]">
          Validate adoption and audit readiness with clear scope, fixed delivery cadence, and measurable completion outcomes.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-[#d5c9bb] bg-[#f7efe2] p-5">
            <h2 className="font-display text-3xl text-[#152740]">Included scope</h2>
            <ul className="mt-4 space-y-2 text-sm text-[#4e6178]">
              <li>Up to 500 learners</li>
              <li>3 default role tracks: exec, builder, general</li>
              <li>Policy upload and obligation extraction</li>
              <li>Campaign generation, publish, and reminders</li>
              <li>CSV and signed PDF evidence exports</li>
            </ul>
          </article>

          <article className="rounded-2xl border border-[#d5c9bb] bg-[#f7efe2] p-5">
            <h2 className="font-display text-3xl text-[#152740]">Success gates</h2>
            <ul className="mt-4 space-y-2 text-sm text-[#4e6178]">
              <li>At least 75% completion rate</li>
              <li>At least 90% attestation among completers</li>
              <li>Publishing in under 45 minutes per campaign</li>
              <li>Export artifact generation under 30 seconds</li>
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}
