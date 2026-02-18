# Security Controls

## Data protection

- Tenant isolation through org-scoped authorization and RLS
- Signed evidence checksums for attestations and PDF exports
- Storage bucket access policies restricted by org role

## Input safety

- Strict Zod validation for API payloads
- File type and size checks for uploads
- LLM output schema validation before persistence

## Abuse protection

- In-memory rate limits on generation/publish/nudge/attestation routes
- Request audit logs with status and error taxonomy

## Logging

Structured logs include:

- request_id
- route
- org_id
- user_id
- event
- status_code
- latency_ms
