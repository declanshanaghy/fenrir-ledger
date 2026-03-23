/**
 * Unit tests for lib/sync/sync-engine.ts
 *
 * Covers the per-card last-write-wins merge logic including:
 *   - Basic merge (local wins, remote wins, equal timestamps)
 *   - Tombstone propagation (deletedAt in both directions)
 *   - Local-only and remote-only cards
 *   - Empty inputs
 *   - mergeCardsWithStats accuracy
 */

import { describe, it, expect } from "vitest";
import {
  mergeCards,
  mergeCardsWithStats,
  effectiveTimestamp,
} from "@/lib/sync/sync-engine";
import { makeCard } from "@/__tests__/fixtures/cards";

// ── effectiveTimestamp ─────────────────────────────────────────────────────

describe("effectiveTimestamp", () => {
  it("returns updatedAt when deletedAt is absent", () => {
    const card = makeCard({ updatedAt: "2025-06-01T10:00:00.000Z" });
    expect(effectiveTimestamp(card)).toBe(new Date("2025-06-01T10:00:00.000Z").getTime());
  });

  it("returns deletedAt when it is later than updatedAt", () => {
    const card = makeCard({
      updatedAt: "2025-06-01T10:00:00.000Z",
      deletedAt: "2025-06-02T10:00:00.000Z",
    });
    expect(effectiveTimestamp(card)).toBe(new Date("2025-06-02T10:00:00.000Z").getTime());
  });

  it("returns updatedAt when it is later than deletedAt (edge case)", () => {
    const card = makeCard({
      updatedAt: "2025-06-03T10:00:00.000Z",
      deletedAt: "2025-06-01T10:00:00.000Z",
    });
    expect(effectiveTimestamp(card)).toBe(new Date("2025-06-03T10:00:00.000Z").getTime());
  });
});

// ── mergeCards — basic LWW ─────────────────────────────────────────────────

describe("mergeCards — last-write-wins", () => {
  it("returns empty array when both sides are empty", () => {
    expect(mergeCards([], [])).toEqual([]);
  });

  it("returns remote cards when local is empty", () => {
    const remote = [makeCard({ id: "r1" }), makeCard({ id: "r2" })];
    const result = mergeCards([], remote);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toContain("r1");
    expect(result.map((c) => c.id)).toContain("r2");
  });

  it("returns local cards when remote is empty", () => {
    const local = [makeCard({ id: "l1" }), makeCard({ id: "l2" })];
    const result = mergeCards(local, []);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toContain("l1");
    expect(result.map((c) => c.id)).toContain("l2");
  });

  it("local wins when local updatedAt is later", () => {
    const shared = "card-shared";
    const local = makeCard({
      id: shared,
      cardName: "Local version",
      updatedAt: "2025-06-10T12:00:00.000Z",
    });
    const remote = makeCard({
      id: shared,
      cardName: "Remote version",
      updatedAt: "2025-06-09T12:00:00.000Z",
    });
    const result = mergeCards([local], [remote]);
    expect(result).toHaveLength(1);
    expect(result[0]!.cardName).toBe("Local version");
  });

  it("remote wins when remote updatedAt is later", () => {
    const shared = "card-shared";
    const local = makeCard({
      id: shared,
      cardName: "Local version",
      updatedAt: "2025-06-08T12:00:00.000Z",
    });
    const remote = makeCard({
      id: shared,
      cardName: "Remote version",
      updatedAt: "2025-06-09T12:00:00.000Z",
    });
    const result = mergeCards([local], [remote]);
    expect(result).toHaveLength(1);
    expect(result[0]!.cardName).toBe("Remote version");
  });

  it("remote wins when timestamps are equal (idempotent)", () => {
    const ts = "2025-06-09T12:00:00.000Z";
    const shared = "card-shared";
    const local = makeCard({ id: shared, cardName: "Local", updatedAt: ts });
    const remote = makeCard({ id: shared, cardName: "Remote", updatedAt: ts });
    const result = mergeCards([local], [remote]);
    // Equal timestamps → remote keeps its slot (idempotent)
    expect(result).toHaveLength(1);
    expect(result[0]!.cardName).toBe("Remote");
  });

  it("includes both when cards have different IDs", () => {
    const local = makeCard({ id: "l1" });
    const remote = makeCard({ id: "r1" });
    const result = mergeCards([local], [remote]);
    expect(result).toHaveLength(2);
  });
});

// ── mergeCards — tombstone propagation ────────────────────────────────────

