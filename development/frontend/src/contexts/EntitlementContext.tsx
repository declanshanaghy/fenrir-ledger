"use client";

/**
 * EntitlementContext -- Fenrir Ledger
 *
 * React context that owns the client-side entitlement state.
 * Platform-agnostic: supports Patreon and Stripe, switched by feature flag.
 *
 * Source of truth: Vercel KV (server-side), accessed via:
 *   - Patreon: /api/patreon/membership (authenticated) or /api/patreon/membership-anon (anonymous)
 *   - Stripe: /api/stripe/membership (authenticated)
 * Client-side cache: localStorage "fenrir:entitlement" for instant mount + fallback.
 *
 * Supports two user modes:
 *   - **Authenticated**: Google-signed-in user. Uses id_token for API calls.
 *   - **Anonymous**: No Google sign-in. For Patreon: uses Patreon user ID from localStorage.
 *     For Stripe: anonymous users can subscribe (email collected via modal).
 *
 * Post-sign-in migration:
 *   When a user signs in with Google after anonymous Patreon linking, the context
 *   auto-detects the stored patreonUserId and calls POST /api/patreon/migrate.
 *
 * On mount:
 *   1. Read localStorage cache for instant UI state (no loading flash).
 *   2. If user is authenticated AND cache is stale (>1 hour), call the membership
 *      API to refresh.
 *   3. If the membership API fails, use stale cache if available, else Thrall.
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
import { isPatreon, isStripe } from "@/lib/feature-flags";

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
  /** Stripe subscription status (e.g. "active", "canceled", "past_due") */
  stripeStatus: string | null;
  /** Stripe subscription current period end (ISO 8601 string) */
  currentPeriodEnd: string | null;

  /** Initiates the Patreon OAuth linking flow (redirects to /api/patreon/authorize). */
  linkPatreon: () => void;
  /** Unlinks Patreon: clears local cache and server-side KV entry. */
  unlinkPatreon: () => Promise<void>;
  /** Re-verifies entitlement status via the server API. */
  refreshEntitlement: () => Promise<void>;
  /** Migrates anonymous entitlement to the authenticated Google-keyed entry. */
  migrateAnonymousEntitlement: () => Promise<boolean>;

  /** Creates a Stripe Checkout session and redirects to Stripe's hosted checkout. */
  subscribeStripe: () => Promise<void>;
  /** Opens the Stripe Customer Portal for subscription management. */
  openPortal: () => Promise<void>;
  /** Unlinks Stripe: cancels subscription and clears entitlement. */
  unlinkStripe: () => Promise<void>;

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
  stripeStatus: null,
  currentPeriodEnd: null,
  linkPatreon: () => {},
  unlinkPatreon: async () => {},
  refreshEntitlement: async () => {},
  migrateAnonymousEntitlement: async () => false,
  subscribeStripe: async () => {},
  openPortal: async () => {},
  unlinkStripe: async () => {},
  hasFeature: () => false,
};

// -- Context -----------------------------------------------------------------

const EntitlementContext = createContext<EntitlementContextValue>(DEFAULT_VALUE);

// -- Membership API response shape -------------------------------------------

interface MembershipApiResponse {
  tier: EntitlementTier;
  active: boolean;
  platform: "patreon" | "stripe";
  checkedAt: string;
  stale?: boolean;
  userId?: string;
  linkedAt?: string;
  customerId?: string;
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
  const [stripeStatus, setStripeStatus] = useState<string | null>(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);

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

  // -- Fetch membership from server (authenticated, Patreon) -----------------

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

  // -- Fetch membership from server (anonymous, Patreon) ---------------------

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

  // -- Fetch Stripe membership (authenticated) --------------------------------

  const fetchStripeMembership = useCallback(async (): Promise<MembershipApiResponse | null> => {
    const token = await ensureFreshToken();
    if (!token) return null;

    try {
      const response = await fetch("/api/stripe/membership", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache",
        },
      });

      if (!response.ok) {
        console.debug("[Fenrir] Stripe membership API returned", response.status);
        return null;
      }

      const data = (await response.json()) as MembershipApiResponse;
      return data;
    } catch (err) {
      console.debug(
        "[Fenrir] Stripe membership API fetch failed:",
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  }, []);

  /**
   * Converts a MembershipApiResponse into a client-side Entitlement record.
   */
  const toEntitlement = useCallback(
    (data: MembershipApiResponse, existing: Entitlement | null): Entitlement | null => {
      if (data.tier === "thrall" && !data.active && !data.userId && !data.customerId && !existing) {
        return null;
      }

      return {
        tier: data.tier,
        active: data.active,
        platform: data.platform,
        userId: data.userId ?? data.customerId ?? existing?.userId ?? "",
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

      if (isStripe()) {
        // Stripe path: authenticated users only for now
        if (isAuthenticated) {
          data = await fetchStripeMembership();
        }
      } else if (isPatreon()) {
        if (isAuthenticated) {
          data = await fetchMembership();
        } else {
          const pid = getPatreonUserId();
          if (pid) {
            data = await fetchAnonymousMembership(pid);
          }
        }
      }

      if (data) {
        const cached = getEntitlementCache();
        const updated = toEntitlement(data, cached);
        if (updated) {
          setEntitlementCache(updated);
          setEntitlement(updated);
        } else {
          clearEntitlementCache();
          setEntitlement(null);
        }
      }
    } finally {
      fetchInProgressRef.current = false;
      setIsLoading(false);
    }
  }, [isAuthenticated, fetchMembership, fetchAnonymousMembership, fetchStripeMembership, toEntitlement]);

