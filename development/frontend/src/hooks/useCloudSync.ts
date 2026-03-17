"use client";

/**
 * useCloudSync — Fenrir Ledger
 *
 * Hook for cloud sync status. Tracks Firestore sync state for Karl/trial users.
 * Thrall users always remain in "idle" — this hook is safe to call unconditionally.
 *
 * Returns:
 *   status       — "idle" | "syncing" | "synced" | "offline" | "error"
 *   lastSyncedAt — Date of last successful sync (null if never synced)
 *   cardCount    — Number of cards in last sync (null if unknown)
 *   errorMessage — Human-readable error description (null if no error)
 *   errorCode    — Machine-readable code e.g. "permission-denied" (null if no error)
 *   errorTimestamp — When the error occurred (null if no error)
 *   retryIn      — Seconds until auto-retry (null if not applicable)
 *   syncNow      — Trigger a manual sync (no-op for Thrall)
 *   dismissError — Clear visible error state (does not stop background retries)
 *
 * State transitions:
 *   idle → syncing: fenrir:cloud-sync-start event (Karl only)
 *   syncing → synced: fenrir:cloud-sync-complete event
 *   syncing → error: fenrir:cloud-sync-error event
 *   synced → idle: after SYNCED_DISPLAY_MS elapsed
 *   error → syncing: syncNow() or auto-retry fires fenrir:cloud-sync-start
 *   error → idle: dismissError()
 *   * → offline: navigator.onLine = false
 *   offline → idle/syncing: navigator.onLine = true
 *
 * Issue #1125
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useIsKarlOrTrial } from "@/hooks/useIsKarlOrTrial";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How long to show the "synced" success state before returning to idle (ms) */
export const SYNCED_DISPLAY_MS = 3000;

/** localStorage key to prevent repeat first-sync confirmation toast */
const LS_FIRST_SYNC_SHOWN = "fenrir:first-sync-shown";

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

/**
 * Dispatched when a cloud sync starts.
 * Detail: { cardCount?: number }
 */
const EVT_CLOUD_SYNC_START = "fenrir:cloud-sync-start";

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
// Hook
// ---------------------------------------------------------------------------

/**
 * useCloudSync — returns cloud sync state + actions.
 *
 * Both SyncIndicator and SyncSettingsSection consume this hook.
 * For Thrall users status is always "idle" — all sync controls are no-ops.
 */
export function useCloudSync(): CloudSyncState {
  const isKarlOrTrial = useIsKarlOrTrial();

  const [status, setStatus] = useState<CloudSyncStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [cardCount, setCardCount] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorTimestamp, setErrorTimestamp] = useState<Date | null>(null);
  const [retryIn, setRetryIn] = useState<number | null>(null);

  // Track previous status to detect syncing → synced transition
  const prevStatusRef = useRef<CloudSyncStatus>("idle");

  // ---------------------------------------------------------------------------
  // Online / offline detection
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isKarlOrTrial) return;

    const handleOffline = () => {
      setStatus((prev) => {
        prevStatusRef.current = prev;
        return "offline";
      });
    };

    const handleOnline = () => {
      // Restore to idle (pending sync will re-trigger via fenrir:cloud-sync-start)
      setStatus("idle");
    };

    if (!navigator.onLine) {
      setStatus("offline");
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [isKarlOrTrial]);

  // ---------------------------------------------------------------------------
  // Cloud sync events
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isKarlOrTrial) return;

    const handleSyncStart = () => {
      setStatus("syncing");
      setErrorMessage(null);
      setErrorCode(null);
      setErrorTimestamp(null);
      setRetryIn(null);
    };

    const handleSyncComplete = (e: Event) => {
      const detail = (e as CustomEvent<{ cardCount?: number }>).detail ?? {};
      const count = detail.cardCount ?? null;

      const wasFirstSync =
        typeof localStorage !== "undefined" &&
        localStorage.getItem(LS_FIRST_SYNC_SHOWN) !== "true";

      setLastSyncedAt(new Date());
      setCardCount(count);
      setStatus("synced");

      // First-sync confirmation toast (fires once per browser)
      if (wasFirstSync && count !== null) {
        try {
          localStorage.setItem(LS_FIRST_SYNC_SHOWN, "true");
        } catch {
          // localStorage unavailable — skip
        }
        toast.success(
          `Your ${count} card${count !== 1 ? "s" : ""} have been backed up`,
          {
            description: "Yggdrasil guards your ledger.",
            duration: 5000,
          }
        );
      }
    };

    const handleSyncError = (e: Event) => {
      const detail = (
        e as CustomEvent<{ errorMessage?: string; errorCode?: string; retryIn?: number }>
      ).detail ?? {};

      setErrorMessage(detail.errorMessage ?? "Cloud sync failed.");
      setErrorCode(detail.errorCode ?? null);
      setErrorTimestamp(new Date());
      setRetryIn(detail.retryIn ?? null);
      setStatus("error");

      // Non-blocking error toast (does NOT auto-dismiss)
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
    };

    window.addEventListener(EVT_CLOUD_SYNC_START, handleSyncStart);
    window.addEventListener(EVT_CLOUD_SYNC_COMPLETE, handleSyncComplete);
    window.addEventListener(EVT_CLOUD_SYNC_ERROR, handleSyncError);

    return () => {
      window.removeEventListener(EVT_CLOUD_SYNC_START, handleSyncStart);
      window.removeEventListener(EVT_CLOUD_SYNC_COMPLETE, handleSyncComplete);
      window.removeEventListener(EVT_CLOUD_SYNC_ERROR, handleSyncError);
    };
  }, [isKarlOrTrial]);

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
  // Retryln countdown (cosmetic — updates every second)
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
  // Actions
  // ---------------------------------------------------------------------------

  const syncNow = useCallback(async (): Promise<void> => {
    if (!isKarlOrTrial) return;
    if (status === "syncing") return;
    // Optimistic: immediately enter syncing state
    setStatus("syncing");
    setErrorMessage(null);
    setErrorCode(null);
    setRetryIn(null);
    // Dispatch the standard sync event — storage layer or cloud sync service handles it
    window.dispatchEvent(new CustomEvent(EVT_CLOUD_SYNC_START, { detail: {} }));
  }, [isKarlOrTrial, status]);

  const dismissError = useCallback((): void => {
    if (status !== "error") return;
    setErrorMessage(null);
    setErrorCode(null);
    setErrorTimestamp(null);
    setRetryIn(null);
    setStatus("idle");
    // Background retries may continue — we only clear the visible error state
  }, [status]);

  // ---------------------------------------------------------------------------
  // Track previous status for transition detection
  // ---------------------------------------------------------------------------

  useEffect(() => {
    prevStatusRef.current = status;
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
