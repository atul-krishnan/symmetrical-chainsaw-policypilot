# Operations Guide

## Environment matrix

### Staging

- Purpose: CI validation + external smoke validation
- Required variables:
  - `STAGING_SUPABASE_URL`
  - `STAGING_SUPABASE_ANON_KEY`
  - `STAGING_SUPABASE_SERVICE_ROLE_KEY`
  - `STAGING_APP_URL` (hosted URL only; no localhost)
  - `STAGING_SMOKE_ACCESS_TOKEN`
  - `STAGING_SMOKE_ORG_ID`

### Pilot

- Purpose: customer-facing release candidate
- Required variables:
  - `PILOT_SUPABASE_URL`
  - `PILOT_SUPABASE_ANON_KEY`
  - `PILOT_SUPABASE_SERVICE_ROLE_KEY`
  - `PILOT_APP_URL`
  - `PILOT_SMOKE_ACCESS_TOKEN`
  - `PILOT_SMOKE_ORG_ID`
- Pilot smoke is enabled with `RUN_PILOT_SMOKE=true`.

## Release gates

Run before pilot onboarding:

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
npm run pilot:preflight
```

`npm run pilot:preflight` returns machine-readable JSON and validates:

- env matrix presence
- hosted staging URL policy
- placeholder credential guard for pilot env values
- migration/table availability in staging and pilot Supabase
- staging live smoke flow
- optional pilot live smoke flow
- report archive output at `output/preflight/pilot-preflight-*.json`

## Security rotation runbook

1. Revoke exposed Supabase PAT in Supabase account settings.
2. Generate a new PAT and store it only in your secret manager.
3. Rotate staging smoke token with:

```bash
npm run smoke:token -- --env staging --email <staging-user-email> --password <staging-user-password> --org-id <staging-org-id>
```

4. Rotate pilot smoke token with:

```bash
npm run smoke:token -- --env pilot --email <pilot-user-email> --password <pilot-user-password> --org-id <pilot-org-id>
```

5. Replace old tokens in deployment env vars and verify old tokens fail.

## Pilot provisioning runbook

1. Create or confirm the pilot Supabase project.
2. Apply migrations in order:
   - `supabase/migrations/20260218_edtech_v1.sql`
   - `supabase/migrations/20260219_edtech_learning_flow_v2.sql`
   - `supabase/migrations/20260220_edtech_controls_integrations.sql`
   - `supabase/migrations/20260221_edtech_adoption_intelligence.sql`
3. Reload PostgREST schema cache:

```sql
NOTIFY pgrst, 'reload schema';
```

4. Set pilot environment variables and run:

```bash
RUN_PILOT_SMOKE=true npm run pilot:preflight
```

## Deployment flow (Vercel)

1. Authenticate once:

```bash
npx vercel@50.18.2 login
```

2. Link project (first run only):

```bash
npx vercel@50.18.2 link
```

3. Deploy preview:

```bash
npm run deploy:preview
```

4. Promote production after release gates are green:

```bash
npm run deploy:prod
```

## Live smoke flow

`npm run smoke:live` validates:

1. Authenticated org-membership fetch
2. Policy upload
3. Campaign generation
4. Publish
5. Learner assignment fetch
6. Quiz attempt
7. Attestation submit
8. CSV/PDF export headers + evidence checksum

Script output is JSON for release automation.

## Demo proof-path seeding

Use this script to prepare a deterministic showcase scenario (stale control + intervention recommendation + evidence lineage):

```bash
npm run seed:demo-proof
```

## Runbooks

### Failed publish recovery

1. Retry `POST /api/orgs/[orgId]/campaigns/[campaignId]/publish` with `Idempotency-Key`.
2. Confirm returned `alreadyPublished` state.
3. Verify assignment counts in dashboard and `assignments` table.

### Reminder resend safety

1. Use `POST .../nudges/send` with `Idempotency-Key`.
2. Verify `deduplicatedCount` and `sentCount` response values.
3. Confirm inserts in `notification_jobs`.

### Export verification

1. Download CSV and PDF exports.
2. Validate `x-evidence-checksum` response header.
3. Confirm `audit_exports` and `request_audit_logs` entries.

### Onboarding support

1. Verify the user appears in `organization_members`.
2. Confirm `GET /api/me/org-memberships` returns expected org(s).
3. For multi-org users, validate explicit org selection in product nav.

## Rollback notes

- Keep latest migration SQL and seed snapshots for both environments.
- If release regression occurs, disable pilot traffic and redeploy prior Vercel build.
- Re-run `npm run smoke:live` against staging before any re-promotion.
