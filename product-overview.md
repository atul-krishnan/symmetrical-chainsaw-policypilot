**Product**
PolicyPilot is an enterprise web platform that turns internal AI policy documents into deployable compliance training programs.

It lets teams:
- Upload policy docs (`pdf/docx/txt`)
- Auto-generate role-based learning tracks (`exec`, `builder`, `general`)
- Publish assignments and send reminders
- Track quiz completion and pass/fail
- Capture employee attestation
- Export audit evidence (CSV + signed PDF)

**Value Proposition**
Core promise: **“From AI policy docs to role-ready training in under 45 minutes.”**

Why enterprises buy it:
- **Speed:** replaces manual policy-to-training work that normally takes days/weeks.
- **Role relevance:** different content for leaders, technical builders, and general staff improves completion quality.
- **Audit readiness:** structured evidence trail for completions, attempts, attestations, and exports.
- **Risk reduction:** consistent policy communication and measurable proof of adoption.
- **Operational simplicity:** one system for policy ingestion, training rollout, and compliance reporting.


-----

Feature Set Needed (Detailed) for PolicyPilot

Multi-tenant workspace + org model (P0)
Organizations, members, and strict org isolation.
Roles: owner, admin, manager, learner.
Org-aware routing and auto org selection.
No-org access state with actionable next step.
Value: lets one platform safely serve many enterprise customers.
Authentication and authorization (P0)
Magic link + Google OAuth only.
Role-based access checks on every admin endpoint/page.
Session handling, sign-out, and protected routes.
Value: enterprise-safe access with minimal onboarding friction.
Policy ingestion pipeline (P0)
Upload pdf/docx/txt.
MIME-extension consistency checks, filename sanitization, size limits.
Store files under org-scoped paths.
Parse status lifecycle: pending, ready, failed.
Value: reliable intake of policy source material.
Policy obligation extraction (P0)
Convert policy text into structured obligations.
Severity and role-track tagging (exec, builder, general).
Human-reviewable records in DB.
Value: transforms legal/policy text into training-ready units.
AI campaign generation (P0)
Generate campaign draft from selected policies.
Output modules + quizzes per role track.
Strict schema validation (Zod + JSON contract).
Generation failure handling and retry behavior.
Value: cuts weeks of manual L&D authoring to minutes.
Campaign editor and lifecycle (P0)
Edit module copy, pass scores, quiz questions.
Draft -> Publish lifecycle.
Publish idempotency and replay-safe behavior.
Assignment creation on publish.
Value: controlled rollout and safe operations under retry/failure conditions.
Learner delivery experience (P0)
Assignment inbox.
Module consumption flow with progress UX.
Quiz attempt submit, scoring, pass/fail.
Attestation completion per campaign.
Value: measurable completion and policy acknowledgment.
Role-safe content exposure (P0)
Learners cannot receive correctChoiceIndex.
Managers/admin/owners can access answer keys for review.
Value: prevents answer leakage and preserves training integrity.
Dashboards and pilot KPIs (P0)
Completion rate and attestation rate at org/campaign level.
Breakdown by track and assignment state.
“At-risk” learners and overdue visibility.
Value: directly supports pilot success metrics.
Audit evidence and exports (P0)
CSV audit export.
Signed PDF summary with checksum (ATTESTATION_SIGNING_SECRET).
Export verification headers.
Value: compliance evidence for legal/audit stakeholders.
Notifications and reminders (P0)
Invite/publish emails and reminder nudges.
Dedup logic to avoid duplicate sends.
Optional Idempotency-Key support on nudge route.
Value: improves completion without admin micromanagement.
Observability and audit logs (P0)
Structured logs with request_id, org_id, user_id, route, status, latency.
Event taxonomy for key product actions.
Request audit records across API flows.
Value: fast incident debugging and traceable compliance operations.
Security controls (P0)
RLS on all tenant tables.
Boundary validation for all payloads.
Rate limiting on high-risk endpoints.
No secrets in code, environment-only configuration.
Value: protects enterprise data and reduces pilot security risk.
Reliability and release gates (P0)
CI pipeline: lint -> test -> build -> e2e smoke.
Live staging smoke script for end-to-end API validation.
Preflight command for env + migration + smoke checks.
Value: prevents broken builds from reaching pilot users.
Enterprise-grade UI/UX layer (P0)
High-quality marketing + product shell.
Responsive nav and mobile-complete workflows.
Accessibility, reduced-motion support, clear action-oriented copy.
Value: lower onboarding friction and better enterprise trust.
Documentation and runbooks (P0)
PRD, architecture, API, security, operations, design system.
Step-by-step platform walkthrough and pilot runbook.
Value: faster handoff, support and customer onboarding.

Post-pilot (P1, not required for immediate release)

SAML/SSO, SCIM.
LMS integrations.
Advanced analytics and benchmarking.
Multi-language generation.
Fine-grained policy version diffing.