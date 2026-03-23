/**
 * Issue #1671 — Anonymous Card Storage
 *
 * Tests the new anonymous card storage model:
 *   - Anonymous cards stored under fixed "anon" key (fenrir_ledger:anon:cards)
 *   - mergeAnonymousCards() reads from "anon" key and merges into Google household
 *   - mergeAnonymousCards() also migrates cards from legacy UUID key (backward compat)
 *   - After merge: both "anon" and legacy UUID keys are cleaned up
 *   - Re-merge on subsequent sign-in merges nothing (anon storage was cleared)
 *
 * @ref Issue #1671
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── localStorage mock ────────────────────────────────────────────────────────

const localStorageStore: Record<string, string> = {};

const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageStore[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageStore[key];
  }),
  clear: vi.fn(() => {
    Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]);
  }),
  get length() {
    return Object.keys(localStorageStore).length;
  },
  key: vi.fn(),
};

// ─── window.dispatchEvent mock ────────────────────────────────────────────────

const mockDispatchEvent = vi.hoisted(() => vi.fn());

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]);
  Object.defineProperty(globalThis, "localStorage", {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(globalThis, "window", {
    value: {
      localStorage: localStorageMock,
      dispatchEvent: mockDispatchEvent,
    },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Helper to seed cards ─────────────────────────────────────────────────────

function seedCards(householdId: string, cards: object[]): void {
  localStorageStore[`fenrir_ledger:${householdId}:cards`] = JSON.stringify(cards);
}

function readCards(householdId: string): object[] {
  const raw = localStorageStore[`fenrir_ledger:${householdId}:cards`];
  return raw ? JSON.parse(raw) : [];
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Issue #1671 — anonymous card storage model", () => {
  // ── Fixed "anon" key ──────────────────────────────────────────────────────

  describe("ANON_HOUSEHOLD_ID constant", () => {
    it("ANON_HOUSEHOLD_ID is 'anon'", async () => {
      const { ANON_HOUSEHOLD_ID } = await import("@/lib/constants");
      expect(ANON_HOUSEHOLD_ID).toBe("anon");
    });

    it("anonymous cards key follows fenrir_ledger:anon:cards pattern", async () => {
      const { ANON_HOUSEHOLD_ID, STORAGE_KEY_PREFIX } = await import("@/lib/constants");
      expect(`${STORAGE_KEY_PREFIX}:${ANON_HOUSEHOLD_ID}:cards`).toBe("fenrir_ledger:anon:cards");
    });
  });

  // ── mergeAnonymousCards: fixed key ────────────────────────────────────────

  describe("mergeAnonymousCards — from fixed 'anon' key", () => {
    it("merges anon cards into Google household", async () => {
      const googleId = "google-sub-123";
      const anonCard = { id: "card-1", householdId: "anon", cardName: "Anon Card" };
      seedCards("anon", [anonCard]);

      const { mergeAnonymousCards } = await import("@/lib/merge-anonymous");
      const result = mergeAnonymousCards(googleId);

      expect(result.merged).toBe(1);
      expect(result.skipped).toBe(0);

      const googleCards = readCards(googleId) as Array<{ householdId: string; id: string }>;
      expect(googleCards).toHaveLength(1);
      expect(googleCards[0]!.householdId).toBe(googleId);
      expect(googleCards[0]!.id).toBe("card-1");
    });

    it("clears the fixed anon key after merge", async () => {
      const googleId = "google-sub-123";
      seedCards("anon", [{ id: "card-1", householdId: "anon", cardName: "Test" }]);

      const { mergeAnonymousCards } = await import("@/lib/merge-anonymous");
      mergeAnonymousCards(googleId);

      expect(localStorageStore["fenrir_ledger:anon:cards"]).toBeUndefined();
    });

    it("skips cards already in Google household (Google version wins)", async () => {
      const googleId = "google-sub-123";
      const existingCard = { id: "card-1", householdId: googleId, cardName: "Google Card" };
      const anonCard = { id: "card-1", householdId: "anon", cardName: "Anon Card" };
      seedCards(googleId, [existingCard]);
      seedCards("anon", [anonCard]);

      const { mergeAnonymousCards } = await import("@/lib/merge-anonymous");
      const result = mergeAnonymousCards(googleId);

      expect(result.merged).toBe(0);
      expect(result.skipped).toBe(1);
    });

    it("returns { merged: 0, skipped: 0 } when anon storage is empty", async () => {
      const googleId = "google-sub-123";
      // No cards seeded

      const { mergeAnonymousCards } = await import("@/lib/merge-anonymous");
      const result = mergeAnonymousCards(googleId);

      expect(result.merged).toBe(0);
      expect(result.skipped).toBe(0);
    });

    it("re-merge on subsequent sign-in finds nothing (anon storage cleared)", async () => {
      const googleId = "google-sub-123";
      seedCards("anon", [{ id: "card-1", householdId: "anon", cardName: "Card" }]);

      const { mergeAnonymousCards } = await import("@/lib/merge-anonymous");
      // First sign-in: merges 1 card
      const first = mergeAnonymousCards(googleId);
      expect(first.merged).toBe(1);

      // Second sign-in: anon storage was cleared, nothing to merge
      const second = mergeAnonymousCards(googleId);
      expect(second.merged).toBe(0);
    });
  });

  // ── mergeAnonymousCards: legacy UUID backward compat ─────────────────────

  describe("mergeAnonymousCards — legacy UUID backward compat", () => {
    it("migrates cards from legacy UUID key when fenrir:household exists", async () => {
      const googleId = "google-sub-456";
      const legacyUuid = "legacy-anon-uuid-abc";
      localStorageStore["fenrir:household"] = legacyUuid;
      const legacyCard = { id: "card-legacy", householdId: legacyUuid, cardName: "Legacy Card" };
      seedCards(legacyUuid, [legacyCard]);

      const { mergeAnonymousCards } = await import("@/lib/merge-anonymous");
      const result = mergeAnonymousCards(googleId);

      expect(result.merged).toBe(1);

      const googleCards = readCards(googleId) as Array<{ id: string }>;
      expect(googleCards[0]!.id).toBe("card-legacy");
    });

    it("clears legacy UUID key and fenrir:household after merge", async () => {
      const googleId = "google-sub-456";
      const legacyUuid = "legacy-anon-uuid-xyz";
      localStorageStore["fenrir:household"] = legacyUuid;
      seedCards(legacyUuid, [{ id: "card-1", householdId: legacyUuid, cardName: "Card" }]);

      const { mergeAnonymousCards } = await import("@/lib/merge-anonymous");
      mergeAnonymousCards(googleId);

      expect(localStorageStore[`fenrir_ledger:${legacyUuid}:cards`]).toBeUndefined();
      expect(localStorageStore["fenrir:household"]).toBeUndefined();
    });

    it("deduplicates when same card is in both fixed anon and legacy UUID key", async () => {
      const googleId = "google-sub-789";
      const legacyUuid = "legacy-uuid-dedup";
      localStorageStore["fenrir:household"] = legacyUuid;
      // Same card ID in both sources
      seedCards("anon", [{ id: "card-dup", householdId: "anon", cardName: "Fixed Anon Card" }]);
      seedCards(legacyUuid, [{ id: "card-dup", householdId: legacyUuid, cardName: "Legacy Card" }]);

      const { mergeAnonymousCards } = await import("@/lib/merge-anonymous");
      const result = mergeAnonymousCards(googleId);

      // The cross-anon dedup removes the legacy duplicate before Google comparison.
      // merged=1: unique card merged into Google household
      // skipped=0: skipped only counts Google household conflicts, not anon-source duplicates
      expect(result.merged).toBe(1);
      expect(result.skipped).toBe(0);

      // The merged card should be in the Google household
      const googleCards = readCards(googleId) as Array<{ id: string }>;
      expect(googleCards).toHaveLength(1);
      expect(googleCards[0]!.id).toBe("card-dup");
    });
  });

  // ── isMergeComplete (deprecated) ─────────────────────────────────────────

  describe("isMergeComplete — deprecated stub", () => {
    it("isMergeComplete always returns false (deprecated, cleanup is sufficient)", async () => {
      const { isMergeComplete } = await import("@/lib/merge-anonymous");
      expect(isMergeComplete("any-id")).toBe(false);
    });
  });
});
