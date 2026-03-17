"use client";

/**
 * useCloudSync — Fenrir Ledger
 *
 * Hook for cloud sync status. Tracks Firestore sync state for Karl users.
 * Thrall and free-trial users always remain in "idle" — this hook is safe
 * to call unconditionally.
 *
 * Returns:
 *   status       — "idle" | "syncing" | "synced" | "offline" | "error"
 *   lastSyncedAt — Date of last successful sync (null if never synced)
 *   cardCount    — Number of cards in last sync (null if unknown)
 *   errorMessage — Human-readable error description (null if no error)
 *   errorCode    — Machine-readable code e.g. "permission-denied" (null if no error)
 *   errorTimestamp — When the error occurred (null if no error)
 *   retryIn      — Seconds until auto-retry (null if not applicable)
 *   syncNow      — Trigger a manual sync (no-op for non-Karl)
 *   dismissError — Clear visible error state (does not stop background retries)
 *
 * State transitions:
 *   idle → syncing: syncNow() called (Karl only)
 *   syncing → synced: fenrir:cloud-sync-complete event
 *   syncing → error: fenrir:cloud-sync-error event
 *   synced → idle: after SYNCED_DISPLAY_MS elapsed
 *   error → syncing: syncNow() or auto-retry fires
 *   error → idle: dismissError()
 *   * → offline: navigator.onLine = false
 *   offline → idle/syncing: navigator.onLine = true
 *
 * Issue #1122 — wired to real API routes
 * Issue #1125 — initial state machine design
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useEntitlement } from "@/hooks/useEntitlement";
import { getRawAllCards, setAllCards } from "@/lib/storage";
import type { FenrirSession } from "@/lib/types";
import type { Card } from "@/lib/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How long to show the "synced" success state before returning to idle (ms) */
export const SYNCED_DISPLAY_MS = 3000;

/** Debounce delay for auto-sync on save (ms) — prevents syncing on every keystroke */
const AUTO_SYNC_DEBOUNCE_MS = 2000;

/** Delay before auto-retry after a sync error (ms) */
const AUTO_RETRY_MS = 30_000;

/** localStorage key to prevent repeat first-sync confirmation toast */
const LS_FIRST_SYNC_SHOWN = "fenrir:first-sync-shown";

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

/**
 * Dispatched when a cloud sync completes successfully.
 * Detail: { cardCount: number }
 */
const EVT_CLOUD_SYNC_COMPLETE = "fenrir:cloud-sync-complete";

/**
 * Dispatched when a cloud sync fails.
 * Detail: { errorMessage: string; errorCode: string; retryIn?: number }
 */
const EVT_CLOUD_SYNC_ERROR = "fenrir:cloud-sync-error";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CloudSyncStatus = "idle" | "syncing" | "synced" | "offline" | "error";

export interface CloudSyncState {
  status: CloudSyncStatus;
  lastSyncedAt: Date | null;
  cardCount: number | null;
  errorMessage: string | null;
  errorCode: string | null;
  errorTimestamp: Date | null;
  retryIn: number | null;
  syncNow: () => Promise<void>;
  dismissError: () => void;
}

// ---------------------------------------------------------------------------
// Session helper
// ---------------------------------------------------------------------------

/** Reads the FenrirSession from localStorage. Returns null if absent or invalid. */
function getSession(): FenrirSession | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem("fenrir:auth");
    if (!raw) return null;
    return JSON.parse(raw) as FenrirSession;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useCloudSync — returns cloud sync state + actions.
 *
 * Karl-only: for Thrall and free-trial users status is always "idle"
 * and all sync controls are no-ops.
 */
