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
 *            householdId = getAnonHouseholdId() (read-only, no eager creation)
 *            If no anon UUID exists yet, householdId = "" until ensureHouseholdId() is called.
 *
 * NEVER redirects to /sign-in automatically. All app routes are accessible
 * without authentication. Sign-in is an opt-in upgrade path.
 *
 * signOut():
 *  - Clears the auth session from localStorage.
 *  - Restores the anonymous householdId from "fenrir:household" (read-only).
 *  - Navigates to / (dashboard in anonymous state), NOT to /sign-in.
 *
 * Household creation contract (Issue #1670):
 *  - Anonymous users: householdId is read from localStorage only (no eager write).
 *    Visiting public/marketing pages never creates a household.
 *  - Household UUID is created LAZILY via ensureHouseholdId() only when the user
 *    explicitly navigates to an interactive page (e.g. /ledger/cards/new).
 *  - Authenticated users: householdId = session.user.sub (Google sub claim).
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
import { getAnonHouseholdId, getOrCreateAnonHouseholdId } from "@/lib/auth/household";
import { clearEntitlementCache } from "@/lib/entitlement/cache";
import { refreshSession } from "@/lib/auth/refresh-session";
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
   * - Anonymous (returning): UUID from localStorage("fenrir:household") if it exists
   * - Anonymous (new user): "" until ensureHouseholdId() is called
   * - Loading: "" (empty — callers must wait for status !== "loading")
   */
  householdId: string;
  /** Sign out: clears session, restores anonymous state, navigates to / */
  signOut: () => void;
  /**
   * Lazily creates and persists the anonymous householdId if not yet set.
   * Safe to call repeatedly — idempotent.
   * Returns the existing householdId if one is already set (authenticated or returning anon).
   * Only creates a new UUID for brand-new anonymous users who have never interacted.
   *
   * Call this from interactive pages (e.g. /ledger/cards/new) — NOT on public/marketing pages.
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
  const [householdId, setHouseholdId] = useState<string>("");

  // Evaluate the stored session once on mount (client-only).
  useEffect(() => {
    if (typeof window === "undefined") return;

    async function initializeAuth() {
      const stored = getSession();

      if (stored && isSessionValid()) {
        // Authenticated: use session sub as householdId
        setSession(stored);
        setStatus("authenticated");
        setHouseholdId(stored.user.sub);
      } else if (stored?.refresh_token) {
        // Session expired but we have a refresh token — attempt to refresh
        try {
          const refreshed = await refreshSession();
          if (refreshed) {
            // Successfully refreshed the session
            setSession(refreshed);
            setStatus("authenticated");
            setHouseholdId(refreshed.user.sub);
            return;
          }
        } catch (err) {
          // Refresh failed, fall through to anonymous
          console.error("[Fenrir] Session refresh failed:", err);
        }
        // Refresh failed or returned null — treat as anonymous.
        // Read-only anon UUID (Issue #1670): do not create eagerly.
        setSession(null);
        setStatus("anonymous");
        setHouseholdId(getAnonHouseholdId() ?? "");
      } else {
        // No session or no refresh token — anonymous user.
        // Read existing anon UUID (read-only) — do NOT create eagerly (Issue #1670).
        // Visiting public pages like /chronicles must not write to localStorage.
        setSession(null);
        setStatus("anonymous");
        setHouseholdId(getAnonHouseholdId() ?? "");
      }
    }

    initializeAuth();
  }, []);

  /**
   * Lazily creates and persists the anonymous householdId when first needed.
   * Only called from interactive pages (e.g. /ledger/cards/new), not on mount.
   * Stable reference — only changes when householdId changes.
   */
  const ensureHouseholdId = useCallback((): string => {
    if (householdId) return householdId;
    const id = getOrCreateAnonHouseholdId();
    setHouseholdId(id);
    return id;
  }, [householdId]);

  const signOut = useCallback(() => {
    clearSession();
    // Clear entitlement cache on sign-out — the user's subscription link
    // is associated with their Google identity, not the anonymous identity.
    clearEntitlementCache();
    // Restore anonymous state — read the existing anon UUID (read-only).
    // Do NOT create a new UUID eagerly on signout (Issue #1670).
    // If there's no anon UUID, householdId becomes "" and the dashboard shows empty.
    const anonId = getAnonHouseholdId() ?? "";
    setSession(null);
    setStatus("anonymous");
    setHouseholdId(anonId);
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
