# Product Page Map (Current Build)

This is a plain-English guide to each page, who it is for, and why it exists.

## Marketing pages

### `/`
- Purpose: Main product story and value proposition.
- Audience: Prospects and first-time visitors.
- Use: Explains the problem and solution at a high level.

### `/pilot`
- Purpose: Pilot packaging and delivery model.
- Audience: Buyers evaluating a paid pilot.
- Use: Shows timeline, gates, and expected outcomes.

### `/roi`
- Purpose: ROI framing.
- Audience: Budget owner, procurement, finance-influencing stakeholders.
- Use: Compares manual workflow vs PolicyPilot workflow.

### `/security`
- Purpose: Security and trust posture.
- Audience: Security, IT, procurement, legal.
- Use: Summarizes access control, isolation, evidence integrity, and operational controls.

## Product shell

### `/product`
- Purpose: Product entry redirect.
- Audience: Signed-in users.
- Use: Sends users to admin dashboard (with org context when present).

### `/product/auth`
- Purpose: Authentication entry.
- Audience: All users.
- Use: Sign in to access workspaces.

### `/product/auth/reset`
- Purpose: Password recovery.
- Audience: Users needing account recovery.
- Use: Reset credentials and restore access.

## Admin pages

### `/product/admin/dashboard`
- Purpose: Compliance command overview.
- Audience: Manager/Admin/Owner.
- Use: Tracks campaign metrics, control coverage, freshness KPI, risk hotspots, and intervention queue.

### `/product/admin/policies`
- Purpose: Policy intake.
- Audience: Manager/Admin/Owner (upload action restricted by role).
- Use: Upload policy files (PDF/DOCX/TXT), parse, and prepare for campaign generation.

### `/product/admin/campaigns`
- Purpose: Campaign creation and list view.
- Audience: Manager/Admin/Owner.
- Use: Generate draft campaigns from parsed policies, then open specific campaign editor.

### `/product/admin/campaigns/[campaignId]`
- Purpose: Campaign editor.
- Audience: Admin/Owner primarily.
- Use:
  - Review/edit generated learning content.
  - Attach media to module suggestion slots.
  - Regenerate quiz from finalized module material.
  - Publish campaign.

### `/product/admin/controls`
- Purpose: Controls and evidence operations.
- Audience: Manager/Admin/Owner.
- Use:
  - Import control templates (SOC2, ISO27001, AI governance).
  - Map controls to campaigns/modules.
  - Explore evidence objects and statuses.
  - Generate audit narratives.

### `/product/admin/integrations`
- Purpose: Connector management.
- Audience: Manager/Admin/Owner (connect/sync actions need higher role).
- Use:
  - Configure Vanta/Drata credentials.
  - Trigger sync jobs.
  - Monitor sync health and job history.

### `/product/admin/adoption`
- Purpose: Adoption Command Center.
- Audience: Manager/Admin/Owner.
- Use:
  - Monitor control freshness and trend.
  - View benchmark delta/percentile.
  - Inspect adoption graph coverage and at-risk controls.

### `/product/admin/interventions`
- Purpose: Intervention Inbox.
- Audience: Manager/Admin/Owner.
- Use:
  - Generate recommendations.
  - Approve interventions.
  - Execute interventions.
  - Track execution state by status.

## Learner pages

### `/product/learn`
- Purpose: Learner inbox.
- Audience: Learners and assigned users.
- Use: Shows assigned/in-progress/completed modules with due-state visibility.

### `/product/learn/[assignmentId]`
- Purpose: Assignment execution page.
- Audience: Learners.
- Use:
  - Read learning material.
  - View attached media.
  - Acknowledge material (for flow v2 assignments).
  - Take quiz and see result.

### `/product/attest/[campaignId]`
- Purpose: Campaign-level attestation completion.
- Audience: Learners after module completion.
- Use: Submit final attestation evidence for campaign closure.

## Navigation model summary
- Admin section: Dashboard, Policies, Adoption Center, Interventions, Controls & Evidence, Integrations, Campaigns.
- Learning section: My Learning.
- Role-aware visibility: pages/actions shown based on org role (`learner`, `manager`, `admin`, `owner`).
