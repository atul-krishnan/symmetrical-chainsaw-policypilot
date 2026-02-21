import dotenv from "dotenv";
import fs from "node:fs";
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
  reportPath: string | null;
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
  "control_frameworks",
  "controls",
  "control_mappings",
  "evidence_objects",
  "integration_connections",
  "integration_sync_jobs",
  "integration_sync_events",
  "control_freshness_snapshots",
  "adoption_edges",
  "intervention_recommendations",
  "intervention_executions",
  "evidence_lineage_links",
  "benchmark_cohorts",
  "benchmark_metric_snapshots",
];

const STAGING_REQUIRED_ENV = [
  "STAGING_SUPABASE_URL",
  "STAGING_SUPABASE_ANON_KEY",
  "STAGING_SUPABASE_SERVICE_ROLE_KEY",
  "STAGING_APP_URL",
  "STAGING_SMOKE_ACCESS_TOKEN",
  "STAGING_SMOKE_ORG_ID",
];

const PILOT_REQUIRED_ENV = [
  "PILOT_SUPABASE_URL",
  "PILOT_SUPABASE_ANON_KEY",
  "PILOT_SUPABASE_SERVICE_ROLE_KEY",
  "PILOT_APP_URL",
  "PILOT_SMOKE_ACCESS_TOKEN",
  "PILOT_SMOKE_ORG_ID",
];

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function isPlaceholderValue(value: string): boolean {
  const normalized = value.toLowerCase();
  const markers = [
    "placeholder",
    "example",
    "changeme",
    "replace-me",
    "replace_me",
    "your_",
    "your-",
    "todo",
    "dummy",
  ];

  if (markers.some((marker) => normalized.includes(marker))) {
    return true;
  }

  return /^https?:\/\/(www\.)?example\./.test(normalized);
}

function isLocalUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1";
  } catch {
    return rawUrl.includes("localhost") || rawUrl.includes("127.0.0.1") || rawUrl.includes("0.0.0.0");
  }
}

function runEnvMatrixCheck(name: string, requiredVars: string[]): CheckResult {
  const missing = requiredVars.filter((envName) => !readEnv(envName));
  const placeholders = requiredVars.filter((envName) => {
    const value = readEnv(envName);
    return value.length > 0 && isPlaceholderValue(value);
  });

  return {
    name,
    status: missing.length > 0 || placeholders.length > 0 ? "failed" : "passed",
    details: {
      missing,
      placeholders,
    },
  };
}

function checkHostedStagingUrl(): CheckResult {
  const appUrl = readEnv("STAGING_APP_URL");
  if (!appUrl) {
    return {
      name: "staging_url_policy",
      status: "failed",
      details: {
        reason: "Missing STAGING_APP_URL",
      },
    };
  }

  if (isLocalUrl(appUrl)) {
    return {
      name: "staging_url_policy",
      status: "failed",
      details: {
        reason: "STAGING_APP_URL must be a hosted URL and cannot be localhost.",
        appUrl,
      },
    };
  }

  return {
    name: "staging_url_policy",
    status: "passed",
    details: {
      appUrl,
    },
  };
}

function checkPlaceholderGuard(name: string, vars: string[]): CheckResult {
  const flagged = vars
    .map((envName) => ({ envName, value: readEnv(envName) }))
    .filter((entry) => entry.value.length > 0 && isPlaceholderValue(entry.value))
    .map((entry) => entry.envName);

  return {
    name,
    status: flagged.length > 0 ? "failed" : "passed",
    details: {
      flagged,
    },
  };
}

function resolveReportPath(): string | null {
  if (readEnv("PREFLIGHT_WRITE_REPORT").toLowerCase() === "false") {
    return null;
  }

  const reportDir = readEnv("PREFLIGHT_REPORT_DIR") || path.join(process.cwd(), "output", "preflight");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(reportDir, `pilot-preflight-${timestamp}.json`);
}

function persistReport(reportPath: string | null, report: PreflightReport): void {
  if (!reportPath) {
    return;
  }

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
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
  const failures: Record<string, string> = {};

  for (const table of REQUIRED_TABLES) {
    const result = await supabase.from(table).select("id", { count: "exact", head: true }).limit(1);
    if (result.error) {
      missingTables.push(table);
      failures[table] = result.error.message;
    }
  }

  if (missingTables.length > 0) {
    return {
      name: `${prefix.toLowerCase()}_migration_state`,
      status: "failed",
      details: {
        missingTables,
        failures,
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

  checks.push(runEnvMatrixCheck("staging_env_matrix", STAGING_REQUIRED_ENV));
  checks.push(runEnvMatrixCheck("pilot_env_matrix", PILOT_REQUIRED_ENV));
  checks.push(checkHostedStagingUrl());
  checks.push(checkPlaceholderGuard("pilot_placeholder_guard", PILOT_REQUIRED_ENV));

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
  const reportPath = resolveReportPath();

  const report: PreflightReport = {
    ok,
    startedAt,
    finishedAt: new Date().toISOString(),
    reportPath,
    checks,
  };

  persistReport(reportPath, report);
  console.log(JSON.stringify(report, null, 2));
  if (!ok) {
    process.exitCode = 1;
  }
}

void main();
