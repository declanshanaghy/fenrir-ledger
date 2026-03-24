"use client";

/**
 * AuthContext — Fenrir Ledger
 *
 * React context that owns the client-side auth state.
 *
 * On mount:
 *  - Reads "fenrir:auth" from localStorage.
 *  - If valid → status = "authenticated", session = FenrirSession,
 *               householdId = session.user.sub
 *  - If expired but has refresh_token → attempts to refresh the session
 *  - Else → status = "anonymous", session = null,
 *            householdId = null (cards stored under ANON_HOUSEHOLD_ID = "anon")
 *
 * NEVER redirects to /sign-in automatically. All app routes are accessible
 * without authentication. Sign-in is an opt-in upgrade path.
 *
 * signOut():
 *  - Clears the auth session from localStorage.
 *  - Sets householdId = null (anonymous state, uses ANON_HOUSEHOLD_ID = "anon").
 *  - Navigates to / (dashboard in anonymous state), NOT to /sign-in.
 *
 * Household creation contract (Issue #1671):
 *  - Anonymous users: householdId = null. Cards stored under fixed "anon" key.
 *    No UUID household is created for anonymous users.
 *  - Authenticated users: householdId = session.user.sub (Google sub claim).
 *
 * See ADR-006 for the anonymous-first auth model.
 * See ADR-005 for the PKCE auth implementation that remains intact.
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { getSession, clearSession, isSessionValid } from "@/lib/auth/session";
import { clearEntitlementCache } from "@/lib/entitlement/cache";
import { refreshSession } from "@/lib/auth/refresh-session";
import { getEffectiveHouseholdId, clearStoredHouseholdId } from "@/lib/storage";
import { ANON_HOUSEHOLD_ID } from "@/lib/constants";
import type { FenrirSession } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Auth status values:
 *   "loading"       — session evaluation in progress on mount (brief)
 *   "authenticated" — valid signed-in session exists
 *   "anonymous"     — no session; user is using the app as an anonymous user
 */
export type AuthStatus = "loading" | "authenticated" | "anonymous";

export interface AuthContextValue {
  /** The signed-in session, or null for anonymous and loading states */
  session: FenrirSession | null;
  /** Current auth status */
  status: AuthStatus;
  /**
   * The household ID to use for authenticated storage operations.
   * - Authenticated: session.user.sub (Google account ID)
   * - Anonymous: null — use ANON_HOUSEHOLD_ID ("anon") for storage
   * - Loading: null — callers must wait for status !== "loading"
   *
   * Pages should resolve with: householdId ?? ANON_HOUSEHOLD_ID
   */
  householdId: string | null;
  /** Sign out: clears session, sets anonymous state (householdId=null), navigates to / */
  signOut: () => void;
  /**
   * Returns the effective storage ID for the current user.
   * - Authenticated: returns householdId (session.user.sub)
   * - Anonymous: returns ANON_HOUSEHOLD_ID ("anon")
   *
   * Safe to call at any time after status !== "loading".
   * Replaces the old lazy UUID creation pattern from #1670.
   */
  ensureHouseholdId: () => string;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

/** Interval for proactive token refresh: 50 minutes in ms. */
const REFRESH_INTERVAL_MS = 50 * 60 * 1000;

// ── Provider ──────────────────────────────────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<FenrirSession | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Evaluate the stored session once on mount (client-only).
  useEffect(() => {
    if (typeof window === "undefined") return;

    async function initializeAuth() {
      const stored = getSession();

      if (stored && isSessionValid()) {
        // Authenticated: resolve effective household ID — may be a joined household
        setSession(stored);
        setStatus("authenticated");
        setHouseholdId(getEffectiveHouseholdId(stored.user.sub));
      } else if (stored?.refresh_token) {
        // Session expired but we have a refresh token — attempt to refresh
        try {
          const refreshed = await refreshSession();
          if (refreshed) {
            // Successfully refreshed the session
            setSession(refreshed);
            setStatus("authenticated");
            setHouseholdId(getEffectiveHouseholdId(refreshed.user.sub));
            return;
          }
        } catch (err) {
          // Refresh failed, fall through to anonymous
          console.error("[Fenrir] Session refresh failed:", err);
        }
        // Refresh failed or returned null — treat as anonymous.
        // Anonymous users use the fixed "anon" storage key (Issue #1671).
        setSession(null);
        setStatus("anonymous");
        setHouseholdId(null);
      } else {
        // No session or no refresh token — anonymous user.
        // Anonymous users use the fixed "anon" storage key (Issue #1671).
        // No UUID household is created — no localStorage write on mount.
        setSession(null);
        setStatus("anonymous");
        setHouseholdId(null);
      }
    }

    initializeAuth();
  }, []);

  // Periodic proactive token refresh for authenticated sessions.
  // Runs every 50 minutes so tokens never expire silently on long-lived pages.
  // Google access tokens have a 1-hour TTL; refreshing at 50 min gives 10 min margin.
  useEffect(() => {
    if (status !== "authenticated") {
      // Clear any existing interval when the user signs out or is not authenticated
      if (refreshIntervalRef.current !== null) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      return;
    }

    refreshIntervalRef.current = setInterval(async () => {
      const refreshed = await refreshSession();
      if (refreshed) {
        setSession(refreshed);
        setHouseholdId(getEffectiveHouseholdId(refreshed.user.sub));
      }
      // If refresh returns null (revoked/expired refresh token), leave the session
      // as-is — the next API call will get a 401 and trigger sign-out via authFetch.
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (refreshIntervalRef.current !== null) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [status]);

  /**
   * Returns the effective storage ID for the current user.
   * For authenticated users: returns householdId (session.user.sub).
   * For anonymous users: returns ANON_HOUSEHOLD_ID ("anon").
   *
   * Replaces the old lazy UUID creation pattern — no UUID is created.
   */
  const ensureHouseholdId = useCallback((): string => {
    return householdId ?? ANON_HOUSEHOLD_ID;
  }, [householdId]);

  const signOut = useCallback(() => {
    clearSession();
    // Clear entitlement cache on sign-out — the user's subscription link
    // is associated with their Google identity, not the anonymous identity.
    clearEntitlementCache();
    // Clear stored effective household ID so the next user on this device
    // doesn't inherit a previous user's joined household.
    clearStoredHouseholdId();
    // Return to anonymous state — householdId = null (Issue #1671).
    // Anonymous cards remain under the "anon" key.
    setSession(null);
    setStatus("anonymous");
    setHouseholdId(null);
    // Navigate to dashboard in anonymous state — NOT to /ledger/sign-in.
    // The app is not gated. Returning to /ledger shows the dashboard.
    window.location.href = "/ledger";
  }, []);

  return (
    <AuthContext.Provider value={{ session, status, householdId, signOut, ensureHouseholdId }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

/**
 * useAuthContext — returns the raw AuthContextValue.
 * Throws if used outside <AuthProvider>.
 */
export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within <AuthProvider>");
  }
  return ctx;
}
