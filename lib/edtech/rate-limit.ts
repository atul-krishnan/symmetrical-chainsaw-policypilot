import { runtimeEnv } from "@/lib/env";

const counters = new Map<string, { count: number; resetAt: number }>();

export function enforceRateLimit(key: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const windowMs = runtimeEnv.rateLimitWindowMs;
  const maxRequests = runtimeEnv.rateLimitMaxRequests;

  const existing = counters.get(key);
  if (!existing || now > existing.resetAt) {
    counters.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      retryAfterMs: existing.resetAt - now,
    };
  }

  existing.count += 1;
  counters.set(key, existing);
  return { allowed: true };
}
