"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type PropsWithChildren } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { OrgProvider, useOrgContext } from "@/lib/edtech/org-context";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Shell body — handles workspace resolution states
// ---------------------------------------------------------------------------

function ProductShellBody({ children }: PropsWithChildren) {
  const { loading, error, memberships, requiresSelection, refreshMemberships } = useOrgContext();
  const [bootstrapLoading, setBootstrapLoading] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const canBootstrapOwner = process.env.NODE_ENV !== "production";

  const bootstrapOwner = async () => {
    setBootstrapLoading(true);
    setBootstrapError(null);

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setBootstrapError("Supabase is not configured in this environment.");
      setBootstrapLoading(false);
      return;
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      setBootstrapError("Sign in before bootstrapping workspace access.");
      setBootstrapLoading(false);
      return;
    }

    const response = await fetch("/api/me/bootstrap-owner", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const body = (await response.json()) as { error?: { message?: string } };

    if (!response.ok) {
      setBootstrapError(
        body.error?.message ?? "Bootstrap failed. Check API logs and retry.",
      );
      setBootstrapLoading(false);
      return;
    }

    await refreshMemberships();
    setBootstrapLoading(false);
  };

  if (loading) {
    return (
      <main className="flex-1 p-6">
        <div className="card mx-auto max-w-lg p-8 text-center">
          <h1 className="page-title">Resolving your workspace</h1>
          <p className="page-subtitle mt-2">Checking organization memberships and permissions.</p>
          <div className="mt-6 flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex-1 p-6">
        <div className="card mx-auto max-w-lg p-8">
          <h1 className="page-title">Workspace setup required</h1>
          <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="btn btn-primary"
              onClick={() => void refreshMemberships()}
              type="button"
            >
              Retry
            </button>
            <Link className="btn btn-secondary" href="/product/auth">
              Go to sign-in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (memberships.length === 0) {
    return (
      <main className="flex-1 p-6">
        <div className="card mx-auto max-w-lg p-8">
          <h1 className="page-title">No organization access</h1>
          <p className="page-subtitle mt-2">
            Ask your PolicyPilot admin to add your account to an organization, then refresh this page.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="btn btn-primary"
              onClick={() => void refreshMemberships()}
              type="button"
            >
              Check again
            </button>
            {canBootstrapOwner ? (
              <button
                className="btn btn-secondary"
                disabled={bootstrapLoading}
                onClick={() => void bootstrapOwner()}
                type="button"
              >
                {bootstrapLoading ? "Creating workspace…" : "Bootstrap owner access"}
              </button>
            ) : null}
            <Link className="btn btn-secondary" href="/product/auth">
              Switch account
            </Link>
          </div>
          {canBootstrapOwner ? (
            <p className="mt-3 text-xs text-[var(--text-faint)]">
              Dev helper: creates owner membership for your signed-in user when no org access exists.
            </p>
          ) : null}
          {bootstrapError ? <p className="mt-2 text-sm text-[var(--danger)]">{bootstrapError}</p> : null}
        </div>
      </main>
    );
  }

  if (requiresSelection) {
    return (
      <main className="flex-1 p-6">
        <div className="card mx-auto max-w-lg p-8">
          <h1 className="page-title">Choose an organization</h1>
          <p className="page-subtitle mt-2">
            Select a workspace from the sidebar before proceeding.
          </p>
        </div>
      </main>
    );
  }

  return <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>;
}

// ---------------------------------------------------------------------------
// Shell — wraps everything with sidebar + header
// ---------------------------------------------------------------------------

export function ProductShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const isAuthRoute = pathname.startsWith("/product/auth");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Auth route — no sidebar, centered layout
  if (isAuthRoute) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)]">
        <main className="flex min-h-screen items-center justify-center px-4 py-8">
          {children}
        </main>
      </div>
    );
  }

  return (
    <OrgProvider>
      <div className="flex min-h-screen bg-[var(--bg-main)]">
        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar — hidden on mobile unless toggled */}
        <div className={cn("hidden lg:block", mobileOpen && "!block")}>
          <AppSidebar
            collapsed={collapsed}
            onToggle={() => {
              if (window.innerWidth < 1024) {
                setMobileOpen(false);
              } else {
                setCollapsed((v) => !v);
              }
            }}
          />
        </div>

        {/* Content area — offset by sidebar width */}
        <div
          className={cn(
            "flex min-h-screen flex-1 flex-col transition-all duration-200",
            collapsed ? "lg:ml-16" : "lg:ml-[260px]",
          )}
        >
          <AppHeader
            sidebarCollapsed={collapsed}
            onToggleSidebar={() => {
              if (window.innerWidth < 1024) {
                setMobileOpen((v) => !v);
              } else {
                setCollapsed((v) => !v);
              }
            }}
          />
          <ProductShellBody>{children}</ProductShellBody>
        </div>
      </div>
    </OrgProvider>
  );
}
