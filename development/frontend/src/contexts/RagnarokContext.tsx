"use client";

/**
 * RagnarokContext — Fenrir Ledger
 *
 * Tracks whether Ragnarök Threshold Mode is active.
 *
 * Ragnarök is active when ≥5 cards have status "fee_approaching" or
 * "promo_expiring". This triggers a persistent visual overlay across the
 * entire app, a changed document title, and intensified easter egg animations.
 *
 * Exception: The /valhalla route is always peaceful — ragnarokActive is
 * forced to false there regardless of card count.
 *
 * Recomputes on:
 * - Initial auth resolution (status transitions away from "loading")
 * - `fenrir:sync` CustomEvent (dispatched by storage mutations)
 *
 * See Story 4.1 for design context.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getAllCardsGlobal } from "@/lib/storage";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RagnarokContextValue {
  /** True when ≥5 cards have fee_approaching or promo_expiring status */
  ragnarokActive: boolean;
}

// ── Context ───────────────────────────────────────────────────────────────────

const RagnarokContext = createContext<RagnarokContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

interface RagnarokProviderProps {
  children: ReactNode;
}

export function RagnarokProvider({ children }: RagnarokProviderProps) {
  const { householdId, status } = useAuth();
  const pathname = usePathname();
  const [ragnarokActive, setRagnarokActive] = useState(false);

  const computeRagnarok = useCallback(() => {
    // Valhalla is always peaceful — no Ragnarök there.
    if (pathname === "/valhalla") {
      setRagnarokActive(false);
      return;
    }

    // Wait for auth to resolve before reading storage.
    if (status === "loading" || !householdId) {
      setRagnarokActive(false);
      return;
    }

    const cards = getAllCardsGlobal(householdId);
    const urgentCount = cards.filter(
      (c) => c.status === "fee_approaching" || c.status === "promo_expiring"
    ).length;

    setRagnarokActive(urgentCount >= 5);
  }, [householdId, pathname, status]);

  // Recompute whenever auth state or route changes.
  useEffect(() => {
    computeRagnarok();
  }, [computeRagnarok]);

  // Recompute when cards are mutated (storage sync event).
  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleSync() {
      computeRagnarok();
    }

    window.addEventListener("fenrir:sync", handleSync);
    return () => {
      window.removeEventListener("fenrir:sync", handleSync);
    };
  }, [computeRagnarok]);

  return (
    <RagnarokContext.Provider value={{ ragnarokActive }}>
      {children}
    </RagnarokContext.Provider>
  );
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

/**
 * useRagnarok — returns the RagnarokContextValue.
 * Throws if used outside <RagnarokProvider>.
 */
export function useRagnarok(): RagnarokContextValue {
  const ctx = useContext(RagnarokContext);
  if (!ctx) {
    throw new Error("useRagnarok must be used within <RagnarokProvider>");
  }
  return ctx;
}
