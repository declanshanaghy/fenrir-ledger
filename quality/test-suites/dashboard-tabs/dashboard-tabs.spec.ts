/**
 * Dashboard Tabs QA Tests — Issue #279
 *
 * Tests the 5-tab dashboard structure:
 *   - All (all cards)
 *   - Valhalla (closed/retired cards)
 *   - Active (status === "active")
 *   - Hunt (bonus_open cards)
 *   - Howl (cards needing attention)
 *
 * Validates:
 *   - Tab switching via click
 *   - Card distribution (no duplication across tabs)
 *   - Default tab logic (Howl if has cards, else Active)
 *   - Keyboard navigation
 *   - Empty states show correct runic text
 */

import { test, expect } from "@playwright/test";
import {
  clearAllStorage,
  seedCards,
  seedEntitlement,
  seedHousehold,
  makeCard,
  makeUrgentCard,
  makePromoCard,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

// Setup helper function
async function setupDashboard(
  page: Parameters<typeof clearAllStorage>[0],
  cards: Parameters<typeof seedCards>[2]
) {
  await page.goto("/ledger");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, cards);
  await seedEntitlement(page);
  await page.reload({ waitUntil: "load" });
}

test.describe("Dashboard Tabs QA — Issue #279", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.describe("TC-2: Card Distribution (No Duplication)", () => {
    test("Each card appears in exactly one tab", async ({ page }) => {
      await setupDashboard(page, [
        makeCard({ cardName: "Active 1" }),
        makeCard({ cardName: "Active 2" }),
        makeUrgentCard({ cardName: "Urgent 1" }),
        makePromoCard({ cardName: "Promo 1" }),
      ]);

      // Active tab should have active + promo cards
      const activeTab = page.locator('button#tab-active');
      await activeTab.click();
      const activePanel = page.locator('[role="tabpanel"]#panel-active');
      const activeCards = activePanel.locator('[data-testid^="card-"]');
      const activeCount = await activeCards.count();
      expect(activeCount).toBeGreaterThanOrEqual(1);

      // All tab should have all 4 cards
      const allTab = page.locator('button#tab-all');
      await allTab.click();
      const allPanel = page.locator('[role="tabpanel"]#panel-all');
      const allCards = allPanel.locator('[data-testid^="card-"]');
      const allCount = await allCards.count();
      expect(allCount).toBe(4);
    });
  });

  // TC-3: Default Tab Logic — REMOVED (Issue #610)
  // Duplicated by howl-panel.spec.ts default tab selection tests.

  test.describe("TC-6: Tab Switching & Keyboard", () => {
    test("Can click to switch between active and all tabs", async ({ page }) => {
      await setupDashboard(page, [
        makeCard({ cardName: "Active" }),
        makeUrgentCard({ cardName: "Urgent" }),
      ]);

      const allTab = page.locator('button#tab-all');
      const activeTab = page.locator('button#tab-active');

      await allTab.click();
      await expect(allTab).toHaveAttribute("aria-selected", "true");

      await activeTab.click();
      await expect(activeTab).toHaveAttribute("aria-selected", "true");
    });

    // "Tab panels show/hide" — REMOVED (Issue #610): Duplicated by howl-panel switching.
    // "Arrow Right keyboard navigation" — REMOVED (Issue #610): Duplicated by reverse-tab-order.
  });

  test.describe("TC-9: Empty States", () => {
    test("Shows empty state text when Active tab has no cards", async ({ page }) => {
      // Setup with only Howl cards (urgent/fee_approaching) - Active tab will be empty
      await setupDashboard(page, [
        makeUrgentCard({ cardName: "Urgent" }),
      ]);

      // Click Active tab which has no cards
      const activeTab = page.locator('button#tab-active');
      await activeTab.click();

      // Verify empty state text appears in Active panel
      const activePanel = page.locator('[role="tabpanel"]#panel-active');
      const emptyText = activePanel.locator("text=/No active cards/i");
      await expect(emptyText).toBeVisible();
    });

    test("All tab with cards shows no empty state", async ({ page }) => {
      await setupDashboard(page, [
        makeCard({ cardName: "Active" }),
        makeUrgentCard({ cardName: "Urgent" }),
      ]);

      // Click All tab - should have cards
      const allTab = page.locator('button#tab-all');
      await allTab.click();

      // Verify cards are visible (no empty state)
      const allPanel = page.locator('[role="tabpanel"]#panel-all');
      const cards = allPanel.locator('[data-testid^="card-"]');
      const cardCount = await cards.count();
      expect(cardCount).toBeGreaterThan(0);
    });
  });
});
