"use client";

/**
 * TrialStatusContext — Fenrir Ledger
 *
 * React context that owns the client-side trial status state.
 * Fetches /api/trial/status ONCE on mount (at the app layout level)
 * and distributes the result to all consumers via context.
 *
 * Replaces the per-component fetch pattern that caused 8x API calls
 * per page load (Issue #1616).
 *
 * Refreshes every 4 minutes — never on every component render.
 *
 * @module contexts/TrialStatusContext
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  computeFingerprint,
  LS_TRIAL_CACHE_VERSION,
  TRIAL_CACHE_VERSION,
} from "@/lib/trial-utils";
import { ensureFreshToken } from "@/lib/auth/refresh-session";
import type { TrialStatus, TrialStatusResponse } from "@/lib/trial-utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Refresh interval: 4 minutes in milliseconds. */
const REFRESH_INTERVAL_MS = 4 * 60 * 1000;

/** Cache TTL: 4 minutes — same as refresh interval. */
const CACHE_TTL_MS = REFRESH_INTERVAL_MS;

// ---------------------------------------------------------------------------
// Module-level cache (shared across provider instances)
// ---------------------------------------------------------------------------

interface CachedTrialStatus {
  data: TrialStatusResponse;
  fetchedAt: number;
}

let cachedStatus: CachedTrialStatus | null = null;

/**
 * Module-level ref to the provider's refresh function.
 * Allows clearTrialStatusCache() to trigger an immediate refetch
 * without requiring callers to hold a reference to the hook.
 */
let externalRefreshFn: (() => Promise<void>) | null = null;

/**
 * Clears the module-level trial status cache and triggers an immediate
 * provider refetch if a TrialStatusProvider is mounted.
 * Call after trial init to force a fresh fetch.
 */
export function clearTrialStatusCache(): void {
  cachedStatus = null;
  if (externalRefreshFn) {
    void externalRefreshFn();
  }
}

// ---------------------------------------------------------------------------
// Context types
// ---------------------------------------------------------------------------

export interface TrialStatusContextValue {
  /** Number of days remaining in the trial (0 if none/expired/converted). */
  remainingDays: number;
  /** Current trial status. */
  status: TrialStatus;
  /** ISO date when the user converted to Karl (if applicable). */
  convertedDate?: string;
  /** Whether the context is currently fetching data. */
  isLoading: boolean;
  /** Manually trigger a refresh. */
  refresh: () => Promise<void>;
}

const DEFAULT_VALUE: TrialStatusContextValue = {
  remainingDays: 0,
  status: "none",
  isLoading: true,
  refresh: async () => {},
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export const TrialStatusContext = createContext<TrialStatusContextValue>(DEFAULT_VALUE);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface TrialStatusProviderProps {
  children: ReactNode;
}

export function TrialStatusProvider({ children }: TrialStatusProviderProps) {
  const [data, setData] = useState<TrialStatusResponse>({
    remainingDays: 0,
    status: "none",
  });
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    // Bust the module-level cache if the stored cache version differs from the
    // current expected version. This handles post-migration scenarios where the
    // server's backend changed (e.g. Redis → Firestore in #1516/#1589) and the
    // in-memory cache may contain phantom trial data from the old store.
    const storedVersion =
      typeof window !== "undefined" ? localStorage.getItem(LS_TRIAL_CACHE_VERSION) : null;
    if (storedVersion !== String(TRIAL_CACHE_VERSION)) {
      cachedStatus = null;
    }

    // Check cache first (only if version is current)
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

      // Persist the server's cache version so future page loads can detect
      // version mismatches without having to hit the network first.
      if (typeof window !== "undefined" && result.cacheVersion !== undefined) {
        localStorage.setItem(LS_TRIAL_CACHE_VERSION, String(result.cacheVersion));
      }

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

  // Register the provider's refresh fn so clearTrialStatusCache() can trigger
  // an immediate refetch from outside React.
  useEffect(() => {
    externalRefreshFn = fetchStatus;
    return () => {
      externalRefreshFn = null;
    };
  }, [fetchStatus]);

  useEffect(() => {
    void fetchStatus();

    // Set up periodic refresh every 4 minutes
    intervalRef.current = setInterval(() => {
      void fetchStatus();
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchStatus]);

  const value: TrialStatusContextValue = {
    remainingDays: data.remainingDays,
    status: data.status,
    ...(data.convertedDate !== undefined ? { convertedDate: data.convertedDate } : {}),
    isLoading,
    refresh: fetchStatus,
  };

  return (
    <TrialStatusContext.Provider value={value}>
      {children}
    </TrialStatusContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Consumer hook
// ---------------------------------------------------------------------------

/**
 * useTrialStatusContext — returns the raw TrialStatusContextValue.
 * Must be used inside a <TrialStatusProvider>.
 */
export function useTrialStatusContext(): TrialStatusContextValue {
  return useContext(TrialStatusContext);
}
