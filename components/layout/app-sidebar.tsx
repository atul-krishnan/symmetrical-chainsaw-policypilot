"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import {
    BookOpen,
    ChevronDown,
    FileText,
    GitBranch,
    LayoutDashboard,
    Link2,
    LogOut,
    Megaphone,
    Sparkles,
    Shield,
} from "lucide-react";

import { useOrgContext } from "@/lib/edtech/org-context";
import { hasMinimumRole } from "@/lib/edtech/roles";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { OrgRole } from "@/lib/types";
import { cn } from "@/lib/utils";

function withOrg(path: string, orgId: string | null): string {
    if (!orgId) return path;
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}org=${orgId}`;
}

type NavItem = {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
    minRole: OrgRole;
    section: "main" | "learning";
};

const NAV_ITEMS: NavItem[] = [
    { href: "/product/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, minRole: "manager", section: "main" },
    { href: "/product/admin/policies", label: "Policies", icon: FileText, minRole: "manager", section: "main" },
    { href: "/product/admin/adoption", label: "Adoption Center", icon: GitBranch, minRole: "manager", section: "main" },
    { href: "/product/admin/interventions", label: "Interventions", icon: Sparkles, minRole: "manager", section: "main" },
    { href: "/product/admin/controls", label: "Controls & Evidence", icon: Shield, minRole: "manager", section: "main" },
    { href: "/product/admin/integrations", label: "Integrations", icon: Link2, minRole: "manager", section: "main" },
    { href: "/product/admin/campaigns", label: "Campaigns", icon: Megaphone, minRole: "admin", section: "main" },
    { href: "/product/learn", label: "My Learning", icon: BookOpen, minRole: "learner", section: "learning" },
];

export function AppSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
    const { memberships, selectedOrgId, selectedMembership, setSelectedOrgId, loading } = useOrgContext();
    const pathname = usePathname();

    const role = selectedMembership?.role;
    const visibleItems = useMemo(
        () => NAV_ITEMS.filter((item) => hasMinimumRole(role, item.minRole)),
        [role],
    );

    const mainItems = visibleItems.filter((i) => i.section === "main");
    const learningItems = visibleItems.filter((i) => i.section === "learning");

    const signOut = async () => {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) {
            window.location.href = "/product/auth";
            return;
        }
        await supabase.auth.signOut();
        window.location.href = "/product/auth";
    };

    return (
        <aside
            className={cn(
                "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-surface)] transition-all duration-200",
                collapsed ? "w-16" : "w-[260px]",
            )}
        >
            {/* Logo */}
            <div className="flex h-14 items-center gap-3 border-b border-[var(--sidebar-border)] px-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-xs font-bold text-white shadow-sm ring-2 ring-blue-100">
                    P
                </div>
                {!collapsed && (
                    <span className="text-base font-bold tracking-tight text-[var(--sidebar-text-strong)]">PolicyPilot</span>
                )}
            </div>

            {/* Org Selector */}
            {!collapsed && (
                <div className="border-b border-[var(--sidebar-border)] px-3 py-3">
                    {loading ? (
                        <span className="text-xs text-[var(--sidebar-text-muted)]">Loading…</span>
                    ) : memberships.length > 1 ? (
                        <div className="relative">
                            <select
                                className="h-10 w-full appearance-none rounded-lg border border-[var(--sidebar-border)] bg-[var(--sidebar-surface-elevated)] px-3 pr-8 text-sm text-[var(--sidebar-text)] focus:border-[var(--accent)] focus:outline-none"
                                onChange={(e) => setSelectedOrgId(e.target.value)}
                                value={selectedOrgId ?? ""}
                            >
                                <option value="" disabled>Select workspace</option>
                                {memberships.map((m) => (
                                    <option key={m.orgId} value={m.orgId}>
                                        {m.orgName}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--sidebar-text-muted)]" />
                        </div>
                    ) : selectedMembership ? (
                        <div className="rounded-lg border border-[var(--sidebar-border)] bg-[var(--sidebar-surface-elevated)] px-3 py-2">
                            <p className="text-xs font-semibold text-[var(--sidebar-text-strong)]">{selectedMembership.orgName}</p>
                            <p className="text-[11px] text-[var(--sidebar-text-muted)] capitalize">{selectedMembership.role}</p>
                        </div>
                    ) : null}
                </div>
            )}

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Sidebar">
                {mainItems.length > 0 && (
                    <div className="space-y-0.5">
                        {!collapsed && (
                            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--sidebar-text-muted)]">
                                Admin
                            </p>
                        )}
                        {mainItems.map((item) => {
                            const active = pathname.startsWith(item.href);
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.href}
                                    href={withOrg(item.href, selectedOrgId)}
                                    className={cn(
                                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                        active
                                            ? "bg-[var(--sidebar-active)] text-[var(--sidebar-text-strong)] ring-1 ring-[var(--sidebar-active-border)]"
                                            : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text-strong)]",
                                        collapsed && "justify-center px-0",
                                    )}
                                    title={collapsed ? item.label : undefined}
                                >
                                    <Icon className="h-[18px] w-[18px] shrink-0" />
                                    {!collapsed && item.label}
                                    {active && !collapsed && (
                                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                )}

                {learningItems.length > 0 && (
                    <div className="mt-6 space-y-0.5">
                        {!collapsed && (
                            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--sidebar-text-muted)]">
                                Learning
                            </p>
                        )}
                        {learningItems.map((item) => {
                            const active = pathname.startsWith(item.href);
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.href}
                                    href={withOrg(item.href, selectedOrgId)}
                                    className={cn(
                                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                        active
                                            ? "bg-[var(--sidebar-active)] text-[var(--sidebar-text-strong)] ring-1 ring-[var(--sidebar-active-border)]"
                                            : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text-strong)]",
                                        collapsed && "justify-center px-0",
                                    )}
                                    title={collapsed ? item.label : undefined}
                                >
                                    <Icon className="h-[18px] w-[18px] shrink-0" />
                                    {!collapsed && item.label}
                                    {active && !collapsed && (
                                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                )}
            </nav>

            {/* Bottom */}
            <div className="border-t border-[var(--sidebar-border)] px-2 py-3 space-y-0.5">
                {!collapsed && (
                    <>
                        <button
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text-strong)] transition-colors"
                            type="button"
                            onClick={() => void signOut()}
                        >
                            <LogOut className="h-[18px] w-[18px]" />
                            Sign out
                        </button>
                    </>
                )}
                {collapsed && (
                    <button
                        className="flex w-full justify-center rounded-lg py-2 text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text-strong)] transition-colors"
                        type="button"
                        onClick={() => void signOut()}
                        title="Sign out"
                    >
                        <LogOut className="h-[18px] w-[18px]" />
                    </button>
                )}
            </div>

            {/* Collapse toggle */}
            <button
                className="absolute -right-3 top-[72px] z-50 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--sidebar-border)] bg-[var(--sidebar-surface-elevated)] text-[var(--sidebar-text-muted)] shadow-sm hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text-strong)] transition-colors"
                onClick={onToggle}
                type="button"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={cn("transition-transform", collapsed && "rotate-180")}>
                    <path d="M7.5 2.5L4.5 6L7.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>

            {/* Trust badge at bottom */}
            {!collapsed && (
                <div className="border-t border-[var(--sidebar-border)] px-4 py-3">
                    <div className="trust-badge text-[var(--sidebar-text-muted)]">
                        <Shield className="h-3 w-3" />
                        SOC 2 Ready · Encrypted
                    </div>
                </div>
            )}
        </aside>
    );
}
