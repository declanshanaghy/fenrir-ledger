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
 * Issue #1172 — auth gating, restore vs backup message, push loop fix
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useEntitlement } from "@/hooks/useEntitlement";
import { useAuthContext } from "@/contexts/AuthContext";
import { getRawAllCards, setAllCards } from "@/lib/storage";
import { hasMigrated, runMigration } from "@/lib/sync/migration";
import type { FenrirSession } from "@/lib/types";
import type { Card } from "@/lib/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How long to show the "synced" success state before returning to idle (ms) */
export const SYNCED_DISPLAY_MS = 3000;

/**
 * Debounce delay for auto-sync on card changes (ms).
 *
 * Increased from 2s → 10s in Issue #1172 to prevent over-eager syncing.
 * The listener is now "fenrir:cards-changed" (user-initiated writes only),
 * NOT "fenrir:sync" (which fires on every write including internal sync merges).
 */
export const AUTO_SYNC_DEBOUNCE_MS = 10_000;

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

/** Custom event name fired when cards change — triggers debounced cloud push */
export const EVT_CARDS_CHANGED = "fenrir:cards-changed";

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
 *
 * Auth-gated (Issue #1172): sync does NOT fire while auth is in "loading" state.
 * This prevents the race where a cached Karl entitlement triggers a pull before
 * the session token has been validated/refreshed by AuthContext.
 */
export function useCloudSync(): CloudSyncState {
  const { tier, isActive } = useEntitlement();
  const { status: authStatus } = useAuthContext();

  // Auth must be confirmed before we attempt any sync.
  // During "loading", the session token may be expired and awaiting refresh.
  const isAuthenticated = authStatus === "authenticated";

  // Karl-only: no sync for Thrall or free-trial users (#1122 acceptance criterion)
  // Also gated on isAuthenticated to prevent pre-auth sync (#1172)
  const isKarl = isAuthenticated && tier === "karl" && isActive;

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
  /** Debounce timer for auto-sync on card changes */
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
    setErrorTimestamp(null);
    setRetryIn(null);

    // Cancel any pending retry
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    try {
      // Gather all local cards including tombstones.
      // Snapshot the local active count BEFORE sync to determine message direction.
      const localCards = getRawAllCards(householdId);
      const localActiveCount = localCards.filter((c) => !c.deletedAt).length;

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

      // Apply merged result back to localStorage using setAllCards.
      // setAllCards dispatches "fenrir:sync" (NOT "fenrir:cards-changed") so the
      // auto-sync debounce listener is not triggered — no push loop. (#1172)
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

        // Determine sync direction for the correct user-facing message (#1172):
        //   "restored from cloud" — local was empty, cards came from Firestore
        //   "backed up"          — local had cards that were pushed to Firestore
        const isRestoring = localActiveCount === 0 && syncedCount > 0;
        const plural = syncedCount !== 1;
        const verb = plural ? "have" : "has";
        const cardWord = plural ? "cards" : "card";

        if (isRestoring) {
          toast.success(
            `Your ${syncedCount} ${cardWord} ${verb} been restored from cloud`,
            {
              description: "Yggdrasil guards your ledger.",
              duration: 5000,
            }
          );
        } else {
          toast.success(
            `Your ${syncedCount} ${cardWord} ${verb} been backed up`,
            {
              description: "Yggdrasil guards your ledger.",
              duration: 5000,
            }
          );
        }
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
  // Migration + login sync
  //
  // Issue #1124: On first Karl sign-in, run the one-time localStorage →
  // Firestore migration before falling through to regular sync.
  // ---------------------------------------------------------------------------

  /**
   * Runs on the non-Karl → Karl transition (sign-in or upgrade).
   *
   * If the user has not yet been migrated (fenrir:migrated flag absent):
   *   - Runs runMigration() which pushes local cards, merges with cloud (LWW),
   *     applies merged result to localStorage, and marks the flag.
   *   - Shows an appropriate toast: "restored from cloud" or "backed up".
   *   - Also sets LS_FIRST_SYNC_SHOWN so performSync won't re-show a toast.
   *   - Dispatches fenrir:cloud-sync-complete for UI listeners.
   *   - On migration error: falls back to regular performSync.
   *
   * If already migrated: delegates to regular performSync.
   */
  const handleLoginTransition = useCallback(async (): Promise<void> => {
    if (!isKarl) return;
    if (syncInProgressRef.current) return;

    const session = getSession();
    if (!session?.id_token || !session?.user?.sub) return;

    const householdId = session.user.sub;
    const idToken = session.id_token;

    if (hasMigrated()) {
      // Already migrated on a previous sign-in — run normal sync
      void performSync();
      return;
    }

    // First Karl sign-in: run migration
    syncInProgressRef.current = true;
    setStatus("syncing");
    setErrorMessage(null);
    setErrorCode(null);
    setRetryIn(null);

    // Tracks whether migration failed so we can fall back AFTER finally releases the lock.
    // (Setting this inside catch and calling performSync inside finally creates a race
    // where finally clears syncInProgressRef.current while performSync is already running.)
    let migrationFailed = false;

    try {
      const result = await runMigration(householdId, idToken);

      setLastSyncedAt(new Date());
      setCardCount(result.cardCount);
      setStatus("synced");

      // Show migration toast when cards were actually involved
      if (result.ran && result.cardCount > 0) {
        const plural = result.cardCount !== 1;
        const verb = plural ? "have" : "has";
        const cardWord = plural ? "cards" : "card";

        if (result.direction === "download") {
          toast.success(
            `Your ${result.cardCount} ${cardWord} ${verb} been restored from cloud`,
            { description: "Yggdrasil guards your ledger.", duration: 5000 }
          );
        } else {
          // "upload" or "merge" — user's local cards were backed up
          toast.success(
            `Your ${result.cardCount} ${cardWord} ${verb} been backed up to the cloud`,
            { description: "Yggdrasil guards your ledger.", duration: 5000 }
          );
        }
      }

      // Suppress the first-sync toast in subsequent performSync calls
      try {
        localStorage.setItem(LS_FIRST_SYNC_SHOWN, "true");
      } catch {
        // localStorage full — ignore
      }

      window.dispatchEvent(
        new CustomEvent(EVT_CLOUD_SYNC_COMPLETE, {
          detail: { cardCount: result.cardCount },
        })
      );
    } catch {
      // Migration failed — will fall back to regular performSync after lock is released.
      // (markMigrated() is only called on success, so migration retries next sign-in.)
      migrationFailed = true;
    } finally {
      syncInProgressRef.current = false;
    }

    if (migrationFailed) {
      // Fallback after finally releases the lock — performSync can now acquire it cleanly.
      void performSync();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isKarl, performSync]);

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
  // Auto-sync on card changes: debounced listener on fenrir:cards-changed
  //
  // Issue #1172 — listen to "fenrir:cards-changed" (user-initiated writes only),
  // NOT "fenrir:sync" (which fires on every setAllCards including internal merge
  // writes). This breaks the push loop where performSync→setAllCards→fenrir:sync
  // →debounce→performSync would repeat indefinitely.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isKarl) return;

    const handleCardsChanged = () => {
      // Debounce: rapid saves coalesce into a single sync.
      // Skip entirely if a sync is already in progress.
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

    window.addEventListener(EVT_CARDS_CHANGED, handleCardsChanged);
    return () => {
      window.removeEventListener(EVT_CARDS_CHANGED, handleCardsChanged);
      if (autoSyncTimerRef.current) {
        clearTimeout(autoSyncTimerRef.current);
        autoSyncTimerRef.current = null;
      }
    };
  }, [isKarl, performSync]);

  // ---------------------------------------------------------------------------
  // Sync on login: migration-aware sign-in handler
  //
  // Issue #1172: isKarl now includes isAuthenticated, so this transition
  // correctly fires only after auth is confirmed (not from stale cache).
  // Issue #1124: handleLoginTransition runs migration on first sign-in,
  // then falls through to regular performSync on subsequent sign-ins.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const wasKarl = prevIsKarlRef.current;
    prevIsKarlRef.current = isKarl;

    // Trigger migration-aware sync when transitioning non-Karl → Karl
    if (isKarl && !wasKarl) {
      void handleLoginTransition();
    }
  }, [isKarl, handleLoginTransition]);

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
