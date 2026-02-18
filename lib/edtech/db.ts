import type { User } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/errors";
import { requireOrgMembership } from "@/lib/edtech/authz";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OrgRole } from "@/lib/types";

export async function requireUserAndClient(request: Request): Promise<{
  user: User;
  supabase: NonNullable<ReturnType<typeof createSupabaseServerClient>>;
}> {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    throw new ApiError("INTERNAL_ERROR", "Supabase service role is not configured", 503);
  }

  const user = await getAuthenticatedUser(request);
  if (!user) {
    throw new ApiError("AUTH_ERROR", "Unauthorized", 401);
  }

  return { user, supabase };
}

export async function requireOrgAccess(
  request: Request,
  orgId: string,
  minimumRole: OrgRole,
): Promise<{
  user: User;
  supabase: NonNullable<ReturnType<typeof createSupabaseServerClient>>;
  role: OrgRole;
}> {
  const { user, supabase } = await requireUserAndClient(request);
  const membership = await requireOrgMembership(supabase, orgId, user.id, minimumRole);

  return {
    user,
    supabase,
    role: membership.role,
  };
}
