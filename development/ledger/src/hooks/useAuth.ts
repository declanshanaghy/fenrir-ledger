"use client";

/**
 * useAuth — Fenrir Ledger
 *
 * Thin wrapper over AuthContext. Exposes session, auth status,
 * householdId, signOut, and ensureHouseholdId in a single convenient hook.
 *
 * Status values:
 *   "loading"       — session evaluation in progress
 *   "authenticated" — signed-in via Google PKCE flow
 *   "anonymous"     — no session; householdId = null
 *
 * householdId (Issue #1671):
 *   - Authenticated: session.user.sub (Google sub claim)
 *   - Anonymous: null — use ANON_HOUSEHOLD_ID ("anon") for storage
 *   - Loading: null — callers must wait for status !== "loading"
 *
 *   Pages should resolve storage key with: householdId ?? ANON_HOUSEHOLD_ID
 *
 * ensureHouseholdId:
 *   Returns the effective storage ID: householdId for authenticated users,
 *   ANON_HOUSEHOLD_ID ("anon") for anonymous users.
 *
 * Usage:
 *   const { householdId, status, session, signOut } = useAuth();
 *
 *   // Wait for auth resolution before reading storage
 *   if (status === "loading") return;
 *   const effectiveId = householdId ?? ANON_HOUSEHOLD_ID;
 *   const cards = getCards(effectiveId);
 */

import { useAuthContext } from "@/contexts/AuthContext";
import type { FenrirSession } from "@/lib/types";
import type { AuthStatus } from "@/contexts/AuthContext";

export interface UseAuthReturn {
  /** The signed-in session, or null for anonymous/loading states */
  data: FenrirSession | null;
  /** Auth resolution status */
  status: AuthStatus;
  /**
   * The active householdId for authenticated storage operations.
   * null while loading or for anonymous users. Use only after status resolves.
   * Resolve with: householdId ?? ANON_HOUSEHOLD_ID
   */
  householdId: string | null;
  /** Sign out and return to dashboard in anonymous state */
  signOut: () => void;
  /**
   * Returns the effective storage ID: householdId for authenticated,
   * ANON_HOUSEHOLD_ID ("anon") for anonymous users.
   */
  ensureHouseholdId: () => string;
}

export function useAuth(): UseAuthReturn {
  const { session, status, householdId, signOut, ensureHouseholdId } = useAuthContext();
  return { data: session, status, householdId, signOut, ensureHouseholdId };
}
