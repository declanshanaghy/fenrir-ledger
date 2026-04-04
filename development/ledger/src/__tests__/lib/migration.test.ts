/**
 * Fenrir Ledger — migration.ts Unit Tests
 *
 * Covers:
 *   - hasMigrated() / markMigrated() flag helpers
 *   - runMigration() — already migrated guard (no-op)
 *   - runMigration() — download direction (empty local, cloud has cards)
 *   - runMigration() — upload direction (local has cards, empty cloud)
 *   - runMigration() — merge direction (both sides have cards, cloud added more)
 *   - runMigration() — empty direction (neither side has cards)
 *   - runMigration() — API error throws and does NOT set the flag
 *   - runMigration() — idempotent: second call returns ran=false
 *
 * Issue #1124
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import type { Card } from "@/lib/types";

// ─── localStorage mock ────────────────────────────────────────────────────────

const localStorageStore: Record<string, string> = {};

const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, val: string) => {
    localStorageStore[key] = val;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageStore[key];
  }),
  clear: vi.fn(() => {
    Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]);
  }),
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// ─── Storage mock ─────────────────────────────────────────────────────────────

const mockGetRawAllCards = vi.fn<(householdId: string) => Card[]>();
const mockSetAllCards = vi.fn<(householdId: string, cards: Card[]) => void>();

vi.mock("@/lib/storage", () => ({
  getRawAllCards: (householdId: string) => mockGetRawAllCards(householdId),
  setAllCards: (householdId: string, cards: Card[]) =>
    mockSetAllCards(householdId, cards),
}));

// ─── Fetch mock ───────────────────────────────────────────────────────────────

const mockFetch = vi.fn<typeof fetch>();
globalThis.fetch = mockFetch as unknown as typeof fetch;

// ─── Module import (cached once) ─────────────────────────────────────────────

let hasMigrated: typeof import("@/lib/sync/migration")["hasMigrated"];
let markMigrated: typeof import("@/lib/sync/migration")["markMigrated"];
let runMigration: typeof import("@/lib/sync/migration")["runMigration"];
let MIGRATION_FLAG: typeof import("@/lib/sync/migration")["MIGRATION_FLAG"];

beforeAll(async () => {
  const mod = await import("@/lib/sync/migration");
  hasMigrated = mod.hasMigrated;
  markMigrated = mod.markMigrated;
  runMigration = mod.runMigration;
  MIGRATION_FLAG = mod.MIGRATION_FLAG;
});

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeCard(id: string, updatedAt: string, deletedAt?: string): Card {
  return {
    id,
    householdId: "hh-test",
    name: `Card ${id}`,
    issuer: "Test Bank",
    network: "visa",
    status: "active",
    rewardType: "cashback",
    createdAt: updatedAt,
    updatedAt,
    ...(deletedAt ? { deletedAt } : {}),
  } as Card;
}

function makePushResponse(cards: Card[]): Response {
  const activeCount = cards.filter((c) => !c.deletedAt).length;
  return {
    ok: true,
    json: async () => ({ cards, syncedCount: activeCount }),
  } as Response;
}

function makePullResponse(cards: Card[]): Response {
  const activeCount = cards.filter((c) => !c.deletedAt).length;
  return {
    ok: true,
    json: async () => ({ cards, activeCount }),
  } as Response;
}

function makeErrorResponse(status: number, error: string, description: string): Response {
  return {
    ok: false,
    status,
    json: async () => ({ error, error_description: description }),
  } as Response;
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe("hasMigrated / markMigrated", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it("returns false when flag is absent", () => {
    expect(hasMigrated()).toBe(false);
  });

  it("returns true after markMigrated()", () => {
    markMigrated();
    expect(hasMigrated()).toBe(true);
  });

  it("markMigrated() sets fenrir:migrated = 'true' in localStorage", () => {
    markMigrated();
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "fenrir:migrated",
      "true"
    );
  });
});

describe("runMigration — already migrated guard", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it("returns ran=false without calling fetch when already migrated", async () => {
    // Pre-set the flag
    localStorageStore["fenrir:migrated"] = "true";

    const result = await runMigration("hh-test", "id-token-123");

    expect(result.ran).toBe(false);
    expect(result.cardCount).toBe(0);
    expect(result.direction).toBe("empty");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("runMigration — download direction (pull-first)", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("calls GET /api/sync/pull when local cards are empty", async () => {
    mockGetRawAllCards.mockReturnValue([]);
    const cloudCards = [
      makeCard("c1", "2026-01-01T10:00:00Z"),
      makeCard("c2", "2026-01-02T10:00:00Z"),
    ];
    mockFetch.mockResolvedValue(makePullResponse(cloudCards));

    await runMigration("hh-test", "tok-pull");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/sync/pull?householdId=hh-test",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer tok-pull",
        }),
      })
    );
    // Must NOT call push when local is empty
    expect(mockFetch).not.toHaveBeenCalledWith(
      "/api/sync/push",
      expect.anything()
    );
  });

  it("direction=download when local is empty and cloud has cards", async () => {
    // Local is empty
    mockGetRawAllCards.mockReturnValue([]);

    // Cloud returns 3 active cards
    const cloudCards = [
      makeCard("c1", "2026-01-01T10:00:00Z"),
      makeCard("c2", "2026-01-02T10:00:00Z"),
      makeCard("c3", "2026-01-03T10:00:00Z"),
    ];
    mockFetch.mockResolvedValue(makePullResponse(cloudCards));

    const result = await runMigration("hh-test", "id-token-123");

    expect(result.ran).toBe(true);
    expect(result.cardCount).toBe(3);
    expect(result.direction).toBe("download");

    // Should write pulled cards to localStorage
    expect(mockSetAllCards).toHaveBeenCalledWith("hh-test", cloudCards);

    // Should mark migrated
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "fenrir:migrated",
      "true"
    );
  });

  it("direction=empty when local is empty and cloud is also empty", async () => {
    mockGetRawAllCards.mockReturnValue([]);
    mockFetch.mockResolvedValue(makePullResponse([]));

    const result = await runMigration("hh-test", "id-token-123");

    expect(result.ran).toBe(true);
    expect(result.cardCount).toBe(0);
    expect(result.direction).toBe("empty");
    expect(localStorageMock.setItem).toHaveBeenCalledWith("fenrir:migrated", "true");
  });

  it("includes tombstones from pull in setAllCards", async () => {
    mockGetRawAllCards.mockReturnValue([]);
    const active = makeCard("c1", "2026-01-01T10:00:00Z");
    const tombstone = makeCard("c2", "2026-01-01T09:00:00Z", "2026-01-02T08:00:00Z");
    mockFetch.mockResolvedValue(makePullResponse([active, tombstone]));

    const result = await runMigration("hh-test", "id-token-123");

    // activeCount is 1 (tombstone excluded), but setAllCards receives all cards
    expect(result.cardCount).toBe(1);
    expect(mockSetAllCards).toHaveBeenCalledWith("hh-test", [active, tombstone]);
  });
});

describe("runMigration — upload direction", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it("direction=upload when local has cards and cloud returns same count", async () => {
    // Local has 2 active cards
    const localCards = [
      makeCard("c1", "2026-01-01T10:00:00Z"),
      makeCard("c2", "2026-01-02T10:00:00Z"),
    ];
    mockGetRawAllCards.mockReturnValue(localCards);

    // Cloud returns the same 2 cards (local-only upload scenario)
    mockFetch.mockResolvedValue(makePushResponse(localCards));

    const result = await runMigration("hh-test", "id-token-123");

    expect(result.ran).toBe(true);
    expect(result.cardCount).toBe(2);
    expect(result.direction).toBe("upload");
  });

  it("sends householdId and all local cards (including tombstones) to push endpoint", async () => {
    const activeCard = makeCard("c1", "2026-01-01T10:00:00Z");
    const tombstone = makeCard("c2", "2026-01-01T09:00:00Z", "2026-01-02T08:00:00Z");
    mockGetRawAllCards.mockReturnValue([activeCard, tombstone]);

    mockFetch.mockResolvedValue(makePushResponse([activeCard]));

    await runMigration("hh-test", "tok-abc");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/sync/push",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer tok-abc",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ householdId: "hh-test", cards: [activeCard, tombstone] }),
      })
    );
  });
});

describe("runMigration — merge direction", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it("direction=merge when local has cards and cloud returns more cards (merge added cloud-only cards)", async () => {
    // Local has 2 active cards
    const localCards = [
      makeCard("c1", "2026-01-01T10:00:00Z"),
      makeCard("c2", "2026-01-02T10:00:00Z"),
    ];
    mockGetRawAllCards.mockReturnValue(localCards);

    // Merged result has 4 cards (cloud had 2 additional)
    const mergedCards = [
      ...localCards,
      makeCard("c3", "2026-01-03T10:00:00Z"),
      makeCard("c4", "2026-01-04T10:00:00Z"),
    ];
    mockFetch.mockResolvedValue(makePushResponse(mergedCards));

    const result = await runMigration("hh-test", "id-token-123");

    expect(result.ran).toBe(true);
    expect(result.cardCount).toBe(4);
    expect(result.direction).toBe("merge");
    expect(mockSetAllCards).toHaveBeenCalledWith("hh-test", mergedCards);
  });
});


describe("runMigration — API error handling (pull path, empty local)", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("throws and does NOT set migration flag when pull API returns non-OK", async () => {
    mockGetRawAllCards.mockReturnValue([]);
    mockFetch.mockResolvedValue(
      makeErrorResponse(403, "forbidden", "Cloud sync is a Karl-tier feature.")
    );

    await expect(runMigration("hh-test", "id-token-123")).rejects.toThrow(
      "Cloud sync is a Karl-tier feature."
    );

    // Flag must NOT be set on failure
    expect(hasMigrated()).toBe(false);
    expect(mockSetAllCards).not.toHaveBeenCalled();
  });

  it("throws with error code attached when pull API errors", async () => {
    mockGetRawAllCards.mockReturnValue([]);
    mockFetch.mockResolvedValue(
      makeErrorResponse(500, "internal_error", "Server blew up.")
    );

    let thrown: Error & { code?: string } | null = null;
    try {
      await runMigration("hh-test", "id-token-123");
    } catch (e) {
      thrown = e as Error & { code?: string };
    }

    expect(thrown).not.toBeNull();
    expect(thrown?.code).toBe("internal_error");
    expect(thrown?.message).toBe("Server blew up.");
  });

  it("throws with generic message when pull error body is not parseable JSON", async () => {
    mockGetRawAllCards.mockReturnValue([]);
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => { throw new SyntaxError("not json"); },
    } as Response);

    await expect(runMigration("hh-test", "id-token-123")).rejects.toThrow(
      "Migration failed."
    );
  });
});

describe("runMigration — API error handling (push path, local has cards)", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("throws and does NOT set migration flag when push API returns non-OK", async () => {
    mockGetRawAllCards.mockReturnValue([makeCard("c1", "2026-01-01T10:00:00Z")]);
    mockFetch.mockResolvedValue(
      makeErrorResponse(403, "forbidden", "Cloud sync is a Karl-tier feature.")
    );

    await expect(runMigration("hh-test", "id-token-123")).rejects.toThrow(
      "Cloud sync is a Karl-tier feature."
    );

    expect(hasMigrated()).toBe(false);
    expect(mockSetAllCards).not.toHaveBeenCalled();
  });
});

describe("runMigration — idempotency", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("second call returns ran=false without fetching (pull path)", async () => {
    mockGetRawAllCards.mockReturnValue([]);
    const cards = [makeCard("c1", "2026-01-01T10:00:00Z")];
    mockFetch.mockResolvedValue(makePullResponse(cards));

    // First call — local empty → pull
    const first = await runMigration("hh-test", "id-token-123");
    expect(first.ran).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second call — should be skipped (flag set)
    vi.clearAllMocks();
    const second = await runMigration("hh-test", "id-token-123");
    expect(second.ran).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("second call returns ran=false without fetching (push path)", async () => {
    const localCards = [makeCard("c1", "2026-01-01T10:00:00Z")];
    mockGetRawAllCards.mockReturnValue(localCards);
    mockFetch.mockResolvedValue(makePushResponse(localCards));

    // First call — local has cards → push
    const first = await runMigration("hh-test", "id-token-123");
    expect(first.ran).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second call — should be skipped (flag set)
    vi.clearAllMocks();
    const second = await runMigration("hh-test", "id-token-123");
    expect(second.ran).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("MIGRATION_FLAG constant", () => {
  it("has the expected value", () => {
    expect(MIGRATION_FLAG).toBe("fenrir:migrated");
  });
});
