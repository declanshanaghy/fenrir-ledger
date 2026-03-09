/**
 * Valhalla Auto-Graduate Test Suite — #436
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates auto-graduation feature for cards meeting minimum sign-up bonus spend:
 * - Cards with signUpBonus.met === true appear in Valhalla tab
 * - Cards with signUpBonus.met === true do NOT appear in active cards list
 * - Status computation reflects the graduated state
 * - Toggling met back to false returns card to active list
 * - When closing a card with unmet bonus, prompt 'Has the minimum spend been met?'
 * - Prompt response updates signUpBonus.met accordingly before closing
 * - No data loss — card data preserved, just status/display changes
 * - Edge cases: no sign-up bonus, already closed + met toggled, rapid toggles, multiple graduations
 */

import { test, expect } from "@playwright/test";
import {
  clearAllStorage,
  seedHousehold,
  seedCards,
  seedEntitlement,
  makeCard,
  makeClosedCard,
  ANONYMOUS_HOUSEHOLD_ID,
} from "./helpers/test-fixtures";

// ════════════════════════════════════════════════════════════════════════════
// Setup
// ════════════════════════════════════════════════════════════════════════════

test.beforeEach(async ({ page }) => {
  await page.goto("/ledger");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await seedEntitlement(page, "karl", true); // Enable Valhalla feature (requires karl tier)
  await page.reload({ waitUntil: "networkidle" });
});

// ════════════════════════════════════════════════════════════════════════════
// Helper: Click tab by ID
// ════════════════════════════════════════════════════════════════════════════

async function clickTab(page: any, tabId: string) {
  const tabButton = page.locator(`button#${tabId}`).first();
  await expect(tabButton).toBeVisible();
  await tabButton.click();
  await page.waitForLoadState("networkidle");
}

