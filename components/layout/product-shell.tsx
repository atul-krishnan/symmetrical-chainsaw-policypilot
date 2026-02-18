"use client";

import Link from "next/link";
import type { PropsWithChildren } from "react";

import { ProductNav } from "@/components/layout/product-nav";
import { OrgProvider, useOrgContext } from "@/lib/edtech/org-context";

function ProductShellBody({ children }: PropsWithChildren) {
  const { loading, error, memberships, requiresSelection, refreshMemberships } = useOrgContext();

  if (loading) {
    return (
      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-4xl rounded-[1.8rem] surface-card p-6">
          <h1 className="font-display text-3xl text-[#10244a]">Resolving your workspace</h1>
          <p className="mt-2 text-sm text-[#4f6486]">Checking your organization memberships and permissions.</p>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-4xl rounded-[1.8rem] border border-[#e2c4b5] bg-white p-6 shadow-[0_20px_45px_rgba(26,45,79,0.08)]">
          <h1 className="font-display text-3xl text-[#10244a]">Workspace setup required</h1>
          <p className="mt-2 text-sm text-[#6a4e3f]">{error}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="h-10 rounded-xl bg-[#1f5eff] px-4 text-sm font-semibold text-white hover:bg-[#154ee6]"
              onClick={() => void refreshMemberships()}
              type="button"
            >
              Retry
            </button>
            <Link
              className="inline-flex h-10 items-center rounded-xl border border-[#d2ddef] px-4 text-sm font-semibold text-[#10243e] hover:bg-[#f4f8ff]"
              href="/product/auth"
            >
              Go to sign-in
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (memberships.length === 0) {
    return (
      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-4xl rounded-[1.8rem] surface-card p-6">
          <h1 className="font-display text-3xl text-[#10244a]">No organization access yet</h1>
          <p className="mt-2 text-sm text-[#4f6486]">
            Ask your PolicyPilot admin to add your account to an organization, then refresh this page.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="h-10 rounded-xl bg-[#1f5eff] px-4 text-sm font-semibold text-white hover:bg-[#154ee6]"
              onClick={() => void refreshMemberships()}
              type="button"
            >
              Check again
            </button>
            <Link
              className="inline-flex h-10 items-center rounded-xl border border-[#d2ddef] px-4 text-sm font-semibold text-[#10243e] hover:bg-[#f4f8ff]"
              href="/product/auth"
            >
              Switch account
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (requiresSelection) {
    return (
      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-4xl rounded-[1.8rem] surface-card p-6">
          <h1 className="font-display text-3xl text-[#10244a]">Choose an organization</h1>
          <p className="mt-2 text-sm text-[#4f6486]">
            Select the organization workspace from the top navigation before starting admin actions.
          </p>
        </section>
      </main>
    );
  }

  return <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>;
}

export function ProductShell({ children }: PropsWithChildren) {
  return (
    <OrgProvider>
      <div className="relative min-h-screen overflow-hidden bg-[#f4f7fd]">
        <div className="pointer-events-none absolute inset-0 -z-10 app-grid" />
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[-14rem] top-[-8rem] h-[34rem] w-[34rem] rounded-full bg-[#2f6dff1a] blur-3xl" />
          <div className="absolute right-[-12rem] top-28 h-[30rem] w-[30rem] rounded-full bg-[#17a6ff1a] blur-3xl" />
        </div>
        <ProductNav />
        <ProductShellBody>{children}</ProductShellBody>
      </div>
    </OrgProvider>
  );
}
