/**
 * Seed script — creates demo org, admin + learner auth users,
 * a sample policy with obligations, and a full campaign.
 *
 * Usage:
 *   npm run seed
 *   (or: npx tsx scripts/seed.ts)
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env / .env.local
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.\n" +
      "   Copy .env.example → .env.local and fill in your Supabase credentials.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

const ADMIN_EMAIL = "admin@demo.policypilot.dev";
const ADMIN_PASSWORD = "DemoAdmin123!";
const LEARNER_EMAIL = "learner@demo.policypilot.dev";
const LEARNER_PASSWORD = "DemoLearner123!";

const ORG_NAME = "Acme Corp";

const POLICY_TITLE = "Responsible AI Use Policy v2.1";
const POLICY_TEXT = `
1. All AI-generated outputs used in customer-facing products must be reviewed by a human before deployment.
2. Employees must not input personally identifiable information (PII) into public AI services.
3. AI model training data must be sourced from approved, licensed datasets only.
4. Executive stakeholders must approve any AI initiative that impacts more than 500 users.
5. Engineering teams must maintain audit logs for all AI model inference calls.
6. All staff must complete annual AI ethics and compliance training.
`.trim();

const OBLIGATIONS = [
  {
    title: "Executive AI initiative approval",
    detail: "All AI initiatives affecting 500+ users require executive sign-off before launch.",
    severity: "high" as const,
    role_track: "exec" as const,
  },
  {
    title: "Audit logging for inference calls",
    detail: "Engineering teams must maintain comprehensive audit logs for every AI model inference call in production systems.",
    severity: "high" as const,
    role_track: "builder" as const,
  },
  {
    title: "Annual AI compliance training",
    detail: "All employees must complete the annual AI ethics and compliance training and submit a signed attestation.",
    severity: "medium" as const,
    role_track: "general" as const,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function upsertAuthUser(email: string, password: string): Promise<string> {
  // Try to create first
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (created?.user) {
    return created.user.id;
  }

  // If user already exists, look them up
  if (createError?.message?.includes("already been registered") || createError?.message?.includes("already exists")) {
    const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const existing = list?.users?.find((u) => u.email === email);
    if (existing) {
      return existing.id;
    }
  }

  throw new Error(`Failed to create/find user ${email}: ${createError?.message}`);
}

function fail(label: string, error: unknown): never {
  console.error(`❌  ${label}:`, error);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("\n🌱  PolicyPilot Seed Script\n");

  // 1. Auth users
  console.log("Creating auth users...");
  const adminUserId = await upsertAuthUser(ADMIN_EMAIL, ADMIN_PASSWORD);
  const learnerUserId = await upsertAuthUser(LEARNER_EMAIL, LEARNER_PASSWORD);
  console.log(`   Admin  → ${adminUserId} (${ADMIN_EMAIL})`);
  console.log(`   Learner → ${learnerUserId} (${LEARNER_EMAIL})`);

  // 2. Organization
  console.log("Creating organization...");
  const orgId = randomUUID();
  const { error: orgError } = await supabase
    .from("organizations")
    .insert({ id: orgId, name: ORG_NAME });
  if (orgError) fail("Organization insert", orgError);
  console.log(`   Org    → ${orgId} ("${ORG_NAME}")`);

  // 3. Organization members
  console.log("Adding organization members...");
  const { error: membersError } = await supabase.from("organization_members").insert([
    { org_id: orgId, user_id: adminUserId, email: ADMIN_EMAIL, role: "admin" },
    { org_id: orgId, user_id: learnerUserId, email: LEARNER_EMAIL, role: "learner" },
  ]);
  if (membersError) fail("Organization members insert", membersError);

  // 4. Policy document
  console.log("Creating policy document...");
  const policyId = randomUUID();
  const { error: policyError } = await supabase.from("policy_documents").insert({
    id: policyId,
    org_id: orgId,
    title: POLICY_TITLE,
    file_path: `policies/${orgId}/responsible-ai-v2.1.txt`,
    file_mime_type: "text/plain",
    parse_status: "ready",
    parsed_text: POLICY_TEXT,
    created_by: adminUserId,
  });
  if (policyError) fail("Policy document insert", policyError);
  console.log(`   Policy → ${policyId}`);

  // 5. Policy obligations
  console.log("Creating policy obligations...");
  const obligationsToInsert = OBLIGATIONS.map((o) => ({
    id: randomUUID(),
    org_id: orgId,
    policy_id: policyId,
    ...o,
  }));
  const { error: obligationsError } = await supabase
    .from("policy_obligations")
    .insert(obligationsToInsert);
  if (obligationsError) fail("Policy obligations insert", obligationsError);

  // 6. Learning campaign (using fallback draft logic inline)
  console.log("Generating learning campaign...");
  const campaignId = randomUUID();
  const campaignName = "AI Literacy Baseline Q1 2026";

  const { error: campaignError } = await supabase.from("learning_campaigns").insert({
    id: campaignId,
    org_id: orgId,
    name: campaignName,
    due_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    policy_ids: [policyId],
    role_tracks: ["exec", "builder", "general"],
    status: "draft",
    created_by: adminUserId,
  });
  if (campaignError) fail("Campaign insert", campaignError);
  console.log(`   Campaign → ${campaignId} ("${campaignName}")`);

  // 7. Learning modules — one per role track
  console.log("Creating learning modules...");
  const modules = [
    {
      id: randomUUID(),
      org_id: orgId,
      campaign_id: campaignId,
      role_track: "exec",
      title: `${campaignName}: Executive Readiness`,
      summary: "Key policy expectations for executive teams with practical actions and decision rules.",
      content_markdown: `## Why this matters

Your role has direct accountability for compliant AI usage across the organization.

## Required behavior

- All AI initiatives affecting 500+ users require executive sign-off before launch.
- Ensure quarterly AI governance reviews are conducted with legal and security stakeholders.
- Approve the organization's AI risk appetite statement annually.

## What to do when unsure

Escalate to legal/security before approving AI deployments that touch customer data or regulated processes.`,
      pass_score: 80,
      estimated_minutes: 10,
    },
    {
      id: randomUUID(),
      org_id: orgId,
      campaign_id: campaignId,
      role_track: "builder",
      title: `${campaignName}: Builder Readiness`,
      summary: "Technical policy requirements for engineering and data science teams building AI systems.",
      content_markdown: `## Why this matters

Engineering teams directly handle AI models, training data, and inference pipelines that must comply with enterprise policy.

## Required behavior

- Maintain comprehensive audit logs for every AI model inference call in production.
- Use only approved, licensed datasets for model training — no scraped or unlicensed data.
- Implement human-in-the-loop review gates for customer-facing AI outputs.

## What to do when unsure

Consult the AI Center of Excellence Slack channel or escalate to security/legal before deploying changes.`,
      pass_score: 80,
      estimated_minutes: 12,
    },
    {
      id: randomUUID(),
      org_id: orgId,
      campaign_id: campaignId,
      role_track: "general",
      title: `${campaignName}: General Staff Readiness`,
      summary: "Essential AI compliance knowledge every employee must understand and practice.",
      content_markdown: `## Why this matters

Every employee interacts with AI tools and must understand the guardrails that protect the company and its customers.

## Required behavior

- Complete the annual AI ethics and compliance training and submit a signed attestation.
- Never input personally identifiable information (PII) into public AI services.
- Report any suspected AI misuse through the internal compliance hotline.

## What to do when unsure

Escalate to your manager or the compliance team before using AI in ways not covered by approved use cases.`,
      pass_score: 80,
      estimated_minutes: 8,
    },
  ];

  const { error: modulesError } = await supabase.from("learning_modules").insert(modules);
  if (modulesError) fail("Learning modules insert", modulesError);

  // 8. Quiz questions — 3 per module
  console.log("Creating quiz questions...");
  const quizQuestions = [
    // Exec questions
    {
      id: randomUUID(),
      org_id: orgId,
      module_id: modules[0].id,
      prompt: "When must executive approval be obtained for an AI initiative?",
      choices_json: [
        "Only for customer-facing AI products",
        "When the initiative impacts more than 500 users",
        "Only when using third-party AI vendors",
        "Executive approval is never required",
      ],
      correct_choice_index: 1,
      explanation: "Policy requires executive sign-off for any AI initiative affecting more than 500 users.",
    },
    {
      id: randomUUID(),
      org_id: orgId,
      module_id: modules[0].id,
      prompt: "How often should AI governance reviews be conducted?",
      choices_json: [
        "Monthly",
        "Annually",
        "Quarterly with legal and security stakeholders",
        "Only after incidents",
      ],
      correct_choice_index: 2,
      explanation: "Quarterly governance reviews ensure ongoing compliance and early risk detection.",
    },
    {
      id: randomUUID(),
      org_id: orgId,
      module_id: modules[0].id,
      prompt: "What is the safest first action when unsure about an AI deployment approval?",
      choices_json: [
        "Proceed and document later",
        "Escalate to legal/security before approving",
        "Ask a colleague informally",
        "Delay indefinitely",
      ],
      correct_choice_index: 1,
      explanation: "Escalation creates auditable, approved decision-making for uncertain cases.",
    },

    // Builder questions
    {
      id: randomUUID(),
      org_id: orgId,
      module_id: modules[1].id,
      prompt: "What must engineering teams maintain for AI model inference calls?",
      choices_json: [
        "Marketing reports",
        "Comprehensive audit logs",
        "Customer satisfaction surveys",
        "Social media posts",
      ],
      correct_choice_index: 1,
      explanation: "Audit logs for inference calls are required for compliance and governance reviews.",
    },
    {
      id: randomUUID(),
      org_id: orgId,
      module_id: modules[1].id,
      prompt: "Which data sources are approved for model training?",
      choices_json: [
        "Any publicly available data",
        "Data scraped from competitor websites",
        "Only approved, licensed datasets",
        "Personal social media data",
      ],
      correct_choice_index: 2,
      explanation: "Policy mandates using only approved, licensed datasets — no scraped or unlicensed data.",
    },
    {
      id: randomUUID(),
      org_id: orgId,
      module_id: modules[1].id,
      prompt: "What review mechanism is required for customer-facing AI outputs?",
      choices_json: [
        "Automated-only review is sufficient",
        "No review needed for low-risk outputs",
        "Human-in-the-loop review gates",
        "Quarterly batch review",
      ],
      correct_choice_index: 2,
      explanation: "Human-in-the-loop review gates ensure that AI outputs are verified before reaching customers.",
    },

    // General questions
    {
      id: randomUUID(),
      org_id: orgId,
      module_id: modules[2].id,
      prompt: "Can employees input PII into public AI services?",
      choices_json: [
        "Yes, if the data is encrypted",
        "Yes, for productivity purposes",
        "No, PII must never be entered into public AI services",
        "Yes, with manager approval",
      ],
      correct_choice_index: 2,
      explanation: "Policy explicitly prohibits inputting PII into public AI services under all circumstances.",
    },
    {
      id: randomUUID(),
      org_id: orgId,
      module_id: modules[2].id,
      prompt: "How should suspected AI misuse be reported?",
      choices_json: [
        "Via personal social media",
        "Through the internal compliance hotline",
        "By sending an email to all-staff",
        "No reporting mechanism exists",
      ],
      correct_choice_index: 1,
      explanation: "The internal compliance hotline is the designated channel for reporting AI misuse.",
    },
    {
      id: randomUUID(),
      org_id: orgId,
      module_id: modules[2].id,
      prompt: "What is required annually from every employee regarding AI compliance?",
      choices_json: [
        "A blog post about AI",
        "Completion of AI ethics training and a signed attestation",
        "An AI project submission",
        "Nothing — training is optional",
      ],
      correct_choice_index: 1,
      explanation: "Annual training completion with a signed attestation creates auditable compliance evidence.",
    },
  ];

  const { error: questionsError } = await supabase.from("quiz_questions").insert(quizQuestions);
  if (questionsError) fail("Quiz questions insert", questionsError);

  // 9. Assignments for the learner
  console.log("Creating assignments for learner...");
  const dueAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const assignments = modules.map((m) => ({
    id: randomUUID(),
    org_id: orgId,
    campaign_id: campaignId,
    module_id: m.id,
    user_id: learnerUserId,
    state: "assigned" as const,
    due_at: dueAt,
  }));

  const { error: assignmentsError } = await supabase.from("assignments").insert(assignments);
  if (assignmentsError) fail("Assignments insert", assignmentsError);

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------

  console.log("\n────────────────────────────────────────────────────");
  console.log("✅  Seed completed successfully!\n");
  console.log("  Organization ID:  ", orgId);
  console.log("  Policy ID:        ", policyId);
  console.log("  Campaign ID:      ", campaignId);
  console.log("  Module IDs:       ", modules.map((m) => m.id).join(", "));
  console.log("");
  console.log("  Admin login:");
  console.log(`    Email:    ${ADMIN_EMAIL}`);
  console.log(`    Password: ${ADMIN_PASSWORD}`);
  console.log("");
  console.log("  Learner login:");
  console.log(`    Email:    ${LEARNER_EMAIL}`);
  console.log(`    Password: ${LEARNER_PASSWORD}`);
  console.log("────────────────────────────────────────────────────\n");
}

main().catch((err) => {
  console.error("❌  Unexpected error:", err);
  process.exit(1);
});
