"use client";

/**
 * EntitlementContext -- Fenrir Ledger
 *
 * React context that owns the client-side entitlement state.
 * Stripe-only: all subscription management is handled via Stripe.
 *
 * Source of truth: Vercel KV (server-side), accessed via:
 *   - Stripe: /api/stripe/membership (authenticated)
 * Client-side cache: localStorage "fenrir:entitlement" for instant mount + fallback.
 *
 * On mount:
 *   1. Read localStorage cache for instant UI state (no loading flash).
 *   2. If user is authenticated AND cache is stale (>1 hour), call the membership
 *      API to refresh.
 *   3. If the membership API fails, use stale cache if available, else Thrall.
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
  /** Stripe subscription status (e.g. "active", "canceled", "past_due") */
  stripeStatus: string | null;
  /** Stripe subscription current period end (ISO 8601 string) */
  currentPeriodEnd: string | null;

  /** Re-verifies entitlement status via the server API. */
  refreshEntitlement: () => Promise<void>;

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
  stripeStatus: null,
  currentPeriodEnd: null,
  refreshEntitlement: async () => {},
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
  platform: "stripe";
  checkedAt: string;
  stale?: boolean;
  customerId?: string;
  linkedAt?: string;
}

// -- Provider ----------------------------------------------------------------

interface EntitlementProviderProps {
  children: ReactNode;
}

export function EntitlementProvider({ children }: EntitlementProviderProps) {
  const { status } = useAuthContext();
  const isAuthenticated = status === "authenticated";

  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<string | null>(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);

  // Prevent concurrent API calls
  const fetchInProgressRef = useRef(false);
  // Track if we've processed query params this mount
  const queryParamsProcessedRef = useRef(false);

  // -- Derived state ---------------------------------------------------------

  const tier: EntitlementTier = entitlement?.tier ?? "thrall";
  const isActive = entitlement?.active ?? false;
  const isLinked = entitlement !== null;
  const platform: EntitlementPlatform | null = entitlement?.platform ?? null;

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
      if (data.tier === "thrall" && !data.active && !data.customerId && !existing) {
        return null;
      }

      return {
        tier: data.tier,
        active: data.active,
        platform: data.platform,
        userId: data.customerId ?? existing?.userId ?? "",
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
        data = await fetchStripeMembership();
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
  }, [isAuthenticated, fetchStripeMembership, toEntitlement]);

  // -- Stripe: Subscribe (create checkout session) ----------------------------

  /**
   * Creates a Stripe Checkout session and redirects the user.
   * For authenticated users, email comes from Google profile.
   * For anonymous users, Stripe's hosted checkout page collects email.
   */
  const subscribeStripe = useCallback(async () => {
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

  // -- Process Stripe callback query params ----------------------------------

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (queryParamsProcessedRef.current) return;
    if (status === "loading") return;

    const params = new URLSearchParams(window.location.search);

    // Handle Stripe callback params
    const stripeParam = params.get("stripe");
    if (!stripeParam) return;

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
  }, [status, refreshEntitlement]);

  // -- Initialize from cache + refresh if stale ------------------------------

  useEffect(() => {
    if (typeof window === "undefined") return;

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
    } else {
      // Anonymous: no entitlement by default
      setEntitlement(null);
    }
  }, [isAuthenticated, refreshEntitlement]);

  // -- Context value ---------------------------------------------------------

  const value: EntitlementContextValue = {
    tier,
    isActive,
    isLinked,
    isLoading,
    platform,
    stripeStatus,
    currentPeriodEnd,
    refreshEntitlement,
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
