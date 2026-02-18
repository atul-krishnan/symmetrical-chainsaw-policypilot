"use client";

import posthog from "posthog-js";

import { runtimeEnv } from "@/lib/env";

let initialized = false;

export function initAnalytics(): void {
  if (initialized || !runtimeEnv.posthogEnabled || !runtimeEnv.posthogKey) {
    return;
  }

  posthog.init(runtimeEnv.posthogKey, {
    api_host: runtimeEnv.posthogHost || "https://us.i.posthog.com",
    person_profiles: "always",
  });

  initialized = true;
}

export function trackEvent(
  eventName: string,
  properties: Record<string, string | number | boolean | null> = {},
): void {
  if (!runtimeEnv.posthogEnabled || !runtimeEnv.posthogKey) {
    return;
  }

  posthog.capture(eventName, properties);
}
