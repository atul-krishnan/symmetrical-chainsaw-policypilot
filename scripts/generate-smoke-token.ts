import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { createClient } from "@supabase/supabase-js";

type EnvName = "staging" | "pilot" | "local";

type Args = {
  env: EnvName;
  email: string;
  password: string;
  appUrl: string | null;
  orgId: string | null;
  raw: boolean;
};

function parseArgs(argv: string[]): Args {
  const map = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      map.set(key, "true");
      continue;
    }
    map.set(key, next);
    i += 1;
  }

  const env = (map.get("env") ?? "staging").toLowerCase() as EnvName;
  if (!["staging", "pilot", "local"].includes(env)) {
    throw new Error("Invalid --env value. Allowed: staging | pilot | local");
  }

  const email = map.get("email")?.trim() ?? "";
  const password = map.get("password")?.trim() ?? "";
  if (!email || !password) {
    throw new Error("Both --email and --password are required.");
  }

  return {
    env,
    email,
    password,
    appUrl: map.get("app-url")?.trim() ?? null,
    orgId: map.get("org-id")?.trim() ?? null,
    raw: (map.get("raw") ?? "false").toLowerCase() === "true",
  };
}

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function envKeysFor(target: EnvName): {
  url: string;
  anonKey: string;
  smokeKeyName: string;
  defaultAppUrl: string | null;
} {
  if (target === "staging") {
    return {
      url: readEnv("STAGING_SUPABASE_URL"),
      anonKey: readEnv("STAGING_SUPABASE_ANON_KEY"),
      smokeKeyName: "STAGING_SMOKE_ACCESS_TOKEN",
      defaultAppUrl: readEnv("STAGING_APP_URL") || null,
    };
  }
  if (target === "pilot") {
    return {
      url: readEnv("PILOT_SUPABASE_URL"),
      anonKey: readEnv("PILOT_SUPABASE_ANON_KEY"),
      smokeKeyName: "PILOT_SMOKE_ACCESS_TOKEN",
      defaultAppUrl: readEnv("PILOT_APP_URL") || null,
    };
  }
  return {
    url: readEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    smokeKeyName: "SMOKE_ACCESS_TOKEN",
    defaultAppUrl: readEnv("NEXT_PUBLIC_SITE_URL") || null,
  };
}

async function verifyMembership(opts: {
  appUrl: string;
  accessToken: string;
  orgId: string | null;
}): Promise<{ count: number; orgMatched: boolean | null }> {
  const response = await fetch(`${opts.appUrl.replace(/\/+$/, "")}/api/me/org-memberships`, {
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
    },
  });

  const body = (await response.json()) as
    | { memberships: Array<{ orgId: string }> }
    | { error?: { message?: string } };

  if (!response.ok || !("memberships" in body)) {
    throw new Error(`Membership verification failed at ${opts.appUrl}`);
  }

  const orgMatched =
    opts.orgId === null ? null : body.memberships.some((membership) => membership.orgId === opts.orgId);
  return {
    count: body.memberships.length,
    orgMatched,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const keys = envKeysFor(args.env);

  if (!keys.url || !keys.anonKey) {
    throw new Error(
      `Missing Supabase URL/anon key for ${args.env}. Check ${args.env.toUpperCase()} env settings.`,
    );
  }

  const supabase = createClient(keys.url, keys.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const signIn = await supabase.auth.signInWithPassword({
    email: args.email,
    password: args.password,
  });

  if (signIn.error || !signIn.data.session?.access_token) {
    throw new Error(signIn.error?.message ?? "Failed to create access token.");
  }

  const accessToken = signIn.data.session.access_token;
  const expiresAt = signIn.data.session.expires_at
    ? new Date(signIn.data.session.expires_at * 1000).toISOString()
    : null;

  const appUrl = args.appUrl ?? keys.defaultAppUrl;
  const verification =
    appUrl !== null
      ? await verifyMembership({
          appUrl,
          accessToken,
          orgId: args.orgId,
        })
      : null;

  if (args.raw) {
    console.log(accessToken);
    return;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        env: args.env,
        smokeKeyName: keys.smokeKeyName,
        expiresAt,
        appUrlChecked: appUrl,
        membershipCount: verification?.count ?? null,
        orgMatched: verification?.orgMatched ?? null,
        exportLine: `${keys.smokeKeyName}=${accessToken}`,
        accessToken,
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown error",
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
