"use client";

/**
 * useAuth — Fenrir Ledger
 *
 * Thin wrapper over AuthContext. Exposes session, auth status,
 * householdId, and signOut in a single convenient hook.
 *
 * Status values:
 *   "loading"       — session evaluation in progress
 *   "authenticated" — signed-in via Google PKCE flow
 *   "anonymous"     — no session; householdId from localStorage("fenrir:household")
 *
 * householdId:
 *   Always the correct ID to pass to storage.ts functions, regardless of
 *   auth state. Callers should wait for status !== "loading" before using it.
 *
 * Usage:
 *   const { householdId, status, session, signOut } = useAuth();
 *
 *   // Wait for auth resolution before reading storage
 *   if (status === "loading") return;
 *   initializeHousehold(householdId);
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
   * "" while status === "loading". Use only after status resolves.
   */
  householdId: string;
  /** Sign out and return to dashboard in anonymous state */
  signOut: () => void;
}

export function useAuth(): UseAuthReturn {
  const { session, status, householdId, signOut } = useAuthContext();
  return { data: session, status, householdId, signOut };
}
