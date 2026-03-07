/**
 * Valhalla Financial Sort Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates acceptance criteria for GitHub Issue #161:
 *   "Add financial sort options to Valhalla"
 *
 * Acceptance Criteria (from issue #161):
 *   AC1: Sort-by option: Fee avoided (descending — biggest savings first)
 *   AC2: Sort-by option: Rewards earned (descending — most profitable first)
 *   AC3: Sort-by option: Net gain (descending)
 *   AC4: Sort selection persists during the session
 *
 * Every assertion is derived from the acceptance criteria — not from observed
 * implementation behaviour.
 *
 * Spec references:
 *   - development/frontend/src/app/valhalla/page.tsx
 *   - quality/sprint-3-gap-audit.md G5.3
 */

import { test, expect } from "@playwright/test";

// Increase timeout to 60s — Next.js dev server has slow cold-start per-route
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
// Suite: Sort options exist in the dropdown (AC1, AC2, AC3)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla Financial Sort — sort options present", () => {
  test("sort dropdown contains 'Fee avoided (highest)' option (AC1)", async ({
    page,
  }) => {
    await setupValhalla(page);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [
      makeClosedCard({ cardName: "Any Closed Card" }),
    ]);
    await page.goto("/valhalla", { waitUntil: "load" });

    const sortSelect = page.locator('select[aria-label="Sort order"]');
    await expect(sortSelect).toBeVisible();
    await expect(sortSelect.locator("option[value='fee_avoided_desc']")).toBeAttached();
  });

  test("sort dropdown contains 'Rewards earned (highest)' option (AC2)", async ({
    page,
  }) => {
    await setupValhalla(page);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [
      makeClosedCard({ cardName: "Any Closed Card" }),
    ]);
    await page.goto("/valhalla", { waitUntil: "load" });

    const sortSelect = page.locator('select[aria-label="Sort order"]');
    await expect(sortSelect).toBeVisible();
    await expect(sortSelect.locator("option[value='rewards_desc']")).toBeAttached();
  });

  test("sort dropdown contains 'Net gain (highest)' option (AC3)", async ({
    page,
  }) => {
    await setupValhalla(page);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [
      makeClosedCard({ cardName: "Any Closed Card" }),
    ]);
    await page.goto("/valhalla", { waitUntil: "load" });

    const sortSelect = page.locator('select[aria-label="Sort order"]');
    await expect(sortSelect).toBeVisible();
    await expect(sortSelect.locator("option[value='net_gain_desc']")).toBeAttached();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Fee avoided sort — biggest savings first (AC1)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla Financial Sort — fee avoided descending (AC1)", () => {
  test("cards are ordered by annual fee descending when 'fee_avoided_desc' selected", async ({
    page,
  }) => {
    await setupValhalla(page);

    // Three cards with distinct annual fees
    const cards = [
      makeClosedCard({ cardName: "Low Fee Card", annualFee: 2500 }),   // $25
      makeClosedCard({ cardName: "High Fee Card", annualFee: 55000 }), // $550
      makeClosedCard({ cardName: "Mid Fee Card", annualFee: 9500 }),   // $95
    ];
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, cards);
    await page.goto("/valhalla", { waitUntil: "load" });

    // Select fee avoided sort
    await page.locator('select[aria-label="Sort order"]').selectOption("fee_avoided_desc");

    const tombstones = page.locator('article[aria-label^="Closed card:"]');
    await expect(tombstones).toHaveCount(3);

    // Spec: biggest fee avoided first — High Fee ($550), Mid Fee ($95), Low Fee ($25)
    await expect(tombstones.nth(0)).toHaveAttribute("aria-label", "Closed card: High Fee Card");
    await expect(tombstones.nth(1)).toHaveAttribute("aria-label", "Closed card: Mid Fee Card");
    await expect(tombstones.nth(2)).toHaveAttribute("aria-label", "Closed card: Low Fee Card");
  });

  test("no-fee cards ($0) sort to the bottom in fee avoided descending", async ({
    page,
  }) => {
    await setupValhalla(page);

    const cards = [
      makeClosedCard({ cardName: "Zero Fee Card", annualFee: 0 }),
      makeClosedCard({ cardName: "Paid Fee Card", annualFee: 9500 }),
    ];
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, cards);
    await page.goto("/valhalla", { waitUntil: "load" });

    await page.locator('select[aria-label="Sort order"]').selectOption("fee_avoided_desc");

    const tombstones = page.locator('article[aria-label^="Closed card:"]');
    await expect(tombstones).toHaveCount(2);

    // Card with a fee is first, no-fee card is last
    await expect(tombstones.nth(0)).toHaveAttribute("aria-label", "Closed card: Paid Fee Card");
    await expect(tombstones.nth(1)).toHaveAttribute("aria-label", "Closed card: Zero Fee Card");
  });

  test("single card with fee avoided sort renders without error (AC1)", async ({
    page,
  }) => {
    await setupValhalla(page);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [
      makeClosedCard({ cardName: "Solo Fee Card", annualFee: 45000 }),
    ]);
    await page.goto("/valhalla", { waitUntil: "load" });

    await page.locator('select[aria-label="Sort order"]').selectOption("fee_avoided_desc");

    await expect(
      page.locator('article[aria-label="Closed card: Solo Fee Card"]')
    ).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Rewards earned sort — most profitable first (AC2)
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
          amount: 5000, // $50
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
          amount: 25000, // $250
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
          amount: 10000, // $100
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

    // Spec: highest cashback first — Large ($250), Medium ($100), Small ($50)
    await expect(tombstones.nth(0)).toHaveAttribute("aria-label", "Closed card: Large Rewards Card");
    await expect(tombstones.nth(1)).toHaveAttribute("aria-label", "Closed card: Medium Rewards Card");
    await expect(tombstones.nth(2)).toHaveAttribute("aria-label", "Closed card: Small Rewards Card");
  });

  test("cards with no earned bonus sort to the bottom in rewards descending", async ({
    page,
  }) => {
    await setupValhalla(page);

    const cards = [
      makeClosedCard({
        cardName: "No Bonus Card",
        annualFee: 0,
        signUpBonus: null,
      }),
      makeClosedCard({
        cardName: "Bonus Card",
        annualFee: 0,
        signUpBonus: {
          type: "cashback",
          amount: 15000, // $150
          spendRequirement: 75000,
          deadline: new Date().toISOString(),
          met: true,
        },
      }),
    ];
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, cards);
    await page.goto("/valhalla", { waitUntil: "load" });

    await page.locator('select[aria-label="Sort order"]').selectOption("rewards_desc");

    const tombstones = page.locator('article[aria-label^="Closed card:"]');
    await expect(tombstones).toHaveCount(2);

    // Card with earned bonus first; no-bonus card last
    await expect(tombstones.nth(0)).toHaveAttribute("aria-label", "Closed card: Bonus Card");
    await expect(tombstones.nth(1)).toHaveAttribute("aria-label", "Closed card: No Bonus Card");
  });

  test("forfeited cashback bonus (met=false) counts as zero for rewards sort", async ({
    page,
  }) => {
    await setupValhalla(page);

    const cards = [
      makeClosedCard({
        cardName: "Forfeited Bonus Card",
        annualFee: 0,
        signUpBonus: {
          type: "cashback",
          amount: 50000, // $500 but NOT earned
          spendRequirement: 500000,
          deadline: new Date(Date.now() - 86400000).toISOString(),
          met: false,
        },
      }),
      makeClosedCard({
        cardName: "Earned Small Bonus Card",
        annualFee: 0,
        signUpBonus: {
          type: "cashback",
          amount: 1000, // $10 earned
          spendRequirement: 5000,
          deadline: new Date().toISOString(),
          met: true,
        },
      }),
    ];
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, cards);
    await page.goto("/valhalla", { waitUntil: "load" });

    await page.locator('select[aria-label="Sort order"]').selectOption("rewards_desc");

    const tombstones = page.locator('article[aria-label^="Closed card:"]');
    await expect(tombstones).toHaveCount(2);

    // Spec: only earned bonuses count — $10 earned > $0 (forfeited $500)
    await expect(tombstones.nth(0)).toHaveAttribute("aria-label", "Closed card: Earned Small Bonus Card");
    await expect(tombstones.nth(1)).toHaveAttribute("aria-label", "Closed card: Forfeited Bonus Card");
  });

  test("points and miles bonuses count as zero for rewards sort", async ({
    page,
  }) => {
    await setupValhalla(page);

    const cards = [
      makeClosedCard({
        cardName: "Points Card",
        annualFee: 0,
        signUpBonus: {
          type: "points",
          amount: 100000, // 100k pts (not monetary)
          spendRequirement: 300000,
          deadline: new Date().toISOString(),
          met: true,
        },
      }),
      makeClosedCard({
        cardName: "Small Cashback Card",
        annualFee: 0,
        signUpBonus: {
          type: "cashback",
          amount: 500, // $5 earned
          spendRequirement: 2000,
          deadline: new Date().toISOString(),
          met: true,
        },
      }),
    ];
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, cards);
    await page.goto("/valhalla", { waitUntil: "load" });

    await page.locator('select[aria-label="Sort order"]').selectOption("rewards_desc");

    const tombstones = page.locator('article[aria-label^="Closed card:"]');
    await expect(tombstones).toHaveCount(2);

    // Spec: points have no monetary value — $5 cashback > 0 (points)
    await expect(tombstones.nth(0)).toHaveAttribute("aria-label", "Closed card: Small Cashback Card");
    await expect(tombstones.nth(1)).toHaveAttribute("aria-label", "Closed card: Points Card");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Net gain sort — fee + cashback combined, descending (AC3)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla Financial Sort — net gain descending (AC3)", () => {
  test("cards are ordered by net gain (fee + cashback) descending", async ({
    page,
  }) => {
    await setupValhalla(page);

    const cards = [
      // Net gain: $0 + $0 = $0
      makeClosedCard({
        cardName: "Zero Gain Card",
        annualFee: 0,
        signUpBonus: null,
      }),
      // Net gain: $95 + $0 = $95
      makeClosedCard({
        cardName: "Fee Only Card",
        annualFee: 9500,
        signUpBonus: null,
      }),
      // Net gain: $50 + $200 = $250
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

    // Spec: highest net gain first — $250, $95, $0
    await expect(tombstones.nth(0)).toHaveAttribute("aria-label", "Closed card: High Gain Card");
    await expect(tombstones.nth(1)).toHaveAttribute("aria-label", "Closed card: Fee Only Card");
    await expect(tombstones.nth(2)).toHaveAttribute("aria-label", "Closed card: Zero Gain Card");
  });

  test("net gain sort: cashback-only card ranks above fee-only card with lower total", async ({
    page,
  }) => {
    await setupValhalla(page);

    const cards = [
      // Net gain: $0 fee + $300 cashback = $300
      makeClosedCard({
        cardName: "Cashback King",
        annualFee: 0,
        signUpBonus: {
          type: "cashback",
          amount: 30000, // $300
          spendRequirement: 150000,
          deadline: new Date().toISOString(),
          met: true,
        },
      }),
      // Net gain: $150 fee + $0 cashback = $150
      makeClosedCard({
        cardName: "Fee Avoider",
        annualFee: 15000, // $150
        signUpBonus: null,
      }),
    ];
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, cards);
    await page.goto("/valhalla", { waitUntil: "load" });

    await page.locator('select[aria-label="Sort order"]').selectOption("net_gain_desc");

    const tombstones = page.locator('article[aria-label^="Closed card:"]');
    await expect(tombstones).toHaveCount(2);

    // $300 > $150, so cashback-only card leads
    await expect(tombstones.nth(0)).toHaveAttribute("aria-label", "Closed card: Cashback King");
    await expect(tombstones.nth(1)).toHaveAttribute("aria-label", "Closed card: Fee Avoider");
  });

  test("net gain sort: points/miles bonuses do not contribute to net gain ranking", async ({
    page,
  }) => {
    await setupValhalla(page);

    const cards = [
      // Net gain: $0 (points don't count)
      makeClosedCard({
        cardName: "Points Earner",
        annualFee: 0,
        signUpBonus: {
          type: "points",
          amount: 500000, // 500k pts earned
          spendRequirement: 500000,
          deadline: new Date().toISOString(),
          met: true,
        },
      }),
      // Net gain: $25 (small fee only)
      makeClosedCard({
        cardName: "Tiny Fee Card",
        annualFee: 2500, // $25
        signUpBonus: null,
      }),
    ];
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, cards);
    await page.goto("/valhalla", { waitUntil: "load" });

    await page.locator('select[aria-label="Sort order"]').selectOption("net_gain_desc");

    const tombstones = page.locator('article[aria-label^="Closed card:"]');
    await expect(tombstones).toHaveCount(2);

    // $25 > $0 (500k points = $0 for sort), fee card leads
    await expect(tombstones.nth(0)).toHaveAttribute("aria-label", "Closed card: Tiny Fee Card");
    await expect(tombstones.nth(1)).toHaveAttribute("aria-label", "Closed card: Points Earner");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Sort selection persists during the session (AC4)
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla Financial Sort — sort persists during session (AC4)", () => {
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

    // Select fee avoided sort
    const sortSelect = page.locator('select[aria-label="Sort order"]');
    await sortSelect.selectOption("fee_avoided_desc");

    // Change issuer filter — sort selection should be preserved in the same select
    const issuerSelect = page.locator('select[aria-label="Filter by issuer"]');
    await issuerSelect.selectOption("all");

    // Sort dropdown should still show fee_avoided_desc
    await expect(sortSelect).toHaveValue("fee_avoided_desc");
  });

  test("sort selection persists after page content re-evaluates", async ({
    page,
  }) => {
    await setupValhalla(page);

    const cards = [
      makeClosedCard({ cardName: "Low Gain Card", annualFee: 1000 }),
      makeClosedCard({ cardName: "High Gain Card", annualFee: 50000 }),
    ];
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, cards);
    await page.goto("/valhalla", { waitUntil: "load" });

    const sortSelect = page.locator('select[aria-label="Sort order"]');
    await sortSelect.selectOption("net_gain_desc");

    // Verify value is still set (React state persists within the session)
    await expect(sortSelect).toHaveValue("net_gain_desc");

    // Tombstones should still be ordered correctly
    const tombstones = page.locator('article[aria-label^="Closed card:"]');
    await expect(tombstones.nth(0)).toHaveAttribute("aria-label", "Closed card: High Gain Card");
    await expect(tombstones.nth(1)).toHaveAttribute("aria-label", "Closed card: Low Gain Card");
  });

  test("rewards_desc sort selection persists while navigating between sort modes", async ({
    page,
  }) => {
    await setupValhalla(page);

    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [
      makeClosedCard({ cardName: "Reward Card A", annualFee: 0, signUpBonus: { type: "cashback", amount: 10000, spendRequirement: 50000, deadline: new Date().toISOString(), met: true } }),
      makeClosedCard({ cardName: "Reward Card B", annualFee: 9500, signUpBonus: null }),
    ]);
    await page.goto("/valhalla", { waitUntil: "load" });

    const sortSelect = page.locator('select[aria-label="Sort order"]');

    // Switch from default to rewards_desc
    await sortSelect.selectOption("closed_date_desc");
    await sortSelect.selectOption("rewards_desc");

    // Should hold the rewards_desc selection
    await expect(sortSelect).toHaveValue("rewards_desc");
  });

  test("all three financial sort options are selectable and remain selected", async ({
    page,
  }) => {
    await setupValhalla(page);

    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [
      makeClosedCard({ cardName: "Test Card", annualFee: 9500 }),
    ]);
    await page.goto("/valhalla", { waitUntil: "load" });

    const sortSelect = page.locator('select[aria-label="Sort order"]');

    // AC1 — fee_avoided_desc
    await sortSelect.selectOption("fee_avoided_desc");
    await expect(sortSelect).toHaveValue("fee_avoided_desc");

    // AC2 — rewards_desc
    await sortSelect.selectOption("rewards_desc");
    await expect(sortSelect).toHaveValue("rewards_desc");

    // AC3 — net_gain_desc
    await sortSelect.selectOption("net_gain_desc");
    await expect(sortSelect).toHaveValue("net_gain_desc");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Edge cases — devil's advocate
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla Financial Sort — edge cases", () => {
  test("fee_avoided_desc with all zero-fee cards maintains stable list (no crash)", async ({
    page,
  }) => {
    await setupValhalla(page);

    const cards = [
      makeClosedCard({ cardName: "No Fee Alpha", annualFee: 0 }),
      makeClosedCard({ cardName: "No Fee Beta", annualFee: 0 }),
      makeClosedCard({ cardName: "No Fee Gamma", annualFee: 0 }),
    ];
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, cards);
    await page.goto("/valhalla", { waitUntil: "load" });

    await page.locator('select[aria-label="Sort order"]').selectOption("fee_avoided_desc");

    // All three cards still render — no crash or disappearance
    const tombstones = page.locator('article[aria-label^="Closed card:"]');
    await expect(tombstones).toHaveCount(3);
  });

  test("rewards_desc with all unearned bonuses renders all cards", async ({
    page,
  }) => {
    await setupValhalla(page);

    const cards = [
      makeClosedCard({
        cardName: "Forfeited A",
        annualFee: 0,
        signUpBonus: { type: "cashback", amount: 10000, spendRequirement: 500000, deadline: new Date(Date.now() - 86400000).toISOString(), met: false },
      }),
      makeClosedCard({
        cardName: "Forfeited B",
        annualFee: 0,
        signUpBonus: { type: "cashback", amount: 20000, spendRequirement: 500000, deadline: new Date(Date.now() - 86400000).toISOString(), met: false },
      }),
    ];
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, cards);
    await page.goto("/valhalla", { waitUntil: "load" });

    await page.locator('select[aria-label="Sort order"]').selectOption("rewards_desc");

    // Both cards still visible — sort by 0 rewards should not crash or hide cards
    const tombstones = page.locator('article[aria-label^="Closed card:"]');
    await expect(tombstones).toHaveCount(2);
  });

  test("financial sort only affects Valhalla cards — filter interacts correctly", async ({
    page,
  }) => {
    await setupValhalla(page);

    const cards = [
      makeClosedCard({ cardName: "Chase High Fee", issuerId: "chase", annualFee: 55000 }),
      makeClosedCard({ cardName: "Chase Low Fee", issuerId: "chase", annualFee: 2500 }),
      makeClosedCard({ cardName: "Amex Any Fee", issuerId: "amex", annualFee: 25000 }),
    ];
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, cards);
    await page.goto("/valhalla", { waitUntil: "load" });

    // Set fee avoided sort, then filter to Chase only
    await page.locator('select[aria-label="Sort order"]').selectOption("fee_avoided_desc");
    await page.locator('select[aria-label="Filter by issuer"]').selectOption("chase");

    const tombstones = page.locator('article[aria-label^="Closed card:"]');
    await expect(tombstones).toHaveCount(2);

    // Among Chase cards, highest fee first
    await expect(tombstones.nth(0)).toHaveAttribute("aria-label", "Closed card: Chase High Fee");
    await expect(tombstones.nth(1)).toHaveAttribute("aria-label", "Closed card: Chase Low Fee");

    // Amex card not visible when filtered to Chase
    await expect(
      page.locator('article[aria-label="Closed card: Amex Any Fee"]')
    ).not.toBeVisible();
  });
});
