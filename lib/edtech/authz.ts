import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/errors";
import type { OrgRole } from "@/lib/types";

const ROLE_PRIORITY: Record<OrgRole, number> = {
  learner: 1,
  manager: 2,
  admin: 3,
  owner: 4,
};

export async function requireOrgMembership(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  minimumRole: OrgRole = "learner",
): Promise<{ role: OrgRole }> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .single();

  if (error || !data?.role) {
    throw new ApiError("AUTH_ERROR", "You are not a member of this organization", 403);
  }

  const role = data.role as OrgRole;
  if (ROLE_PRIORITY[role] < ROLE_PRIORITY[minimumRole]) {
    throw new ApiError("AUTH_ERROR", "Your role does not permit this action", 403);
  }

  return { role };
}
