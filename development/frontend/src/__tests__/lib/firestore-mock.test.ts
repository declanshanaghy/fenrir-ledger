/**
 * Fenrir Ledger — In-Memory Mock Firestore Tests
 *
 * Tests for firestore-mock.ts, the test-only in-memory Firestore backend.
 *
 * Validates:
 *   - Mock functions return correct empty/default data shapes
 *   - Mock state is isolated between tests (resetMockFirestore)
 *   - Sync API response shapes match the real API contract
 *   - CRUD operations on the in-memory store work correctly
 *
 * Issue #1189
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  resetMockFirestore,
  mockGetCards,
  mockGetAllFirestoreCards,
  mockSetCard,
  mockSetCards,
  mockGetUser,
  mockSetUser,
  mockGetHousehold,
  mockSetHousehold,
  mockSyncPushResponse,
  mockSyncPullResponse,
  type SyncPushResponse,
  type SyncPullResponse,
} from "@/lib/firebase/firestore-mock";
import type { Card } from "@/lib/types";
import type { FirestoreUser, FirestoreHousehold } from "@/lib/firebase/firestore-types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TEST_HOUSEHOLD = "hh-test-001";

function makeCard(overrides: Partial<Card> = {}): Card {
  const now = new Date().toISOString();
  return {
    id: "card-001",
    householdId: TEST_HOUSEHOLD,
    issuerId: "chase",
    cardName: "Test Card",
    openDate: "2024-01-01",
    creditLimit: 500000,
    annualFee: 9500,
    annualFeeDate: "2025-01-01",
    promoPeriodMonths: 0,
    signUpBonus: null,
    status: "active",
    notes: "",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeUser(overrides: Partial<FirestoreUser> = {}): FirestoreUser {
  const now = new Date().toISOString();
  return {
    userId: "user-001",
    email: "test@example.com",
    displayName: "Test User",
    householdId: TEST_HOUSEHOLD,
    role: "owner",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeHousehold(overrides: Partial<FirestoreHousehold> = {}): FirestoreHousehold {
  const now = new Date().toISOString();
  return {
    id: TEST_HOUSEHOLD,
    name: "Test Household",
    ownerId: "user-001",
    memberIds: ["user-001"],
    inviteCode: "ABCDEF",
    inviteCodeExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    tier: "free",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetMockFirestore();
});

// ─── Card operations ──────────────────────────────────────────────────────────

describe("mockGetAllFirestoreCards", () => {
  it("returns empty array when no cards exist", async () => {
    const result = await mockGetAllFirestoreCards(TEST_HOUSEHOLD);
    expect(result).toEqual([]);
  });

  it("returns stored cards including tombstones", async () => {
    const active = makeCard({ id: "active-1" });
    const tombstone = makeCard({
      id: "deleted-1",
      deletedAt: new Date().toISOString(),
    });
    await mockSetCards([active, tombstone]);

    const result = await mockGetAllFirestoreCards(TEST_HOUSEHOLD);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toContain("active-1");
    expect(result.map((c) => c.id)).toContain("deleted-1");
  });

  it("returns empty array for unknown household", async () => {
    await mockSetCard(makeCard({ id: "card-001" }));
    const result = await mockGetAllFirestoreCards("unknown-household");
    expect(result).toEqual([]);
  });
});

describe("mockGetCards", () => {
  it("returns empty array when no cards exist", async () => {
    const result = await mockGetCards(TEST_HOUSEHOLD);
    expect(result).toEqual([]);
  });

  it("excludes tombstoned (soft-deleted) cards", async () => {
    const active = makeCard({ id: "active-1" });
    const tombstone = makeCard({
      id: "deleted-1",
      deletedAt: new Date().toISOString(),
    });
    await mockSetCards([active, tombstone]);

    const result = await mockGetCards(TEST_HOUSEHOLD);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("active-1");
  });
});

describe("mockSetCard / mockSetCards", () => {
  it("stores a card and retrieves it", async () => {
    const card = makeCard({ id: "stored-card" });
    await mockSetCard(card);

    const result = await mockGetAllFirestoreCards(TEST_HOUSEHOLD);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("stored-card");
  });

  it("overwrites a card with the same id", async () => {
    const original = makeCard({ id: "card-a", cardName: "Original" });
    const updated = makeCard({ id: "card-a", cardName: "Updated" });

    await mockSetCard(original);
    await mockSetCard(updated);

    const result = await mockGetAllFirestoreCards(TEST_HOUSEHOLD);
    expect(result).toHaveLength(1);
    expect(result[0]!.cardName).toBe("Updated");
  });

  it("mockSetCards stores multiple cards", async () => {
    const cards = [
      makeCard({ id: "c1" }),
      makeCard({ id: "c2" }),
      makeCard({ id: "c3" }),
    ];
    await mockSetCards(cards);

    const result = await mockGetAllFirestoreCards(TEST_HOUSEHOLD);
    expect(result).toHaveLength(3);
  });
});

// ─── User operations ──────────────────────────────────────────────────────────

describe("mockGetUser / mockSetUser", () => {
  it("returns null for unknown user", async () => {
    const result = await mockGetUser("nonexistent");
    expect(result).toBeNull();
  });

  it("stores and retrieves a user", async () => {
    const user = makeUser({ userId: "user-xyz" });
    await mockSetUser(user);

    const result = await mockGetUser("user-xyz");
    expect(result).not.toBeNull();
    expect(result!.userId).toBe("user-xyz");
    expect(result!.email).toBe("test@example.com");
  });
});

// ─── Household operations ─────────────────────────────────────────────────────

describe("mockGetHousehold / mockSetHousehold", () => {
  it("returns null for unknown household", async () => {
    const result = await mockGetHousehold("nonexistent");
    expect(result).toBeNull();
  });

  it("stores and retrieves a household", async () => {
    const hh = makeHousehold({ id: "hh-abc", name: "Loki's Household" });
    await mockSetHousehold(hh);

    const result = await mockGetHousehold("hh-abc");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Loki's Household");
  });
});

// ─── Store isolation ─────────────────────────────────────────────────────────

describe("resetMockFirestore", () => {
  it("clears all stored data", async () => {
    await mockSetCard(makeCard({ id: "card-before-reset" }));
    await mockSetUser(makeUser());
    await mockSetHousehold(makeHousehold());

    resetMockFirestore();

    expect(await mockGetAllFirestoreCards(TEST_HOUSEHOLD)).toEqual([]);
    expect(await mockGetUser("user-001")).toBeNull();
    expect(await mockGetHousehold(TEST_HOUSEHOLD)).toBeNull();
  });
});

// ─── Sync API response shapes ─────────────────────────────────────────────────

describe("mockSyncPushResponse", () => {
  it("returns correct shape with no cards", () => {
    const response: SyncPushResponse = mockSyncPushResponse();
    expect(response).toHaveProperty("cards");
    expect(response).toHaveProperty("syncedCount");
    expect(response.cards).toEqual([]);
    expect(response.syncedCount).toBe(0);
  });

  it("counts only non-deleted cards in syncedCount", () => {
    const now = new Date().toISOString();
    const cards: Card[] = [
      makeCard({ id: "c1" }),
      makeCard({ id: "c2" }),
      makeCard({ id: "c3-deleted", deletedAt: now }),
    ];
    const response = mockSyncPushResponse(cards);
    expect(response.cards).toHaveLength(3);
    expect(response.syncedCount).toBe(2); // excludes tombstone
  });

  it("syncedCount is 0 for all-tombstone input", () => {
    const now = new Date().toISOString();
    const cards = [
      makeCard({ id: "d1", deletedAt: now }),
      makeCard({ id: "d2", deletedAt: now }),
    ];
    const response = mockSyncPushResponse(cards);
    expect(response.syncedCount).toBe(0);
  });
});

describe("mockSyncPullResponse", () => {
  it("returns correct shape with no cards", () => {
    const response: SyncPullResponse = mockSyncPullResponse();
    expect(response).toHaveProperty("cards");
    expect(response.cards).toEqual([]);
  });

  it("returns provided cards unchanged", () => {
    const cards = [makeCard({ id: "c1" }), makeCard({ id: "c2" })];
    const response = mockSyncPullResponse(cards);
    expect(response.cards).toHaveLength(2);
    expect(response.cards[0]!.id).toBe("c1");
  });
});

// ─── Production code path validation ─────────────────────────────────────────

describe("real firestore.ts throws without FIRESTORE_PROJECT_ID", () => {
  it("getFirestore throws when FIRESTORE_PROJECT_ID is missing", async () => {
    const { _resetFirestoreForTests, getFirestore } = await import(
      "@/lib/firebase/firestore"
    );
    _resetFirestoreForTests();
    const original = process.env.FIRESTORE_PROJECT_ID;
    delete process.env.FIRESTORE_PROJECT_ID;

    expect(() => getFirestore()).toThrow(
      "FIRESTORE_PROJECT_ID environment variable is not set"
    );

    // Restore
    if (original !== undefined) {
      process.env.FIRESTORE_PROJECT_ID = original;
    }
    _resetFirestoreForTests();
  });
});
