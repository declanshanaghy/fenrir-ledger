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
  /** Whether the subscription is set to cancel at period end */
  cancelAtPeriodEnd: boolean;
  /** Stripe subscription current period end (ISO 8601 string) */
  currentPeriodEnd: string | null;

  /** Re-verifies entitlement status via the server API. Optional sessionId for migration. */
  refreshEntitlement: (sessionId?: string) => Promise<void>;

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
  cancelAtPeriodEnd: false,
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
  stripeStatus?: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string;
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
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
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

  const fetchStripeMembership = useCallback(async (sessionId?: string): Promise<MembershipApiResponse | null> => {
    const token = await ensureFreshToken();
    if (!token) return null;

    try {
      const url = sessionId
        ? `/api/stripe/membership?session_id=${encodeURIComponent(sessionId)}`
        : "/api/stripe/membership";
      const response = await fetch(url, {
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

  const refreshEntitlement = useCallback(async (sessionId?: string) => {
    if (fetchInProgressRef.current) return;

    fetchInProgressRef.current = true;
    setIsLoading(true);

    try {
      let data: MembershipApiResponse | null = null;

      if (isAuthenticated) {
        data = await fetchStripeMembership(sessionId);
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
        // Populate Stripe-specific fields
        setStripeStatus(data.stripeStatus ?? null);
        setCancelAtPeriodEnd(data.cancelAtPeriodEnd ?? false);
        setCurrentPeriodEnd(data.currentPeriodEnd ?? null);
      }
    } finally {
      fetchInProgressRef.current = false;
      setIsLoading(false);
    }
  }, [isAuthenticated, fetchStripeMembership, toEntitlement]);

  // -- Stripe: Subscribe (create checkout session) ----------------------------

  /**
   * Creates a Stripe Checkout session and redirects the user.
   * Requires authentication — if not signed in, redirects to /sign-in first
   * with a returnTo that will auto-start checkout after sign-in.
   */
  const subscribeStripe = useCallback(async () => {
    if (!isAuthenticated) {
      // Redirect to sign-in, then back to settings to auto-start checkout
      window.location.href = "/ledger/sign-in?returnTo=" + encodeURIComponent("/ledger/settings?stripe=checkout");
      return;
    }

    const token = await ensureFreshToken();
    if (!token) {
      // Token expired mid-session — redirect to sign-in
      window.location.href = "/ledger/sign-in?returnTo=" + encodeURIComponent("/ledger/settings?stripe=checkout");
      return;
    }

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as { error_description?: string }).error_description ?? "Checkout failed");
      }

      const data = (await response.json()) as { url?: string; revived?: boolean };
      if (data.revived) {
        // Subscription was revived (un-canceled) — redirect to success page
        window.location.href = "/ledger/settings?stripe=success";
      } else if (data.url) {
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
    setCancelAtPeriodEnd(false);
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

    const sessionId = params.get("session_id") ?? undefined;

    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("stripe");
    cleanUrl.searchParams.delete("session_id");
    window.history.replaceState({}, "", cleanUrl.toString());

    if (stripeParam === "success") {
      console.debug("[Fenrir] Stripe checkout success callback", { sessionId });
      void refreshEntitlement(sessionId);
    } else if (stripeParam === "checkout") {
      console.debug("[Fenrir] Stripe auto-checkout after sign-in");
      void subscribeStripe();
    } else if (stripeParam === "portal_return") {
      console.debug("[Fenrir] Stripe portal return — refreshing entitlement");
      void refreshEntitlement();
    } else if (stripeParam === "cancel") {
      console.debug("[Fenrir] Stripe checkout cancelled by user");
    }
  }, [status, refreshEntitlement, subscribeStripe]);

  // -- Initialize from cache + refresh if stale ------------------------------

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isAuthenticated) {
      // Load cache for instant UI (no loading flash), then always refresh
      // from the server to pick up webhook-driven changes (cancellations, etc.)
      const cached = getEntitlementCache();
      if (cached) {
        setEntitlement(cached);
      }
      void refreshEntitlement();
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
    cancelAtPeriodEnd,
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
