/**
 * Fenrir Ledger — Sync Engine
 *
 * Per-card last-write-wins merge logic for offline-first cloud sync.
 *
 * Conflict resolution strategy:
 *   - For each card, compare by id + effectiveTimestamp (max of updatedAt, deletedAt)
 *   - Later timestamp wins
 *   - Tombstones (deletedAt) propagate in both directions — a deleted card at
 *     T=10 beats an update at T=8, preserving the deletion
 *
 * This is a pure utility module — no side effects, no I/O.
 * Used by both the push API route (server-side) and tests.
 *
 * Issue #1122
 */

import type { Card } from "@/lib/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the effective timestamp for conflict resolution.
 *
 * We use the later of updatedAt and deletedAt so that a soft-delete
 * (which sets deletedAt but may not update updatedAt) correctly wins
 * against an older update.
 */
export function effectiveTimestamp(card: Card): number {
  const updatedMs = new Date(card.updatedAt).getTime();
  const deletedMs = card.deletedAt ? new Date(card.deletedAt).getTime() : 0;
  return Math.max(updatedMs, deletedMs);
}

// ─── Core merge ──────────────────────────────────────────────────────────────

/**
 * Merges two card arrays using per-card last-write-wins semantics.
 *
 * Algorithm:
 *   1. Build a map from card id → card, seeded with all remote cards
 *   2. For each local card, compare effectiveTimestamp with the remote version
 *   3. The card with the later effectiveTimestamp wins
 *   4. Cards present on only one side are included as-is (no delete = no tombstone)
 *
 * Tombstone propagation:
 *   - deletedAt cards are treated like any other card for timestamp comparison
 *   - If a card is deleted at T=10 and updated at T=8, the deletion wins
 *   - Tombstones from either side are included in the output so the other side
 *     can apply them
 *
 * @param local  - Cards from localStorage (including tombstones)
 * @param remote - Cards from Firestore (including tombstones)
 * @returns      Merged array. Caller is responsible for writing to both stores.
 */
export function mergeCards(local: Card[], remote: Card[]): Card[] {
  const merged = new Map<string, Card>();

  // Seed with remote cards
  for (const card of remote) {
    merged.set(card.id, card);
  }

  // Apply local cards: later effectiveTimestamp wins
  for (const localCard of local) {
    const existing = merged.get(localCard.id);
    if (!existing) {
      // Card only exists locally — always include it
      merged.set(localCard.id, localCard);
    } else {
      const localTs = effectiveTimestamp(localCard);
      const existingTs = effectiveTimestamp(existing);
      if (localTs > existingTs) {
        merged.set(localCard.id, localCard);
      }
      // else: remote is newer or equal — keep remote (already in map)
    }
  }

  return Array.from(merged.values());
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export interface MergeStats {
  /** Total cards in merged result */
  total: number;
  /** Cards that exist in both sets with no conflict (same updatedAt) */
  unchanged: number;
  /** Cards where local won (local was newer) */
  localWon: number;
  /** Cards where remote won (remote was newer or equal) */
  remoteWon: number;
  /** Cards only present locally */
  localOnly: number;
  /** Cards only present remotely */
  remoteOnly: number;
  /** Active (non-tombstoned) cards in merged result */
  activeCount: number;
}

/**
 * Returns merge statistics for logging / response metadata.
 * Runs the same algorithm as mergeCards() but also collects counts.
 */
export function mergeCardsWithStats(
  local: Card[],
  remote: Card[]
): { merged: Card[]; stats: MergeStats } {
  const remoteById = new Map<string, Card>(remote.map((c) => [c.id, c]));
  const localById = new Map<string, Card>(local.map((c) => [c.id, c]));

  const merged = new Map<string, Card>();
  let localWon = 0;
  let remoteWon = 0;
  let unchanged = 0;
  let localOnly = 0;
  let remoteOnly = 0;

  // Seed with remote
  for (const [id, card] of remoteById) {
    merged.set(id, card);
  }

  // Apply local with LWW
  for (const [id, localCard] of localById) {
    const remoteCard = remoteById.get(id);
    if (!remoteCard) {
      merged.set(id, localCard);
      localOnly++;
    } else {
      const localTs = effectiveTimestamp(localCard);
      const remoteTs = effectiveTimestamp(remoteCard);
      if (localTs > remoteTs) {
        merged.set(id, localCard);
        localWon++;
      } else if (localTs === remoteTs) {
        unchanged++;
        // keep remote (already in map)
      } else {
        remoteWon++;
        // keep remote (already in map)
      }
    }
  }

  // Count remote-only
  for (const id of remoteById.keys()) {
    if (!localById.has(id)) {
      remoteOnly++;
    }
  }

  const mergedArr = Array.from(merged.values());
  const activeCount = mergedArr.filter((c) => !c.deletedAt).length;

  return {
    merged: mergedArr,
    stats: {
      total: mergedArr.length,
      unchanged,
      localWon,
      remoteWon,
      localOnly,
      remoteOnly,
      activeCount,
    },
  };
}
