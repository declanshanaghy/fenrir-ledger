/**
 * Valhalla Financial Sort Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Slimmed to interactive behavior only:
 *   - Sort by fee avoided works (cards reorder)
 *   - Sort by rewards earned works (cards reorder)
 *   - Sort by net gain works (cards reorder)
 *   - Sort direction toggles between options
 *   - Sort selection persists during the session
 *
 * Removed: single-card edge cases, zero-value edge cases, forfeited bonus
 * edge cases, points/miles edge cases, filter+sort interaction tests.
 */

import { test, expect } from "@playwright/test";

test.setTimeout(60_000);

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

async function setupValhalla(page: Parameters<typeof clearAllStorage>[0]) {
  await page.goto("/");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
}

// ════════════════════════════════════════════════════════════════════════════
// Suite: Fee avoided sort (AC1)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla Financial Sort — fee avoided descending (AC1)", () => {
  test("cards are ordered by annual fee descending when 'fee_avoided_desc' selected", async ({
    page,
  }) => {
    await setupValhalla(page);

    const cards = [
      makeClosedCard({ cardName: "Low Fee Card", annualFee: 2500 }),
      makeClosedCard({ cardName: "High Fee Card", annualFee: 55000 }),
      makeClosedCard({ cardName: "Mid Fee Card", annualFee: 9500 }),
    ];
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, cards);
    await page.goto("/valhalla", { waitUntil: "load" });

    await page.locator('select[aria-label="Sort order"]').selectOption("fee_avoided_desc");

    const tombstones = page.locator('article[aria-label^="Closed card:"]');
    await expect(tombstones).toHaveCount(3);

    await expect(tombstones.nth(0)).toHaveAttribute("aria-label", "Closed card: High Fee Card");
    await expect(tombstones.nth(1)).toHaveAttribute("aria-label", "Closed card: Mid Fee Card");
    await expect(tombstones.nth(2)).toHaveAttribute("aria-label", "Closed card: Low Fee Card");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Rewards earned sort (AC2)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla Financial Sort — rewards earned descending (AC2)", () => {
  test("cards are ordered by earned cashback descending when 'rewards_desc' selected", async ({
    page,
  }) => {
    await setupValhalla(page);

    const cards = [
      makeClosedCard({
        cardName: "Small Rewards Card",
        annualFee: 0,
        signUpBonus: {
          type: "cashback",
          amount: 5000,
          spendRequirement: 20000,
          deadline: new Date().toISOString(),
          met: true,
        },
      }),
      makeClosedCard({
        cardName: "Large Rewards Card",
        annualFee: 0,
        signUpBonus: {
          type: "cashback",
          amount: 25000,
          spendRequirement: 100000,
          deadline: new Date().toISOString(),
          met: true,
        },
      }),
      makeClosedCard({
        cardName: "Medium Rewards Card",
        annualFee: 0,
        signUpBonus: {
          type: "cashback",
          amount: 10000,
          spendRequirement: 50000,
          deadline: new Date().toISOString(),
          met: true,
        },
      }),
    ];
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, cards);
    await page.goto("/valhalla", { waitUntil: "load" });

    await page.locator('select[aria-label="Sort order"]').selectOption("rewards_desc");

    const tombstones = page.locator('article[aria-label^="Closed card:"]');
    await expect(tombstones).toHaveCount(3);

    await expect(tombstones.nth(0)).toHaveAttribute("aria-label", "Closed card: Large Rewards Card");
    await expect(tombstones.nth(1)).toHaveAttribute("aria-label", "Closed card: Medium Rewards Card");
    await expect(tombstones.nth(2)).toHaveAttribute("aria-label", "Closed card: Small Rewards Card");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Net gain sort (AC3)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla Financial Sort — net gain descending (AC3)", () => {
  test("cards are ordered by net gain (fee + cashback) descending", async ({
    page,
  }) => {
    await setupValhalla(page);

    const cards = [
      makeClosedCard({
        cardName: "Zero Gain Card",
        annualFee: 0,
        signUpBonus: null,
      }),
      makeClosedCard({
        cardName: "Fee Only Card",
        annualFee: 9500,
        signUpBonus: null,
      }),
      makeClosedCard({
        cardName: "High Gain Card",
        annualFee: 5000,
        signUpBonus: {
          type: "cashback",
          amount: 20000,
          spendRequirement: 100000,
          deadline: new Date().toISOString(),
          met: true,
        },
      }),
    ];
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, cards);
    await page.goto("/valhalla", { waitUntil: "load" });

    await page.locator('select[aria-label="Sort order"]').selectOption("net_gain_desc");

    const tombstones = page.locator('article[aria-label^="Closed card:"]');
    await expect(tombstones).toHaveCount(3);

    await expect(tombstones.nth(0)).toHaveAttribute("aria-label", "Closed card: High Gain Card");
    await expect(tombstones.nth(1)).toHaveAttribute("aria-label", "Closed card: Fee Only Card");
    await expect(tombstones.nth(2)).toHaveAttribute("aria-label", "Closed card: Zero Gain Card");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Sort direction toggles and persists (AC4)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla Financial Sort — sort persists during session (AC4)", () => {
  test("all three financial sort options are selectable and remain selected", async ({
    page,
  }) => {
    await setupValhalla(page);

    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [
      makeClosedCard({ cardName: "Test Card", annualFee: 9500 }),
    ]);
    await page.goto("/valhalla", { waitUntil: "load" });

    const sortSelect = page.locator('select[aria-label="Sort order"]');

    await sortSelect.selectOption("fee_avoided_desc");
    await expect(sortSelect).toHaveValue("fee_avoided_desc");

    await sortSelect.selectOption("rewards_desc");
    await expect(sortSelect).toHaveValue("rewards_desc");

    await sortSelect.selectOption("net_gain_desc");
    await expect(sortSelect).toHaveValue("net_gain_desc");
  });

  test("sort selection persists after issuer filter is changed", async ({
    page,
  }) => {
    await setupValhalla(page);

    const cards = [
      makeClosedCard({ cardName: "Chase Card", issuerId: "chase", annualFee: 9500 }),
      makeClosedCard({ cardName: "Amex Card", issuerId: "amex", annualFee: 55000 }),
    ];
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, cards);
    await page.goto("/valhalla", { waitUntil: "load" });

    const sortSelect = page.locator('select[aria-label="Sort order"]');
    await sortSelect.selectOption("fee_avoided_desc");

    const issuerSelect = page.locator('select[aria-label="Filter by issuer"]');
    await issuerSelect.selectOption("all");

    await expect(sortSelect).toHaveValue("fee_avoided_desc");
  });
});
