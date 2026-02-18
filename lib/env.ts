const valueOrEmpty = (value: string | undefined): string => value?.trim() ?? "";
const valueOrNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const runtimeEnv = {
  siteUrl: valueOrEmpty(process.env.NEXT_PUBLIC_SITE_URL),
  supabaseUrl: valueOrEmpty(process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: valueOrEmpty(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  supabaseServiceRoleKey: valueOrEmpty(process.env.SUPABASE_SERVICE_ROLE_KEY),
  openAiApiKey: valueOrEmpty(process.env.OPENAI_API_KEY),
  openAiModel: valueOrEmpty(process.env.OPENAI_MODEL) || "gpt-4.1-mini",
  resendApiKey: valueOrEmpty(process.env.RESEND_API_KEY),
  resendFromEmail: valueOrEmpty(process.env.RESEND_FROM_EMAIL),
  attestationSigningSecret: valueOrEmpty(process.env.ATTESTATION_SIGNING_SECRET),
  maxPolicyUploadMb: valueOrNumber(process.env.MAX_POLICY_UPLOAD_MB, 15),
  rateLimitWindowMs: valueOrNumber(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
  rateLimitMaxRequests: valueOrNumber(process.env.RATE_LIMIT_MAX_REQUESTS, 20),
  posthogKey: valueOrEmpty(process.env.NEXT_PUBLIC_POSTHOG_KEY),
  posthogHost: valueOrEmpty(process.env.NEXT_PUBLIC_POSTHOG_HOST),
  posthogEnabled:
    valueOrEmpty(process.env.NEXT_PUBLIC_POSTHOG_ENABLED).toLowerCase() === "true",
};

export const hasSupabaseEnv = (): boolean =>
  Boolean(runtimeEnv.supabaseUrl && runtimeEnv.supabaseAnonKey);

export const hasSupabaseServiceRole = (): boolean =>
  Boolean(runtimeEnv.supabaseServiceRoleKey);

export const hasOpenAi = (): boolean => Boolean(runtimeEnv.openAiApiKey);

export const hasResend = (): boolean =>
  Boolean(runtimeEnv.resendApiKey && runtimeEnv.resendFromEmail);
