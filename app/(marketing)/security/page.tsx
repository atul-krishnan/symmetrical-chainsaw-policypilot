import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security",
  description: "Security and privacy controls for PolicyPilot deployments.",
};

export default function SecurityPage() {
  return (
    <section className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl rounded-[2rem] border border-[#ccbfae] bg-[#fff8ef] p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#60738a]">Security posture</p>
        <h1 className="mt-3 font-display text-5xl text-[#10243e]">Secure by default architecture</h1>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-[#d6cabd] bg-[#f5ede2] p-4 text-sm text-[#455b73]">
            <h2 className="font-display text-2xl text-[#13253f]">Access controls</h2>
            <p className="mt-2">Role-gated APIs, organization-scoped tenancy, and Supabase row-level security on all core tables.</p>
          </article>
          <article className="rounded-xl border border-[#d6cabd] bg-[#f5ede2] p-4 text-sm text-[#455b73]">
            <h2 className="font-display text-2xl text-[#13253f]">Boundary validation</h2>
            <p className="mt-2">All payloads and AI outputs are schema-validated using Zod before persistence or workflow execution.</p>
          </article>
          <article className="rounded-xl border border-[#d6cabd] bg-[#f5ede2] p-4 text-sm text-[#455b73]">
            <h2 className="font-display text-2xl text-[#13253f]">Evidence integrity</h2>
            <p className="mt-2">Attestations and PDF summaries include checksum signatures for verifiable audit evidence.</p>
          </article>
          <article className="rounded-xl border border-[#d6cabd] bg-[#f5ede2] p-4 text-sm text-[#455b73]">
            <h2 className="font-display text-2xl text-[#13253f]">Operational telemetry</h2>
            <p className="mt-2">Structured logs include request, org, and user identifiers to accelerate production incident triage.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
