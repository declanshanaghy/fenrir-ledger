/**
 * Fenrir Ledger — Predefined Seed Data Sets
 *
 * Reusable card collections for test scenarios. Import the set that matches
 * your test's needs and pass it to seedCards() from test-fixtures.ts.
 *
 * All cards use ANONYMOUS_HOUSEHOLD_ID unless overridden.
 *
 * Usage:
 *   import { FEW_CARDS, URGENT_CARDS } from "../helpers/seed-data";
 *   import { seedCards, seedHousehold, ANONYMOUS_HOUSEHOLD_ID } from "../helpers/test-fixtures";
 *
 *   test.beforeEach(async ({ page }) => {
 *     await page.goto("/");
 *     await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
 *     await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, FEW_CARDS);
 *     await page.reload();
 *   });
 */

import {
  makeCard,
  makeUrgentCard,
  makePromoCard,
  makeClosedCard,
  ANONYMOUS_HOUSEHOLD_ID,
} from "./test-fixtures";

import type { Card } from "./test-fixtures";

// ─── Empty State ──────────────────────────────────────────────────────────────

/** No cards — tests empty state messaging and zero-card UI. */
export const EMPTY_CARDS: Card[] = [];

// ─── Small Set ────────────────────────────────────────────────────────────────

/**
 * 3 diverse active cards — Chase, Amex, Capital One.
 * Use for basic dashboard rendering, card list, and form edit tests.
 */
export const FEW_CARDS: Card[] = [
  makeCard({
    issuerId: "chase",
    cardName: "Sapphire Preferred",
    annualFee: 9500,
    creditLimit: 1000000,
    notes: "Primary travel card",
  }),
  makeCard({
    issuerId: "amex",
    cardName: "Platinum",
    annualFee: 69500,
    creditLimit: 2500000,
    notes: "High-fee prestige card",
  }),
  makeCard({
    issuerId: "capital_one",
    cardName: "Venture Rewards",
    annualFee: 9500,
    creditLimit: 750000,
    notes: "Miles accumulator",
  }),
];

// ─── Large Set ────────────────────────────────────────────────────────────────

/**
 * 10 cards with varied issuers and fees.
 * Use for pagination stress tests, sorting tests, and scroll behavior.
 */
export const MANY_CARDS: Card[] = [
  makeCard({ issuerId: "chase", cardName: "Sapphire Reserve", annualFee: 55000, creditLimit: 1000000 }),
  makeCard({ issuerId: "chase", cardName: "Freedom Unlimited", annualFee: 0, creditLimit: 500000 }),
  makeCard({ issuerId: "amex", cardName: "Platinum", annualFee: 69500, creditLimit: 2500000 }),
  makeCard({ issuerId: "amex", cardName: "Gold Card", annualFee: 25000, creditLimit: 800000 }),
  makeCard({ issuerId: "amex", cardName: "Blue Cash Preferred", annualFee: 9500, creditLimit: 600000 }),
  makeCard({ issuerId: "capital_one", cardName: "Venture Rewards", annualFee: 9500, creditLimit: 750000 }),
  makeCard({ issuerId: "citibank", cardName: "Premier", annualFee: 9500, creditLimit: 550000 }),
  makeCard({ issuerId: "discover", cardName: "it Cash Back", annualFee: 0, creditLimit: 300000 }),
  makeCard({ issuerId: "bank_of_america", cardName: "Premium Rewards", annualFee: 9500, creditLimit: 650000 }),
  makeCard({ issuerId: "wells_fargo", cardName: "Active Cash", annualFee: 0, creditLimit: 400000 }),
];

// ─── Urgent Set ───────────────────────────────────────────────────────────────

/**
 * 5 cards all requiring attention: 3 fee_approaching + 2 promo_expiring.
 * Use for Ragnarök threshold tests (≥5 urgent cards triggers overlay)
 * and WolfHungerMeter aggregate bonus tests.
 */
export const URGENT_CARDS: Card[] = [
  makeUrgentCard({ issuerId: "chase", cardName: "Fee Due Chase" }),
  makeUrgentCard({ issuerId: "amex", cardName: "Fee Due Amex" }),
  makeUrgentCard({ issuerId: "capital_one", cardName: "Fee Due Capital One" }),
  makePromoCard({ issuerId: "citibank", cardName: "Promo Expiring Citi" }),
  makePromoCard({ issuerId: "discover", cardName: "Promo Expiring Discover" }),
];

// ─── Mixed Set ────────────────────────────────────────────────────────────────

/**
 * Mix of active, urgent, and closed cards.
 * Represents a realistic household portfolio.
 * Use for integrated dashboard and Valhalla tests together.
 *
 * Dashboard will show: 2 active + 1 urgent + 1 promo (4 cards)
 * Valhalla will show: 2 closed cards
 */
export const MIXED_CARDS: Card[] = [
  makeCard({ issuerId: "chase", cardName: "Sapphire Preferred" }),
  makeCard({ issuerId: "amex", cardName: "Blue Cash Everyday" }),
  makeUrgentCard({ issuerId: "citibank", cardName: "Annual Fee Approaching" }),
  makePromoCard({ issuerId: "bank_of_america", cardName: "Bonus Not Yet Met" }),
  makeClosedCard({ issuerId: "discover", cardName: "Closed — Fee Not Worth It" }),
  makeClosedCard({ issuerId: "barclays", cardName: "Closed — Downgraded" }),
];

// ─── Re-export ANONYMOUS_HOUSEHOLD_ID for convenience ────────────────────────

export { ANONYMOUS_HOUSEHOLD_ID };
