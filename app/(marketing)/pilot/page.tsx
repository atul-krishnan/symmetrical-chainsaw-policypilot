import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pilot Package",
  description: "6-week paid pilot package for enterprise AI compliance training rollout.",
};

export default function PilotPage() {
  return (
    <section className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="rounded-[2rem] surface-card p-8 lg:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#5e77a0]">Commercial offer</p>
          <h1 className="mt-3 max-w-3xl font-display text-5xl text-[#10244a]">6-week paid pilot</h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[#4d6385]">
            Validate adoption and audit readiness with fixed scope, explicit gates, and daily operational visibility.
          </p>

          <div className="mt-7 grid gap-4 lg:grid-cols-3">
            <article className="rounded-2xl soft-chip p-5">
              <h2 className="font-display text-3xl text-[#122d5b]">Scope</h2>
              <ul className="mt-4 space-y-2 text-sm text-[#4e6487]">
                <li>Up to 500 learners</li>
                <li>3 role tracks: exec, builder, general</li>
                <li>Policy ingestion + campaign generation</li>
                <li>Publish, reminders, completion tracking</li>
              </ul>
            </article>

            <article className="rounded-2xl soft-chip p-5">
              <h2 className="font-display text-3xl text-[#122d5b]">Success gates</h2>
              <ul className="mt-4 space-y-2 text-sm text-[#4e6487]">
                <li>75%+ completion rate</li>
                <li>90%+ attestation among completers</li>
                <li>Campaign publish under 45 minutes</li>
                <li>Export generation under 30 seconds</li>
              </ul>
            </article>

            <article className="rounded-2xl border border-[#c8d7ef] bg-[#0f2d66] p-5 text-sm text-[#d4e3ff]">
              <h2 className="font-display text-3xl text-white">What you get</h2>
              <ul className="mt-4 space-y-2">
                <li>Staging + pilot rollout checklist</li>
                <li>Runbooks for publish/reminder/export operations</li>
                <li>Release-gate evidence in machine-readable JSON</li>
                <li>Weekly implementation check-ins</li>
              </ul>
            </article>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              className="inline-flex items-center rounded-full bg-[#1f5eff] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#154ee6]"
              href="/product/auth"
            >
              Start pilot onboarding
            </Link>
            <Link
              className="inline-flex items-center rounded-full border border-[#d2ddef] bg-white px-5 py-2.5 text-sm font-semibold text-[#163162] hover:bg-[#f4f8ff]"
              href="/security"
            >
              Review security posture
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
