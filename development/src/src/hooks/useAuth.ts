"use client";

/**
 * useAuth — Fenrir Ledger
 *
 * Thin wrapper over AuthContext. Return shape mirrors useSession() from
 * next-auth/react so all call sites are a one-line import swap.
 *
 * Return shape:
 *   {
 *     data: FenrirSession | null,        ← was "data: Session | null"
 *     status: "loading" | "authenticated" | "unauthenticated",
 *     signOut: () => void
 *   }
 *
 * Usage:
 *   const { data: session, status, signOut } = useAuth();
 *   const householdId = session?.user?.sub ?? "";
 */

import { useAuthContext } from "@/contexts/AuthContext";
import type { FenrirSession } from "@/lib/types";

export interface UseAuthReturn {
  data: FenrirSession | null;
  status: "loading" | "authenticated" | "unauthenticated";
  signOut: () => void;
}

export function useAuth(): UseAuthReturn {
  const { session, status, signOut } = useAuthContext();
  return { data: session, status, signOut };
}
