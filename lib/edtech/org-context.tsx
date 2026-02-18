"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import { pickOrgId } from "@/lib/edtech/org-selection";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { OrgMembership } from "@/lib/types";

type OrgContextValue = {
  memberships: OrgMembership[];
  selectedOrgId: string | null;
  selectedMembership: OrgMembership | null;
  loading: boolean;
  error: string | null;
  requiresSelection: boolean;
  setSelectedOrgId: (orgId: string) => void;
  refreshMemberships: () => Promise<void>;
};

const SELECTED_ORG_STORAGE_KEY = "policypilot:selected-org-id";
const ACCESS_TOKEN_REFRESH_BUFFER_MS = 30_000;

const OrgContext = createContext<OrgContextValue | null>(null);

function readStoredOrgId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(SELECTED_ORG_STORAGE_KEY);
  return value?.trim() ? value.trim() : null;
}

function writeStoredOrgId(orgId: string | null): void {
  if (typeof window === "undefined") {
    return;
  }

  if (!orgId) {
    window.localStorage.removeItem(SELECTED_ORG_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(SELECTED_ORG_STORAGE_KEY, orgId);
}

async function fetchMemberships(): Promise<OrgMembership[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase is not configured in this environment.");
  }

  const resolveAccessToken = async (): Promise<string> => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw new Error("Could not read your session. Sign in again.");
    }

    const session = data.session;
    const accessToken = session?.access_token;
    if (!accessToken) {
      throw new Error("Sign in to access organization workspaces.");
    }

    const expiresAtMs = (session?.expires_at ?? 0) * 1000;
    const needsRefresh =
      Boolean(expiresAtMs) && expiresAtMs <= Date.now() + ACCESS_TOKEN_REFRESH_BUFFER_MS;

    if (!needsRefresh) {
      return accessToken;
    }

    const refreshResult = await supabase.auth.refreshSession();
    const refreshedToken = refreshResult.data.session?.access_token;
    if (refreshResult.error || !refreshedToken) {
      throw new Error("Your session expired. Sign in again.");
    }

    return refreshedToken;
  };

  const runRequest = async (token: string) =>
    fetch("/api/me/org-memberships", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

  let response = await runRequest(await resolveAccessToken());
  if (response.status === 401) {
    const refreshResult = await supabase.auth.refreshSession();
    const refreshedToken = refreshResult.data.session?.access_token;
    if (refreshResult.error || !refreshedToken) {
      throw new Error("Your session expired. Sign in again.");
    }

    response = await runRequest(refreshedToken);
  }

  const body = (await response.json()) as
    | { memberships: OrgMembership[] }
    | { error?: { message?: string } };

  if (!response.ok) {
    const message = "error" in body ? body.error?.message : undefined;
    throw new Error(message ?? "Failed to load your organization memberships.");
  }

  if (!("memberships" in body)) {
    throw new Error("Membership response shape is invalid.");
  }

  return body.memberships;
}

export function OrgProvider({ children }: PropsWithChildren) {
  const [queryOrgId, setQueryOrgId] = useState<string | null>(null);

  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [selectedOrgId, setSelectedOrgIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const membershipRefreshInFlight = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const readFromUrl = () => {
      const search = new URLSearchParams(window.location.search);
      setQueryOrgId(search.get("org"));
    };

    readFromUrl();
    window.addEventListener("popstate", readFromUrl);
    return () => {
      window.removeEventListener("popstate", readFromUrl);
    };
  }, []);

  const refreshMemberships = useCallback(async () => {
    if (membershipRefreshInFlight.current) {
      return membershipRefreshInFlight.current;
    }

    const promise = (async () => {
      setLoading(true);
      setError(null);

      try {
        const nextMemberships = await fetchMemberships();
        setMemberships(nextMemberships);
        setSelectedOrgIdState((current) =>
          pickOrgId(nextMemberships, [queryOrgId, current, readStoredOrgId()]),
        );
      } catch (loadError) {
        setMemberships([]);
        setSelectedOrgIdState(null);
        setError(loadError instanceof Error ? loadError.message : "Failed to load organization access.");
      } finally {
        setLoading(false);
      }
    })().finally(() => {
      membershipRefreshInFlight.current = null;
    });

    membershipRefreshInFlight.current = promise;
    return promise;
  }, [queryOrgId]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setLoading(false);
      setError("Supabase is not configured in this environment.");
      return;
    }

    void refreshMemberships();

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void refreshMemberships();
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [refreshMemberships]);

  useEffect(() => {
    if (!queryOrgId || memberships.length === 0) {
      return;
    }

    if (memberships.some((membership) => membership.orgId === queryOrgId)) {
      setSelectedOrgIdState(queryOrgId);
    }
  }, [memberships, queryOrgId]);

  useEffect(() => {
    writeStoredOrgId(selectedOrgId);
  }, [selectedOrgId]);

  const setSelectedOrgId = useCallback(
    (orgId: string) => {
      if (!memberships.some((membership) => membership.orgId === orgId)) {
        return;
      }

      setSelectedOrgIdState(orgId);
    },
    [memberships],
  );

  const selectedMembership = useMemo(
    () => memberships.find((membership) => membership.orgId === selectedOrgId) ?? null,
    [memberships, selectedOrgId],
  );

  const value = useMemo<OrgContextValue>(
    () => ({
      memberships,
      selectedOrgId,
      selectedMembership,
      loading,
      error,
      requiresSelection: memberships.length > 1 && !selectedOrgId,
      setSelectedOrgId,
      refreshMemberships,
    }),
    [
      error,
      loading,
      memberships,
      refreshMemberships,
      selectedMembership,
      selectedOrgId,
      setSelectedOrgId,
    ],
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrgContext(): OrgContextValue {
  const value = useContext(OrgContext);
  if (!value) {
    throw new Error("useOrgContext must be used within OrgProvider");
  }

  return value;
}
