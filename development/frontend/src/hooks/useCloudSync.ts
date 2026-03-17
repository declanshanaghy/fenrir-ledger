"use client";

/**
 * useCloudSync — Fenrir Ledger
 *
 * Hook for cloud sync status and actions. Wires Firestore sync API routes
 * for Karl/trial users. Thrall users always remain in "idle".
 *
 * Sync flows:
 *   1. On mount (Karl): GET /api/sync → merge with localStorage (last-write-wins)
 *   2. On card save (debounced): PUT /api/sync with all local cards
 *   3. Manual: syncNow() → PUT /api/sync immediately
 *
 * Returns:
 *   status       — "idle" | "syncing" | "synced" | "offline" | "error"
 *   lastSyncedAt — Date of last successful sync (null if never synced)
 *   cardCount    — Number of cards in last sync (null if unknown)
 *   errorMessage — Human-readable error description (null if no error)
 *   errorCode    — Machine-readable code e.g. "permission-denied" (null if no error)
 *   errorTimestamp — When the error occurred (null if no error)
 *   retryIn      — Seconds until auto-retry (null if not applicable)
 *   syncNow      — Trigger a manual push sync (no-op for Thrall)
 *   dismissError — Clear visible error state (does not stop background retries)
 *
 * State transitions:
 *   idle → syncing: sync initiated (mount pull, card-changed event, or syncNow)
 *   syncing → synced: sync API returned successfully
 *   syncing → error: sync API failed
 *   synced → idle: after SYNCED_DISPLAY_MS elapsed
 *   error → syncing: syncNow() called or auto-retry fires
 *   error → idle: dismissError()
 *   * → offline: navigator.onLine = false
 *   offline → idle/syncing: navigator.onLine = true
 *
 * Issue #1119 — Cloud data sync via Firestore
 * Issue #1125 — Sync UX wireframes
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useIsKarlOrTrial } from "@/hooks/useIsKarlOrTrial";
import { ensureFreshToken } from "@/lib/auth/refresh-session";
import { getSession } from "@/lib/auth/session";
import { getCards, setAllCards } from "@/lib/storage";
import type { Card } from "@/lib/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How long to show the "synced" success state before returning to idle (ms) */
export const SYNCED_DISPLAY_MS = 3000;

/** Debounce delay before pushing cards after a local write (ms) */
const PUSH_DEBOUNCE_MS = 2000;

/** Retry delay after a sync error (seconds) */
const ERROR_RETRY_SECONDS = 120;

/** localStorage key to prevent repeat first-sync confirmation toast */
const LS_FIRST_SYNC_SHOWN = "fenrir:first-sync-shown";

// ---------------------------------------------------------------------------
// Internal event name
// ---------------------------------------------------------------------------

/**
 * Dispatched by storage.ts write operations (saveCard, deleteCard, closeCard,
 * restoreCard, expungeCard) to signal that local data has changed and a
 * background push sync should be scheduled.
 * Detail: { householdId: string }
 */
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
// API helpers
// ---------------------------------------------------------------------------

interface SyncGetResponse {
  householdId: string;
  cards: Card[];
  syncedAt: string;
}

interface SyncPutResponse {
  householdId: string;
  written: number;
  skipped: number;
  syncedAt: string;
}

async function buildAuthHeaders(): Promise<Record<string, string> | null> {
  const token = await ensureFreshToken();
  if (!token) return null;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Pull cards from Firestore and merge with localStorage using last-write-wins.
 * Returns the total merged card count.
 */
async function pullAndMerge(): Promise<number> {
  const headers = await buildAuthHeaders();
  if (!headers) throw new Error("No auth token available.");

  const res = await fetch("/api/sync", { method: "GET", headers });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw Object.assign(new Error(body.error ?? `HTTP ${res.status}`), {
      code: body.error ?? `http_${res.status}`,
    });
  }

  const data = (await res.json()) as SyncGetResponse;
  const { householdId, cards: firestoreCards } = data;

  // Merge: Firestore and local cards — keep whichever has newer updatedAt
  const localCards = getCards(householdId);
  const localMap = new Map<string, Card>(localCards.map((c) => [c.id, c]));
  const firestoreIds = new Set(firestoreCards.map((c) => c.id));

  // Start with Firestore cards, overriding with local when local is newer
  const merged: Card[] = firestoreCards.map((remote) => {
    const local = localMap.get(remote.id);
    return local && local.updatedAt > remote.updatedAt ? local : remote;
  });

  // Append local-only cards not yet in Firestore
  for (const local of localCards) {
    if (!firestoreIds.has(local.id)) merged.push(local);
  }

  setAllCards(householdId, merged);
  return merged.length;
}

/**
 * Push all local cards to Firestore.
 * Returns the number of cards written.
 */
