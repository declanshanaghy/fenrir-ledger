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
 *  - Else → status = "anonymous", session = null,
 *            householdId = getOrCreateAnonHouseholdId() (localStorage "fenrir:household")
 *
 * NEVER redirects to /sign-in automatically. All app routes are accessible
 * without authentication. Sign-in is an opt-in upgrade path.
 *
 * signOut():
 *  - Clears the auth session from localStorage.
 *  - Restores the anonymous householdId from "fenrir:household".
 *  - Navigates to / (dashboard in anonymous state), NOT to /sign-in.
 *
 * See ADR-006 for the anonymous-first auth model.
 * See ADR-005 for the PKCE auth implementation that remains intact.
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
import { getOrCreateAnonHouseholdId } from "@/lib/auth/household";
import { clearEntitlementCache } from "@/lib/entitlement/cache";
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
   * The household ID to use for all storage operations.
   * - Authenticated: session.user.sub (Google account ID)
   * - Anonymous: UUID from localStorage("fenrir:household")
   * - Loading: "" (empty — callers must wait for status !== "loading")
   */
  householdId: string;
  /** Sign out: clears session, restores anonymous state, navigates to / */
  signOut: () => void;
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
  const [householdId, setHouseholdId] = useState<string>("");

  // Evaluate the stored session once on mount (client-only).
  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = getSession();

    if (stored && isSessionValid()) {
      // Authenticated: use session sub as householdId
      setSession(stored);
      setStatus("authenticated");
      setHouseholdId(stored.user.sub);
    } else {
      // Anonymous: generate or retrieve the anonymous householdId
      setSession(null);
      setStatus("anonymous");
      setHouseholdId(getOrCreateAnonHouseholdId());
    }
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    // Clear entitlement cache on sign-out — the user's subscription link
    // is associated with their Google identity, not the anonymous identity.
    clearEntitlementCache();
    // Restore anonymous state — the anonymous householdId in localStorage
    // is preserved (never overwritten by sign-in). Data is never lost.
    const anonId = getOrCreateAnonHouseholdId();
    setSession(null);
    setStatus("anonymous");
    setHouseholdId(anonId);
    // Navigate to dashboard in anonymous state — NOT to /sign-in.
    // The app is not gated. Returning to / shows the dashboard.
    window.location.href = "/";
  }, []);

  return (
    <AuthContext.Provider value={{ session, status, householdId, signOut }}>
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
