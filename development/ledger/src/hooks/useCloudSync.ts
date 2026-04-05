"use client";

/**
 * useCloudSync — Fenrir Ledger
 *
 * Hook for cloud sync status. Tracks Firestore sync state for Karl users.
 * Thrall and free-trial users always remain in "idle" — this hook is safe
 * to call unconditionally.
 *
 * Returns:
 *   status       — "idle" | "needs-upload" | "needs-download" | "syncing" | "synced" | "offline" | "error"
 *   lastSyncedAt — Date of last successful sync (null if never synced)
 *   cardCount    — Number of cards in last sync (null if unknown)
 *   syncVersion  — Current household sync version (null if unknown)
 *   errorMessage — Human-readable error description (null if no error)
 *   errorCode    — Machine-readable code e.g. "permission-denied" (null if no error)
 *   errorTimestamp — When the error occurred (null if no error)
 *   retryIn      — Always null (auto-retry removed in Issue #1239)
 *   syncNow      — Trigger a manual sync (no-op for non-Karl)
 *   dismissError — Clear visible error state
 *
 * State transitions:
 *   idle → needs-upload: local card change (before debounce fires)
 *   idle → needs-download: server check reveals needsDownload=true
 *   idle → offline: navigator.onLine = false
 *   needs-upload → syncing: debounce fires / bulk-changed / syncNow()
 *   needs-download → syncing: auto-trigger / syncNow()
 *   syncing → synced: sync success
 *   syncing → error: sync failure
 *   synced → idle: after SYNCED_DISPLAY_MS elapsed
 *   error → idle: dismissError()
 *   offline → needs-upload: reconnect + needs-upload flag
 *   offline → idle: reconnect (no pending changes)
 *
 * Pull-before-push (Issue #2006): Before any push, performSync() calls
 * GET /api/sync/state. If needsDownload=true or lastSyncedVersion<syncVersion,
 * it pulls first then pushes. 409 from push triggers automatic pull → retry.
 *
 * Issue #1122 — wired to real API routes
 * Issue #1125 — initial state machine design
 * Issue #1172 — auth gating, restore vs backup message, push loop fix
 * Issue #1239 — lock push to card create/edit only (remove online/retry/login push)
 * Issue #1693 — refactor: extract helpers, reduce cyclomatic complexity ≤ 15
 * Issue #2006 — pull-before-push orchestration, needs-upload/needs-download states
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useEntitlement } from "@/hooks/useEntitlement";
import { useAuthContext } from "@/contexts/AuthContext";
import { getRawAllCards, setAllCards, getEffectiveHouseholdId, getNeedsUpload, clearNeedsUpload } from "@/lib/storage";
import { hasMigrated, runMigration } from "@/lib/sync/migration";
import { ensureFreshToken } from "@/lib/auth/refresh-session";
import { authFetch } from "@/lib/auth/auth-fetch";
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
 * Debounce delay for auto-sync on individual card changes (ms).
 *
 * Reduced from 10s → 2s in Issue #2005. Individual card saves are user-initiated
 * and infrequent enough that 10s provides no debounce benefit.
 * The listener is "fenrir:cards-changed" (user-initiated writes only),
 * NOT "fenrir:sync" (which fires on every write including internal sync merges).
 *
 * Bulk imports use the "fenrir:cards-bulk-changed" event which bypasses
 * the debounce entirely and calls performSync() immediately.
 */
export const AUTO_SYNC_DEBOUNCE_MS = 2_000;

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

/** Custom event name fired after a bulk import — triggers immediate cloud push (no debounce) */
export const EVT_CARDS_BULK_CHANGED = "fenrir:cards-bulk-changed";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CloudSyncStatus = "idle" | "needs-upload" | "needs-download" | "syncing" | "synced" | "offline" | "error";

