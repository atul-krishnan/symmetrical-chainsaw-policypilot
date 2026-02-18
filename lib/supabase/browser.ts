"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { hasSupabaseEnv, runtimeEnv } from "@/lib/env";

let client: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!hasSupabaseEnv()) {
    return null;
  }

  if (!client) {
    client = createClient(runtimeEnv.supabaseUrl, runtimeEnv.supabaseAnonKey);
  }

  return client;
}
