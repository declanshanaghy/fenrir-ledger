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
 *   retryIn      — Always null (auto-retry removed in Issue #1239)
 *   syncNow      — Trigger a manual sync (no-op for non-Karl)
 *   dismissError — Clear visible error state
 *
 * State transitions:
 *   idle → syncing: syncNow() called (Karl only)
 *   syncing → synced: fenrir:cloud-sync-complete event
 *   syncing → error: fenrir:cloud-sync-error event
 *   synced → idle: after SYNCED_DISPLAY_MS elapsed
 *   error → idle: dismissError()
 *   * → offline: navigator.onLine = false
 *   offline → idle: navigator.onLine = true (no push on reconnect — Issue #1239)
 *
 * Issue #1122 — wired to real API routes
 * Issue #1125 — initial state machine design
 * Issue #1172 — auth gating, restore vs backup message, push loop fix
 * Issue #1239 — lock push to card create/edit only (remove online/retry/login push)
 * Issue #1693 — refactor: extract helpers, reduce cyclomatic complexity ≤ 15
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useEntitlement } from "@/hooks/useEntitlement";
import { useAuthContext } from "@/contexts/AuthContext";
import { getRawAllCards, setAllCards, getEffectiveHouseholdId } from "@/lib/storage";
import { hasMigrated, runMigration } from "@/lib/sync/migration";
import type { FenrirSession } from "@/lib/types";
import type { Card } from "@/lib/types";
import {
  LS_FIRST_SYNC_SHOWN,
  maybeShowFirstSyncToast,
  parseApiError,
  showMigrationToast,
} from "@/hooks/useCloudSync.helpers";

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
// LWW merge helper (used by performPull)
// ---------------------------------------------------------------------------

/**
 * Last-write-wins merge of local and cloud card arrays.
 * For each card ID, keeps the version with the most recent updatedAt.
 * Cards absent from one side are included unconditionally.
 */
function lwwMerge(local: Card[], cloud: Card[]): Card[] {
  const merged = new Map<string, Card>();
  for (const card of local) merged.set(card.id, card);
  for (const card of cloud) {
    const existing = merged.get(card.id);
    if (!existing) {
      merged.set(card.id, card);
    } else {
      const localTime = new Date(existing.updatedAt ?? existing.createdAt).getTime();
      const cloudTime = new Date(card.updatedAt ?? card.createdAt).getTime();
      if (cloudTime >= localTime) merged.set(card.id, card);
    }
  }
  return Array.from(merged.values());
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
 *
 * Push trigger (Issue #1239): POST /api/sync/push fires ONLY from
 * fenrir:cards-changed (user-initiated card writes) and syncNow().
 * Online reconnect and error auto-retry no longer trigger push.
 * Login transition uses pull-only (GET /api/sync/pull).
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

  // ---------------------------------------------------------------------------
  // Core push function (internal)
  // ---------------------------------------------------------------------------

  /**
   * Performs the actual push→merge→apply sync cycle against /api/sync/push.
   * Dispatches cloud sync events so other listeners can react.
   * Returns early (no-op) if already in progress or offline.
   *
   * Issue #1239: Called ONLY from fenrir:cards-changed listener (debounced)
   * and syncNow() (manual). Not called on online reconnect, login, or error retry.
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

    // Resolve actual householdId — for solo users this equals session.user.sub;
    // after joining a shared household it is the new household's ID (#1796).
    const householdId = getEffectiveHouseholdId(session.user.sub);
    const idToken = session.id_token;

    syncInProgressRef.current = true;
    setStatus("syncing");
    setErrorMessage(null);
    setErrorCode(null);
    setErrorTimestamp(null);
    setRetryIn(null);

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
        const { code, message } = await parseApiError(response);
        throw Object.assign(new Error(message), { code });
      }

      const { cards: mergedCards, syncedCount } = (await response.json()) as {
        cards: Card[];
        syncedCount: number;
      };

      // Apply merged result back to localStorage using setAllCards.
      // setAllCards dispatches "fenrir:sync" (NOT "fenrir:cards-changed") so the
      // auto-sync debounce listener is not triggered — no push loop. (#1172)
      setAllCards(householdId, mergedCards);

      setLastSyncedAt(new Date());
      setCardCount(syncedCount);
      setStatus("synced");

      // Show one-time first-sync toast (restore vs backup). No-op if already shown.
      maybeShowFirstSyncToast(syncedCount, localActiveCount);

      window.dispatchEvent(
        new CustomEvent(EVT_CLOUD_SYNC_COMPLETE, {
          detail: { cardCount: syncedCount },
        })
      );
    } catch (err) {
      const typedErr = err as Error & { code?: string };
      const msg = typedErr.message ?? "Cloud sync failed.";
      const code = typedErr.code ?? "network_error";

      setErrorMessage(msg);
      setErrorCode(code);
      setErrorTimestamp(new Date());
      setRetryIn(null);
      setStatus("error");

      // Non-blocking error toast
      toast.error("Sync failed", {
        description: "Your cards are safe locally. Retry by editing a card.",
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
          detail: { errorMessage: msg, errorCode: code, retryIn: null },
        })
      );

      // Issue #1239: No auto-retry timer. The next push fires only when
      // the user edits a card (fenrir:cards-changed) or calls syncNow().
    } finally {
      syncInProgressRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isKarl]);

  // ---------------------------------------------------------------------------
  // Pull-on-login (Issue #1239)
  // ---------------------------------------------------------------------------

  /**
   * Fetches Firestore cards and merges them into localStorage using LWW.
   * Called on login transition when migration is already done.
   * Does NOT push local cards to Firestore — read-only from cloud perspective.
   */
  const performPull = useCallback(async (): Promise<void> => {
    if (!isKarl) return;
    if (syncInProgressRef.current) return;

    const session = getSession();
    if (!session?.id_token || !session?.user?.sub) return;

    // Resolve actual householdId — same rationale as performSync (#1796).
    const householdId = getEffectiveHouseholdId(session.user.sub);
    const idToken = session.id_token;

    syncInProgressRef.current = true;
    setStatus("syncing");
    setErrorMessage(null);
    setErrorCode(null);
    setErrorTimestamp(null);
    setRetryIn(null);

    try {
      const response = await fetch(
        `/api/sync/pull?householdId=${encodeURIComponent(householdId)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );

      if (!response.ok) {
        // Pull failed — stay idle rather than showing an error (non-critical path)
        setStatus("idle");
        return;
      }

      const { cards: cloudCards, activeCount } = (await response.json()) as {
        cards: Card[];
        activeCount: number;
      };

      // LWW merge: cloud cards win ties (most recent updatedAt)
      const localCards = getRawAllCards(householdId);
      const localActiveCount = localCards.filter((c) => !c.deletedAt).length;
      const mergedCards = lwwMerge(localCards, cloudCards);

      // Apply merged result — uses setAllCards (not saveCard) so fenrir:cards-changed
      // is not dispatched and no push loop is created.
      setAllCards(householdId, mergedCards);

      setLastSyncedAt(new Date());
      setCardCount(activeCount);
      setStatus("synced");

      // Show one-time first-sync toast (restore vs backup). No-op if already shown.
      maybeShowFirstSyncToast(activeCount, localActiveCount);

      window.dispatchEvent(
        new CustomEvent(EVT_CLOUD_SYNC_COMPLETE, {
          detail: { cardCount: activeCount },
        })
      );
    } catch {
      // Network error or parse failure — stay idle (non-critical pull-on-login path)
      setStatus("idle");
    } finally {
      syncInProgressRef.current = false;
    }
  }, [isKarl]);

  // ---------------------------------------------------------------------------
  // Migration + login sync
  //
  // Issue #1124: On first Karl sign-in, run the one-time localStorage →
  // Firestore migration before falling through to regular sync.
  // Issue #1239: On subsequent sign-ins (hasMigrated=true), pull from cloud
  // instead of pushing — no push on login.
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
   * If already migrated (Issue #1239): calls performPull() — pull-only, no push.
   */
  const handleLoginTransition = useCallback(async (): Promise<void> => {
    if (!isKarl) return;
    if (syncInProgressRef.current) return;

    const session = getSession();
    if (!session?.id_token || !session?.user?.sub) return;

    // Resolve actual householdId — same rationale as performSync (#1796).
    const householdId = getEffectiveHouseholdId(session.user.sub);
    const idToken = session.id_token;

    if (hasMigrated()) {
      // Already migrated on a previous sign-in — pull from cloud (no push)
      void performPull();
      return;
    }

    // First Karl sign-in: run migration (push+merge — correct for initial sync)
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
        showMigrationToast(result.cardCount, result.direction);
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
  }, [isKarl, performSync, performPull]);

  // ---------------------------------------------------------------------------
  // Online / offline detection
  //
  // Issue #1239: handleOnline no longer calls performSync.
  // Network reconnect ≠ cards changed. Push fires only from fenrir:cards-changed.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isKarl) return;

    const handleOffline = () => {
      setStatus("offline");
    };

    const handleOnline = () => {
      // Restore to idle — do NOT push. No card data changed on reconnect. (#1239)
      setStatus("idle");
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
  }, [isKarl]);

  // ---------------------------------------------------------------------------
  // Auto-sync on card changes: debounced listener on fenrir:cards-changed
  //
  // Issue #1172 — listen to "fenrir:cards-changed" (user-initiated writes only),
  // NOT "fenrir:sync" (which fires on every setAllCards including internal merge
  // writes). This breaks the push loop where performSync→setAllCards→fenrir:sync
  // →debounce→performSync would repeat indefinitely.
  //
  // Issue #1239 — this is the SOLE automatic push trigger. Nothing else pushes.
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
  // Issue #1239: subsequent sign-ins now use pull-only (performPull).
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const wasKarl = prevIsKarlRef.current;
    prevIsKarlRef.current = isKarl;

    // Trigger migration-aware pull/push when transitioning non-Karl → Karl
    if (isKarl && !wasKarl) {
      void handleLoginTransition();
    }
  }, [isKarl, handleLoginTransition]);

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
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
    setErrorMessage(null);
    setErrorCode(null);
    setErrorTimestamp(null);
    setRetryIn(null);
    setStatus("idle");
    // User explicitly dismissed — next push fires on next card change
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