export interface CloudSyncState {
  status: CloudSyncStatus;
  lastSyncedAt: Date | null;
  cardCount: number | null;
  syncVersion: number | null;
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
// Module-level API helpers (issue #2006)
// ---------------------------------------------------------------------------

/** Response shape from GET /api/sync/state */
interface SyncStateData {
  syncVersion: number;
  lastSyncedVersion: number;
  needsDownload: boolean;
}

/** Response shape from GET /api/sync/pull */
interface PullResponseData {
  cards: Card[];
  activeCount: number;
  syncVersion: number;
}

/**
 * Calls GET /api/sync/state and returns the parsed response.
 * Returns null on any network error or non-ok response (caller degrades gracefully).
 */
async function fetchSyncStateResponse(householdId: string): Promise<SyncStateData | null> {
  try {
    const response = await authFetch(
      `/api/sync/state?householdId=${encodeURIComponent(householdId)}`,
      { method: "GET" }
    );
    if (!response?.ok) return null;
    return (await response.json()) as SyncStateData;
  } catch {
    return null;
  }
}

/**
 * Calls GET /api/sync/pull and returns the parsed response.
 * Returns null on any network error or non-ok response.
 */
async function fetchPullResponse(householdId: string): Promise<PullResponseData | null> {
  try {
    const response = await authFetch(
      `/api/sync/pull?householdId=${encodeURIComponent(householdId)}`,
      { method: "GET" }
    );
    if (!response?.ok) return null;
    return (await response.json()) as PullResponseData;
  } catch {
    return null;
  }
}

/**
 * Pulls from cloud, LWW-merges with given local cards, persists the result.
 * Returns the merged card array and the pulled syncVersion.
 * If the pull fails, returns the original cards and null version (degrade gracefully).
 *
 * Issue #2120: Before merging, drop local tombstones for cards absent from
 * the cloud response. Such tombstones represent cards expunged by another
 * household member — the cloud's authoritative absence wins over a local
 * tombstone, preventing expunged cards from reappearing via the pull path.
 */
async function pullMergeApply(
  householdId: string,
  currentCards: Card[],
): Promise<{ merged: Card[]; version: number | null }> {
  const pullData = await fetchPullResponse(householdId);
  if (!pullData) return { merged: currentCards, version: null };
  const cloudIds = new Set(pullData.cards.map((c) => c.id));
  const filteredLocal = currentCards.filter((c) => !c.deletedAt || cloudIds.has(c.id));
  const merged = lwwMerge(filteredLocal, pullData.cards);
  setAllCards(householdId, merged);
  return { merged, version: pullData.syncVersion };
}

/**
 * Applies a pulled syncVersion to the ref and state setter if non-null.
 * Returns the new version, or the provided fallback if version is null.
 * This avoids null-coalescing at call sites, keeping callers branch-free.
 */
function applyPulledVersion(
  version: number | null,
  fallbackVersion: number | null,
  syncVersionRef: { current: number | null },
  setSyncVersion: (v: number) => void,
): number | null {
  if (version !== null) {
    syncVersionRef.current = version;
    setSyncVersion(version);
    return version;
  }
  return fallbackVersion;
}

/**
 * Handles the 409 "stale client" response: pulls latest cloud cards, merges,
 * then retries the push with the updated payload.
 * Extracted to keep performSync's cyclomatic complexity ≤ 19.
 */
async function retryPushAfter409(
  householdId: string,
  clientSyncVersion: number | null,
  syncVersionRef: { current: number | null },
  setSyncVersion: (v: number) => void,
): Promise<Response | null> {
  const currentCards = getRawAllCards(householdId);
  const { merged, version } = await pullMergeApply(householdId, currentCards);
  const resolvedVersion = applyPulledVersion(version, clientSyncVersion, syncVersionRef, setSyncVersion);

  const body: { householdId: string; cards: Card[]; clientSyncVersion?: number } = {
    householdId,
    cards: merged,
  };
  if (resolvedVersion !== null) body.clientSyncVersion = resolvedVersion;

  return authFetch("/api/sync/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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
  const [syncVersion, setSyncVersion] = useState<number | null>(null);
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
  /** Last known household syncVersion — used as clientSyncVersion in push requests */
  const syncVersionRef = useRef<number | null>(null);
  /** Tracks online state via window events (navigator.onLine not reliable in tests) */
  const isOnlineRef = useRef<boolean>(typeof navigator === "undefined" || navigator.onLine);

  // ---------------------------------------------------------------------------
  // Core push function (internal)
  // ---------------------------------------------------------------------------

  /**
   * Performs the pull-before-push sync cycle against /api/sync/push.
   *
   * Issue #2006 pull-before-push flow:
   *   1. GET /api/sync/state — check if server is ahead of client
   *   2. If needsDownload=true OR lastSyncedVersion<syncVersion: pull first
   *   3. POST /api/sync/push with clientSyncVersion
   *   4. On 409: pull → merge → retry push once
   *
   * State check failure degrades gracefully: push proceeds without version guard.
   *
   * Issue #1239: Called ONLY from fenrir:cards-changed listener (debounced),
   * fenrir:cards-bulk-changed (immediate), and syncNow() (manual).
   */
  const performSync = useCallback(async (): Promise<void> => {
    if (!isKarl) return;
    if (syncInProgressRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline");
      return;
    }

    const session = getSession();
    if (!session?.user?.sub) return;

    // Resolve actual householdId — for solo users this equals session.user.sub;
    // after joining a shared household it is the new household's ID (#1796).
    const householdId = getEffectiveHouseholdId(session.user.sub);

    // Acquire the sync lock and set status synchronously (optimistic update).
    syncInProgressRef.current = true;
    setStatus("syncing");
    setErrorMessage(null);
    setErrorCode(null);
    setErrorTimestamp(null);
    setRetryIn(null);

    try {
      // Gather all local cards including tombstones.
      // Snapshot the local active count BEFORE sync to determine message direction.
      let localCards = getRawAllCards(householdId);
      const localActiveCount = localCards.filter((c) => !c.deletedAt).length;

      // ── Step 1: Check sync state (pull-before-push) ──────────────────────────
      // clientSyncVersion starts from the last version we know about.
      let clientSyncVersion: number | null = syncVersionRef.current;

      const stateData = await fetchSyncStateResponse(householdId);
      if (stateData) {
        const { syncVersion: serverVersion, lastSyncedVersion, needsDownload } = stateData;

        if (needsDownload || lastSyncedVersion < serverVersion) {
          // Server is ahead — pull first so our push has full context.
          // setAllCards dispatches "fenrir:sync" (not "fenrir:cards-changed") — no push loop.
          const { merged, version } = await pullMergeApply(householdId, localCards);
          localCards = merged;
          clientSyncVersion = applyPulledVersion(version, clientSyncVersion, syncVersionRef, setSyncVersion);
        } else {
          // No pull needed — capture server's version as our clientSyncVersion.
          clientSyncVersion = serverVersion;
        }
      }
      // If stateData is null (network error), fall back to direct push with
      // whatever clientSyncVersion we have — degrade gracefully per spec.

      // ── Step 2: Push ─────────────────────────────────────────────────────────
      const pushBody: { householdId: string; cards: Card[]; clientSyncVersion?: number } = {
        householdId,
        cards: localCards,
      };
      if (clientSyncVersion !== null) {
        pushBody.clientSyncVersion = clientSyncVersion;
      }

      let response = await authFetch("/api/sync/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pushBody),
      });

      // ── Step 3: Handle 409 — pull → retry push ───────────────────────────────
      // retryPushAfter409 pulls, LWW-merges, updates syncVersionRef, and retries.
      if (response?.status === 409) {
        response = await retryPushAfter409(householdId, clientSyncVersion, syncVersionRef, setSyncVersion);
      }

      if (!response || !response.ok) {
        const { code, message } = response
          ? await parseApiError(response)
          : { code: "auth_error", message: "Authentication failed." };
        throw Object.assign(new Error(message), { code });
      }

      const { cards: mergedCards, syncedCount, syncVersion: newSyncVersion } = (await response.json()) as {
        cards: Card[];
        syncedCount: number;
        syncVersion: number;
      };

      // Apply merged result back to localStorage.
      // setAllCards dispatches "fenrir:sync" (NOT "fenrir:cards-changed") — no push loop. (#1172)
      setAllCards(householdId, mergedCards);

      // Push succeeded — clear the needs-upload flag. (#2005)
      clearNeedsUpload();

      // Track syncVersion for future push requests.
      if (typeof newSyncVersion === "number") {
        syncVersionRef.current = newSyncVersion;
        setSyncVersion(newSyncVersion);
      }

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

      // Issue #1239: No auto-retry timer.
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
   * Tracks syncVersion from the pull response. (Issue #2006)
   */
  const performPull = useCallback(async (): Promise<void> => {
    if (!isKarl) return;
    if (syncInProgressRef.current) return;

    const session = getSession();
    if (!session?.user?.sub) return;

    // Resolve actual householdId — same rationale as performSync (#1796).
    const householdId = getEffectiveHouseholdId(session.user.sub);

    // Acquire lock synchronously before any awaits.
    syncInProgressRef.current = true;
    setStatus("syncing");
    setErrorMessage(null);
    setErrorCode(null);
    setErrorTimestamp(null);
    setRetryIn(null);

    try {
      const pullData = await fetchPullResponse(householdId);

      if (!pullData) {
        // Pull failed — stay idle rather than showing an error (non-critical path)
        setStatus("idle");
        return;
      }

      const { cards: cloudCards, activeCount, syncVersion: pulledVersion } = pullData;

      // Issue #2120: Drop local tombstones for cards absent from cloud before
      // merging. Cards expunged by another household member are gone from
      // Firestore entirely — keeping their local tombstones would resurrect
      // them in this member's trash view via the pull path.
      const localCards = getRawAllCards(householdId);
      const localActiveCount = localCards.filter((c) => !c.deletedAt).length;
      const cloudIds = new Set(cloudCards.map((c) => c.id));
      const filteredLocal = localCards.filter((c) => !c.deletedAt || cloudIds.has(c.id));
      const mergedCards = lwwMerge(filteredLocal, cloudCards);

      // Apply merged result — uses setAllCards (not saveCard) so fenrir:cards-changed
      // is not dispatched and no push loop is created.
      setAllCards(householdId, mergedCards);

      // Track syncVersion from pull response. (Issue #2006)
      if (typeof pulledVersion === "number") {
        syncVersionRef.current = pulledVersion;
        setSyncVersion(pulledVersion);
      }

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
    if (!session?.user?.sub) return;

    // Resolve actual householdId — same rationale as performSync (#1796).
    const householdId = getEffectiveHouseholdId(session.user.sub);

    if (hasMigrated()) {
      // Already migrated on a previous sign-in — pull from cloud (no push)
      void performPull();
      return;
    }

    // First Karl sign-in: acquire lock synchronously before any awaits.
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
      // Get fresh token — may involve a network refresh if stale.
      // Done inside the try block so a refresh failure falls through to the catch.
      const migrationToken = await ensureFreshToken();
      if (!migrationToken) {
        throw Object.assign(new Error("Authentication expired."), { code: "auth_error" });
      }

      const result = await runMigration(householdId, migrationToken);

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
      isOnlineRef.current = false;
      setStatus("offline");
    };

    const handleOnline = () => {
      isOnlineRef.current = true;
      // Restore to needs-upload if there are pending changes, otherwise idle.
      // State machine: offline → needs-upload (reconnect + needs-upload flag)
      //                offline → idle (reconnect, no pending changes)
      // Does NOT auto-push — push fires only on next card change or syncNow(). (#1239)
      if (getNeedsUpload()) {
        setStatus("needs-upload");
      } else {
        setStatus("idle");
      }
    };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      isOnlineRef.current = false;
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
      // Set needs-upload immediately for visual feedback before the debounce fires.
      // (Issue #2006 — state machine: idle → needs-upload on local card change)
      // Only set if online — offline state is managed by online/offline events.
      // Use isOnlineRef (not navigator.onLine) for reliable detection in all envs.
      if (!syncInProgressRef.current && isOnlineRef.current) {
        setStatus("needs-upload");
      }

      // Debounce: rapid saves coalesce into a single sync.
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
  // Immediate sync on bulk card changes: fenrir:cards-bulk-changed listener
  //
  // Issue #2005: Import loops call notifyCardsBulkChanged() after all saveCard()
  // calls complete. This listener bypasses the debounce and pushes immediately,
  // ensuring the import reaches Firestore without waiting 2s.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isKarl) return;

    const handleBulkChanged = () => {
      // Cancel any pending debounced sync — the bulk push supersedes it.
      if (autoSyncTimerRef.current) {
        clearTimeout(autoSyncTimerRef.current);
        autoSyncTimerRef.current = null;
      }
      if (!syncInProgressRef.current) {
        // Set needs-upload for visual feedback before performSync sets syncing. (#2006)
        setStatus("needs-upload");
        void performSync();
      }
    };

    window.addEventListener(EVT_CARDS_BULK_CHANGED, handleBulkChanged);
    return () => window.removeEventListener(EVT_CARDS_BULK_CHANGED, handleBulkChanged);
  }, [isKarl, performSync]);

  // ---------------------------------------------------------------------------
  // On-mount needs-upload check
  //
  // Issue #2005: If the user navigated away before the debounce fired, the
  // "fenrir:needs-upload" flag persists in localStorage. On the next mount
  // where isKarl is confirmed, kick off a sync to flush the pending changes.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isKarl) return;
    if (getNeedsUpload()) {
      // Set needs-upload immediately for visual feedback before performSync sets syncing. (#2006)
      setStatus("needs-upload");
      void performSync();
    }
  // Only run when isKarl becomes true (login transition handled separately).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isKarl]);

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
    syncVersion,
    errorMessage,
    errorCode,
    errorTimestamp,
    retryIn,
    syncNow,
    dismissError,
  };
}
