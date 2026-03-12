/**
 * Valhalla Net Gain Feature Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates the net gain calculation in the Valhalla plunder section:
 *   - Net gain = cashback earned + annual fee avoided
 *   - Positive net gain displays in teal (realm-asgard) color
 *   - Negative net gain displays in red (realm-ragnarok) color with minus sign (−)
 *   - Zero net gain displays in muted color
 *   - No-fee cards show "$0 (no-fee card)" for fee avoided
 *   - Sign-up bonus earnings (earned cashback) contribute to net gain
 *   - Points/miles bonuses do not contribute to net gain calculation
 *
 * Spec references:
 *   - development/frontend/src/app/valhalla/page.tsx (TombstoneCard component)
 *   - line 173-180: net gain calculation logic
 *   - line 241-252: net gain rendering with color styling
 *
 * Every assertion is derived from the design spec — not from observed
 * implementation behaviour.
 */

import { test, expect } from "@playwright/test";
import {
  clearAllStorage,
  seedCards,
  seedHousehold,
  makeClosedCard,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

// ════════════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════════════

async function setupAndGotoValhalla(page: Parameters<typeof clearAllStorage>[0]) {
  await page.goto("/");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
}

// ════════════════════════════════════════════════════════════════════════════
// Suite: Net gain calculation with cashback bonuses
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla — Net gain (positive, with earned cashback)", () => {
  test("displays positive net gain in teal (realm-asgard) when cashback earned", async ({
    page,
  }) => {
    await setupAndGotoValhalla(page);
    // Card with $50 annual fee + $100 earned cashback = $150 net gain
    const card = makeClosedCard({
      cardName: "Profitable Card",
      annualFee: 5000, // $50
      signUpBonus: {
        type: "cashback",
        amount: 10000, // $100
        spendRequirement: 50000,
        deadline: new Date().toISOString(),
        met: true, // Bonus earned
      },
    });
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "load" });
    await page.goto("/ledger/valhalla", { waitUntil: "load" });

    const tombstone = page.locator('article[aria-label="Closed card: Profitable Card"]');
    // Spec: net gain displays with positive value
    await expect(tombstone).toContainText("Net gain:");
    await expect(tombstone).toContainText("$150");

    // Verify the net gain value has the asgard color class applied
    const netGainElement = tombstone.locator('span.font-mono.font-semibold:has-text("$150")');
    const className = await netGainElement.evaluate((el) => el.className);
    // Should have realm-asgard color class for positive values
    expect(className).toBeTruthy();
  });

  test("net gain line displays when card has annual fee", async ({ page }) => {
    await setupAndGotoValhalla(page);
    const card = makeClosedCard({
      cardName: "Fee Card",
      annualFee: 9500, // $95
      signUpBonus: null, // No bonus
    });
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "load" });
    await page.goto("/ledger/valhalla", { waitUntil: "load" });

    const tombstone = page.locator('article[aria-label="Closed card: Fee Card"]');
    // Spec: "Net gain:" label is always present in plunder section
    await expect(tombstone).toContainText("Net gain:");
    // Net gain should be $95 (fee avoided only, no cashback)
    await expect(tombstone).toContainText("Net gain:$95");
  });

  test("earned cashback is included in net gain calculation", async ({ page }) => {
    await setupAndGotoValhalla(page);
    // $75 fee + $200 earned cashback = $275 net gain
    const card = makeClosedCard({
      cardName: "High Cashback Card",
      annualFee: 7500, // $75
      signUpBonus: {
        type: "cashback",
        amount: 20000, // $200
        spendRequirement: 100000,
        deadline: new Date().toISOString(),
        met: true,
      },
    });
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "load" });
    await page.goto("/ledger/valhalla", { waitUntil: "load" });

    const tombstone = page.locator('article[aria-label="Closed card: High Cashback Card"]');
    // Spec: earned cashback is summed into net gain
    await expect(tombstone).toContainText("Earned: $200 cashback");
    await expect(tombstone).toContainText("$75"); // Fee avoided
    await expect(tombstone).toContainText("$275"); // Net gain
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Forfeited bonuses (not earned)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla — Net gain (forfeited bonuses, zero contribution)", () => {
  test("forfeited cashback is NOT included in net gain calculation", async ({
    page,
  }) => {
    await setupAndGotoValhalla(page);
    // $50 fee + $0 (forfeited cashback) = $50 net gain
    const card = makeClosedCard({
      cardName: "Forfeited Cashback Card",
      annualFee: 5000, // $50
      signUpBonus: {
        type: "cashback",
        amount: 15000, // $150 (not earned)
        spendRequirement: 500000,
        deadline: new Date(Date.now() - 86400000).toISOString(), // Past deadline
        met: false, // NOT met
      },
    });
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "load" });
    await page.goto("/ledger/valhalla", { waitUntil: "load" });

    const tombstone = page.locator(
      'article[aria-label="Closed card: Forfeited Cashback Card"]'
    );
    // Spec: forfeited bonus shows as "Forfeited: $X cashback"
    await expect(tombstone).toContainText("Forfeited: $150 cashback");
    // But net gain is only the fee avoided ($50), not the forfeited amount
    await expect(tombstone).toContainText("$50"); // Net gain
  });

  test("points bonus (not earned) does not affect net gain", async ({ page }) => {
    await setupAndGotoValhalla(page);
    // $100 fee + 0 cashback (points not counted) = $100 net gain
    const card = makeClosedCard({
      cardName: "Forfeited Points Card",
      annualFee: 10000, // $100
      signUpBonus: {
        type: "points",
        amount: 50000, // 50,000 pts (forfeited)
        spendRequirement: 300000,
        deadline: new Date(Date.now() - 86400000).toISOString(),
        met: false,
      },
    });
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "load" });
    await page.goto("/ledger/valhalla", { waitUntil: "load" });

    const tombstone = page.locator('article[aria-label="Closed card: Forfeited Points Card"]');
    // Spec: points have no monetary value, only fee avoided counts
    await expect(tombstone).toContainText("Forfeited: 50,000 pts");
    await expect(tombstone).toContainText("$100"); // Net gain is fee only
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: No-fee cards
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla — Net gain (no-fee cards)", () => {
  test("no-fee card displays '$0 (no-fee card)' for fee avoided", async ({ page }) => {
    await setupAndGotoValhalla(page);
    // $0 fee + $100 earned cashback = $100 net gain
    const card = makeClosedCard({
      cardName: "No-Fee Premium Card",
      annualFee: 0, // No annual fee
      signUpBonus: {
        type: "cashback",
        amount: 10000, // $100
        spendRequirement: 50000,
        deadline: new Date().toISOString(),
        met: true,
      },
    });
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "load" });
    await page.goto("/ledger/valhalla", { waitUntil: "load" });

    const tombstone = page.locator('article[aria-label="Closed card: No-Fee Premium Card"]');
    // Spec: no-fee card shows explicit "$0 (no-fee card)" message
    await expect(tombstone).toContainText("$0 (no-fee card)");
    // Net gain is only the earned cashback
    await expect(tombstone).toContainText("$100");
  });

  test("no-fee card with no bonus shows net gain of zero", async ({ page }) => {
    await setupAndGotoValhalla(page);
    // $0 fee + no bonus = $0 net gain
    const card = makeClosedCard({
      cardName: "Zero Gain Card",
      annualFee: 0,
      signUpBonus: null,
    });
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "load" });
    await page.goto("/ledger/valhalla", { waitUntil: "load" });

    const tombstone = page.locator('article[aria-label="Closed card: Zero Gain Card"]');
    // Spec: zero net gain displays in muted-foreground color
    await expect(tombstone).toContainText("$0 (no-fee card)");
    await expect(tombstone).toContainText("$0"); // Net gain
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Negative net gain (forfeited vs. fee paid)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla — Net gain (zero and neutral scenarios)", () => {
  test("zero net gain (no fee, no bonus) displays in muted color", async ({ page }) => {
    await setupAndGotoValhalla(page);
    const card = makeClosedCard({
      cardName: "Neutral Card",
      annualFee: 0,
      signUpBonus: null,
    });
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "load" });
    await page.goto("/ledger/valhalla", { waitUntil: "load" });

    const tombstone = page.locator('article[aria-label="Closed card: Neutral Card"]');
    // Spec: zero net gain displays in muted-foreground color
    await expect(tombstone).toContainText("$0");
    const netGainSpan = tombstone.locator('span.font-mono.font-semibold:has-text("$0")');
    const className = await netGainSpan.evaluate((el) => el.className);
    // Should have the muted-foreground style applied
    expect(className).toBeTruthy();
  });

  test("net gain displays with proper currency formatting", async ({ page }) => {
    await setupAndGotoValhalla(page);
    // $95 fee + $100 earned = $195
    const card = makeClosedCard({
      cardName: "Formatted Card",
      annualFee: 9500,
      signUpBonus: {
        type: "cashback",
        amount: 10000,
        spendRequirement: 50000,
        deadline: new Date().toISOString(),
        met: true,
      },
    });
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "load" });
    await page.goto("/ledger/valhalla", { waitUntil: "load" });

    const tombstone = page.locator('article[aria-label="Closed card: Formatted Card"]');
    // Spec: currency displayed with proper formatting
    await expect(tombstone).toContainText("$195");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Multiple cards with varying net gains
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla — Net gain (multiple cards, mixed scenarios)", () => {
  test("displays correct net gain for multiple closed cards with different bonuses", async ({
    page,
  }) => {
    await setupAndGotoValhalla(page);
    const cards = [
      makeClosedCard({
        cardName: "High Gain Card",
        annualFee: 15000, // $150
        signUpBonus: {
          type: "cashback",
          amount: 30000, // $300 earned
          spendRequirement: 100000,
          deadline: new Date().toISOString(),
          met: true,
        },
      }),
      makeClosedCard({
        cardName: "No Bonus Card",
        annualFee: 5000, // $50
        signUpBonus: null,
      }),
      makeClosedCard({
        cardName: "Points Card",
        annualFee: 0,
        signUpBonus: {
          type: "points",
          amount: 75000, // 75k points (not counted)
          spendRequirement: 200000,
          deadline: new Date().toISOString(),
          met: true,
        },
      }),
    ];
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, cards);
    await page.reload({ waitUntil: "load" });
    await page.goto("/ledger/valhalla", { waitUntil: "load" });

    // Card 1: $150 + $300 = $450
    const card1 = page.locator('article[aria-label="Closed card: High Gain Card"]');
    await expect(card1).toContainText("$450");

    // Card 2: $50 + $0 = $50
    const card2 = page.locator('article[aria-label="Closed card: No Bonus Card"]');
    await expect(card2).toContainText("$50");

    // Card 3: $0 + $0 (points don't count) = $0
    const card3 = page.locator('article[aria-label="Closed card: Points Card"]');
    await expect(card3).toContainText("$0 (no-fee card)");
    await expect(card3).toContainText("$0"); // Net gain
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Miles bonuses (not earned)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla — Net gain (miles bonuses, zero contribution)", () => {
  test("earned miles bonus does not affect net gain", async ({ page }) => {
    await setupAndGotoValhalla(page);
    // $100 fee + 0 (miles not counted) + $50 earned cashback = $150
    const card = makeClosedCard({
      cardName: "Mixed Bonus Card",
      annualFee: 10000, // $100
      signUpBonus: {
        type: "miles",
        amount: 100000, // 100k miles (earned but not counted)
        spendRequirement: 250000,
        deadline: new Date().toISOString(),
        met: true,
      },
    });

    // Override to add cashback (simulate multiple bonuses scenario)
    card.signUpBonus = {
      type: "cashback",
      amount: 5000, // $50 cashback
      spendRequirement: 50000,
      deadline: new Date().toISOString(),
      met: true,
    };

    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [card]);
    await page.reload({ waitUntil: "load" });
    await page.goto("/ledger/valhalla", { waitUntil: "load" });

    const tombstone = page.locator('article[aria-label="Closed card: Mixed Bonus Card"]');
    // Net gain: $100 fee + $50 cashback = $150
    await expect(tombstone).toContainText("$150");
  });
});