  // -- Link Patreon ----------------------------------------------------------

  const linkPatreon = useCallback(() => {
    if (!isPatreon()) {
      console.debug("[Fenrir] linkPatreon skipped: platform is not patreon");
      return;
    }

    if (isAuthenticated && session) {
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
      const url = new URL("/api/patreon/authorize", window.location.origin);
      window.location.href = url.toString();
    }
  }, [isAuthenticated, session]);

  // -- Unlink Patreon --------------------------------------------------------

  const unlinkPatreon = useCallback(async () => {
    if (!isPatreon()) return;

    clearEntitlementCache();
    clearPatreonUserId();
    setEntitlement(null);
    setAnonymouslyLinked(false);

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
        console.debug(
          "[Fenrir] Server-side unlink failed:",
          err instanceof Error ? err.message : err,
        );
      }
    }
  }, [isAuthenticated]);

  // -- Stripe: Subscribe (create checkout session) ----------------------------

  /**
   * Creates a Stripe Checkout session and redirects the user.
   * For authenticated users, email comes from Google profile.
   * For anonymous users, Stripe's hosted checkout page collects email.
   */
  const subscribeStripe = useCallback(async () => {
    if (!isStripe()) {
      console.debug("[Fenrir] subscribeStripe skipped: platform is not stripe");
      return;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (isAuthenticated) {
      const token = await ensureFreshToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as { error_description?: string }).error_description ?? "Checkout failed");
      }

      const data = (await response.json()) as { url: string };
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.debug(
        "[Fenrir] Stripe checkout failed:",
        err instanceof Error ? err.message : err,
      );
      throw err;
    }
  }, [isAuthenticated]);

  // -- Stripe: Open Customer Portal ------------------------------------------

  const openPortal = useCallback(async () => {
    if (!isStripe()) {
      console.debug("[Fenrir] openPortal skipped: platform is not stripe");
      return;
    }

    const token = await ensureFreshToken();
    if (!token) {
      console.debug("[Fenrir] Cannot open portal: no valid token");
      return;
    }

    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.debug("[Fenrir] Portal API returned", response.status);
        return;
      }

      const data = (await response.json()) as { url: string };
      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      console.debug(
        "[Fenrir] Stripe portal failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }, []);

  // -- Stripe: Unlink --------------------------------------------------------

  const unlinkStripe = useCallback(async () => {
    if (!isStripe()) return;

    clearEntitlementCache();
    setEntitlement(null);
    setStripeStatus(null);
    setCurrentPeriodEnd(null);

    if (isAuthenticated) {
      try {
        const token = await ensureFreshToken();
        if (token) {
          await fetch("/api/stripe/unlink", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        }
      } catch (err) {
        console.debug(
          "[Fenrir] Stripe unlink failed:",
          err instanceof Error ? err.message : err,
        );
      }
    }
  }, [isAuthenticated]);

  // -- Migrate anonymous entitlement -----------------------------------------

  const migrateAnonymousEntitlement = useCallback(async (): Promise<boolean> => {
    if (!isPatreon()) return false;

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
        clearPatreonUserId();
        setAnonymouslyLinked(false);
        await refreshEntitlement();
        return true;
      } else {
        console.debug("[Fenrir] Migration returned not migrated", { reason: data.reason });
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

    // Handle Stripe callback params
    const stripeParam = params.get("stripe");
    if (stripeParam && isStripe()) {
      queryParamsProcessedRef.current = true;

      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("stripe");
      cleanUrl.searchParams.delete("session_id");
      window.history.replaceState({}, "", cleanUrl.toString());

      if (stripeParam === "success") {
        console.debug("[Fenrir] Stripe checkout success callback");
        void refreshEntitlement();
      } else if (stripeParam === "cancel") {
        console.debug("[Fenrir] Stripe checkout cancelled by user");
      }
      return;
    }

    // Handle Patreon callback params
    if (!isPatreon()) return;
    const patreonParam = params.get("patreon");
    if (!patreonParam) return;

    queryParamsProcessedRef.current = true;

    const pidParam = params.get("pid");

    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("patreon");
    cleanUrl.searchParams.delete("tier");
    cleanUrl.searchParams.delete("reason");
    cleanUrl.searchParams.delete("pid");
    window.history.replaceState({}, "", cleanUrl.toString());

    switch (patreonParam) {
      case "linked": {
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

        void refreshEntitlement();
        break;
      }

      case "error": {
        const reason = params.get("reason") ?? "unknown";
        console.debug("[Fenrir] Patreon linking error:", reason);
        break;
      }

      case "denied": {
        console.debug("[Fenrir] Patreon linking cancelled by user");
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
      const cached = getEntitlementCache();
      if (cached) {
        setEntitlement(cached);
        if (isEntitlementStale(cached)) {
          void refreshEntitlement();
        }
      } else {
        void refreshEntitlement();
      }
    } else if (isPatreon()) {
      // Anonymous Patreon path
      if (storedPid) {
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
        setEntitlement(null);
      }
    } else {
      // Anonymous + Stripe mode: no entitlement by default
      setEntitlement(null);
    }
  }, [isAuthenticated, refreshEntitlement]);

  // -- Post-sign-in migration hook -------------------------------------------

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuthenticated) return;
    if (migrationAttemptedRef.current) return;

    const storedPid = getPatreonUserId();
    if (!storedPid) return;

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
    stripeStatus,
    currentPeriodEnd,
    linkPatreon,
    unlinkPatreon,
    refreshEntitlement,
    migrateAnonymousEntitlement,
    subscribeStripe,
    openPortal,
    unlinkStripe,
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
  return ctx;
}
