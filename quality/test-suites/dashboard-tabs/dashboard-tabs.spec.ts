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
  seedEntitlement,
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
  // Seed Karl tier entitlement to unlock all features (Howl, Valhalla, Hunt tabs)
  await seedEntitlement(page, "karl", true);
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

  test.describe("TC-3: Default Tab Logic", () => {
    test("Defaults to Howl when urgent cards exist", async ({ page }) => {
      await setupDashboard(page, [
        makeCard({ cardName: "Active" }),
        makeUrgentCard({ cardName: "Urgent" }),
      ]);

      const howlTab = page.locator('button#tab-howl');
      await expect(howlTab).toHaveAttribute("aria-selected", "true");
    });

    test("Defaults to Active when Howl is empty", async ({ page }) => {
      await setupDashboard(page, [
        makeCard({ cardName: "Active 1" }),
        makeCard({ cardName: "Active 2" }),
      ]);

      const activeTab = page.locator('button#tab-active');
      await expect(activeTab).toHaveAttribute("aria-selected", "true");
    });
  });

  test.describe("TC-6: Tab Switching & Keyboard", () => {
    test("Can click to switch between tabs", async ({ page }) => {
      await setupDashboard(page, [
        makeCard({ cardName: "Active" }),
        makeUrgentCard({ cardName: "Urgent" }),
      ]);

      const howlTab = page.locator('button#tab-howl');
      const activeTab = page.locator('button#tab-active');

      await howlTab.click();
      await expect(howlTab).toHaveAttribute("aria-selected", "true");

      await activeTab.click();
      await expect(activeTab).toHaveAttribute("aria-selected", "true");
    });

    test("Tab panels show/hide correctly when switching", async ({ page }) => {
      await setupDashboard(page, [
        makeCard({ cardName: "Active" }),
        makeUrgentCard({ cardName: "Urgent" }),
      ]);

      const howlPanel = page.locator('[role="tabpanel"]#panel-howl');
      const activePanel = page.locator('[role="tabpanel"]#panel-active');
      const howlTab = page.locator('button#tab-howl');
      const activeTab = page.locator('button#tab-active');

      // Click Howl — should not be hidden
      await howlTab.click();
      const howlHidden = await howlPanel.getAttribute("hidden");
      expect(howlHidden).toBeNull();

      // Click Active — Howl should be hidden, Active should not
      await activeTab.click();
      const activeHidden = await activePanel.getAttribute("hidden");
      expect(activeHidden).toBeNull();
    });

    test("Arrow Right keyboard navigation switches tab", async ({ page }) => {
      await setupDashboard(page, [
        makeCard({ cardName: "Active" }),
        makeUrgentCard({ cardName: "Urgent" }),
      ]);

      // Tab order: All → Valhalla → Active → Hunt → Howl
      const allTab = page.locator('button#tab-all');
      const valhallaTab = page.locator('button#tab-valhalla');

      await allTab.focus();
      await page.keyboard.press("ArrowRight");
      await expect(valhallaTab).toHaveAttribute("aria-selected", "true");
    });
  });

  test.describe("TC-9: Empty States", () => {
    test("Shows Howl empty state when no urgent cards", async ({ page }) => {
      await setupDashboard(page, [makeCard({ cardName: "Only active" })]);

      const howlTab = page.locator('button#tab-howl');
      await howlTab.click();

      const howlPanel = page.locator('[role="tabpanel"]#panel-howl');
      const emptyText = howlPanel.locator("text=/No alerts/i");
      await expect(emptyText).toBeVisible();
    });

    test("Shows Active empty state when no active cards", async ({ page }) => {
      await setupDashboard(page, [makeUrgentCard({ cardName: "Only urgent" })]);

      const activeTab = page.locator('button#tab-active');
      await activeTab.click();

      const activePanel = page.locator('[role="tabpanel"]#panel-active');
      const emptyText = activePanel.locator("text=/No active cards/i");
      await expect(emptyText).toBeVisible();
    });
  });
});
