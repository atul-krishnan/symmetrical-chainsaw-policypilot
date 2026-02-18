import Link from "next/link";

import type { OrgRole } from "@/lib/types";

type AdminAccessGateProps = {
  orgName?: string;
  currentRole?: OrgRole;
  requiredRole: OrgRole;
  title: string;
};

export function AdminAccessGate({
  orgName,
  currentRole,
  requiredRole,
  title,
}: AdminAccessGateProps) {
  return (
    <div className="mx-auto max-w-lg">
      <div className="card p-8">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">{title}</h1>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          You are signed in as <span className="font-semibold text-[var(--text-primary)]">{currentRole ?? "unknown"}</span>
          {orgName ? ` in ${orgName}` : ""}. This page requires <span className="font-semibold text-[var(--text-primary)]">{requiredRole}</span> access.
        </p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Ask an organization admin to upgrade your role, or continue in learner view.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link className="btn btn-primary" href="/product/learn">
            Open learner view
          </Link>
          <Link className="btn btn-secondary" href="/product/auth">
            Switch account
          </Link>
        </div>
      </div>
    </div>
  );
}
