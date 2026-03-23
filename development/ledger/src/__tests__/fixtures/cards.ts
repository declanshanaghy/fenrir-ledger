/**
 * Shared card test fixtures — issue #1858
 *
 * Centralises makeCard / makeDeletedCard so schema changes only need to be
 * applied in one place instead of across every test file.
 */

import type { Card } from "@/lib/types";

let _seq = 0;

/**
 * Returns a minimal valid Card object.  Every field defaults to a sensible
 * value; pass overrides to customise individual fields.
 *
 * The `id` field auto-increments (card-1, card-2, …) across the test run
 * so each call produces a unique identifier unless explicitly overridden.
 */
export function makeCard(overrides: Partial<Card> = {}): Card {
  _seq++;
  return {
    id: `card-${_seq}`,
    householdId: "hh-test",
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

/**
 * Returns a soft-deleted card (deletedAt set).
 * Thin wrapper around makeCard — all overrides are forwarded.
 */
export function makeDeletedCard(overrides: Partial<Card> = {}): Card {
  return makeCard({
    deletedAt: "2026-03-01T12:00:00.000Z",
    ...overrides,
  });
}
