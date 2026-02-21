# Platform Walkthrough

## 1. Local setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env.local
```

3. Run migrations in Supabase SQL editor (in this order):

- `supabase/migrations/20260218_edtech_v1.sql`
- `supabase/migrations/20260219_edtech_learning_flow_v2.sql`
- `supabase/migrations/20260220_edtech_controls_integrations.sql`
- `supabase/migrations/20260221_edtech_adoption_intelligence.sql`

4. Start app:

```bash
npm run dev
```

5. Open:

- `http://localhost:3000`

## 2. Sign in and workspace access

1. Open `/product/auth`.
2. Existing users can sign in with Google, email/password, or magic link.
3. New users without Google can use **Sign up** to create an email/password account.
4. If password is forgotten, use **Forgot password?** and complete reset at `/product/auth/reset`.
5. If user belongs to one org, workspace auto-selects.
6. If user belongs to multiple orgs, select org in top navigation.
7. If user has no org membership, follow the no-access guidance page.
8. In local/dev, you can use **Bootstrap owner access** on that page to self-assign owner role.

## 3. Role authorization behavior

- `learner`:
  - Can access learner pages
  - Cannot access manager/admin pages
- `manager`:
  - Can view policies/dashboard/campaign list
  - Cannot generate/edit/publish campaigns
- `admin` and `owner`:
  - Full admin workflow (upload, generate, edit, publish, reminders, exports)

## 4. Admin workflow (end-to-end)

1. Go to `/product/admin/policies`.
2. Upload policy file (PDF/DOCX/TXT).
3. Confirm parse status becomes `ready`.
4. Go to `/product/admin/campaigns`.
5. Select ready policy sources and generate draft campaign.
6. Open campaign editor and review modules/questions.
7. Save draft updates.
8. Publish campaign (supports idempotent retry semantics).
9. Monitor rollout in `/product/admin/dashboard`.

## 5. Learner workflow

1. Go to `/product/learn`.
2. Open assigned module.
3. Review learning material and acknowledge completion.
4. Submit quiz attempts.
5. Complete attestation.
6. Verify completion state in learner queue.

## 6. Evidence and operations

1. Generate CSV/PDF exports from org export APIs.
2. Validate `x-evidence-checksum` response headers.
3. Check `request_audit_logs` for traceability.
4. Use nudge send endpoint with optional `Idempotency-Key`.

## 7. Quality gates before release

Run in order:

```bash
npm run lint
npm run test
npm run build
npm run test:e2e:ci
npm run pilot:preflight
```

`pilot:preflight` verifies env matrix, hosted staging URL policy, migration state, and smoke checks.
Reports are archived to `output/preflight/`.

Run pilot smoke gate when pilot env is ready:

```bash
RUN_PILOT_SMOKE=true npm run pilot:preflight
```

## 8. Smoke token refresh

Use this before release demos whenever auth drift is suspected:

```bash
npm run smoke:token -- --env staging --email <email> --password <password> --org-id <org-id>
```
