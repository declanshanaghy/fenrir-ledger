/**
 * Dashboard Tabs QA Tests — Issue #279
 *
 * Validates the tabbed layout redesign:
 * - Two tabs: "The Howl" (fee_approaching, promo_expiring, overdue) and "Active" (all others)
 * - Each card appears in exactly one tab (no duplication)
 * - Default tab logic: Howl when non-empty, Active otherwise
 * - Tab badges show correct counts
 * - Mobile-friendly at 375px viewport
 * - Urgency bars visible on Howl tab cards
 * - Keyboard navigation (arrow keys)
 * - ARIA attributes for accessibility
 */

import { test, expect } from "@playwright/test";
import {
  clearAllStorage,
  seedCards,
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
  await page.goto("/");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, cards);
  await page.reload({ waitUntil: "networkidle" });
}

// Set viewport to desktop by default; override per test for mobile
test.describe("Dashboard Tabs QA — Issue #279", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.describe("TC-1: Tab Structure & ARIA", () => {
    test("TC-1.1: Should render two tabs (Howl + Active) with proper ARIA roles", async ({
      page,
    }) => {
      await setupDashboard(page, [
        makeCard({ cardName: "Active Card" }),
        makeUrgentCard({ cardName: "Urgent Card" }),
      ]);

      const tablist = page.locator('[role="tablist"]');
      expect(tablist).toHaveAttribute("aria-label", /tabs/i);

      const howlTab = page.locator('button#tab-howl');
      const activeTab = page.locator('button#tab-active');

      expect(howlTab).toHaveAttribute("role", "tab");
      expect(howlTab).toHaveAttribute("aria-controls", "panel-howl");
      expect(activeTab).toHaveAttribute("role", "tab");
      expect(activeTab).toHaveAttribute("aria-controls", "panel-active");

      const howlPanel = page.locator('[role="tabpanel"]#panel-howl');
      const activePanel = page.locator('[role="tabpanel"]#panel-active');
      expect(howlPanel).toHaveAttribute("aria-labelledby", "tab-howl");
      expect(activePanel).toHaveAttribute("aria-labelledby", "tab-active");
    });

    test("TC-1.2: Should not have old HowlPanel aside in DOM", async ({ page }) => {
      await setupDashboard(page, [makeCard({ cardName: "Test" })]);
      const oldPanel = page.locator('aside[aria-label*="Urgent"]');
      await expect(oldPanel).not.toBeVisible();
    });
  });

  test.describe("TC-2: Card Distribution (No Duplication)", () => {
    test("TC-2.1: Each card appears in exactly one tab", async ({ page }) => {
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

      // With 2 active + 1 urgent + 1 promo: Howl should have 2, Active should have 2
      expect(howlCount + activeCount).toBe(4);
      expect(howlCount).toBeGreaterThanOrEqual(1); // At least 1 urgent/promo card
      expect(activeCount).toBeGreaterThanOrEqual(1); // At least 1 active card
    });

    test("TC-2.2: Howl tab contains fee_approaching + promo_expiring cards", async ({
      page,
    }) => {
      await setupDashboard(page, [
        makeUrgentCard({ cardName: "Fee Approaching" }),
        makePromoCard({ cardName: "Promo Expiring" }),
      ]);

      const howlTab = page.locator('button#tab-howl');
      await howlTab.click();

      const howlPanel = page.locator('[role="tabpanel"]#panel-howl');
      const urgencyBars = howlPanel.locator('[data-testid="urgency-bar"]');
      expect(urgencyBars).toHaveCount(2);
    });

    test("TC-2.3: Active tab contains only non-urgent cards", async ({ page }) => {
      await setupDashboard(page, [
        makeCard({ cardName: "Active 1" }),
        makeCard({ cardName: "Active 2" }),
      ]);

      const activeTab = page.locator('button#tab-active');
      await activeTab.click();

      const activePanel = page.locator('[role="tabpanel"]#panel-active');
      const urgencyBars = activePanel.locator('[data-testid="urgency-bar"]');
      expect(urgencyBars).toHaveCount(0);
    });
  });

  test.describe("TC-3: Default Tab Logic", () => {
    test("TC-3.1: Defaults to Howl when urgent cards exist", async ({ page }) => {
      await setupDashboard(page, [
        makeCard({ cardName: "Active" }),
        makeUrgentCard({ cardName: "Urgent" }),
      ]);

      const howlTab = page.locator('button#tab-howl');
      expect(howlTab).toHaveAttribute("aria-selected", "true");
    });

    test("TC-3.2: Defaults to Active when Howl is empty", async ({ page }) => {
      await setupDashboard(page, [
        makeCard({ cardName: "Active 1" }),
        makeCard({ cardName: "Active 2" }),
      ]);

      const activeTab = page.locator('button#tab-active');
      expect(activeTab).toHaveAttribute("aria-selected", "true");
    });
  });

  test.describe("TC-4: Tab Badges", () => {
    test("TC-4.1: Howl badge shows correct urgent card count", async ({ page }) => {
      await setupDashboard(page, [
        makeCard({ cardName: "A1" }),
        makeUrgentCard({ cardName: "U1" }),
        makePromoCard({ cardName: "P1" }),
      ]);

      const howlTab = page.locator('button#tab-howl');
      const badgeText = await howlTab.locator("span").filter({ hasText: /^\d+$/ }).last().textContent();
      expect(parseInt(badgeText || "0", 10)).toBe(2); // 1 urgent + 1 promo
    });

    test("TC-4.2: Active badge shows correct non-urgent card count", async ({ page }) => {
      await setupDashboard(page, [
        makeCard({ cardName: "A1" }),
        makeCard({ cardName: "A2" }),
        makeUrgentCard({ cardName: "U1" }),
      ]);

      const activeTab = page.locator('button#tab-active');
      const badgeText = await activeTab.locator("span").filter({ hasText: /^\d+$/ }).last().textContent();
      expect(parseInt(badgeText || "0", 10)).toBe(2);
    });
  });

  test.describe("TC-5: Urgency Bars", () => {
    test("TC-5.1: Howl cards display urgency bars with status labels", async ({
      page,
    }) => {
      await setupDashboard(page, [
        makeUrgentCard({ cardName: "Fee Card" }),
        makePromoCard({ cardName: "Promo Card" }),
      ]);

      const howlTab = page.locator('button#tab-howl');
      await howlTab.click();

      const howlPanel = page.locator('[role="tabpanel"]#panel-howl');
      const urgencyBars = howlPanel.locator('[data-testid="urgency-bar"]');

      // Should have 2 urgency bars
      expect(urgencyBars).toHaveCount(2);

      // Check for status labels
      const feeLabel = howlPanel.locator("text=/FEE APPROACHING/");
      const promoLabel = howlPanel.locator("text=/PROMO EXPIRING/");
      expect(feeLabel).toBeVisible();
      expect(promoLabel).toBeVisible();
    });

    test("TC-5.2: Urgency bars show days remaining", async ({ page }) => {
      await setupDashboard(page, [makeUrgentCard({ cardName: "Urgent Card" })]);

      const howlTab = page.locator('button#tab-howl');
      await howlTab.click();

      const urgencyBar = page.locator('[data-testid="urgency-bar"]');
      const text = await urgencyBar.textContent();
      expect(text).toMatch(/day|past/i);
    });
  });

  test.describe("TC-6: Tab Switching & Keyboard", () => {
    test("TC-6.1: Can click to switch between tabs", async ({ page }) => {
      await setupDashboard(page, [
        makeCard({ cardName: "Active" }),
        makeUrgentCard({ cardName: "Urgent" }),
      ]);

      const howlTab = page.locator('button#tab-howl');
      const activeTab = page.locator('button#tab-active');

      await howlTab.click();
      expect(howlTab).toHaveAttribute("aria-selected", "true");

      await activeTab.click();
      expect(activeTab).toHaveAttribute("aria-selected", "true");
    });

    test("TC-6.2: Tab panels show/hide correctly when switching", async ({ page }) => {
      await setupDashboard(page, [
        makeCard({ cardName: "Active" }),
        makeUrgentCard({ cardName: "Urgent" }),
      ]);

      const howlPanel = page.locator('[role="tabpanel"]#panel-howl');
      const activePanel = page.locator('[role="tabpanel"]#panel-active');
      const howlTab = page.locator('button#tab-howl');
      const activeTab = page.locator('button#tab-active');

      await howlTab.click();
      expect(howlPanel).not.toHaveAttribute("hidden");

      await activeTab.click();
      expect(activePanel).not.toHaveAttribute("hidden");
    });

    test("TC-6.3: Arrow Right/Left keyboard navigation works", async ({ page }) => {
      await setupDashboard(page, [
        makeCard({ cardName: "Active" }),
        makeUrgentCard({ cardName: "Urgent" }),
      ]);

      const howlTab = page.locator('button#tab-howl');
      const activeTab = page.locator('button#tab-active');

      await howlTab.focus();
      await page.keyboard.press("ArrowRight");
      expect(activeTab).toHaveAttribute("aria-selected", "true");

      await page.keyboard.press("ArrowLeft");
      expect(howlTab).toHaveAttribute("aria-selected", "true");
    });
  });

  test.describe("TC-7: Mobile Responsiveness", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test("TC-7.1: Tab bar visible and functional on mobile (375px)", async ({
      page,
    }) => {
      await setupDashboard(page, [
        makeCard({ cardName: "Active" }),
        makeUrgentCard({ cardName: "Urgent" }),
      ]);

      const tablist = page.locator('[role="tablist"]');
      expect(tablist).toBeVisible();

      const howlTab = page.locator('button#tab-howl');
      const activeTab = page.locator('button#tab-active');

      await howlTab.click();
      expect(howlTab).toHaveAttribute("aria-selected", "true");

      await activeTab.click();
      expect(activeTab).toHaveAttribute("aria-selected", "true");
    });

    test("TC-7.2: Cards display properly on mobile", async ({ page }) => {
      await setupDashboard(page, [
        makeCard({ cardName: "Active" }),
        makeUrgentCard({ cardName: "Urgent" }),
      ]);

      const howlTab = page.locator('button#tab-howl');
      await howlTab.click();

      const howlPanel = page.locator('[role="tabpanel"]#panel-howl');
      const firstCard = howlPanel.locator('[data-testid^="card-"]').first();
      expect(firstCard).toBeVisible();
    });

    test("TC-7.3: Badges visible and readable on mobile", async ({ page }) => {
      await setupDashboard(page, [
        makeCard({ cardName: "Active" }),
        makeUrgentCard({ cardName: "Urgent" }),
      ]);

      const howlTab = page.locator('button#tab-howl');
      const activeTab = page.locator('button#tab-active');

      const howlBadge = howlTab.locator("span").filter({ hasText: /^\d+$/ }).last();
      const activeBadge = activeTab.locator("span").filter({ hasText: /^\d+$/ }).last();

      expect(howlBadge).toBeVisible();
      expect(activeBadge).toBeVisible();

      const howlText = await howlBadge.textContent();
      const activeText = await activeBadge.textContent();
      expect(howlText).toMatch(/\d+/);
      expect(activeText).toMatch(/\d+/);
    });
  });

  test.describe("TC-8: No Regression", () => {
    test("TC-8.1: Summary header shows correct total card count", async ({ page }) => {
      await setupDashboard(page, [
        makeCard({ cardName: "A1" }),
        makeCard({ cardName: "A2" }),
        makeUrgentCard({ cardName: "U1" }),
      ]);

      const summaryHeader = page.locator("text=/^\\d+\\s+cards$/");
      const text = await summaryHeader.textContent();
      const num = parseInt(text || "0", 10);
      expect(num).toBe(3);
    });

    test("TC-8.2: Card data not corrupted in tabs", async ({ page }) => {
      const testCard = makeCard({ cardName: "Test Card Name" });
      await setupDashboard(page, [testCard]);

      const activePanel = page.locator('[role="tabpanel"]#panel-active');
      const cards = activePanel.locator('[data-testid^="card-"]');
      expect(cards).toHaveCount(1);

      const cardContent = await cards.first().textContent();
      expect(cardContent).toContain("Test Card Name");
    });
  });

  test.describe("TC-9: Empty States", () => {
    test("TC-9.1: Shows Howl empty state when no urgent cards", async ({ page }) => {
      await setupDashboard(page, [makeCard({ cardName: "Only active" })]);

      const howlTab = page.locator('button#tab-howl');
      await howlTab.click();

      const howlPanel = page.locator('[role="tabpanel"]#panel-howl');
      const emptyText = howlPanel.locator("text=/wolf.*silent/i");
      expect(emptyText).toBeVisible();
    });

    test("TC-9.2: Shows Active empty state when no active cards", async ({ page }) => {
      await setupDashboard(page, [makeUrgentCard({ cardName: "Only urgent" })]);

      const activeTab = page.locator('button#tab-active');
      await activeTab.click();

      const activePanel = page.locator('[role="tabpanel"]#panel-active');
      const emptyText = activePanel.locator("text=/no active cards/i");
      expect(emptyText).toBeVisible();
    });
  });
});
