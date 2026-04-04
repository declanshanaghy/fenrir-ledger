"use client";

/**
 * AuthContext — Fenrir Ledger
 *
 * React context that owns the client-side auth state.
 *
 * On mount:
 *  - Reads "fenrir:auth" from localStorage.
 *  - If valid (fenrir_token exists and expires_at > now) → status = "authenticated"
 *  - If expired → status = "anonymous" (user must re-login with Google)
 *    No background refresh: Fenrir JWTs have 30-day lifetime + server-side
 *    sliding window refresh via X-Fenrir-Token header in API responses.
 *  - Else → status = "anonymous"
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
 * Token refresh (issue #2060):
 *  - NO setInterval for token refresh — removed entirely.
 *  - Fenrir JWTs are self-contained (30-day expiry). Sessions extend indefinitely
 *    via sliding window: server re-issues a new JWT in X-Fenrir-Token header on
 *    API calls when the token is older than 15 days. authFetch() swaps it in.
 *  - If inactive for 30+ days → token expires → user re-logins with Google.
 *
 * See ADR-006 for the anonymous-first auth model.
 * See ADR-005 for the PKCE auth implementation that remains intact.
 * See issue #2060 for the Fenrir JWT session migration.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { getSession, clearSession, isSessionValid } from "@/lib/auth/session";
import { clearEntitlementCache } from "@/lib/entitlement/cache";
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

// ── Provider ──────────────────────────────────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<FenrirSession | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [householdId, setHouseholdId] = useState<string | null>(null);

  // Evaluate the stored session once on mount (client-only).
  // No proactive refresh: Fenrir JWTs are 30-day tokens refreshed server-side
  // via sliding window (X-Fenrir-Token header). No setInterval needed.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = getSession();

    if (stored && isSessionValid()) {
      // Authenticated: resolve effective household ID — may be a joined household
      setSession(stored);
      setStatus("authenticated");
      setHouseholdId(getEffectiveHouseholdId(stored.user.sub));
    } else {
      // No session or Fenrir JWT expired — anonymous user.
      // If the JWT is expired, the user must re-authenticate with Google.
      // Sliding window refresh (via API calls) prevents expiry for active users.
      setSession(null);
      setStatus("anonymous");
      setHouseholdId(null);
    }
  }, []);

  /**
   * Returns the effective storage ID for the current user.
   * For authenticated users: returns householdId (session.user.sub).
   * For anonymous users: returns ANON_HOUSEHOLD_ID ("anon").
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
