import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security",
  description: "Security and privacy controls for PolicyPilot deployments.",
};

const SECURITY_ITEMS = [
  {
    title: "Access controls",
    body: "Role-gated APIs, org-scoped tenancy, and Supabase RLS across all production tables.",
  },
  {
    title: "Boundary validation",
    body: "Zod validation for request contracts and strict schema validation for AI-generated content.",
  },
  {
    title: "Evidence integrity",
    body: "HMAC-signed attestation artifacts and checksum headers on CSV/PDF exports.",
  },
  {
    title: "Operational telemetry",
    body: "Structured request logs with request_id, org_id, user_id, route, status_code, and latency_ms.",
  },
  {
    title: "Replay safety",
    body: "Optional Idempotency-Key handling on publish and nudge endpoints for safe retries.",
  },
  {
    title: "Storage hardening",
    body: "MIME-extension enforcement and sanitized storage paths for policy uploads.",
  },
];

export default function SecurityPage() {
  return (
    <section className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="rounded-[2rem] surface-card p-8 lg:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#5e77a0]">Security posture</p>
          <h1 className="mt-3 max-w-3xl font-display text-5xl text-[#10244a]">Secure by default architecture</h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[#4e6588]">
            PolicyPilot is designed for enterprise pilots where auditability, tenant isolation, and operational safety are mandatory.
          </p>

          <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {SECURITY_ITEMS.map((item) => (
              <article className="rounded-xl soft-chip p-4 text-sm text-[#455d82]" key={item.title}>
                <h2 className="font-display text-2xl text-[#132f61]">{item.title}</h2>
                <p className="mt-2">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
