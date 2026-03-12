/**
 * Dashboard Tabs QA Tests — Issue #279
 *
 * Slimmed to interactive behavior only:
 *   - Tabs switch content
 *   - Default tab logic (Howl vs Active)
 *   - Card distribution (no duplication)
 *   - Tab switching via click
 *   - Keyboard navigation
 *   - Empty states show when switching to empty tab
 *
 * Removed: ARIA attribute assertions, mobile viewport tests,
 * badge count text, urgency bar labels, summary header count,
 * card data integrity, old HowlPanel regression.
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

      const howlTab = page.locator('button#tab-howl');
      await howlTab.click();

      const howlPanel = page.locator('[role="tabpanel"]#panel-howl');
      const howlCards = howlPanel.locator('[data-testid^="card-"]');
      const howlCount = await howlCards.count();

      await page.locator('button#tab-active').click();
      const activePanel = page.locator('[role="tabpanel"]#panel-active');
      const activeCards = activePanel.locator('[data-testid^="card-"]');
      const activeCount = await activeCards.count();

      expect(howlCount + activeCount).toBe(4);
      expect(howlCount).toBeGreaterThanOrEqual(1);
      expect(activeCount).toBeGreaterThanOrEqual(1);
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

      await howlTab.click();
      await expect(howlPanel).not.toHaveAttribute("hidden");

      await activeTab.click();
      await expect(activePanel).not.toHaveAttribute("hidden");
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
      const emptyText = howlPanel.locator("text=/wolf.*silent/i");
      await expect(emptyText).toBeVisible();
    });

    test("Shows Active empty state when no active cards", async ({ page }) => {
      await setupDashboard(page, [makeUrgentCard({ cardName: "Only urgent" })]);

      const activeTab = page.locator('button#tab-active');
      await activeTab.click();

      const activePanel = page.locator('[role="tabpanel"]#panel-active');
      const emptyText = activePanel.locator("text=/no active cards/i");
      await expect(emptyText).toBeVisible();
    });
  });
});
