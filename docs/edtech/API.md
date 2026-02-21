# API Reference

All API errors use this envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "...",
    "requestId": "..."
  }
}
```

## Auth

- All API calls require `Authorization: Bearer <supabase_access_token>`.
- Product admin endpoints also require org membership with sufficient role.

## User APIs

- `GET /api/me/org-memberships`
  - Returns `{ memberships: [{ orgId, orgName, role }] }`
- `POST /api/me/bootstrap-owner` (dev bootstrap)
  - Creates owner membership for signed-in user if they have no org memberships.
  - If no organizations exist, creates one and assigns owner role.
- `GET /api/me/assignments`
- `GET /api/me/assignments/[assignmentId]`
- `POST /api/me/assignments/[assignmentId]/acknowledge-material`
- `POST /api/me/modules/[moduleId]/attempts`
- `POST /api/me/campaigns/[campaignId]/attest`

## Org APIs

- `POST /api/orgs/[orgId]/policies`
- `GET /api/orgs/[orgId]/policies`
- `POST /api/orgs/[orgId]/campaigns/generate`
- `GET /api/orgs/[orgId]/campaigns/[campaignId]`
  - Learner responses hide `correctChoiceIndex`
- `PUT /api/orgs/[orgId]/campaigns/[campaignId]`
- `POST /api/orgs/[orgId]/campaigns/[campaignId]/modules/[moduleId]/quiz/regenerate`
- `POST /api/orgs/[orgId]/campaigns/[campaignId]/modules/[moduleId]/media`
- `POST /api/orgs/[orgId]/campaigns/[campaignId]/publish`
  - Idempotent success semantics. Replays return success with current state.
- `POST /api/orgs/[orgId]/campaigns/[campaignId]/nudges/send`
  - Deduplicates reminder sends in a 24-hour window per assignment.
- `GET /api/orgs/[orgId]/dashboard`
- `GET /api/orgs/[orgId]/adoption/freshness?window=`
- `GET /api/orgs/[orgId]/adoption/graph?controlId=&roleTrack=&window=`
- `GET /api/orgs/[orgId]/interventions?status=&controlId=`
- `POST /api/orgs/[orgId]/interventions/recommend`
- `POST /api/orgs/[orgId]/interventions/[interventionId]/approve`
- `POST /api/orgs/[orgId]/interventions/[interventionId]/execute`
- `GET /api/orgs/[orgId]/benchmarks?metric=&cohort=&window=`
- `GET /api/orgs/[orgId]/controls/[controlId]/lineage`
- `POST /api/orgs/[orgId]/audit-narratives/generate`
- `GET /api/orgs/[orgId]/exports/[campaignId].csv`
- `GET /api/orgs/[orgId]/exports/[campaignId].pdf`

## Idempotency

`publish` and `nudge send` support an optional `Idempotency-Key` request header.

- Keys are hashed server-side and persisted in request audit metadata.
- Replayed requests with the same key return the prior successful response envelope.
