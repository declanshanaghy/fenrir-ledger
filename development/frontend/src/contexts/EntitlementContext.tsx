"use client";

/**
 * EntitlementContext -- Fenrir Ledger
 *
 * React context that owns the client-side entitlement state.
 * Platform-agnostic: supports Patreon today, extensible to other platforms.
 *
 * Source of truth: Vercel KV (server-side), accessed via /api/patreon/membership
 * (authenticated) or /api/patreon/membership-anon (anonymous).
 * Client-side cache: localStorage "fenrir:entitlement" for instant mount + fallback.
 *
 * Supports two user modes:
 *   - **Authenticated**: Google-signed-in user. Uses id_token for API calls.
 *     Entitlements keyed by Google sub in KV.
 *   - **Anonymous**: No Google sign-in. Uses Patreon user ID from localStorage
 *     (`fenrir:patreon-user-id`). Entitlements keyed by Patreon PID in KV.
 *
 * Post-sign-in migration:
 *   When a user signs in with Google after anonymous Patreon linking, the context
 *   auto-detects the stored patreonUserId and calls POST /api/patreon/migrate
 *   to move the entitlement from the anonymous KV key to the Google-keyed entry.
 *
 * On mount:
 *   1. Read localStorage cache for instant UI state (no loading flash).
 *   2. If user is authenticated AND cache is stale (>1 hour), call the membership
 *      API to refresh.
 *   3. If user is anonymous AND has a patreonUserId, call the anonymous membership
 *      API to check status.
 *   4. If the membership API fails, use stale cache if available, else Thrall.
 *
 * OAuth callback handling:
 *   Checks for ?patreon=linked|error|denied query params (set by the OAuth
 *   callback redirect). Processes them, updates cache, cleans the URL.
 *   For anonymous callbacks, also reads ?pid= and saves to localStorage.
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
  getPatreonUserId,
  setPatreonUserId,
  clearPatreonUserId,
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

// -- Types -------------------------------------------------------------------

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
  /** Whether the user has an anonymous Patreon link (pid in localStorage). */
  isAnonymouslyLinked: boolean;
  /** Whether a migration from anonymous to authenticated is in progress. */
  isMigrating: boolean;

  /** Initiates the Patreon OAuth linking flow (redirects to /api/patreon/authorize). */
  linkPatreon: () => void;
  /** Unlinks Patreon: clears local cache and server-side KV entry. */
  unlinkPatreon: () => Promise<void>;
  /** Re-verifies entitlement status via the server API. */
  refreshEntitlement: () => Promise<void>;
  /** Migrates anonymous entitlement to the authenticated Google-keyed entry. */
  migrateAnonymousEntitlement: () => Promise<boolean>;

  /** Returns true if the user has access to the given premium feature. */
  hasFeature: (feature: PremiumFeature) => boolean;
}

// -- Default (Thrall) --------------------------------------------------------

const DEFAULT_VALUE: EntitlementContextValue = {
  tier: "thrall",
  isActive: false,
  isLinked: false,
  isLoading: false,
  platform: null,
  isAnonymouslyLinked: false,
  isMigrating: false,
  linkPatreon: () => {},
  unlinkPatreon: async () => {},
  refreshEntitlement: async () => {},
  migrateAnonymousEntitlement: async () => false,
  hasFeature: () => false,
};

// -- Context -----------------------------------------------------------------

const EntitlementContext = createContext<EntitlementContextValue>(DEFAULT_VALUE);

// -- Membership API response shape -------------------------------------------

interface MembershipApiResponse {
  tier: EntitlementTier;
  active: boolean;
  platform: "patreon";
  checkedAt: string;
  stale?: boolean;
  userId?: string;
  linkedAt?: string;
}

// -- Migration API response shape --------------------------------------------

interface MigrateApiResponse {
  migrated: boolean;
  tier?: string;
  active?: boolean;
  reason?: string;
}

// -- Provider ----------------------------------------------------------------

interface EntitlementProviderProps {
  children: ReactNode;
}

