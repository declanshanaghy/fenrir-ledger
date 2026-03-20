/**
 * Fenrir Ledger — Loki QA: Firestore Mock Augmentation Tests
 *
 * Augments firestore-mock.test.ts (FiremanDecko's 18 tests) with gap coverage:
 *   - Multi-household data isolation (no cross-household leakage)
 *   - mockSetCards empty-array no-op
 *   - User overwrite semantics
 *   - mockSyncPushResponse syncedCount math (mixed active + tombstone input)
 *   - SyncPushResponse shape contract matches what useCloudSync expects
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
  mockSyncPushResponse,
  type SyncPushResponse,
} from "@/lib/firebase/firestore-mock";
import type { Card } from "@/lib/types";
import type { FirestoreUser } from "@/lib/firebase/firestore-types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const HH_A = "household-alpha";
const HH_B = "household-beta";

function makeCard(id: string, householdId: string, deletedAt?: string): Card {
  const now = new Date().toISOString();
  return {
    id,
    householdId,
    issuerId: "chase",
    cardName: `Card ${id}`,
    openDate: "2024-01-01",
    creditLimit: 100000,
    annualFee: 0,
    annualFeeDate: "2025-01-01",
    promoPeriodMonths: 0,
    signUpBonus: null,
    status: "active",
    notes: "",
    createdAt: now,
    updatedAt: now,
    ...(deletedAt ? { deletedAt } : {}),
  };
}

function makeUser(id: string, overrides: Partial<FirestoreUser> = {}): FirestoreUser {
  const now = new Date().toISOString();
  return {
    userId: id,
    email: `${id}@example.com`,
    displayName: id,
    householdId: HH_A,
    role: "owner",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeEach(() => {
  resetMockFirestore();
});

// ─── Multi-household isolation ────────────────────────────────────────────────

describe("multi-household isolation", () => {
  it("cards written to household-A do not appear in household-B", async () => {
    await mockSetCard(makeCard("a1", HH_A));
    await mockSetCard(makeCard("a2", HH_A));

    const inA = await mockGetAllFirestoreCards(HH_A);
    const inB = await mockGetAllFirestoreCards(HH_B);

    expect(inA).toHaveLength(2);
    expect(inB).toEqual([]);
  });

  it("active cards are isolated per household when filtering tombstones", async () => {
    const now = new Date().toISOString();
    await mockSetCard(makeCard("a-active", HH_A));
    await mockSetCard(makeCard("a-deleted", HH_A, now));
    await mockSetCard(makeCard("b-active", HH_B));

    const activeA = await mockGetCards(HH_A);
    const activeB = await mockGetCards(HH_B);

    expect(activeA).toHaveLength(1);
    expect(activeA[0]!.id).toBe("a-active");
    expect(activeB).toHaveLength(1);
    expect(activeB[0]!.id).toBe("b-active");
  });
});

// ─── mockSetCards empty-array no-op ──────────────────────────────────────────

describe("mockSetCards empty array", () => {
  it("calling mockSetCards with empty array does not throw and leaves store empty", async () => {
    await expect(mockSetCards([])).resolves.toBeUndefined();
    const result = await mockGetAllFirestoreCards(HH_A);
    expect(result).toEqual([]);
  });
});

// ─── User overwrite semantics ─────────────────────────────────────────────────

describe("user overwrite semantics", () => {
  it("setting the same user twice replaces with the latest data", async () => {
    const original = makeUser("u-overwrite", { email: "old@example.com" });
    const updated = makeUser("u-overwrite", { email: "new@example.com" });

    await mockSetUser(original);
    await mockSetUser(updated);

    const result = await mockGetUser("u-overwrite");
    expect(result).not.toBeNull();
    expect(result!.email).toBe("new@example.com");
  });
});

// ─── SyncPushResponse shape contract ─────────────────────────────────────────

describe("mockSyncPushResponse shape contract (matches useCloudSync expectation)", () => {
  it("response has exactly the keys useCloudSync destructures: cards + syncedCount", () => {
    // useCloudSync line 226: const { cards: mergedCards, syncedCount } = await response.json()
    const response: SyncPushResponse = mockSyncPushResponse();
    const keys = Object.keys(response).sort();
    expect(keys).toEqual(["cards", "syncedCount"]);
  });

  it("syncedCount equals exactly the number of active cards (no tombstones)", () => {
    const now = new Date().toISOString();
    // 3 active, 2 tombstoned → syncedCount must be 3
    const cards: Card[] = [
      makeCard("c1", HH_A),
      makeCard("c2", HH_A),
      makeCard("c3", HH_A),
      makeCard("d1", HH_A, now),
      makeCard("d2", HH_A, now),
    ];
    const response = mockSyncPushResponse(cards);
    expect(response.syncedCount).toBe(3);
    expect(response.cards).toHaveLength(5); // all cards returned, client applies them
  });
});
