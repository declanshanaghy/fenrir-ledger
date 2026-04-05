/**
 * Trash sync across household members — issue #2120
 *
 * Unit tests for the orphaned-tombstone filtering logic introduced to fix
 * expunge propagation across household members.
 *
 * Scenario being tested:
 *   1. Household member A (Freya) expunges card C from her trash.
 *   2. The push route deletes C from Firestore entirely (no tombstone).
 *   3. Member B (Odin) still has a local tombstone for C (deletedAt set).
 *   4. On Odin's next sync (push or pull), C must NOT reappear.
 *
 * This file tests the filter logic in isolation — the same invariant that
 * both the push route and the pull path apply:
 *
 *   "A local tombstone whose card ID is absent from the remote/cloud state
 *    was expunged by another household member and must be dropped."
 */

import { describe, it, expect } from "vitest";
import type { Card } from "@/lib/types";
import { makeCard, makeDeletedCard } from "@/__tests__/fixtures/cards";

// ---------------------------------------------------------------------------
// Pure helper: the orphaned-tombstone filter extracted for unit testing.
// This mirrors the logic added in both the push route and the pull hook.
// ---------------------------------------------------------------------------

/**
 * Filters out local tombstones for cards absent from the authoritative remote
 * card set. Such tombstones represent cards expunged by another household
 * member — keeping them would resurrect the card on the next sync.
 *
 * The `hasLocalCards` guard mirrors the push route's `localCards.length > 0`
 * safety check (issue #2002): when the local set is empty, we must NOT apply
 * the filter because the device may be brand-new and hasn't synced yet.
 *
 * @param localCards   All cards in the local state (including tombstones)
 * @param remoteCards  Authoritative card set from Firestore / pull response
 * @returns            Filtered local cards with orphaned tombstones removed
 */
function filterOrphanedTombstones(localCards: Card[], remoteCards: Card[]): Card[] {
  if (localCards.length === 0) return localCards; // new-device guard
  const remoteIds = new Set(remoteCards.map((c) => c.id));
  return localCards.filter((c) => !c.deletedAt || remoteIds.has(c.id));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("filterOrphanedTombstones — core invariant (issue #2120)", () => {
  it("drops a local tombstone when the card is absent from remote (expunged by another member)", () => {
    const tombstone = makeDeletedCard({ id: "expunged-card" });
    const activeCard = makeCard({ id: "active-card" });
    const remote = [makeCard({ id: "active-card" })]; // expunged-card is gone from remote

    const result = filterOrphanedTombstones([tombstone, activeCard], remote);

    expect(result.map((c) => c.id)).not.toContain("expunged-card");
    expect(result.map((c) => c.id)).toContain("active-card");
  });

  it("keeps a local tombstone when the same card is a tombstone in remote (normal soft-delete)", () => {
    const localTombstone = makeDeletedCard({ id: "soft-deleted" });
    const remoteTombstone = makeDeletedCard({ id: "soft-deleted" });

    const result = filterOrphanedTombstones([localTombstone], [remoteTombstone]);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("soft-deleted");
  });

  it("keeps a local tombstone when the same card exists as an active card in remote", () => {
    // Edge case: local has tombstone, remote has active version — LWW will resolve
    // this in the merge; the filter must not drop it prematurely.
    const localTombstone = makeDeletedCard({ id: "conflict-card" });
    const remoteActive = makeCard({ id: "conflict-card" });

    const result = filterOrphanedTombstones([localTombstone], [remoteActive]);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("conflict-card");
  });

  it("keeps active (non-deleted) local cards absent from remote (new unsynced card)", () => {
    // An active card not yet in remote is a new local card, NOT an orphaned tombstone.
    // The filter must only drop tombstones (deletedAt set) absent from remote.
    const activeLocal = makeCard({ id: "local-only-active" });
    const remoteOther = makeCard({ id: "other-card" });

    const result = filterOrphanedTombstones([activeLocal], [remoteOther]);

    // Active card preserved — it's not a tombstone, so it passes the filter
    expect(result.map((c) => c.id)).toContain("local-only-active");
  });

  it("returns empty array when all local tombstones are orphaned (all expunged by another member)", () => {
    const t1 = makeDeletedCard({ id: "t1" });
    const t2 = makeDeletedCard({ id: "t2" });

    const result = filterOrphanedTombstones([t1, t2], []);
    // localCards.length > 0, remote is empty → both tombstones are orphaned
    expect(result).toHaveLength(0);
  });

  it("does NOT apply the filter when local is empty (new-device guard)", () => {
    // Empty local means brand-new device — must not filter anything.
    // The caller (push route) uses localCards.length > 0 as the outer guard,
    // so filterOrphanedTombstones([]) is a no-op by design.
    const result = filterOrphanedTombstones([], []);
    expect(result).toHaveLength(0);

    const result2 = filterOrphanedTombstones([], [makeDeletedCard({ id: "remote-tombstone" })]);
    expect(result2).toHaveLength(0);
  });

  it("handles mixed local state: drops orphaned tombstones, keeps others", () => {
    const orphanedTombstone = makeDeletedCard({ id: "orphaned" });   // expunged by another member
    const normalTombstone   = makeDeletedCard({ id: "normal-del" }); // regular soft-delete
    const activeLocal       = makeCard({ id: "active-local" });      // unsyced new card

    const remote = [
      makeDeletedCard({ id: "normal-del" }), // tombstone present in remote → keep
      makeCard({ id: "active-remote" }),      // some other card
    ];

    const result = filterOrphanedTombstones(
      [orphanedTombstone, normalTombstone, activeLocal],
      remote
    );

    const ids = result.map((c) => c.id);
    expect(ids).not.toContain("orphaned");     // dropped (orphaned tombstone)
    expect(ids).toContain("normal-del");        // kept (tombstone present in remote)
    expect(ids).toContain("active-local");      // kept (active card, not a tombstone)
  });

  it("drops multiple orphaned tombstones when multiple cards were expunged by household", () => {
    const orphan1 = makeDeletedCard({ id: "orphan-1" });
    const orphan2 = makeDeletedCard({ id: "orphan-2" });
    const orphan3 = makeDeletedCard({ id: "orphan-3" });
    const kept    = makeCard({ id: "kept-active" });

    const remote = [makeCard({ id: "kept-active" })];

    const result = filterOrphanedTombstones([orphan1, orphan2, orphan3, kept], remote);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("kept-active");
  });
});
