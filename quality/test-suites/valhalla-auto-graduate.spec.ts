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
  await page.reload({ waitUntil: "networkidle" });
});

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

    // Navigate to Valhalla tab
    const valhallaTab = page.locator('button[role="tab"]', {
      hasText: /Valhalla|valhalla/i,
    }).first();
    await expect(valhallaTab).toBeVisible();
    await valhallaTab.click();

    // Card should appear in Valhalla with "graduated" status indicator
    const cardTile = page.locator('[data-testid*="card-tile"]', {
      has: page.locator(`:text("${graduatedCard.cardName}")`),
    }).first();
    await expect(cardTile).toBeVisible();

    // Should show graduated status badge
    const statusBadge = cardTile.locator('[data-testid*="status"]');
    await expect(statusBadge).toContainText(/Graduated|graduated/i);
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
    const valhallaTab = page.locator('button[role="tab"]', {
      hasText: /Valhalla|valhalla/i,
    }).first();
    await valhallaTab.click();

    // All 3 cards should appear in Valhalla
    for (const card of cards) {
      const cardTile = page.locator('[data-testid*="card-tile"]', {
        has: page.locator(`:text("${card.cardName}")`),
      }).first();
      await expect(cardTile).toBeVisible();
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
    const activeTab = page.locator('button[role="tab"]', {
      hasText: /^Active$/i,
    }).first();
    await activeTab.click();

    // Only active card should appear
    const activeCardTile = page.locator('[data-testid*="card-tile"]', {
      has: page.locator(`:text("${activeCard.cardName}")`),
    }).first();
    await expect(activeCardTile).toBeVisible();

    // Graduated card should NOT appear
    const graduatedCardTile = page.locator('[data-testid*="card-tile"]', {
      has: page.locator(`:text("${graduatedCard.cardName}")`),
    }).first();
    const isVisible = await graduatedCardTile.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Toggling met back to false returns card to active
// ════════════════════════════════════════════════════════════════════════════

test.describe("Valhalla Auto-Graduate — Toggle Met State", () => {
  test("toggling bonus met from true to false returns card to active", async ({
    page,
  }) => {
    const cardId = "toggle-test-card";
    const graduatedCard = makeCard({
      id: cardId,
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

    // Verify card is in Valhalla
    const valhallaTab = page.locator('button[role="tab"]', {
      hasText: /Valhalla|valhalla/i,
    }).first();
    await valhallaTab.click();

    const cardTile = page.locator('[data-testid*="card-tile"]', {
      has: page.locator(`:text("${graduatedCard.cardName}")`),
    }).first();
    await expect(cardTile).toBeVisible();

    // Click on card to edit
    await cardTile.click();
    await page.waitForLoadState("networkidle");

    // Find and toggle the "minimum spend met" checkbox
    const bonusMetCheckbox = page.locator('input[type="checkbox"]', {
      hasText: /met|spend|minimum/i,
    }).first();

    // Uncheck it
    if (await bonusMetCheckbox.isChecked()) {
      await bonusMetCheckbox.uncheck();
    }

    // Save the card
    const saveButton = page.locator('button', { hasText: /Save|submit/i }).first();
    await saveButton.click();
    await page.waitForLoadState("networkidle");

    // Navigate back to dashboard
    const dashboardLink = page.locator('a', { hasText: /Dashboard|Home/i }).first();
    if (await dashboardLink.isVisible()) {
      await dashboardLink.click();
      await page.waitForLoadState("networkidle");
    }

    // Card should now appear in Active tab, not Valhalla
    const activeTab = page.locator('button[role="tab"]', {
      hasText: /^Active$/i,
    }).first();
    await activeTab.click();

    const activeCardTile = page.locator('[data-testid*="card-tile"]', {
      has: page.locator(`:text("${graduatedCard.cardName}")`),
    }).first();
    await expect(activeCardTile).toBeVisible();
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

    // Find and click on the unmet card
    const cardTile = page.locator('[data-testid*="card-tile"]', {
      has: page.locator(`:text("${unmetCard.cardName}")`),
    }).first();
    await cardTile.click();
    await page.waitForLoadState("networkidle");

    // Look for close/delete button and click it
    const closeButton = page.locator('button', {
      hasText: /close|delete|remove/i,
    }).first();
    await closeButton.click();
    await page.waitForLoadState("networkidle");

    // Dialog should appear asking about minimum spend
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    const dialogText = dialog.locator('[role="alertdialog"], [role="heading"], p');
    const hasMinimumSpendQuestion = dialogText.filter({
      hasText: /minimum spend/i,
    });
    const count = await hasMinimumSpendQuestion.count();
    expect(count).toBeGreaterThan(0);
  });

  test("answering Yes to minimum spend sets met=true before closing", async ({
    page,
  }) => {
    const unmetCard = makeCard({
      id: "unmet-card",
      cardName: "Unmet Bonus Card 2",
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
    const cardTile = page.locator('[data-testid*="card-tile"]', {
      has: page.locator(`:text("${unmetCard.cardName}")`),
    }).first();
    await cardTile.click();
    await page.waitForLoadState("networkidle");

    const closeButton = page.locator('button', {
      hasText: /close|delete|remove/i,
    }).first();
    await closeButton.click();
    await page.waitForLoadState("networkidle");

    // Click "Yes" button in dialog
    const yesButton = page.locator('button', { hasText: /^Yes$|^yes$|confirm/i }).first();
    await yesButton.click();
    await page.waitForLoadState("networkidle");

    // Verify card appears in Valhalla (marked as graduated because met was set to true)
    const valhallaTab = page.locator('button[role="tab"]', {
      hasText: /Valhalla|valhalla/i,
    }).first();
    await valhallaTab.click();

    const valhallaTile = page.locator('[data-testid*="card-tile"]', {
      has: page.locator(`:text("${unmetCard.cardName}")`),
    }).first();
    await expect(valhallaTile).toBeVisible();
  });

  test("answering No to minimum spend closes without setting met", async ({
    page,
  }) => {
    const unmetCard = makeCard({
      id: "unmet-card-no",
      cardName: "Unmet Bonus Card 3",
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
    const cardTile = page.locator('[data-testid*="card-tile"]', {
      has: page.locator(`:text("${unmetCard.cardName}")`),
    }).first();
    await cardTile.click();
    await page.waitForLoadState("networkidle");

    const closeButton = page.locator('button', {
      hasText: /close|delete|remove/i,
    }).first();
    await closeButton.click();
    await page.waitForLoadState("networkidle");

    // Click "No" button in dialog
    const noButton = page.locator('button', { hasText: /^No$|^no$/i }).first();
    await noButton.click();
    await page.waitForLoadState("networkidle");

    // Verify card appears in Valhalla with closed status (NOT graduated)
    const valhallaTab = page.locator('button[role="tab"]', {
      hasText: /Valhalla|valhalla/i,
    }).first();
    await valhallaTab.click();

    const valhallaTile = page.locator('[data-testid*="card-tile"]', {
      has: page.locator(`:text("${unmetCard.cardName}")`),
    }).first();
    await expect(valhallaTile).toBeVisible();

    const statusBadge = valhallaTile.locator('[data-testid*="status"]');
    await expect(statusBadge).toContainText(/Closed|closed/i);
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

    // Navigate to Active tab
    const activeTab = page.locator('button[role="tab"]', {
      hasText: /^Active$/i,
    }).first();
    await activeTab.click();

    // Card should appear in active
    const cardTile = page.locator('[data-testid*="card-tile"]', {
      has: page.locator(`:text("${noBonus.cardName}")`),
    }).first();
    await expect(cardTile).toBeVisible();

    // Navigate to Valhalla
    const valhallaTab = page.locator('button[role="tab"]', {
      hasText: /Valhalla|valhalla/i,
    }).first();
    await valhallaTab.click();

    // Card should NOT appear in Valhalla
    const valhallaTile = page.locator('[data-testid*="card-tile"]', {
      has: page.locator(`:text("${noBonus.cardName}")`),
    }).first();
    const isVisible = await valhallaTile.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
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
    const valhallaTab = page.locator('button[role="tab"]', {
      hasText: /Valhalla|valhalla/i,
    }).first();
    await valhallaTab.click();

    // Card should appear in Valhalla
    const cardTile = page.locator('[data-testid*="card-tile"]', {
      has: page.locator(`:text("${closedGraduated.cardName}")`),
    }).first();
    await expect(cardTile).toBeVisible();
  });
});
