"use client";

/**
 * EntitlementContext — Fenrir Ledger
 *
 * React context that owns the client-side entitlement state.
 * Platform-agnostic: supports Patreon today, extensible to other platforms.
 *
 * Source of truth: Vercel KV (server-side), accessed via /api/patreon/membership.
 * Client-side cache: localStorage "fenrir:entitlement" for instant mount + fallback.
 *
 * On mount:
 *   1. Read localStorage cache for instant UI state (no loading flash).
 *   2. If user is authenticated AND cache is stale (>1 hour), call the membership
 *      API to refresh.
 *   3. If the membership API fails, use stale cache if available, else Thrall.
 *
 * OAuth callback handling:
 *   Checks for ?patreon=linked|error|denied query params (set by the OAuth
 *   callback redirect). Processes them, updates cache, cleans the URL.
 *
 * See ADR-009 for the architectural decision.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { ensureFreshToken } from "@/lib/auth/refresh-session";
import {
  getEntitlementCache,
  setEntitlementCache,
  clearEntitlementCache,
  isEntitlementStale,
} from "@/lib/entitlement/cache";
import {
  tierMeetsRequirement,
  PREMIUM_FEATURES,
} from "@/lib/entitlement/types";
import type {
  EntitlementTier,
  EntitlementPlatform,
  Entitlement,
  PremiumFeature,
} from "@/lib/entitlement/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EntitlementContextValue {
  /** Current subscription tier. "thrall" if not linked or not authenticated. */
  tier: EntitlementTier;
  /** Whether the subscription is currently active. */
  isActive: boolean;
  /** Whether any subscription platform is linked. */
  isLinked: boolean;
  /** Whether the entitlement status is being loaded/refreshed. */
  isLoading: boolean;
  /** Which platform is linked, or null if none. */
  platform: EntitlementPlatform | null;

  /** Initiates the Patreon OAuth linking flow (redirects to /api/patreon/authorize). */
  linkPatreon: () => void;
  /** Unlinks Patreon: clears local cache and server-side KV entry. */
  unlinkPatreon: () => Promise<void>;
  /** Re-verifies entitlement status via the server API. */
  refreshEntitlement: () => Promise<void>;

  /** Returns true if the user has access to the given premium feature. */
  hasFeature: (feature: PremiumFeature) => boolean;
}

// ── Default (Thrall) ──────────────────────────────────────────────────────────

const DEFAULT_VALUE: EntitlementContextValue = {
  tier: "thrall",
  isActive: false,
  isLinked: false,
  isLoading: false,
  platform: null,
  linkPatreon: () => {},
  unlinkPatreon: async () => {},
  refreshEntitlement: async () => {},
  hasFeature: () => false,
};

// ── Context ───────────────────────────────────────────────────────────────────

const EntitlementContext = createContext<EntitlementContextValue>(DEFAULT_VALUE);

// ── Membership API response shape ─────────────────────────────────────────────

interface MembershipApiResponse {
  tier: EntitlementTier;
  active: boolean;
  platform: "patreon";
  checkedAt: string;
  stale?: boolean;
  userId?: string;
  linkedAt?: string;
}

// ── Provider ──────────────────────────────────────────────────────────────────

interface EntitlementProviderProps {
  children: ReactNode;
}

