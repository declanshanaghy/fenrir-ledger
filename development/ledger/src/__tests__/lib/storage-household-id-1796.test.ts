/**
 * Unit tests for the effective-household-ID helpers added in Issue #1796.
 *
 * Covers:
 *   - getEffectiveHouseholdId  — returns fallback when nothing stored; stored value otherwise
 *   - setStoredHouseholdId     — persists to "fenrir:householdId"
 *   - clearHouseholdLocalStorage — removes cards + household keys for a given ID
 *
 * Uses happy-dom localStorage (configured in vitest.config.ts).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { STORAGE_KEY_PREFIX } from "@/lib/constants";
import {
  getEffectiveHouseholdId,
  setStoredHouseholdId,
  clearHouseholdLocalStorage,
  setAllCards,
  initializeHousehold,
} from "@/lib/storage";
import type { Card } from "@/lib/types";

const EFFECTIVE_KEY = "fenrir:householdId";
const HH_SOLO = "user-solo-sub";
const HH_JOINED = "hh-joined-target";

function cardsKey(id: string) {
  return `${STORAGE_KEY_PREFIX}:${id}:cards`;
}
function householdKey(id: string) {
  return `${STORAGE_KEY_PREFIX}:${id}:household`;
}

function makeCard(householdId: string): Card {
  return {
    id: "card-1",
    householdId,
    issuerId: "chase",
    cardName: "Test Card",
    openDate: "2026-01-01T00:00:00.000Z",
    creditLimit: 500000,
    annualFee: 0,
    annualFeeDate: "",
    promoPeriodMonths: 0,
    signUpBonus: null,
    status: "active",
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("getEffectiveHouseholdId", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns fallback when fenrir:householdId is not set", () => {
    expect(getEffectiveHouseholdId(HH_SOLO)).toBe(HH_SOLO);
  });

  it("returns stored value after setStoredHouseholdId is called", () => {
    setStoredHouseholdId(HH_JOINED);
    expect(getEffectiveHouseholdId(HH_SOLO)).toBe(HH_JOINED);
  });

  it("returns fallback when fenrir:householdId is empty string edge-case (not set)", () => {
    // Only set to a real value — empty string would be falsy but we only care about null/missing
    localStorage.removeItem(EFFECTIVE_KEY);
    expect(getEffectiveHouseholdId(HH_SOLO)).toBe(HH_SOLO);
  });
});

describe("setStoredHouseholdId", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("writes to fenrir:householdId in localStorage", () => {
    setStoredHouseholdId(HH_JOINED);
    expect(localStorage.getItem(EFFECTIVE_KEY)).toBe(HH_JOINED);
  });

  it("overwrites a previously stored value", () => {
    setStoredHouseholdId("old-value");
    setStoredHouseholdId(HH_JOINED);
    expect(localStorage.getItem(EFFECTIVE_KEY)).toBe(HH_JOINED);
  });
});

describe("clearHouseholdLocalStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("removes the cards key for the given householdId", () => {
    setAllCards(HH_SOLO, [makeCard(HH_SOLO)]);
    expect(localStorage.getItem(cardsKey(HH_SOLO))).not.toBeNull();

    clearHouseholdLocalStorage(HH_SOLO);

    expect(localStorage.getItem(cardsKey(HH_SOLO))).toBeNull();
  });

  it("removes the household key for the given householdId", () => {
    initializeHousehold(HH_SOLO);
    expect(localStorage.getItem(householdKey(HH_SOLO))).not.toBeNull();

    clearHouseholdLocalStorage(HH_SOLO);

    expect(localStorage.getItem(householdKey(HH_SOLO))).toBeNull();
  });

  it("does not affect keys for a different householdId", () => {
    setAllCards(HH_SOLO, [makeCard(HH_SOLO)]);
    setAllCards(HH_JOINED, [makeCard(HH_JOINED)]);

    clearHouseholdLocalStorage(HH_SOLO);

    // Joined household keys must remain intact
    expect(localStorage.getItem(cardsKey(HH_JOINED))).not.toBeNull();
  });

  it("is a no-op when keys do not exist", () => {
    // Should not throw
    expect(() => clearHouseholdLocalStorage("nonexistent-hh")).not.toThrow();
  });
});
