# Architecture

## Runtime

- Next.js App Router serving UI and API routes
- Supabase service-role client for backend operations
- Supabase auth token validation per API request

## Bounded contexts

- `lib/edtech`: policy parsing, campaign generation, grading, attestation, exports, notifications
- `lib/observability`: structured logs and request context
- `lib/api`: error model and route wrappers

## Data model

Primary entities:

- organizations, organization_members
- policy_documents, policy_obligations
- learning_campaigns, learning_modules, quiz_questions
- assignments, module_attempts, attestations
- audit_exports, notification_jobs, request_audit_logs

## Security model

- Role-gated API actions (`owner/admin/manager/learner`)
- RLS enabled for all tenant tables
- Input and output validation with Zod
- HMAC checksum on attestation and export evidence
