"use client";

/**
 * useTrialStatus — Fenrir Ledger
 *
 * Hook for reading trial status from TrialStatusContext.
 * The actual API fetch is handled by TrialStatusProvider (Issue #1616).
 * This hook is a thin context reader — no API call per component.
 *
 * Usage:
 *   const { remainingDays, status, isLoading } = useTrialStatus();
 *
 * @module hooks/useTrialStatus
 */

import {
  useTrialStatusContext,
  clearTrialStatusCache,
  type TrialStatusContextValue,
} from "@/contexts/TrialStatusContext";
import type { TrialStatus } from "@/lib/trial-utils";

// Re-export for backward compatibility with callers that import clearTrialStatusCache
// from this module (CardForm, ledger/page, auth/callback/page).
export { clearTrialStatusCache };

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface UseTrialStatusReturn {
  /** Number of days remaining in the trial (0 if none/expired/converted). */
  remainingDays: number;
  /** Current trial status. */
  status: TrialStatus;
  /** ISO timestamp of when the trial expires — canonical source of truth from Firestore. */
  expiresAt?: string;
  /** ISO date when the user converted to Karl (if applicable). */
  convertedDate?: string;
  /** Whether the context is currently fetching data. */
  isLoading: boolean;
  /** Manually trigger a refresh. */
  refresh: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Reads trial status from the nearest TrialStatusProvider.
 * No API call — data is fetched once by the provider and distributed here.
 *
 * @returns Trial status, loading state, and refresh function
 */
export function useTrialStatus(): UseTrialStatusReturn {
  const ctx: TrialStatusContextValue = useTrialStatusContext();
  return {
    remainingDays: ctx.remainingDays,
    status: ctx.status,
    ...(ctx.expiresAt !== undefined ? { expiresAt: ctx.expiresAt } : {}),
    ...(ctx.convertedDate !== undefined ? { convertedDate: ctx.convertedDate } : {}),
    isLoading: ctx.isLoading,
    refresh: ctx.refresh,
  };
}
