# PolicyPilot

PolicyPilot is a greenfield Next.js + Supabase enterprise EdTech product that converts AI policy documents into role-based compliance training workflows.

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

Set values for:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ATTESTATION_SIGNING_SECRET`
- optional `OPENAI_API_KEY` and `RESEND_API_KEY`

3. Run database migration in Supabase SQL editor:

- `supabase/migrations/20260218_edtech_v1.sql`

4. Start development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Routes

- Marketing: `/`, `/pilot`, `/security`, `/roi`
- Product: `/product/auth`, `/product/admin/*`, `/product/learn/*`
- API: `/api/orgs/*` and `/api/me/*`

## Scripts

- `npm run lint`
- `npm run test`
- `npm run test:coverage`
- `npm run test:e2e`

## Documentation

See `/docs/edtech`:

- `PRD.md`
- `ARCHITECTURE.md`
- `API.md`
- `SECURITY.md`
- `OPERATIONS.md`
- `DESIGN-SYSTEM.md`

## Notes

- If `OPENAI_API_KEY` is unset, generation uses deterministic fallback content.
- If `RESEND_API_KEY` is unset, invite/reminder sends are logged and skipped.