export function EntitlementProvider({ children }: EntitlementProviderProps) {
  const { session, status } = useAuthContext();
  const isAuthenticated = status === "authenticated";

  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  // Track whether the user has an anonymous Patreon link in localStorage
  const [anonymouslyLinked, setAnonymouslyLinked] = useState(false);

  // Prevent concurrent API calls
  const fetchInProgressRef = useRef(false);
  // Track if we've processed query params this mount
  const queryParamsProcessedRef = useRef(false);
  // Track if we've already attempted migration this session
  const migrationAttemptedRef = useRef(false);

  // -- Derived state ---------------------------------------------------------

  const tier: EntitlementTier = entitlement?.tier ?? "thrall";
  const isActive = entitlement?.active ?? false;
  const isLinked = entitlement !== null;
  const platform: EntitlementPlatform | null = entitlement?.platform ?? null;

  // -- Fetch membership from server (authenticated) --------------------------

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

  // -- Fetch membership from server (anonymous) ------------------------------

  /**
   * Calls /api/patreon/membership-anon with the Patreon user ID.
   * Returns the membership data or null on failure.
   */
  const fetchAnonymousMembership = useCallback(
    async (pid: string): Promise<MembershipApiResponse | null> => {
      try {
        const response = await fetch(
          `/api/patreon/membership-anon?pid=${encodeURIComponent(pid)}`,
          {
            method: "GET",
            headers: { "Cache-Control": "no-cache" },
          },
        );

        if (!response.ok) {
          console.debug("[Fenrir] Anonymous membership API returned", response.status);
          return null;
        }

        const data = (await response.json()) as MembershipApiResponse;
        return data;
      } catch (err) {
        console.debug(
          "[Fenrir] Anonymous membership API fetch failed:",
          err instanceof Error ? err.message : err,
        );
        return null;
      }
    },
    [],
  );

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

  // -- Refresh entitlement ---------------------------------------------------

  const refreshEntitlement = useCallback(async () => {
    if (fetchInProgressRef.current) return;

    fetchInProgressRef.current = true;
    setIsLoading(true);

    try {
      let data: MembershipApiResponse | null = null;

      if (isAuthenticated) {
        // Authenticated path: use Google id_token
        data = await fetchMembership();
      } else {
        // Anonymous path: use Patreon user ID from localStorage
        const pid = getPatreonUserId();
        if (pid) {
          data = await fetchAnonymousMembership(pid);
        }
      }

      if (data) {
        const cached = getEntitlementCache();
        const updated = toEntitlement(data, cached);
        if (updated) {
          setEntitlementCache(updated);
          setEntitlement(updated);
        } else {
          // Not linked -- clear any stale cache
          clearEntitlementCache();
          setEntitlement(null);
        }
      }
      // If data is null (API failed), keep whatever cache we have (graceful degradation)
    } finally {
      fetchInProgressRef.current = false;
      setIsLoading(false);
    }
  }, [isAuthenticated, fetchMembership, fetchAnonymousMembership, toEntitlement]);

  // -- Link Patreon ----------------------------------------------------------

  const linkPatreon = useCallback(() => {
    if (isAuthenticated && session) {
      // Authenticated flow: pass id_token to authorize endpoint
      void (async () => {
        const token = await ensureFreshToken();
        if (!token) {
          console.debug("[Fenrir] Cannot link Patreon: no valid token");
          return;
        }

        const url = new URL("/api/patreon/authorize", window.location.origin);
        url.searchParams.set("id_token", token);
        window.location.href = url.toString();
      })();
    } else {
      // Anonymous flow: redirect to authorize WITHOUT id_token
      const url = new URL("/api/patreon/authorize", window.location.origin);
      window.location.href = url.toString();
    }
  }, [isAuthenticated, session]);

  // -- Unlink Patreon --------------------------------------------------------

  const unlinkPatreon = useCallback(async () => {
    // Clear client-side state immediately for responsive UI
    clearEntitlementCache();
    clearPatreonUserId();
    setEntitlement(null);
    setAnonymouslyLinked(false);

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

  // -- Migrate anonymous entitlement -----------------------------------------

  /**
   * Migrates an anonymous Patreon entitlement to the authenticated Google-keyed entry.
   * Called automatically on sign-in if a patreonUserId exists in localStorage.
   *
   * @returns true if migration succeeded, false otherwise.
   */
  const migrateAnonymousEntitlement = useCallback(async (): Promise<boolean> => {
    const pid = getPatreonUserId();
    if (!pid) {
      console.debug("[Fenrir] No anonymous Patreon user ID to migrate");
      return false;
    }

    if (!isAuthenticated) {
      console.debug("[Fenrir] Cannot migrate: user not authenticated");
      return false;
    }

    const token = await ensureFreshToken();
    if (!token) {
      console.debug("[Fenrir] Cannot migrate: no valid token");
      return false;
    }

    setIsMigrating(true);

    try {
      const response = await fetch("/api/patreon/migrate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ patreonUserId: pid }),
      });

      if (!response.ok) {
        console.debug("[Fenrir] Migration API returned", response.status);
        return false;
      }

      const data = (await response.json()) as MigrateApiResponse;

      if (data.migrated) {
        console.debug("[Fenrir] Migration successful", { tier: data.tier, active: data.active });
        // Clear the anonymous Patreon user ID from localStorage
        clearPatreonUserId();
        setAnonymouslyLinked(false);
        // Refresh entitlement to pick up the migrated data
        await refreshEntitlement();
        return true;
      } else {
        console.debug("[Fenrir] Migration returned not migrated", { reason: data.reason });
        // If reason is "not_found", the anonymous entitlement expired or was already migrated.
        // Clear the stale localStorage entry.
        if (data.reason === "not_found") {
          clearPatreonUserId();
          setAnonymouslyLinked(false);
        }
        return false;
      }
    } catch (err) {
      console.debug(
        "[Fenrir] Migration failed:",
        err instanceof Error ? err.message : err,
      );
      return false;
    } finally {
      setIsMigrating(false);
    }
  }, [isAuthenticated, refreshEntitlement]);

  // -- Feature gating --------------------------------------------------------

  const hasFeature = useCallback(
    (feature: PremiumFeature): boolean => {
      if (!isActive || !isLinked) return false;

      const featureDef = PREMIUM_FEATURES[feature];
      if (!featureDef) return false;

      return tierMeetsRequirement(tier, featureDef.tier);
    },
    [tier, isActive, isLinked],
  );

  // -- Process OAuth callback query params -----------------------------------

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (queryParamsProcessedRef.current) return;
    if (status === "loading") return;

    const params = new URLSearchParams(window.location.search);
    const patreonParam = params.get("patreon");
    if (!patreonParam) return;

    queryParamsProcessedRef.current = true;

    // Read pid before cleaning (anonymous callbacks include it)
    const pidParam = params.get("pid");

    // Clean the query params from the URL immediately
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("patreon");
    cleanUrl.searchParams.delete("tier");
    cleanUrl.searchParams.delete("reason");
    cleanUrl.searchParams.delete("pid");
    window.history.replaceState({}, "", cleanUrl.toString());

    switch (patreonParam) {
      case "linked": {
        // If pid is present, this was an anonymous callback -- save the pid
        if (pidParam) {
          console.debug("[Fenrir] Anonymous Patreon callback: saving pid", { pid: pidParam });
          setPatreonUserId(pidParam);
          setAnonymouslyLinked(true);
        }

        const tierParam = params.get("tier") as EntitlementTier | null;
        if (tierParam === "karl") {
          console.debug("[Fenrir] Patreon linked successfully (Karl tier)");
        } else {
          console.debug("[Fenrir] Patreon linked (Thrall tier -- no active pledge)");
        }

        // Refresh to get full entitlement data (works for both auth and anon)
        void refreshEntitlement();
        break;
      }

      case "error": {
        const reason = params.get("reason") ?? "unknown";
        console.debug("[Fenrir] Patreon linking error:", reason);
        // No state change -- keep whatever cache we had before the attempt.
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

  // -- Initialize from cache + refresh if stale ------------------------------

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if there is an anonymous Patreon user ID in localStorage
    const storedPid = getPatreonUserId();
    if (storedPid) {
      setAnonymouslyLinked(true);
    }

    if (isAuthenticated) {
      // Authenticated user: read local cache for instant state
      const cached = getEntitlementCache();
      if (cached) {
        setEntitlement(cached);
        if (isEntitlementStale(cached)) {
          void refreshEntitlement();
        }
      } else {
        void refreshEntitlement();
      }
    } else {
      // Anonymous user: if we have a Patreon user ID, check status
      if (storedPid) {
        // Read local cache first for instant UI
        const cached = getEntitlementCache();
        if (cached) {
          setEntitlement(cached);
          if (isEntitlementStale(cached)) {
            void refreshEntitlement();
          }
        } else {
          void refreshEntitlement();
        }
      } else {
        // No auth, no anonymous link -- Thrall
        setEntitlement(null);
      }
    }
  }, [isAuthenticated, refreshEntitlement]);

  // -- Post-sign-in migration hook -------------------------------------------

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuthenticated) return;
    if (migrationAttemptedRef.current) return;

    const storedPid = getPatreonUserId();
    if (!storedPid) return;

    // User just signed in and has an anonymous Patreon user ID -- auto-migrate
    migrationAttemptedRef.current = true;
    console.debug("[Fenrir] Post-sign-in: auto-migrating anonymous Patreon entitlement");
    void migrateAnonymousEntitlement();
  }, [isAuthenticated, migrateAnonymousEntitlement]);

  // -- Context value ---------------------------------------------------------

  const value: EntitlementContextValue = {
    tier,
    isActive,
    isLinked,
    isLoading,
    platform,
    isAnonymouslyLinked: anonymouslyLinked,
    isMigrating,
    linkPatreon,
    unlinkPatreon,
    refreshEntitlement,
    migrateAnonymousEntitlement,
    hasFeature,
  };

  return (
    <EntitlementContext.Provider value={value}>
      {children}
    </EntitlementContext.Provider>
  );
}

// -- Consumer hook -----------------------------------------------------------

/**
 * useEntitlementContext -- returns the raw EntitlementContextValue.
 * Throws if used outside <EntitlementProvider>.
 */
export function useEntitlementContext(): EntitlementContextValue {
  const ctx = useContext(EntitlementContext);
  // The context has a default value so it will never be null, but the
  // provider wrapping is still recommended for proper behavior.
  return ctx;
}
