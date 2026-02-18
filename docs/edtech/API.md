# API Reference

All errors return:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "...",
    "requestId": "..."
  }
}
```

## Org APIs

- `POST /api/orgs/[orgId]/policies`
- `GET /api/orgs/[orgId]/policies`
- `POST /api/orgs/[orgId]/campaigns/generate`
- `PUT /api/orgs/[orgId]/campaigns/[campaignId]`
- `POST /api/orgs/[orgId]/campaigns/[campaignId]/publish`
- `POST /api/orgs/[orgId]/campaigns/[campaignId]/nudges/send`
- `GET /api/orgs/[orgId]/dashboard`
- `GET /api/orgs/[orgId]/exports/[campaignId].csv`
- `GET /api/orgs/[orgId]/exports/[campaignId].pdf`

## User APIs

- `GET /api/me/assignments`
- `POST /api/me/modules/[moduleId]/attempts`
- `POST /api/me/campaigns/[campaignId]/attest`

## Auth

All API calls require `Authorization: Bearer <supabase_access_token>`.
