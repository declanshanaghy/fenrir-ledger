/**
 * Fenrir Ledger — localStorage → Firestore Migration
 *
 * Runs once on first Karl sign-in to synchronise localStorage card data
 * with Firestore, using the existing push/merge API.
 *
 * Priority order (Issue #1124 — ODIN scope expansion):
 *   1. Download  — cloud has cards, local is empty (returning user, new device)
 *   2. Upload    — local has cards, cloud is empty (first Karl sign-in, existing data)
 *   3. Merge     — both sides have cards → LWW merge via /api/sync/push
 *   4. Empty     — neither side has data; mark migrated, do nothing
 *
 * The push endpoint fetches remote, runs per-card last-write-wins, writes merged
 * result back to Firestore, and returns the merged array.  LWW achieves
 * "cloud wins" semantics for the typical case: cloud cards carry newer timestamps
 * (modified on another device) while local cards on a fresh browser are absent
 * or older.
 *
 * Idempotency: localStorage flag `fenrir:migrated` is set after a successful
 * run.  Subsequent sign-ins skip migration entirely.
 *
 * This module is pure data — no React state, no toasts.
 * Callers (useCloudSync) handle UI feedback based on MigrationResult.
 *
 * Issue #1124
 */

import { getRawAllCards, setAllCards } from "@/lib/storage";
import type { Card } from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * localStorage flag that prevents migration from running more than once.
 * Set to "true" after a successful runMigration() call.
 */
export const MIGRATION_FLAG = "fenrir:migrated";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Describes which direction data flowed during migration.
 *
 *   "download" — cloud had cards, local was empty → cards downloaded to local
 *   "upload"   — local had cards, cloud was empty → cards pushed to cloud
 *   "merge"    — both sides had cards → LWW merge applied
 *   "empty"    — neither side had cards → no-op
 */
export type MigrationDirection = "download" | "upload" | "merge" | "empty";

/** Returned by runMigration() to allow callers to show appropriate UI feedback. */
export interface MigrationResult {
  /** true if migration actually executed this call; false if already migrated */
  ran: boolean;
  /** Active (non-deleted) card count after migration */
  cardCount: number;
  /** Data flow direction inferred from pre/post-migration counts */
  direction: MigrationDirection;
}

// ─── Flag helpers ─────────────────────────────────────────────────────────────

/**
 * Returns true if the fenrir:migrated flag is set in localStorage.
 * Always returns false in SSR contexts where localStorage is unavailable.
 */
export function hasMigrated(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(MIGRATION_FLAG) === "true";
  } catch {
    return false;
  }
}

/**
 * Sets the fenrir:migrated flag in localStorage.
 * Silently no-ops if localStorage is unavailable or full.
 */
export function markMigrated(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(MIGRATION_FLAG, "true");
  } catch {
    // localStorage full — silently skip; migration will re-run next sign-in
  }
}

// ─── Core migration ───────────────────────────────────────────────────────────

/**
 * Runs the one-time localStorage → Firestore migration for a Karl user.
 *
 * Steps:
 *   1. Guard — return early if already migrated (idempotent)
 *   2. Read local cards (including tombstones)
 *   3a. If local is empty → GET /api/sync/pull (new device: download cloud data)
 *   3b. If local has cards → POST /api/sync/push (existing data: merge with cloud)
 *   4. Apply result to localStorage via setAllCards
 *   5. Mark migrated
 *   6. Return MigrationResult for caller to show appropriate toast
 *
 * Throws if the API call fails (non-2xx) — callers should fall back to
 * regular performSync on error.
 *
 * @param householdId - The authenticated user's household ID (Google sub claim)
 * @param idToken     - Google ID token for Bearer auth
 */
export async function runMigration(
  householdId: string,
  idToken: string
): Promise<MigrationResult> {
  if (hasMigrated()) {
    return { ran: false, cardCount: 0, direction: "empty" };
  }

  // Snapshot local state before the API call so we can infer direction
  const localCards = getRawAllCards(householdId);
  const localActiveCount = localCards.filter((c) => !c.deletedAt).length;

  let resultCards: Card[];
  let resultActiveCount: number;

  if (localCards.length === 0) {
    // New device with no local data — pull cloud cards down rather than pushing nothing
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
      let errCode = "migration_error";
      let errMsg = "Migration failed.";
      try {
        const errBody = (await response.json()) as {
          error?: string;
          error_description?: string;
        };
        errCode = errBody.error ?? errCode;
        errMsg = errBody.error_description ?? errMsg;
      } catch {
        // ignore JSON parse failure on error body
      }
      throw Object.assign(new Error(errMsg), { code: errCode });
    }

    const { cards: pulledCards, activeCount } = (await response.json()) as {
      cards: Card[];
      activeCount: number;
    };

    resultCards = pulledCards;
    resultActiveCount = activeCount;
  } else {
    // Local has cards — push to cloud; server merges (LWW), writes Firestore, returns merged
    const response = await fetch("/api/sync/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ householdId, cards: localCards }),
    });

    if (!response.ok) {
      let errCode = "migration_error";
      let errMsg = "Migration failed.";
      try {
        const errBody = (await response.json()) as {
          error?: string;
          error_description?: string;
        };
        errCode = errBody.error ?? errCode;
        errMsg = errBody.error_description ?? errMsg;
      } catch {
        // ignore JSON parse failure on error body
      }
      throw Object.assign(new Error(errMsg), { code: errCode });
    }

    const { cards: mergedCards, syncedCount } = (await response.json()) as {
      cards: Card[];
      syncedCount: number;
    };

    resultCards = mergedCards;
    resultActiveCount = syncedCount;
  }

  // Apply result to localStorage — same semantics as regular sync
  setAllCards(householdId, resultCards);

  // Infer data flow direction for the caller's toast message
  const direction = inferDirection(localActiveCount, resultActiveCount);

  // Mark as migrated — prevents re-running on subsequent sign-ins
  markMigrated();

  return { ran: true, cardCount: resultActiveCount, direction };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Infers migration direction from local active count (before push) and
 * synced count (active cards in merged result).
 *
 * @param localActiveCount - Active cards in localStorage before migration
 * @param syncedCount      - Active cards in merged result after push
 */
function inferDirection(
  localActiveCount: number,
  syncedCount: number
): MigrationDirection {
  if (localActiveCount === 0 && syncedCount > 0) {
    // Had nothing locally; cards arrived from cloud
    return "download";
  }
  if (localActiveCount > 0 && syncedCount > localActiveCount) {
    // Both sides had cards; merged result is larger than local → cloud added cards
    return "merge";
  }
  if (localActiveCount > 0) {
    // Local had cards; pushed to cloud (cloud may have been empty or same size)
    return "upload";
  }
  // Neither side had active cards
  return "empty";
}