describe("mergeCards — tombstone propagation", () => {
  it("local tombstone wins over older remote update", () => {
    const id = "card-tombstone";
    const local = makeCard({
      id,
      updatedAt: "2025-06-01T00:00:00.000Z",
      deletedAt: "2025-06-10T00:00:00.000Z", // deleted later
    });
    const remote = makeCard({
      id,
      updatedAt: "2025-06-05T00:00:00.000Z", // updated after createdAt but before deletion
    });
    const result = mergeCards([local], [remote]);
    expect(result).toHaveLength(1);
    expect(result[0]!.deletedAt).toBe("2025-06-10T00:00:00.000Z");
  });

  it("remote tombstone wins over older local update", () => {
    const id = "card-tombstone";
    const local = makeCard({
      id,
      updatedAt: "2025-06-05T00:00:00.000Z",
    });
    const remote = makeCard({
      id,
      updatedAt: "2025-06-01T00:00:00.000Z",
      deletedAt: "2025-06-10T00:00:00.000Z",
    });
    const result = mergeCards([local], [remote]);
    expect(result).toHaveLength(1);
    expect(result[0]!.deletedAt).toBe("2025-06-10T00:00:00.000Z");
  });

  it("local update wins over older remote tombstone", () => {
    const id = "card-restore";
    const local = makeCard({
      id,
      updatedAt: "2025-06-15T00:00:00.000Z", // updated after deletion (restore scenario)
    });
    const remote = makeCard({
      id,
      updatedAt: "2025-06-01T00:00:00.000Z",
      deletedAt: "2025-06-10T00:00:00.000Z",
    });
    const result = mergeCards([local], [remote]);
    expect(result).toHaveLength(1);
    expect(result[0]!.deletedAt).toBeUndefined();
  });

  it("tombstoned cards are included in merged result (not expunged)", () => {
    const tombstone = makeCard({
      id: "t1",
      deletedAt: "2025-06-10T00:00:00.000Z",
    });
    const active = makeCard({ id: "a1" });
    const result = mergeCards([tombstone, active], []);
    expect(result).toHaveLength(2);
    expect(result.find((c) => c.id === "t1")?.deletedAt).toBeDefined();
  });

  it("remote-only tombstone propagates to merged result", () => {
    const remoteTombstone = makeCard({
      id: "rt1",
      deletedAt: "2025-05-01T00:00:00.000Z",
    });
    const result = mergeCards([], [remoteTombstone]);
    expect(result).toHaveLength(1);
    expect(result[0]!.deletedAt).toBeDefined();
  });
});

// ── mergeCards — multiple cards ────────────────────────────────────────────

describe("mergeCards — multi-card scenarios", () => {
  it("handles large arrays without collision", () => {
    const N = 200;
    const local: Card[] = Array.from({ length: N }, (_, i) =>
      makeCard({ id: `card-${i}`, updatedAt: "2025-01-01T00:00:00.000Z" })
    );
    const remote: Card[] = Array.from({ length: N }, (_, i) =>
      makeCard({ id: `card-${i}`, updatedAt: "2025-01-02T00:00:00.000Z" }) // remote is newer
    );
    const result = mergeCards(local, remote);
    expect(result).toHaveLength(N);
    // All should be remote versions (newer)
    result.forEach((c) => {
      expect(c.updatedAt).toBe("2025-01-02T00:00:00.000Z");
    });
  });

  it("correctly handles mix of local-only, remote-only, and conflicts", () => {
    const localOnly = makeCard({ id: "local-only" });
    const remoteOnly = makeCard({ id: "remote-only" });
    const conflictLocal = makeCard({
      id: "conflict",
      cardName: "Local",
      updatedAt: "2025-06-10T00:00:00.000Z",
    });
    const conflictRemote = makeCard({
      id: "conflict",
      cardName: "Remote",
      updatedAt: "2025-06-09T00:00:00.000Z",
    });

    const result = mergeCards(
      [localOnly, conflictLocal],
      [remoteOnly, conflictRemote]
    );

    expect(result).toHaveLength(3);
    expect(result.find((c) => c.id === "local-only")).toBeDefined();
    expect(result.find((c) => c.id === "remote-only")).toBeDefined();
    const conflict = result.find((c) => c.id === "conflict");
    expect(conflict?.cardName).toBe("Local"); // local was newer
  });
});

// ── mergeCardsWithStats ────────────────────────────────────────────────────

describe("mergeCardsWithStats", () => {
  it("reports correct counts for local-only, remote-only, and conflicts", () => {
    const localOnly = makeCard({ id: "lo" });
    const remoteOnly = makeCard({ id: "ro" });
    const localWins = makeCard({
      id: "lw",
      updatedAt: "2025-06-10T00:00:00.000Z",
    });
    const remoteWins = makeCard({
      id: "lw",
      updatedAt: "2025-06-09T00:00:00.000Z",
    });
    const sameTs = "2025-06-05T00:00:00.000Z";
    const unchanged1 = makeCard({ id: "uc", updatedAt: sameTs });
    const unchanged2 = makeCard({ id: "uc", updatedAt: sameTs });

    const { merged, stats } = mergeCardsWithStats(
      [localOnly, localWins, unchanged1],
      [remoteOnly, remoteWins, unchanged2]
    );

    expect(merged).toHaveLength(4); // lo, ro, lw/rw (1), uc (1)
    expect(stats.localOnly).toBe(1);
    expect(stats.remoteOnly).toBe(1);
    expect(stats.localWon).toBe(1);
    expect(stats.unchanged).toBe(1);
    expect(stats.total).toBe(4);
    expect(stats.activeCount).toBe(4); // none tombstoned
  });

  it("counts tombstoned cards correctly in activeCount", () => {
    const active = makeCard({ id: "active" });
    const tombstone = makeCard({ id: "dead", deletedAt: "2025-06-01T00:00:00.000Z" });
    const { stats } = mergeCardsWithStats([active, tombstone], []);
    expect(stats.activeCount).toBe(1);
    expect(stats.total).toBe(2);
  });

  it("merged result matches plain mergeCards()", () => {
    const local = [makeCard({ id: "a" }), makeCard({ id: "b" })];
    const remote = [makeCard({ id: "b", updatedAt: "2030-01-01T00:00:00.000Z" }), makeCard({ id: "c" })];
    const plain = mergeCards(local, remote);
    const { merged } = mergeCardsWithStats(local, remote);
    expect(new Set(merged.map((c) => c.id))).toEqual(new Set(plain.map((c) => c.id)));
  });
});
