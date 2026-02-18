# Operations Guide

## Setup

1. Configure `.env.local`
2. Run SQL migration from `supabase/migrations/20260218_edtech_v1.sql`
3. Seed initial organization and membership rows

## Observability

- Use request IDs to correlate API and export events
- Review `request_audit_logs` table for operational history

## Common runbooks

### Policy upload failures

- Verify storage bucket `policy-files` exists
- Verify MIME and size constraints
- Check parser compatibility for scanned PDFs

### Campaign publish failures

- Ensure campaign is in `draft` status
- Ensure modules exist
- Ensure org has eligible members

### Email not sending

- Confirm `RESEND_API_KEY` and `RESEND_FROM_EMAIL`
- Check notification_jobs for send status
