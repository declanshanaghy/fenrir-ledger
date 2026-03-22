/**
 * Unit tests for storage.ts — localStorage abstraction layer.
 *
 * Uses happy-dom (configured in vitest.config.ts) for localStorage.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Card, Household } from "@/lib/types";
import { STORAGE_KEY_PREFIX, STORAGE_KEYS, SCHEMA_VERSION } from "@/lib/constants";

import {
  migrateIfNeeded,
  initializeHousehold,
  getHouseholds,
  getCards,
  getClosedCards,
  getCardById,
  getAllCardsGlobal,
  saveCard,
  deleteCard,
  closeCard,
  setAllCards,
} from "@/lib/storage";

// ── Test helpers ──────────────────────────────────────────────────────────

const HH_ID = "test-household-id";

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: `card-${Math.random().toString(36).slice(2, 9)}`,
    householdId: HH_ID,
    issuerId: "chase",
    cardName: "Test Card",
    openDate: "2025-01-01T00:00:00.000Z",
    creditLimit: 500000,
    annualFee: 0,
    annualFeeDate: "",
    promoPeriodMonths: 0,
    signUpBonus: null,
    status: "active",
    notes: "",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function seedCards(cards: Card[]): void {
  localStorage.setItem(
    `${STORAGE_KEY_PREFIX}:${HH_ID}:cards`,
    JSON.stringify(cards)
  );
}

function readRawCards(): Card[] {
  const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}:${HH_ID}:cards`);
  return raw ? JSON.parse(raw) : [];
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ── migrateIfNeeded ─────────────────────────────────────────────────

  describe("migrateIfNeeded", () => {
    it("sets schema version on fresh install", () => {
      migrateIfNeeded();
      expect(localStorage.getItem(STORAGE_KEYS.SCHEMA_VERSION)).toBe(
        String(SCHEMA_VERSION)
      );
    });

    it("does not overwrite if already at current version", () => {
      localStorage.setItem(STORAGE_KEYS.SCHEMA_VERSION, String(SCHEMA_VERSION));
      migrateIfNeeded();
      expect(localStorage.getItem(STORAGE_KEYS.SCHEMA_VERSION)).toBe(
        String(SCHEMA_VERSION)
      );
    });

    it("upgrades from older version", () => {
      localStorage.setItem(STORAGE_KEYS.SCHEMA_VERSION, "0");
      migrateIfNeeded();
      expect(localStorage.getItem(STORAGE_KEYS.SCHEMA_VERSION)).toBe(
        String(SCHEMA_VERSION)
      );
    });
  });

  // ── getHouseholds ───────────────────────────────────────────────────

  describe("getHouseholds", () => {
    it("returns empty array (per-household key scheme)", () => {
      expect(getHouseholds()).toEqual([]);
    });
  });

  // ── initializeHousehold ─────────────────────────────────────────────

  describe("initializeHousehold", () => {
    it("creates new household when none exists", () => {
      const hh = initializeHousehold(HH_ID);
      expect(hh.id).toBe(HH_ID);
      expect(hh.name).toBe("My Household");
      expect(hh.createdAt).toBeTruthy();
      expect(hh.updatedAt).toBeTruthy();
    });

    it("returns existing household idempotently", () => {
      const hh1 = initializeHousehold(HH_ID);
      const hh2 = initializeHousehold(HH_ID);
      expect(hh2.id).toBe(hh1.id);
      expect(hh2.createdAt).toBe(hh1.createdAt);
    });

    it("persists household to localStorage", () => {
      initializeHousehold(HH_ID);
      const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}:${HH_ID}:household`);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!) as Household;
      expect(parsed.id).toBe(HH_ID);
    });

    it("backfills updatedAt if missing", () => {
      // Simulate pre-migration household without updatedAt
      const legacy: any = {
        id: HH_ID,
        name: "Legacy Household",
        createdAt: "2025-01-01T00:00:00.000Z",
      };
      localStorage.setItem(
        `${STORAGE_KEY_PREFIX}:${HH_ID}:household`,
        JSON.stringify(legacy)
      );

      const hh = initializeHousehold(HH_ID);
      expect(hh.updatedAt).toBe(legacy.createdAt);
    });
  });

  // ── Card CRUD ───────────────────────────────────────────────────────

  describe("getCards", () => {
    it("returns empty array when no cards exist", () => {
      expect(getCards(HH_ID)).toEqual([]);
    });

    it("returns non-deleted cards for the household", () => {
      const card = makeCard({ id: "c1" });
      seedCards([card]);

      const result = getCards(HH_ID);
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe("c1");
    });

    it("excludes soft-deleted cards", () => {
      const active = makeCard({ id: "c1" });
      const deleted = makeCard({
        id: "c2",
        deletedAt: "2025-06-01T00:00:00.000Z",
      });
      seedCards([active, deleted]);

      const result = getCards(HH_ID);
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe("c1");
    });

    it("sorts by updatedAt descending", () => {
      const older = makeCard({
        id: "c1",
        updatedAt: "2025-01-01T00:00:00.000Z",
      });
      const newer = makeCard({
        id: "c2",
        updatedAt: "2025-06-01T00:00:00.000Z",
      });
      seedCards([older, newer]);

      const result = getCards(HH_ID);
      expect(result[0]!.id).toBe("c2");
      expect(result[1]!.id).toBe("c1");
    });

    it("only returns cards matching householdId", () => {
      const mine = makeCard({ id: "c1", householdId: HH_ID });
      const other = makeCard({ id: "c2", householdId: "other-hh" });
      seedCards([mine, other]);

      const result = getCards(HH_ID);
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe("c1");
    });
  });

  describe("getClosedCards", () => {
    it("returns only closed and graduated cards", () => {
      const active = makeCard({ id: "c1", status: "active" });
      const closed = makeCard({ id: "c2", status: "closed" });
      const graduated = makeCard({ id: "c3", status: "graduated" });
      seedCards([active, closed, graduated]);

      const result = getClosedCards(HH_ID);
      expect(result).toHaveLength(2);
      expect(result.map((c) => c.id).sort()).toEqual(["c2", "c3"]);
    });

    it("excludes soft-deleted cards", () => {
      const closed = makeCard({ id: "c1", status: "closed" });
      const deletedClosed = makeCard({
        id: "c2",
        status: "closed",
        deletedAt: "2025-06-01T00:00:00.000Z",
      });
      seedCards([closed, deletedClosed]);

      const result = getClosedCards(HH_ID);
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe("c1");
    });

    it("sorts by closedAt descending, falls back to updatedAt", () => {
      const older = makeCard({
        id: "c1",
        status: "closed",
        closedAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      });
      const newer = makeCard({
        id: "c2",
        status: "closed",
        closedAt: "2025-06-01T00:00:00.000Z",
        updatedAt: "2025-06-01T00:00:00.000Z",
      });
      seedCards([older, newer]);

      const result = getClosedCards(HH_ID);
      expect(result[0]!.id).toBe("c2");
    });
  });

  describe("getCardById", () => {
    it("returns card by ID", () => {
      seedCards([makeCard({ id: "c1" })]);
      const result = getCardById(HH_ID, "c1");
      expect(result).toBeDefined();
      expect(result!.id).toBe("c1");
    });

    it("returns undefined for non-existent ID", () => {
      seedCards([makeCard({ id: "c1" })]);
      expect(getCardById(HH_ID, "c999")).toBeUndefined();
    });

    it("returns undefined for soft-deleted card", () => {
      seedCards([
        makeCard({ id: "c1", deletedAt: "2025-06-01T00:00:00.000Z" }),
      ]);
      expect(getCardById(HH_ID, "c1")).toBeUndefined();
    });
  });

  describe("getAllCardsGlobal", () => {
    it("returns non-deleted cards", () => {
      const active = makeCard({ id: "c1" });
      const deleted = makeCard({
        id: "c2",
        deletedAt: "2025-06-01T00:00:00.000Z",
      });
      seedCards([active, deleted]);

      const result = getAllCardsGlobal(HH_ID);
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe("c1");
    });
  });

  describe("saveCard", () => {
    it("inserts a new card", () => {
      const card = makeCard({ id: "c1" });
      saveCard(card);

      const cards = readRawCards();
      expect(cards).toHaveLength(1);
      expect(cards[0]!.id).toBe("c1");
    });

    it("updates an existing card", () => {
      const card = makeCard({ id: "c1", cardName: "Original" });
      seedCards([card]);

      saveCard({ ...card, cardName: "Updated" });

      const cards = readRawCards();
      expect(cards).toHaveLength(1);
      expect(cards[0]!.cardName).toBe("Updated");
    });

    it("recomputes card status on save", () => {
      const card = makeCard({
        id: "c1",
        status: "active",
        signUpBonus: {
          type: "points",
          amount: 50000,
          spendRequirement: 400000,
          deadline: "2025-12-01T00:00:00.000Z",
          met: true,
        },
      });
      saveCard(card);

      const cards = readRawCards();
      expect(cards[0]!.status).toBe("graduated");
    });

    it("auto-sets createdAt on insert", () => {
      const card = makeCard({ id: "c1", createdAt: "" });
      saveCard(card);

      const cards = readRawCards();
      expect(cards[0]!.createdAt).toBeTruthy();
    });

    it("refreshes updatedAt on every save", () => {
      const card = makeCard({
        id: "c1",
        updatedAt: "2020-01-01T00:00:00.000Z",
      });
      saveCard(card);

      const cards = readRawCards();
      expect(new Date(cards[0]!.updatedAt).getFullYear()).toBeGreaterThanOrEqual(
        2025
      );
    });

    it("dispatches fenrir:sync event", () => {
      const handler = vi.fn();
      window.addEventListener("fenrir:sync", handler);

      saveCard(makeCard({ id: "c1" }));

      expect(handler).toHaveBeenCalledTimes(1);
      window.removeEventListener("fenrir:sync", handler);
    });
  });

  describe("deleteCard", () => {
    it("soft-deletes a card by setting deletedAt", () => {
      const card = makeCard({ id: "c1" });
      seedCards([card]);

      deleteCard(HH_ID, "c1");

      const cards = readRawCards();
      expect(cards[0]!.deletedAt).toBeTruthy();
    });

    it("no-op if card does not exist", () => {
      seedCards([makeCard({ id: "c1" })]);
      deleteCard(HH_ID, "c999"); // non-existent

      const cards = readRawCards();
      expect(cards).toHaveLength(1);
      expect(cards[0]!.deletedAt).toBeUndefined();
    });

    it("no-op if card is already soft-deleted", () => {
      const card = makeCard({
        id: "c1",
        deletedAt: "2025-01-01T00:00:00.000Z",
      });
      seedCards([card]);

      deleteCard(HH_ID, "c1");

      const cards = readRawCards();
      expect(cards[0]!.deletedAt).toBe("2025-01-01T00:00:00.000Z");
    });

    it("soft-deleted card is excluded from getCards", () => {
      seedCards([makeCard({ id: "c1" })]);
      deleteCard(HH_ID, "c1");

      expect(getCards(HH_ID)).toHaveLength(0);
    });
  });

  describe("closeCard", () => {
    it("closes a card by setting status and closedAt", () => {
      const card = makeCard({ id: "c1", status: "active" });
      seedCards([card]);

      closeCard(HH_ID, "c1");

      const cards = readRawCards();
      expect(cards[0]!.status).toBe("closed");
      expect(cards[0]!.closedAt).toBeTruthy();
    });

    it("no-op for non-existent card", () => {
      seedCards([]);
      closeCard(HH_ID, "c999");
      expect(readRawCards()).toHaveLength(0);
    });

    it("no-op for already-closed card", () => {
      const card = makeCard({
        id: "c1",
        status: "closed",
        closedAt: "2025-01-01T00:00:00.000Z",
      });
      seedCards([card]);

      closeCard(HH_ID, "c1");

      const cards = readRawCards();
      expect(cards[0]!.closedAt).toBe("2025-01-01T00:00:00.000Z");
    });

    it("no-op for soft-deleted card", () => {
      const card = makeCard({
        id: "c1",
        status: "active",
        deletedAt: "2025-01-01T00:00:00.000Z",
      });
      seedCards([card]);

      closeCard(HH_ID, "c1");

      const cards = readRawCards();
      expect(cards[0]!.status).toBe("active");
    });

    it("marks bonus met when markBonusMet option is true", () => {
      const card = makeCard({
        id: "c1",
        status: "active",
        signUpBonus: {
          type: "points",
          amount: 50000,
          spendRequirement: 400000,
          deadline: "2025-12-01T00:00:00.000Z",
          met: false,
        },
      });
      seedCards([card]);

      closeCard(HH_ID, "c1", { markBonusMet: true });

      const cards = readRawCards();
      expect(cards[0]!.signUpBonus!.met).toBe(true);
    });

    it("does not mark bonus met when option is not provided", () => {
      const card = makeCard({
        id: "c1",
        status: "active",
        signUpBonus: {
          type: "points",
          amount: 50000,
          spendRequirement: 400000,
          deadline: "2025-12-01T00:00:00.000Z",
          met: false,
        },
      });
      seedCards([card]);

      closeCard(HH_ID, "c1");

      const cards = readRawCards();
      expect(cards[0]!.signUpBonus!.met).toBe(false);
    });

    it("checks householdId before closing", () => {
      const card = makeCard({ id: "c1", householdId: "other-hh" });
      seedCards([card]);

      closeCard(HH_ID, "c1"); // Wrong household

      const cards = readRawCards();
      expect(cards[0]!.status).toBe("active");
    });
  });

  // ── setAllCards ─────────────────────────────────────────────────────

  describe("setAllCards", () => {
    it("writes cards array to localStorage", () => {
      const cards = [makeCard({ id: "c1" }), makeCard({ id: "c2" })];
      setAllCards(HH_ID, cards);

      const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}:${HH_ID}:cards`);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!) as Card[];
      expect(parsed).toHaveLength(2);
    });

    it("dispatches fenrir:sync event", () => {
      const handler = vi.fn();
      window.addEventListener("fenrir:sync", handler);

      setAllCards(HH_ID, []);

      expect(handler).toHaveBeenCalledTimes(1);
      window.removeEventListener("fenrir:sync", handler);
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles corrupted localStorage gracefully for cards", () => {
      localStorage.setItem(
        `${STORAGE_KEY_PREFIX}:${HH_ID}:cards`,
        "INVALID JSON"
      );
      expect(getCards(HH_ID)).toEqual([]);
    });

    it("handles corrupted localStorage gracefully for household", () => {
      localStorage.setItem(
        `${STORAGE_KEY_PREFIX}:${HH_ID}:household`,
        "INVALID JSON"
      );
      // initializeHousehold should create a new one when read fails
      const hh = initializeHousehold(HH_ID);
      expect(hh.id).toBe(HH_ID);
    });
  });
});
