import dotenv from "dotenv";
import path from "node:path";

// Load .env.local first (Next.js convention), fall back to .env
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { spawnSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";

type CheckStatus = "passed" | "failed" | "skipped";

type CheckResult = {
  name: string;
  status: CheckStatus;
  details: Record<string, unknown>;
};

type PreflightReport = {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  checks: CheckResult[];
};

const REQUIRED_TABLES = [
  "organizations",
  "organization_members",
  "policy_documents",
  "policy_obligations",
  "learning_campaigns",
  "learning_modules",
  "quiz_questions",
  "assignments",
  "module_attempts",
  "attestations",
  "audit_exports",
  "notification_jobs",
  "request_audit_logs",
];

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

async function checkSupabaseTables(prefix: "STAGING" | "PILOT"): Promise<CheckResult> {
  const url = readEnv(`${prefix}_SUPABASE_URL`);
  const serviceRole = readEnv(`${prefix}_SUPABASE_SERVICE_ROLE_KEY`);

  if (!url || !serviceRole) {
    return {
      name: `${prefix.toLowerCase()}_migration_state`,
      status: "failed",
      details: {
        reason: `Missing ${prefix}_SUPABASE_URL or ${prefix}_SUPABASE_SERVICE_ROLE_KEY`,
      },
    };
  }

  const supabase = createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const missingTables: string[] = [];

  for (const table of REQUIRED_TABLES) {
    const result = await supabase.from(table).select("id", { count: "exact", head: true }).limit(1);
    if (result.error) {
      missingTables.push(table);
    }
  }

  if (missingTables.length > 0) {
    return {
      name: `${prefix.toLowerCase()}_migration_state`,
      status: "failed",
      details: {
        missingTables,
      },
    };
  }

  return {
    name: `${prefix.toLowerCase()}_migration_state`,
    status: "passed",
    details: {
      tablesChecked: REQUIRED_TABLES.length,
    },
  };
}

function runSmoke(prefix: "STAGING" | "PILOT", required: boolean): CheckResult {
  const baseUrl = readEnv(`${prefix}_APP_URL`);
  const accessToken = readEnv(`${prefix}_SMOKE_ACCESS_TOKEN`);
  const orgId = readEnv(`${prefix}_SMOKE_ORG_ID`);

  if (!baseUrl || !accessToken) {
    return {
      name: `${prefix.toLowerCase()}_smoke`,
      status: required ? "failed" : "skipped",
      details: {
        reason: `Missing ${prefix}_APP_URL or ${prefix}_SMOKE_ACCESS_TOKEN`,
      },
    };
  }

  const smoke = spawnSync(
    "npx",
    ["tsx", "scripts/smoke-live.ts"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        SMOKE_ENV: prefix.toLowerCase(),
        SMOKE_BASE_URL: baseUrl,
        SMOKE_ACCESS_TOKEN: accessToken,
        ...(orgId ? { SMOKE_ORG_ID: orgId } : {}),
      },
    },
  );

  const output = smoke.stdout?.trim();
  const parsed = output ? safeParseJson(output) : null;

  if (smoke.status !== 0) {
    return {
      name: `${prefix.toLowerCase()}_smoke`,
      status: "failed",
      details: {
        statusCode: smoke.status,
        output: parsed ?? output,
      },
    };
  }

  return {
    name: `${prefix.toLowerCase()}_smoke`,
    status: "passed",
    details: {
      output: parsed ?? output,
    },
  };
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const checks: CheckResult[] = [];

  const envMatrixChecks: Array<{ name: string; vars: string[]; required: boolean }> = [
    {
      name: "staging_env_matrix",
      required: true,
      vars: [
        "STAGING_SUPABASE_URL",
        "STAGING_SUPABASE_ANON_KEY",
        "STAGING_SUPABASE_SERVICE_ROLE_KEY",
        "STAGING_APP_URL",
        "STAGING_SMOKE_ACCESS_TOKEN",
      ],
    },
    {
      name: "pilot_env_matrix",
      required: true,
      vars: [
        "PILOT_SUPABASE_URL",
        "PILOT_SUPABASE_ANON_KEY",
        "PILOT_SUPABASE_SERVICE_ROLE_KEY",
      ],
    },
  ];

  for (const matrixCheck of envMatrixChecks) {
    const missing = matrixCheck.vars.filter((name) => !readEnv(name));
    checks.push({
      name: matrixCheck.name,
      status: missing.length > 0 ? (matrixCheck.required ? "failed" : "skipped") : "passed",
      details: {
        missing,
      },
    });
  }

  checks.push(await checkSupabaseTables("STAGING"));
  checks.push(await checkSupabaseTables("PILOT"));

  checks.push(runSmoke("STAGING", true));

  const runPilotSmoke = readEnv("RUN_PILOT_SMOKE").toLowerCase() === "true";
  checks.push(runPilotSmoke ? runSmoke("PILOT", true) : {
    name: "pilot_smoke",
    status: "skipped",
    details: {
      reason: "Set RUN_PILOT_SMOKE=true to run pilot smoke gate.",
    },
  });

  const ok = checks.every((check) => check.status !== "failed");

  const report: PreflightReport = {
    ok,
    startedAt,
    finishedAt: new Date().toISOString(),
    checks,
  };

  console.log(JSON.stringify(report, null, 2));
  if (!ok) {
    process.exitCode = 1;
  }
}

void main();
