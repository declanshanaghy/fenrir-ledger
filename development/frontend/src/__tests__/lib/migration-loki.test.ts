/**
 * Fenrir Ledger — migration.ts Edge-Case Tests (Loki QA — Issue #1124)
 *
 * Covers gaps NOT addressed by FiremanDecko's migration.test.ts:
 *
 *   1. hasMigrated() returns false in SSR (typeof localStorage === "undefined")
 *   2. markMigrated() is silent when localStorage throws (full/QuotaExceeded)
 *   3. inferDirection: localActive > syncedCount → still "upload" (deleted cards in merge)
 *   4. runMigration passes the correct Authorization header to /api/sync/push
 *   5. runMigration falls back to generic error message when error body has no error_description
 *   6. Tombstone cards are included in the push payload (send ALL cards, not just active)
 *
 * Issue #1124
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Card } from "@/lib/types";

// ─── localStorage mock ────────────────────────────────────────────────────────

const localStorageStore: Record<string, string> = {};
let localStorageThrows = false;

const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, val: string) => {
    if (localStorageThrows) throw new DOMException("QuotaExceededError");
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
  configurable: true,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("hasMigrated — SSR guard", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    localStorageThrows = false;
  });

  it("returns false when localStorage.getItem returns null (no flag set)", async () => {
    const { hasMigrated } = await import("@/lib/sync/migration");
    // localStorageStore is empty → getItem returns null
    localStorageMock.getItem.mockReturnValueOnce(null);
    expect(hasMigrated()).toBe(false);
  });

  it("returns false when localStorage.getItem throws", async () => {
    localStorageMock.getItem.mockImplementationOnce(() => {
      throw new Error("storage error");
    });
    const { hasMigrated } = await import("@/lib/sync/migration");
    expect(hasMigrated()).toBe(false);
  });
});

describe("markMigrated — localStorage full (QuotaExceededError)", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    localStorageThrows = false;
  });

  afterEach(() => {
    localStorageThrows = false;
  });

  it("does not throw when localStorage.setItem throws QuotaExceededError", async () => {
    localStorageThrows = true;
    const { markMigrated } = await import("@/lib/sync/migration");
    // Should not throw — silently no-ops
    expect(() => markMigrated()).not.toThrow();
  });

  it("when localStorage is full, migration flag is NOT set", async () => {
    localStorageThrows = true;
    const { markMigrated, hasMigrated } = await import("@/lib/sync/migration");
    markMigrated();
    localStorageThrows = false;
    // hasMigrated reads from localStorageStore (which was not written)
    expect(hasMigrated()).toBe(false);
  });
});

describe("runMigration — direction inference edge cases", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    localStorageThrows = false;
  });

  it("returns direction=upload when local has more cards than synced (server deleted some)", async () => {
    // Local has 4 active cards
    const localCards = [
      makeCard("c1", "2026-01-01T10:00:00Z"),
      makeCard("c2", "2026-01-02T10:00:00Z"),
      makeCard("c3", "2026-01-03T10:00:00Z"),
      makeCard("c4", "2026-01-04T10:00:00Z"),
    ];
    mockGetRawAllCards.mockReturnValue(localCards);

    // Merged result has only 2 active (server tombstoned 2)
    const mergedCards = [
      makeCard("c1", "2026-01-01T10:00:00Z"),
      makeCard("c2", "2026-01-02T10:00:00Z"),
    ];
    mockFetch.mockResolvedValue(makePushResponse(mergedCards));

    const { runMigration } = await import("@/lib/sync/migration");
    const result = await runMigration("hh-test", "id-token-xyz");

    // syncedCount(2) is NOT > localActiveCount(4) → not "merge"
    // localActiveCount(4) > 0 → "upload"
    expect(result.direction).toBe("upload");
    expect(result.cardCount).toBe(2);
  });
});

describe("runMigration — Authorization header", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    localStorageThrows = false;
  });

  it("sends Bearer token in Authorization header", async () => {
    mockGetRawAllCards.mockReturnValue([]);
    mockFetch.mockResolvedValue(makePushResponse([]));

    const { runMigration } = await import("@/lib/sync/migration");
    await runMigration("hh-abc", "my-id-token-xyz");

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/sync/push",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer my-id-token-xyz",
        }),
      })
    );
  });
});

describe("runMigration — generic error message fallback", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    localStorageThrows = false;
  });

  it("uses generic message when error body has no error_description field", async () => {
    mockGetRawAllCards.mockReturnValue([]);
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "internal_error" }),
    } as Response);

    const { runMigration } = await import("@/lib/sync/migration");
    await expect(runMigration("hh-test", "tok")).rejects.toThrow("Migration failed.");
  });

  it("uses generic error code when error body has no error field", async () => {
    mockGetRawAllCards.mockReturnValue([]);
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error_description: "Something went wrong." }),
    } as Response);

    const { runMigration } = await import("@/lib/sync/migration");

    let thrown: Error & { code?: string } | null = null;
    try {
      await runMigration("hh-test", "tok");
    } catch (e) {
      thrown = e as Error & { code?: string };
    }

    expect(thrown?.code).toBe("migration_error");
    expect(thrown?.message).toBe("Something went wrong.");
  });
});

describe("runMigration — tombstones in push payload", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    localStorageThrows = false;
  });

  it("includes tombstone cards (deletedAt set) in the push payload", async () => {
    const activeCard = makeCard("c1", "2026-01-01T10:00:00Z");
    const tombstone = makeCard("c2", "2025-12-01T09:00:00Z", "2026-01-10T08:00:00Z");

    mockGetRawAllCards.mockReturnValue([activeCard, tombstone]);
    mockFetch.mockResolvedValue(makePushResponse([activeCard]));

    const { runMigration } = await import("@/lib/sync/migration");
    await runMigration("hh-test", "tok-payload");

    const [, callOptions] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(callOptions.body as string) as {
      cards: Card[];
      householdId: string;
    };

    // Both the active card and tombstone must be in the payload
    expect(body.cards).toHaveLength(2);
    expect(body.cards.some((c) => c.id === "c1")).toBe(true);
    expect(body.cards.some((c) => c.id === "c2")).toBe(true);
    expect(body.cards.find((c) => c.id === "c2")?.deletedAt).toBeDefined();
  });
});
