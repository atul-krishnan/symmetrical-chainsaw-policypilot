"use client";

import { Bell, Menu, Search } from "lucide-react";
import { usePathname } from "next/navigation";

import { useOrgContext } from "@/lib/edtech/org-context";
import { cn } from "@/lib/utils";

function getBreadcrumbs(pathname: string): string[] {
    const segments = pathname
        .replace("/product/", "")
        .split("/")
        .filter(Boolean);

    return segments.map((s) => {
        // Prettify known segments
        const map: Record<string, string> = {
            admin: "Admin",
            dashboard: "Dashboard",
            policies: "Policies",
            adoption: "Adoption Center",
            interventions: "Interventions",
            controls: "Controls & Evidence",
            integrations: "Integrations",
            campaigns: "Campaigns",
            learn: "My Learning",
            attest: "Attestation",
            auth: "Sign In",
        };
        return map[s] ?? s;
    });
}

export function AppHeader({
    sidebarCollapsed,
    onToggleSidebar,
}: {
    sidebarCollapsed: boolean;
    onToggleSidebar: () => void;
}) {
    const pathname = usePathname();
    const { selectedMembership } = useOrgContext();
    const crumbs = getBreadcrumbs(pathname);
    const role = selectedMembership?.role;

    return (
        <header
            data-sidebar-collapsed={sidebarCollapsed ? "true" : "false"}
            className={cn(
                "sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-white/80 backdrop-blur-sm px-4 sm:px-6 transition-all",
                "border-[var(--border)]",
            )}
        >
            <div className="flex items-center gap-3">
                {/* Mobile menu toggle */}
                <button
                    className="btn-ghost -ml-2 h-9 w-9 rounded-lg p-0 lg:hidden"
                    onClick={onToggleSidebar}
                    type="button"
                    aria-label="Toggle sidebar"
                >
                    <Menu className="h-5 w-5" />
                </button>

                {/* Breadcrumb */}
                <nav className="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
                    {crumbs.map((crumb, i) => (
                        <span key={i} className="flex items-center gap-1">
                            {i > 0 && (
                                <span className="text-[var(--text-faint)]">/</span>
                            )}
                            <span
                                className={cn(
                                    i === crumbs.length - 1
                                        ? "font-semibold text-[var(--text-primary)]"
                                        : "text-[var(--text-muted)]",
                                )}
                            >
                                {crumb}
                            </span>
                        </span>
                    ))}
                </nav>
            </div>

            <div className="flex items-center gap-2">
                {/* Search (placeholder) */}
                <div className="hidden md:flex items-center gap-2 h-9 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] px-3 text-sm text-[var(--text-faint)] min-w-[200px]">
                    <Search className="h-3.5 w-3.5" />
                    <span>Search…</span>
                    <kbd className="ml-auto rounded border border-[var(--border)] bg-white px-1.5 text-[10px] font-medium text-[var(--text-faint)]">⌘K</kbd>
                </div>

                {/* Notifications */}
                <button
                    className="btn-ghost h-9 w-9 rounded-lg p-0 relative"
                    type="button"
                    aria-label="Notifications"
                >
                    <Bell className="h-4 w-4" />
                </button>

                {/* Role badge */}
                {role && (
                    <span className="hidden sm:inline-flex status-pill status-pill-info capitalize">
                        {role}
                    </span>
                )}

                {/* Avatar */}
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">
                    {selectedMembership?.orgName?.charAt(0)?.toUpperCase() ?? "U"}
                </div>
            </div>
        </header>
    );
}
