import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { hasSupabaseEnv, hasSupabaseServiceRole, runtimeEnv } from "@/lib/env";

export function createSupabaseServerClient(): SupabaseClient | null {
  if (!hasSupabaseEnv() || !hasSupabaseServiceRole()) {
    return null;
  }

  return createClient(runtimeEnv.supabaseUrl, runtimeEnv.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createSupabaseAnonServerClient(): SupabaseClient | null {
  if (!hasSupabaseEnv()) {
    return null;
  }

  return createClient(runtimeEnv.supabaseUrl, runtimeEnv.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