async function pushToFirestore(): Promise<number> {
  const session = getSession();
  if (!session) throw new Error("No session available.");

  const householdId = session.user.sub;
  const localCards = getCards(householdId);

  const headers = await buildAuthHeaders();
  if (!headers) throw new Error("No auth token available.");

  const res = await fetch("/api/sync", {
    method: "PUT",
    headers,
    body: JSON.stringify({ cards: localCards }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw Object.assign(new Error(body.error ?? `HTTP ${res.status}`), {
      code: body.error ?? `http_${res.status}`,
    });
  }

  const data = (await res.json()) as SyncPutResponse;
  return data.written;
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

  const isSyncingRef = useRef(false);
  const pushDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------
  // Sync success / error helpers (stable refs, used in effects)
  // ---------------------------------------------------------------------------

  const onSyncSuccess = useCallback((count: number) => {
    const wasFirstSync =
      typeof localStorage !== "undefined" &&
      localStorage.getItem(LS_FIRST_SYNC_SHOWN) !== "true";

    setLastSyncedAt(new Date());
    setCardCount(count);
    setStatus("synced");
    setErrorMessage(null);
    setErrorCode(null);
    setErrorTimestamp(null);
    setRetryIn(null);
    isSyncingRef.current = false;

    if (wasFirstSync && count > 0) {
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
  }, []);

  const onSyncError = useCallback((err: unknown) => {
    const msg = err instanceof Error ? err.message : "Cloud sync failed.";
    const code = (err as { code?: string }).code ?? "sync_error";

    setErrorMessage(msg);
    setErrorCode(code);
    setErrorTimestamp(new Date());
    setRetryIn(ERROR_RETRY_SECONDS);
    setStatus("error");
    isSyncingRef.current = false;

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
  }, []);

  // ---------------------------------------------------------------------------
  // Online / offline detection
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isKarlOrTrial) return;

    const handleOffline = () => setStatus("offline");
    const handleOnline = () =>
      setStatus((prev) => (prev === "offline" ? "idle" : prev));

    if (!navigator.onLine) setStatus("offline");

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [isKarlOrTrial]);

  // ---------------------------------------------------------------------------
  // On-mount pull from Firestore
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isKarlOrTrial) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    let cancelled = false;
    isSyncingRef.current = true;
    setStatus("syncing");

    pullAndMerge()
      .then((count) => {
        if (!cancelled) onSyncSuccess(count);
      })
      .catch((err: unknown) => {
        if (!cancelled) onSyncError(err);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isKarlOrTrial]);

  // ---------------------------------------------------------------------------
  // Background push on local card changes (debounced)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isKarlOrTrial) return;

    const handleCardsChanged = () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;

      if (pushDebounceRef.current) clearTimeout(pushDebounceRef.current);

      pushDebounceRef.current = setTimeout(() => {
        if (isSyncingRef.current) return;
        isSyncingRef.current = true;
        setStatus("syncing");

        pushToFirestore()
          .then((count) => onSyncSuccess(count))
          .catch((err: unknown) => onSyncError(err));
      }, PUSH_DEBOUNCE_MS);
    };

    window.addEventListener(EVT_CARDS_CHANGED, handleCardsChanged);
    return () => {
      window.removeEventListener(EVT_CARDS_CHANGED, handleCardsChanged);
      if (pushDebounceRef.current) clearTimeout(pushDebounceRef.current);
    };
  }, [isKarlOrTrial, onSyncSuccess, onSyncError]);

  // ---------------------------------------------------------------------------
  // Auto-retry after error
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (status !== "error" || !isKarlOrTrial) return;

    retryTimerRef.current = setTimeout(() => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      setStatus("syncing");
      setRetryIn(null);

      pushToFirestore()
        .then((count) => onSyncSuccess(count))
        .catch((err: unknown) => onSyncError(err));
    }, ERROR_RETRY_SECONDS * 1000);

    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [status, isKarlOrTrial, onSyncSuccess, onSyncError]);

  // ---------------------------------------------------------------------------
  // Synced → idle auto-transition after SYNCED_DISPLAY_MS
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (status !== "synced") return;
    const timer = setTimeout(() => setStatus("idle"), SYNCED_DISPLAY_MS);
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
  // Actions
  // ---------------------------------------------------------------------------

  const syncNow = useCallback(async (): Promise<void> => {
    if (!isKarlOrTrial) return;
    if (isSyncingRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    isSyncingRef.current = true;
    setStatus("syncing");
    setErrorMessage(null);
    setErrorCode(null);
    setRetryIn(null);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);

    try {
      const count = await pushToFirestore();
      onSyncSuccess(count);
    } catch (err) {
      onSyncError(err);
    }
  }, [isKarlOrTrial, onSyncSuccess, onSyncError]);

  const dismissError = useCallback((): void => {
    if (status !== "error") return;
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    setErrorMessage(null);
    setErrorCode(null);
    setErrorTimestamp(null);
    setRetryIn(null);
    setStatus("idle");
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
