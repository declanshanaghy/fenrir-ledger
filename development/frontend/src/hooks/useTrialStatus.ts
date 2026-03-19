"use client";

/**
 * useTrialStatus — Fenrir Ledger
 *
 * Hook for fetching and caching trial status from /api/trial/status.
 * Calls the API on mount and refreshes every 5 minutes.
 * Caches the response in a module-level variable to avoid excessive API calls.
 *
 * Usage:
 *   const { remainingDays, status, isLoading } = useTrialStatus();
 *
 * @module hooks/useTrialStatus
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { computeFingerprint } from "@/lib/trial-utils";
import { ensureFreshToken } from "@/lib/auth/refresh-session";
import type { TrialStatus, TrialStatusResponse } from "@/lib/trial-utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Refresh interval: 5 minutes in milliseconds. */
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/** Cache TTL: 4 minutes in milliseconds (slightly less than refresh interval). */
const CACHE_TTL_MS = 4 * 60 * 1000;

// ---------------------------------------------------------------------------
// Module-level cache
// ---------------------------------------------------------------------------

interface CachedTrialStatus {
  data: TrialStatusResponse;
  fetchedAt: number;
}

let cachedStatus: CachedTrialStatus | null = null;

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface UseTrialStatusReturn {
  /** Number of days remaining in the trial (0 if none/expired/converted). */
  remainingDays: number;
  /** Current trial status. */
  status: TrialStatus;
  /** ISO date when the user converted to Karl (if applicable). */
  convertedDate?: string;
  /** Whether the hook is currently fetching data. */
  isLoading: boolean;
  /** Manually trigger a refresh. */
  refresh: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches and caches trial status from /api/trial/status.
 * Refreshes every 5 minutes while mounted.
 *
 * @returns Trial status, loading state, and refresh function
 */
export function useTrialStatus(): UseTrialStatusReturn {
  const [data, setData] = useState<TrialStatusResponse>({
    remainingDays: 0,
    status: "none",
  });
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    // Check cache first
    if (cachedStatus && Date.now() - cachedStatus.fetchedAt < CACHE_TTL_MS) {
      setData(cachedStatus.data);
      setIsLoading(false);
      return;
    }

    try {
      const fingerprint = await computeFingerprint();
      if (!fingerprint) {
        setIsLoading(false);
        return;
      }

      // Supports anonymous users — no auth token required (Issue #1413)
      const token = await ensureFreshToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("/api/trial/status", {
        method: "POST",
        headers,
        body: JSON.stringify({ fingerprint }),
      });

      if (!response.ok) {
        console.debug("[Fenrir] Trial status API returned", response.status);
        setIsLoading(false);
        return;
      }

      const result = (await response.json()) as TrialStatusResponse;

      // Update cache
      cachedStatus = { data: result, fetchedAt: Date.now() };
      setData(result);
    } catch (err) {
      console.debug(
        "[Fenrir] Trial status fetch failed:",
        err instanceof Error ? err.message : err,
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();

    // Set up periodic refresh
    intervalRef.current = setInterval(() => {
      void fetchStatus();
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchStatus]);

  return {
    remainingDays: data.remainingDays,
    status: data.status,
    ...(data.convertedDate !== undefined ? { convertedDate: data.convertedDate } : {}),
    isLoading,
    refresh: fetchStatus,
  };
}

/**
 * Clears the module-level trial status cache.
 * Call after trial init to force a fresh fetch.
 */
export function clearTrialStatusCache(): void {
  cachedStatus = null;
}