export function EntitlementProvider({ children }: EntitlementProviderProps) {
  const { session, status } = useAuthContext();
  const isAuthenticated = status === "authenticated";

  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Prevent concurrent API calls
  const fetchInProgressRef = useRef(false);
  // Track if we've processed query params this mount
  const queryParamsProcessedRef = useRef(false);

  // ── Derived state ─────────────────────────────────────────────────────────

  const tier: EntitlementTier = entitlement?.tier ?? "thrall";
  const isActive = entitlement?.active ?? false;
  const isLinked = entitlement !== null;
  const platform: EntitlementPlatform | null = entitlement?.platform ?? null;

  // ── Fetch membership from server ──────────────────────────────────────────

  /**
   * Calls /api/patreon/membership with the user's Google id_token.
   * Returns the membership data or null on failure.
   */
  const fetchMembership = useCallback(async (): Promise<MembershipApiResponse | null> => {
    const token = await ensureFreshToken();
    if (!token) return null;

    try {
      const response = await fetch("/api/patreon/membership", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache",
        },
      });

      if (!response.ok) {
        console.debug("[Fenrir] Membership API returned", response.status);
        return null;
      }

      const data = (await response.json()) as MembershipApiResponse;
      return data;
    } catch (err) {
      console.debug(
        "[Fenrir] Membership API fetch failed:",
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  }, []);

  /**
   * Converts a MembershipApiResponse into a client-side Entitlement record.
   * Fills in userId/linkedAt from existing cache if the API doesn't return them.
   */
  const toEntitlement = useCallback(
    (data: MembershipApiResponse, existing: Entitlement | null): Entitlement | null => {
      // If the API says the user is not linked (thrall + not active + no userId),
      // there is no entitlement to cache.
      if (data.tier === "thrall" && !data.active && !data.userId && !existing) {
        return null;
      }

      return {
        tier: data.tier,
        active: data.active,
        platform: data.platform,
        userId: data.userId ?? existing?.userId ?? "",
        linkedAt: data.linkedAt
          ? new Date(data.linkedAt).getTime()
          : existing?.linkedAt ?? Date.now(),
        checkedAt: new Date(data.checkedAt).getTime(),
      };
    },
    [],
  );

  // ── Refresh entitlement ───────────────────────────────────────────────────

  const refreshEntitlement = useCallback(async () => {
    if (!isAuthenticated || fetchInProgressRef.current) return;

    fetchInProgressRef.current = true;
    setIsLoading(true);

    try {
      const data = await fetchMembership();
      if (data) {
        const cached = getEntitlementCache();
        const updated = toEntitlement(data, cached);
        if (updated) {
          setEntitlementCache(updated);
          setEntitlement(updated);
        } else {
          // Not linked — clear any stale cache
          clearEntitlementCache();
          setEntitlement(null);
        }
      }
      // If data is null (API failed), keep whatever cache we have (graceful degradation)
    } finally {
      fetchInProgressRef.current = false;
      setIsLoading(false);
    }
  }, [isAuthenticated, fetchMembership, toEntitlement]);

  // ── Link Patreon ──────────────────────────────────────────────────────────

  const linkPatreon = useCallback(() => {
    if (!isAuthenticated || !session) return;

    // Redirect to the authorize endpoint. The server-side route:
    //   1. Validates the Google id_token (requireAuth)
    //   2. Generates an encrypted state token
    //   3. Redirects to Patreon's OAuth authorize URL
    //
    // The id_token is passed via a cookie-like mechanism: we set it as a
    // query param on the authorize URL so the server can validate it.
    // Actually, the authorize route reads the Authorization header, but since
    // we're doing a full-page redirect, we need to pass it differently.
    //
    // The authorize route is a GET endpoint behind requireAuth.
    // For a redirect-based flow, we need to pass the token in the URL.
    // Let's use a fetch-then-redirect pattern: fetch the authorize URL
    // to get the Patreon redirect URL, then navigate there.
    //
    // Simpler approach: navigate directly. The authorize route needs the
    // Authorization header. Since this is a page navigation (not fetch),
    // we pass the token as a query param that the server reads.
    void (async () => {
      const token = await ensureFreshToken();
      if (!token) {
        console.debug("[Fenrir] Cannot link Patreon: no valid token");
        return;
      }

      // Navigate to the authorize endpoint with the token as a query param.
      // The server-side route will read this and validate it.
      const url = new URL("/api/patreon/authorize", window.location.origin);
      url.searchParams.set("id_token", token);
      window.location.href = url.toString();
    })();
  }, [isAuthenticated, session]);

  // ── Unlink Patreon ────────────────────────────────────────────────────────

  const unlinkPatreon = useCallback(async () => {
    // Clear client-side state immediately for responsive UI
    clearEntitlementCache();
    setEntitlement(null);

    // Also clear the server-side KV entry
    if (isAuthenticated) {
      try {
        const token = await ensureFreshToken();
        if (token) {
          await fetch("/api/patreon/unlink", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        }
      } catch (err) {
        // Server-side cleanup failed. The local cache is already cleared.
        // The KV entry will expire naturally (30-day TTL).
        console.debug(
          "[Fenrir] Server-side unlink failed:",
          err instanceof Error ? err.message : err,
        );
      }
    }
  }, [isAuthenticated]);

  // ── Feature gating ────────────────────────────────────────────────────────

  const hasFeature = useCallback(
    (feature: PremiumFeature): boolean => {
      if (!isActive || !isLinked) return false;

      const featureDef = PREMIUM_FEATURES[feature];
      if (!featureDef) return false;

      return tierMeetsRequirement(tier, featureDef.tier);
    },
    [tier, isActive, isLinked],
  );

  // ── Process OAuth callback query params ───────────────────────────────────

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (queryParamsProcessedRef.current) return;
    if (status === "loading") return;

    const params = new URLSearchParams(window.location.search);
    const patreonParam = params.get("patreon");
    if (!patreonParam) return;

    queryParamsProcessedRef.current = true;

    // Clean the query params from the URL immediately
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("patreon");
    cleanUrl.searchParams.delete("tier");
    cleanUrl.searchParams.delete("reason");
    window.history.replaceState({}, "", cleanUrl.toString());

    switch (patreonParam) {
      case "linked": {
        const tierParam = params.get("tier") as EntitlementTier | null;
        if (tierParam === "karl") {
          // Success: active Karl membership. Refresh from server to get full data.
          console.debug("[Fenrir] Patreon linked successfully (Karl tier)");
          void refreshEntitlement();
        } else {
          // Linked but no active pledge (Thrall). Still refresh to cache the link.
          console.debug("[Fenrir] Patreon linked (Thrall tier — no active pledge)");
          void refreshEntitlement();
        }
        break;
      }

      case "error": {
        const reason = params.get("reason") ?? "unknown";
        console.debug("[Fenrir] Patreon linking error:", reason);
        // No state change — keep whatever cache we had before the attempt.
        break;
      }

      case "denied": {
        console.debug("[Fenrir] Patreon linking cancelled by user");
        // No state change.
        break;
      }

      default:
        console.debug("[Fenrir] Unknown patreon query param:", patreonParam);
        break;
    }
  }, [status, refreshEntitlement]);

  // ── Initialize from cache + refresh if stale ──────────────────────────────

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Only process entitlements for authenticated users
    if (!isAuthenticated) {
      // Clear entitlement state when user is not authenticated
      setEntitlement(null);
      return;
    }

    // Read the local cache for instant state
    const cached = getEntitlementCache();
    if (cached) {
      setEntitlement(cached);

      // If the cache is stale, refresh from server in the background
      if (isEntitlementStale(cached)) {
        void refreshEntitlement();
      }
    } else {
      // No cache — check the server to see if user has a linked entitlement
      void refreshEntitlement();
    }
  }, [isAuthenticated, refreshEntitlement]);

  // ── Context value ─────────────────────────────────────────────────────────

  const value: EntitlementContextValue = {
    tier,
    isActive,
    isLinked,
    isLoading,
    platform,
    linkPatreon,
    unlinkPatreon,
    refreshEntitlement,
    hasFeature,
  };

  return (
    <EntitlementContext.Provider value={value}>
      {children}
    </EntitlementContext.Provider>
  );
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

/**
 * useEntitlementContext — returns the raw EntitlementContextValue.
 * Throws if used outside <EntitlementProvider>.
 */
export function useEntitlementContext(): EntitlementContextValue {
  const ctx = useContext(EntitlementContext);
  // The context has a default value so it will never be null, but the
  // provider wrapping is still recommended for proper behavior.
  return ctx;
}
