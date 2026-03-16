/**
 * trash-storage.test.ts — Vitest unit tests for trash storage functions.
 *
 * Tests: getDeletedCards, restoreCard, expungeCard, expungeAllCards.
 * All functions operate on mocked localStorage (vitest jsdom environment).
 *
 * Issue: #1127
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getDeletedCards,
  restoreCard,
  expungeCard,
  expungeAllCards,
  setAllCards,
  getCards,
} from "@/lib/storage";
import type { Card } from "@/lib/types";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const HOUSEHOLD_ID = "test-household-1";

function makeCard(overrides: Partial<Card> = {}): Card {
  const id = overrides.id ?? `card-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    householdId: HOUSEHOLD_ID,
    cardName: "Test Card",
    issuerId: "chase",
    openDate: "2026-01-01T00:00:00.000Z",
    creditLimit: 500000,
    annualFee: 0,
    annualFeeDate: "",
    promoPeriodMonths: 0,
    signUpBonus: null,
    notes: "",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as Card;
}

function makeDeletedCard(overrides: Partial<Card> = {}): Card {
  return makeCard({
    deletedAt: "2026-03-01T12:00:00.000Z",
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Setup: seed localStorage before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// getDeletedCards
// ---------------------------------------------------------------------------

describe("getDeletedCards", () => {
  it("returns only cards with deletedAt set", () => {
    const active = makeCard({ id: "active-1" });
    const deleted = makeDeletedCard({ id: "deleted-1" });
    setAllCards(HOUSEHOLD_ID, [active, deleted]);

    const result = getDeletedCards(HOUSEHOLD_ID);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("deleted-1");
  });

  it("returns empty array when no deleted cards exist", () => {
    setAllCards(HOUSEHOLD_ID, [makeCard(), makeCard()]);
    expect(getDeletedCards(HOUSEHOLD_ID)).toHaveLength(0);
  });

  it("returns empty array when household has no cards", () => {
    expect(getDeletedCards(HOUSEHOLD_ID)).toHaveLength(0);
  });

  it("sorts deleted cards by deletedAt descending (most recent first)", () => {
    const older = makeDeletedCard({
      id: "older",
      deletedAt: "2026-02-01T00:00:00.000Z",
    });
    const newer = makeDeletedCard({
      id: "newer",
      deletedAt: "2026-03-15T00:00:00.000Z",
    });
    setAllCards(HOUSEHOLD_ID, [older, newer]);

    const result = getDeletedCards(HOUSEHOLD_ID);
    expect(result[0]?.id).toBe("newer");
    expect(result[1]?.id).toBe("older");
  });

  it("excludes cards from other households", () => {
    const otherHousehold = "other-household";
    const mine = makeDeletedCard({ id: "mine", householdId: HOUSEHOLD_ID });
    const theirs = makeDeletedCard({ id: "theirs", householdId: otherHousehold });
    // Write to each household's key separately
    setAllCards(HOUSEHOLD_ID, [mine]);
    setAllCards(otherHousehold, [theirs]);

    const result = getDeletedCards(HOUSEHOLD_ID);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("mine");
  });
});

// ---------------------------------------------------------------------------
// restoreCard
// ---------------------------------------------------------------------------

describe("restoreCard", () => {
  it("clears deletedAt on a soft-deleted card", () => {
    const deleted = makeDeletedCard({ id: "restore-me" });
    setAllCards(HOUSEHOLD_ID, [deleted]);

    restoreCard(HOUSEHOLD_ID, "restore-me");

    const active = getCards(HOUSEHOLD_ID);
    const found = active.find((c) => c.id === "restore-me");
    expect(found).toBeDefined();
    expect(found?.deletedAt).toBeUndefined();
  });

  it("restored card no longer appears in getDeletedCards", () => {
    const deleted = makeDeletedCard({ id: "restore-me" });
    setAllCards(HOUSEHOLD_ID, [deleted]);

    restoreCard(HOUSEHOLD_ID, "restore-me");

    expect(getDeletedCards(HOUSEHOLD_ID)).toHaveLength(0);
  });

  it("returns the restored card with deletedAt cleared", () => {
    const deleted = makeDeletedCard({ id: "restore-me" });
    setAllCards(HOUSEHOLD_ID, [deleted]);

    const result = restoreCard(HOUSEHOLD_ID, "restore-me");
    expect(result).toBeDefined();
    expect(result?.deletedAt).toBeUndefined();
    expect(result?.id).toBe("restore-me");
  });

  it("is a no-op for a non-deleted card (returns card as-is)", () => {
    const active = makeCard({ id: "active-card" });
    setAllCards(HOUSEHOLD_ID, [active]);

    const result = restoreCard(HOUSEHOLD_ID, "active-card");
    expect(result?.id).toBe("active-card");
    expect(result?.deletedAt).toBeUndefined();
  });

  it("returns undefined for a non-existent card", () => {
    setAllCards(HOUSEHOLD_ID, []);
    expect(restoreCard(HOUSEHOLD_ID, "ghost-card")).toBeUndefined();
  });

  it("preserves other cards when restoring one", () => {
    const del1 = makeDeletedCard({ id: "del-1" });
    const del2 = makeDeletedCard({ id: "del-2" });
    setAllCards(HOUSEHOLD_ID, [del1, del2]);

    restoreCard(HOUSEHOLD_ID, "del-1");

    expect(getDeletedCards(HOUSEHOLD_ID)).toHaveLength(1);
    expect(getDeletedCards(HOUSEHOLD_ID)[0]?.id).toBe("del-2");
  });
});

// ---------------------------------------------------------------------------
// expungeCard
// ---------------------------------------------------------------------------

describe("expungeCard", () => {
  it("permanently removes a card from localStorage", () => {
    const deleted = makeDeletedCard({ id: "expunge-me" });
    setAllCards(HOUSEHOLD_ID, [deleted]);

    expungeCard(HOUSEHOLD_ID, "expunge-me");

    expect(getDeletedCards(HOUSEHOLD_ID)).toHaveLength(0);
    expect(getCards(HOUSEHOLD_ID)).toHaveLength(0);
  });

  it("removes the card entirely (not just sets deletedAt)", () => {
    const deleted = makeDeletedCard({ id: "expunge-me" });
    setAllCards(HOUSEHOLD_ID, [deleted]);

    expungeCard(HOUSEHOLD_ID, "expunge-me");

    // Verify through raw storage: card should be gone entirely
    const raw = localStorage.getItem(`fenrir_ledger:${HOUSEHOLD_ID}:cards`);
    const parsed = raw ? (JSON.parse(raw) as Card[]) : [];
    expect(parsed.find((c) => c.id === "expunge-me")).toBeUndefined();
  });

  it("is a no-op for a non-existent card", () => {
    const deleted = makeDeletedCard({ id: "keep-me" });
    setAllCards(HOUSEHOLD_ID, [deleted]);

    expungeCard(HOUSEHOLD_ID, "ghost-card"); // no-op

    expect(getDeletedCards(HOUSEHOLD_ID)).toHaveLength(1);
  });

  it("preserves other cards when expunging one", () => {
    const del1 = makeDeletedCard({ id: "del-1" });
    const del2 = makeDeletedCard({ id: "del-2" });
    const active = makeCard({ id: "active-1" });
    setAllCards(HOUSEHOLD_ID, [del1, del2, active]);

    expungeCard(HOUSEHOLD_ID, "del-1");

    const trash = getDeletedCards(HOUSEHOLD_ID);
    expect(trash).toHaveLength(1);
    expect(trash[0]?.id).toBe("del-2");

    const live = getCards(HOUSEHOLD_ID);
    expect(live).toHaveLength(1);
    expect(live[0]?.id).toBe("active-1");
  });
});

// ---------------------------------------------------------------------------
// expungeAllCards
// ---------------------------------------------------------------------------

describe("expungeAllCards", () => {
  it("removes all soft-deleted cards from localStorage", () => {
    const del1 = makeDeletedCard({ id: "del-1" });
    const del2 = makeDeletedCard({ id: "del-2" });
    setAllCards(HOUSEHOLD_ID, [del1, del2]);

    expungeAllCards(HOUSEHOLD_ID);

    expect(getDeletedCards(HOUSEHOLD_ID)).toHaveLength(0);
  });

  it("preserves active (non-deleted) cards", () => {
    const del1 = makeDeletedCard({ id: "del-1" });
    const active = makeCard({ id: "active-1" });
    setAllCards(HOUSEHOLD_ID, [del1, active]);

    expungeAllCards(HOUSEHOLD_ID);

    const trash = getDeletedCards(HOUSEHOLD_ID);
    expect(trash).toHaveLength(0);

    const live = getCards(HOUSEHOLD_ID);
    expect(live).toHaveLength(1);
    expect(live[0]?.id).toBe("active-1");
  });

  it("is a no-op when there are no deleted cards", () => {
    const active = makeCard({ id: "active-1" });
    setAllCards(HOUSEHOLD_ID, [active]);

    expungeAllCards(HOUSEHOLD_ID);

    const live = getCards(HOUSEHOLD_ID);
    expect(live).toHaveLength(1);
  });

  it("is a no-op on empty household", () => {
    setAllCards(HOUSEHOLD_ID, []);
    expungeAllCards(HOUSEHOLD_ID);
    expect(getDeletedCards(HOUSEHOLD_ID)).toHaveLength(0);
  });

  it("only removes deleted cards for the target household", () => {
    const otherHousehold = "other-household-2";
    const myDeleted = makeDeletedCard({ id: "my-del", householdId: HOUSEHOLD_ID });
    const theirDeleted = makeDeletedCard({ id: "their-del", householdId: otherHousehold });
    setAllCards(HOUSEHOLD_ID, [myDeleted]);
    setAllCards(otherHousehold, [theirDeleted]);

    expungeAllCards(HOUSEHOLD_ID);

    expect(getDeletedCards(HOUSEHOLD_ID)).toHaveLength(0);
    expect(getDeletedCards(otherHousehold)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Trash filtering: getCards excludes deletedAt cards
// ---------------------------------------------------------------------------

describe("getCards excludes deleted cards (regression)", () => {
  it("getCards does not return soft-deleted cards", () => {
    const active = makeCard({ id: "active-1" });
    const deleted = makeDeletedCard({ id: "deleted-1" });
    setAllCards(HOUSEHOLD_ID, [active, deleted]);

    const result = getCards(HOUSEHOLD_ID);
    expect(result.find((c) => c.id === "deleted-1")).toBeUndefined();
    expect(result.find((c) => c.id === "active-1")).toBeDefined();
  });
});
