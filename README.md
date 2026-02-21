# PolicyPilot

PolicyPilot is a Next.js + Supabase enterprise EdTech product that converts AI policy documents into role-based compliance training workflows.

## Core outcomes

- Upload AI policy documents (PDF, DOCX, TXT)
- Generate role-specific modules (`exec`, `builder`, `general`)
- Publish assignments and track learner completion
- Capture attestation evidence with checksums
- Export audit artifacts in CSV and signed PDF formats

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- Supabase (Auth, Postgres, Storage)
- OpenAI Responses API with strict schema output
- Resend email notifications
- Pino structured logging
- Vitest + Playwright test suites

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env.local
```

3. Run database migrations in Supabase SQL editor (in this order):

- `supabase/migrations/20260218_edtech_v1.sql`
- `supabase/migrations/20260219_edtech_learning_flow_v2.sql`
- `supabase/migrations/20260220_edtech_controls_integrations.sql`
- `supabase/migrations/20260221_edtech_adoption_intelligence.sql`

4. Start development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Product onboarding behavior

- Auth modes: Google OAuth, email/password sign-up + sign-in, and magic link access.
- Password recovery: from `/product/auth`, enter email and use **Forgot password?**, then complete reset at `/product/auth/reset`.
- Users load organization memberships from `GET /api/me/org-memberships`.
- Single-org users auto-select their org workspace.
- Multi-org users must explicitly choose a workspace in product navigation.
- Users with no org membership see an actionable no-access page.
- Local/dev builds include a `Bootstrap owner access` helper for first-user setup.

## Scripts

- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:e2e`
- `npm run smoke:live`
- `npm run smoke:token`
- `npm run pilot:preflight`
- `npm run seed:demo-proof`
- `npm run deploy:preview`
- `npm run deploy:prod`

## Pilot hardening notes

- `publish` and `nudges/send` support optional `Idempotency-Key` headers.
- Publish endpoint is replay-safe and returns success for already-published campaigns.
- Policy upload validates MIME/extension consistency and sanitizes storage paths.
- Request audit logs persist idempotency key hash metadata.
- `pilot:preflight` enforces hosted staging URL policy and pilot placeholder-credential guards.
- `pilot:preflight` writes archived reports to `output/preflight/` by default.

## Documentation

See `/docs/edtech`:

- `PRD.md`
- `ARCHITECTURE.md`
- `API.md`
- `SECURITY.md`
- `OPERATIONS.md`
- `DESIGN-SYSTEM.md`
- `WALKTHROUGH.md`
- `SALES-CALL-PACK.md`
