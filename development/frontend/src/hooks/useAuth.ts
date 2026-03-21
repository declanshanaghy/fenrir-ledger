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
 *   "anonymous"     — no session; householdId from localStorage("fenrir:household") if exists
 *
 * householdId:
 *   - Authenticated: session.user.sub (Google sub claim)
 *   - Anonymous (returning user): existing UUID from localStorage
 *   - Anonymous (new user): "" until ensureHouseholdId() is called
 *   - Loading: "" — callers must wait for status !== "loading"
 *
 * ensureHouseholdId:
 *   Lazily creates the anon householdId if not yet set. Call from interactive
 *   pages only (e.g. /ledger/cards/new) — never from public marketing pages.
 *
 * Usage:
 *   const { householdId, status, session, signOut } = useAuth();
 *
 *   // Wait for auth resolution before reading storage
 *   if (status === "loading") return;
 *   const cards = getCards(householdId);
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
   * The active householdId for storage operations.
   * "" while loading or for brand-new anonymous users. Use only after status resolves.
   */
  householdId: string;
  /** Sign out and return to dashboard in anonymous state */
  signOut: () => void;
  /**
   * Lazily creates and persists the anonymous householdId if not yet set.
   * Call from interactive pages only — not from public marketing pages.
   * Returns the existing householdId if already set.
   */
  ensureHouseholdId: () => string;
}

export function useAuth(): UseAuthReturn {
  const { session, status, householdId, signOut, ensureHouseholdId } = useAuthContext();
  return { data: session, status, householdId, signOut, ensureHouseholdId };
}