export function useCloudSync(): CloudSyncState {
  const { tier, isActive } = useEntitlement();
  // Karl-only: no sync for Thrall or free-trial users (#1122 acceptance criterion)
  const isKarl = tier === "karl" && isActive;

  const [status, setStatus] = useState<CloudSyncStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [cardCount, setCardCount] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorTimestamp, setErrorTimestamp] = useState<Date | null>(null);
  const [retryIn, setRetryIn] = useState<number | null>(null);

  /** Tracks previous Karl state to detect login transition */
  const prevIsKarlRef = useRef<boolean>(false);
  /** Prevents re-entrant sync calls */
  const syncInProgressRef = useRef<boolean>(false);
  /** Debounce timer for auto-sync on save */
  const autoSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Auto-retry timer */
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------
  // Core sync function (internal)
  // ---------------------------------------------------------------------------

  /**
   * Performs the actual push→merge→apply sync cycle against /api/sync/push.
   * Dispatches cloud sync events so other listeners can react.
   * Returns early (no-op) if already in progress or offline.
   */
  const performSync = useCallback(async (): Promise<void> => {
    if (!isKarl) return;
    if (syncInProgressRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline");
      return;
    }

    const session = getSession();
    if (!session?.id_token || !session?.user?.sub) return;

    const householdId = session.user.sub;
    const idToken = session.id_token;

    syncInProgressRef.current = true;
    setStatus("syncing");
    setErrorMessage(null);
    setErrorCode(null);
    setRetryIn(null);

    // Cancel any pending retry
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    try {
      // Gather all local cards including tombstones
      const localCards = getRawAllCards(householdId);

      const response = await fetch("/api/sync/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ householdId, cards: localCards }),
      });

      if (!response.ok) {
        let errCode = "sync_error";
        let errMsg = "Cloud sync failed.";
        try {
          const errBody = (await response.json()) as {
            error?: string;
            error_description?: string;
          };
          errCode = errBody.error ?? errCode;
          errMsg = errBody.error_description ?? errMsg;
        } catch {
          // ignore JSON parse failure
        }
        throw Object.assign(new Error(errMsg), { code: errCode });
      }

      const { cards: mergedCards, syncedCount } = (await response.json()) as {
        cards: Card[];
        syncedCount: number;
      };

      // Apply merged result back to localStorage.
      // Suppress re-triggering auto-sync by setting the in-progress flag
      // before setAllCards (which dispatches fenrir:sync).
      setAllCards(householdId, mergedCards);

      const wasFirstSync =
        typeof localStorage !== "undefined" &&
        localStorage.getItem(LS_FIRST_SYNC_SHOWN) !== "true";

      setLastSyncedAt(new Date());
      setCardCount(syncedCount);
      setStatus("synced");

      if (wasFirstSync) {
        try {
          localStorage.setItem(LS_FIRST_SYNC_SHOWN, "true");
        } catch {
          // localStorage full — skip
        }
        toast.success(
          `Your ${syncedCount} card${syncedCount !== 1 ? "s" : ""} have been backed up`,
          {
            description: "Yggdrasil guards your ledger.",
            duration: 5000,
          }
        );
      }

      window.dispatchEvent(
        new CustomEvent(EVT_CLOUD_SYNC_COMPLETE, {
          detail: { cardCount: syncedCount },
        })
      );
    } catch (err) {
      const typedErr = err as Error & { code?: string };
      const msg = typedErr.message ?? "Cloud sync failed.";
      const code = typedErr.code ?? "network_error";
      const retryInSeconds = Math.round(AUTO_RETRY_MS / 1000);

      setErrorMessage(msg);
      setErrorCode(code);
      setErrorTimestamp(new Date());
      setRetryIn(retryInSeconds);
      setStatus("error");

      // Non-blocking error toast
      toast.error("Sync failed", {
        description: "Your cards are safe locally. We'll retry shortly.",
        duration: Infinity,
        action: {
          label: "Settings",
          onClick: () => {
            window.location.href = "/ledger/settings";
          },
        },
      });

      window.dispatchEvent(
        new CustomEvent(EVT_CLOUD_SYNC_ERROR, {
          detail: { errorMessage: msg, errorCode: code, retryIn: retryInSeconds },
        })
      );

      // Schedule auto-retry
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        void performSync();
      }, AUTO_RETRY_MS);
    } finally {
      syncInProgressRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isKarl]);

  // ---------------------------------------------------------------------------
  // Online / offline detection
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isKarl) return;

    const handleOffline = () => {
      setStatus("offline");
    };

    const handleOnline = () => {
      setStatus("idle");
      // Re-sync when connectivity is restored
      void performSync();
    };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline");
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [isKarl, performSync]);

  // ---------------------------------------------------------------------------
  // Auto-sync on save: debounced listener on fenrir:sync events
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isKarl) return;

    const handleStorageSync = () => {
      // Debounce: rapid saves coalesce into a single sync
      if (autoSyncTimerRef.current) {
        clearTimeout(autoSyncTimerRef.current);
      }
      autoSyncTimerRef.current = setTimeout(() => {
        autoSyncTimerRef.current = null;
        if (!syncInProgressRef.current) {
          void performSync();
        }
      }, AUTO_SYNC_DEBOUNCE_MS);
    };

    window.addEventListener("fenrir:sync", handleStorageSync);
    return () => {
      window.removeEventListener("fenrir:sync", handleStorageSync);
      if (autoSyncTimerRef.current) {
        clearTimeout(autoSyncTimerRef.current);
        autoSyncTimerRef.current = null;
      }
    };
  }, [isKarl, performSync]);

  // ---------------------------------------------------------------------------
  // Sync on login: auto-pull when Karl user signs in
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const wasKarl = prevIsKarlRef.current;
    prevIsKarlRef.current = isKarl;

    // Trigger sync when transitioning from non-Karl → Karl (sign-in / upgrade)
    if (isKarl && !wasKarl) {
      void performSync();
    }
  }, [isKarl, performSync]);

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (autoSyncTimerRef.current) clearTimeout(autoSyncTimerRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Synced → idle auto-transition after SYNCED_DISPLAY_MS
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (status !== "synced") return;
    const timer = setTimeout(() => {
      setStatus("idle");
    }, SYNCED_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [status]);

  // ---------------------------------------------------------------------------
  // retryIn countdown (cosmetic — updates every second)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (retryIn === null || retryIn <= 0) return;
    const interval = setInterval(() => {
      setRetryIn((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [retryIn]);

  // ---------------------------------------------------------------------------
  // Public actions
  // ---------------------------------------------------------------------------

  const syncNow = useCallback(async (): Promise<void> => {
    if (!isKarl) return;
    await performSync();
  }, [isKarl, performSync]);

  const dismissError = useCallback((): void => {
    if (status !== "error") return;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    setErrorMessage(null);
    setErrorCode(null);
    setErrorTimestamp(null);
    setRetryIn(null);
    setStatus("idle");
    // Background retries stopped — user explicitly dismissed
  }, [status]);

  return {
    status,
    lastSyncedAt,
    cardCount,
    errorMessage,
    errorCode,
    errorTimestamp,
    retryIn,
    syncNow,
    dismissError,
  };
}