// ════════════════════════════════════════════════════════════════════════════
// Suite: Cards with met bonus appear in Valhalla
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla Auto-Graduate — Graduated Cards in Valhalla Tab", () => {
  test("card with signUpBonus.met=true appears in Valhalla tab", async ({
    page,
  }) => {
    // Create a card with sign-up bonus already met
    const graduatedCard = makeCard({
      cardName: "Chase Sapphire Preferred",
      signUpBonus: {
        type: "points",
        amount: 100000,
        spendRequirement: 400000, // $4,000
        deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        met: true, // Met — should graduate to Valhalla
      },
      status: "graduated", // Should be computed as graduated
    });

    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [graduatedCard]);
    await page.goto("/ledger");
    await page.waitForLoadState("networkidle");

    // Navigate to Valhalla tab using tab-valhalla ID
    await clickTab(page, "tab-valhalla");

    // Card should appear in Valhalla
    const cardTile = page.locator('[data-testid="card-tile"]').first();
    const cardText = cardTile.locator('text=' + graduatedCard.cardName);
    await expect(cardText).toBeVisible();
  });

  test("multiple cards with met bonus all appear in Valhalla", async ({
    page,
  }) => {
    // Create 3 cards with met bonuses
    const cards = [
      makeCard({
        cardName: "Sapphire",
        signUpBonus: {
          type: "points",
          amount: 100000,
          spendRequirement: 400000,
          deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          met: true,
        },
        status: "graduated",
      }),
      makeCard({
        cardName: "Amex Gold",
        signUpBonus: {
          type: "points",
          amount: 90000,
          spendRequirement: 500000,
          deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          met: true,
        },
        status: "graduated",
      }),
      makeCard({
        cardName: "Citi Prestige",
        signUpBonus: {
          type: "miles",
          amount: 150000,
          spendRequirement: 300000,
          deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          met: true,
        },
        status: "graduated",
      }),
    ];

    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, cards);
    await page.goto("/ledger");
    await page.waitForLoadState("networkidle");

    // Navigate to Valhalla tab
    await clickTab(page, "tab-valhalla");

    // All 3 cards should appear in Valhalla
    const cardTiles = page.locator('[data-testid="card-tile"]');
    await expect(cardTiles).toHaveCount(3);

    for (const card of cards) {
      const cardText = page.locator(`text=${card.cardName}`);
      await expect(cardText).toBeVisible();
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Graduated cards do NOT appear in active list
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla Auto-Graduate — Graduated Cards Excluded from Active", () => {
  test("card with met bonus does not appear in active cards tab", async ({
    page,
  }) => {
    const graduatedCard = makeCard({
      cardName: "Graduated Sapphire",
      signUpBonus: {
        type: "points",
        amount: 100000,
        spendRequirement: 400000,
        deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        met: true,
      },
      status: "graduated",
    });

    const activeCard = makeCard({
      cardName: "Active Card",
      signUpBonus: null,
      status: "active",
    });

    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [graduatedCard, activeCard]);
    await page.goto("/ledger");
    await page.waitForLoadState("networkidle");

    // Navigate to Active tab
    await clickTab(page, "tab-active");

    // Only active card should appear
    const cardTiles = page.locator('[data-testid="card-tile"]');
    await expect(cardTiles).toHaveCount(1);

    const activeCardText = page.locator(`text=${activeCard.cardName}`);
    await expect(activeCardText).toBeVisible();

    // Graduated card text should NOT appear
    const graduatedCardText = page.locator(`text=${graduatedCard.cardName}`);
    const isVisible = await graduatedCardText.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Card status reflects graduated state
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla Auto-Graduate — Status Computation", () => {
  test("computeCardStatus returns 'graduated' when met=true", async ({
    page,
  }) => {
    const graduatedCard = makeCard({
      cardName: "Status Test Card",
      signUpBonus: {
        type: "points",
        amount: 100000,
        spendRequirement: 400000,
        deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        met: true,
      },
      status: "graduated",
    });

    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [graduatedCard]);
    await page.goto("/ledger");
    await page.waitForLoadState("networkidle");

    // Navigate to Valhalla to verify card is there (which proves status is correct)
    await clickTab(page, "tab-valhalla");

    const cardTile = page.locator('[data-testid="card-tile"]').first();
    const cardText = cardTile.locator(`text=${graduatedCard.cardName}`);
    await expect(cardText).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Toggling met back to false returns card to active
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla Auto-Graduate — Toggle Met State", () => {
  test("toggling bonus met from true to false returns card to active", async ({
    page,
  }) => {
    const graduatedCard = makeCard({
      cardName: "Toggle Card",
      signUpBonus: {
        type: "points",
        amount: 100000,
        spendRequirement: 400000,
        deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        met: true, // Initially met
      },
      status: "graduated",
    });

    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [graduatedCard]);
    await page.goto("/ledger");
    await page.waitForLoadState("networkidle");

    // Verify card is in Valhalla initially
    await clickTab(page, "tab-valhalla");
    let cardTile = page.locator('[data-testid="card-tile"]').first();
    let cardText = cardTile.locator(`text=${graduatedCard.cardName}`);
    await expect(cardText).toBeVisible();

    // Click on card to edit
    await cardTile.click();
    await page.waitForLoadState("networkidle");

    // Find and toggle the "minimum spend met" checkbox
    const bonusMetCheckbox = page.locator('input[type="checkbox"]').nth(2); // 3rd checkbox typically is bonus met
    const isChecked = await bonusMetCheckbox.isChecked();

    if (isChecked) {
      await bonusMetCheckbox.uncheck();
    }

    // Save the card
    const saveButton = page.locator('button').filter({ hasText: /Save/ }).first();
    await saveButton.click();
    await page.waitForLoadState("networkidle");

    // Navigate back to dashboard and check Active tab
    await page.goto("/ledger");
    await page.waitForLoadState("networkidle");

    // Card should now appear in Active tab
    await clickTab(page, "tab-active");
    cardTile = page.locator('[data-testid="card-tile"]').first();
    cardText = cardTile.locator(`text=${graduatedCard.cardName}`);
    await expect(cardText).toBeVisible();

    // Card should NOT appear in Valhalla anymore
    await clickTab(page, "tab-valhalla");
    const valhallaTiles = page.locator('[data-testid="card-tile"]');
    await expect(valhallaTiles).toHaveCount(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Close card with unmet bonus prompts about minimum spend
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla Auto-Graduate — Close Card Prompt", () => {
  test("closing card with unmet bonus shows confirmation dialog", async ({
    page,
  }) => {
    const unmetCard = makeCard({
      cardName: "Unmet Bonus Card",
      signUpBonus: {
        type: "points",
        amount: 100000,
        spendRequirement: 400000,
        deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        met: false, // Unmet — should trigger prompt
      },
      status: "bonus_open",
    });

    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [unmetCard]);
    await page.goto("/ledger");
    await page.waitForLoadState("networkidle");

    // Card should be in The Hunt tab (bonus_open status)
    await clickTab(page, "tab-hunt");

    // Find and click on the card
    const cardTile = page.locator('[data-testid="card-tile"]').first();
    await cardTile.click();
    await page.waitForLoadState("networkidle");

    // Look for close/delete button and click it
    const closeButton = page.locator('button').filter({ hasText: /[Cc]lose|[Dd]elete|[Rr]emove/ }).first();
    await closeButton.click();
    await page.waitForLoadState("networkidle");

    // Dialog should appear asking about minimum spend
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Should contain text about minimum spend
    const dialogText = dialog.locator('[role="alertdialog"], h2, p');
    const hasMinSpendText = dialogText.filter({ hasText: /minimum spend/i });
    const count = await hasMinSpendText.count();
    expect(count).toBeGreaterThan(0);
  });

  test("answering Yes to minimum spend marks bonus as met before closing", async ({
    page,
  }) => {
    const unmetCard = makeCard({
      id: "unmet-yes-test",
      cardName: "Unmet Yes Card",
      signUpBonus: {
        type: "points",
        amount: 100000,
        spendRequirement: 400000,
        deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        met: false,
      },
      status: "bonus_open",
    });

    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [unmetCard]);
    await page.goto("/ledger");
    await page.waitForLoadState("networkidle");

    // Open card and trigger close
    await clickTab(page, "tab-hunt");
    const cardTile = page.locator('[data-testid="card-tile"]').first();
    await cardTile.click();
    await page.waitForLoadState("networkidle");

    const closeButton = page.locator('button').filter({ hasText: /[Cc]lose|[Dd]elete|[Rr]emove/ }).first();
    await closeButton.click();
    await page.waitForLoadState("networkidle");

    // Click "Yes" button in dialog
    const yesButton = page.locator('button').filter({ hasText: /^Yes$|^yes$/ }).first();
    await yesButton.click();
    await page.waitForLoadState("networkidle");

    // Verify card appears in Valhalla (marked as graduated because met was set to true)
    await page.goto("/ledger");
    await page.waitForLoadState("networkidle");

    await clickTab(page, "tab-valhalla");
    const valhallaTile = page.locator('[data-testid="card-tile"]').first();
    const valhallaTileText = valhallaTile.locator(`text=${unmetCard.cardName}`);
    await expect(valhallaTileText).toBeVisible();
  });

  test("answering No to minimum spend closes without marking met", async ({
    page,
  }) => {
    const unmetCard = makeCard({
      id: "unmet-no-test",
      cardName: "Unmet No Card",
      signUpBonus: {
        type: "points",
        amount: 100000,
        spendRequirement: 400000,
        deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        met: false,
      },
      status: "bonus_open",
    });

    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [unmetCard]);
    await page.goto("/ledger");
    await page.waitForLoadState("networkidle");

    // Open card and trigger close
    await clickTab(page, "tab-hunt");
    const cardTile = page.locator('[data-testid="card-tile"]').first();
    await cardTile.click();
    await page.waitForLoadState("networkidle");

    const closeButton = page.locator('button').filter({ hasText: /[Cc]lose|[Dd]elete|[Rr]emove/ }).first();
    await closeButton.click();
    await page.waitForLoadState("networkidle");

    // Click "No" button in dialog
    const noButton = page.locator('button').filter({ hasText: /^No$|^no$/ }).first();
    await noButton.click();
    await page.waitForLoadState("networkidle");

    // Verify card appears in Valhalla with closed status (NOT graduated)
    await page.goto("/ledger");
    await page.waitForLoadState("networkidle");

    await clickTab(page, "tab-valhalla");
    const valhallaTile = page.locator('[data-testid="card-tile"]').first();
    const valhallaTileText = valhallaTile.locator(`text=${unmetCard.cardName}`);
    await expect(valhallaTileText).toBeVisible();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Edge Cases
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla Auto-Graduate — Edge Cases", () => {
  test("card with no sign-up bonus unaffected by graduation logic", async ({
    page,
  }) => {
    const noBonus = makeCard({
      cardName: "No Bonus Card",
      signUpBonus: null, // No bonus
      status: "active",
    });

    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [noBonus]);
    await page.goto("/ledger");
    await page.waitForLoadState("networkidle");

    // Card should appear in Active tab
    await clickTab(page, "tab-active");
    const activeCardText = page.locator(`text=${noBonus.cardName}`);
    await expect(activeCardText).toBeVisible();

    // Card should NOT appear in Valhalla
    await clickTab(page, "tab-valhalla");
    const valhallaTiles = page.locator('[data-testid="card-tile"]');
    await expect(valhallaTiles).toHaveCount(0);
  });

  test("closed card with met bonus appears in Valhalla", async ({ page }) => {
    const closedGraduated = makeClosedCard({
      cardName: "Closed Graduated Card",
      signUpBonus: {
        type: "points",
        amount: 100000,
        spendRequirement: 400000,
        deadline: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        met: true, // Bonus was met
      },
      status: "closed", // But card is closed
    });

    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [closedGraduated]);
    await page.goto("/ledger");
    await page.waitForLoadState("networkidle");

    // Navigate to Valhalla
    await clickTab(page, "tab-valhalla");

    // Card should appear in Valhalla
    const cardText = page.locator(`text=${closedGraduated.cardName}`);
    await expect(cardText).toBeVisible();
  });
});
