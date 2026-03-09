/**
 * Dashboard Tab Order QA Tests — Issue #399
 *
 * Validates that dashboard tabs render in the correct reversed order:
 * All → Valhalla → Active → The Hunt → The Howl
 *
 * Previously (old order): The Howl → The Hunt → Active → Valhalla → All
 *
 * Acceptance Criteria:
 * 1. Dashboard tabs render in reversed order: All, Valhalla, Active, The Hunt, The Howl
 * 2. Default selected tab unchanged (Howl if has cards, else Active)
 * 3. Mobile tab display matches new order
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

test.describe("Dashboard Tab Order (Issue #399)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("AC1: tabs render in reversed order: All → Valhalla → Active → The Hunt → The Howl", async ({
    page,
  }) => {
    // Setup with mixed card types
    await setupDashboard(page, [
      makeCard({ cardName: "Active 1" }),
      makeCard({ cardName: "Active 2" }),
      makeUrgentCard({ cardName: "Urgent 1" }),
      makePromoCard({ cardName: "Promo 1" }),
    ]);

    // Wait for tablist to be rendered
    await page.waitForSelector('[role="tablist"]', { timeout: 15000 });

    // Get all tab buttons
    const tabs = page.locator('[role="tab"]');
    const tabCount = await tabs.count();

    // Verify we have exactly 5 tabs
    expect(tabCount).toBe(5);

    // Get tab labels and IDs in order
    const tabLabels: string[] = [];
    const tabIds: string[] = [];
    for (let i = 0; i < tabCount; i++) {
      const tab = tabs.nth(i);
      const id = await tab.getAttribute("id");
      const text = await tab.textContent();

      // Extract label (text before the badge)
      const labelMatch = text?.match(/([A-Za-z\s]+)/);
      const label = labelMatch?.[1]?.trim() || "";

      if (id && label) {
        tabIds.push(id);
        tabLabels.push(label);
      }
    }

    // Verify the new tab order
    expect(tabLabels).toEqual([
      "All",
      "Valhalla",
      "Active",
      "The Hunt",
      "The Howl",
    ]);

    // Verify corresponding tab IDs match expected order
    expect(tabIds).toEqual([
      "tab-all",
      "tab-valhalla",
      "tab-active",
      "tab-hunt",
      "tab-howl",
    ]);
  });

  test("AC2: default selected tab unchanged (Howl if has cards, else Active)", async ({
    page,
  }) => {
    // Test 1: Default should be Howl when urgent cards exist
    await setupDashboard(page, [
      makeCard({ cardName: "Active" }),
      makeUrgentCard({ cardName: "Urgent" }),
    ]);

    const howlTab = page.locator('button#tab-howl');
    await expect(howlTab).toHaveAttribute("aria-selected", "true");

    // Test 2: Default should be Active when Howl is empty
    await setupDashboard(page, [
      makeCard({ cardName: "Active 1" }),
      makeCard({ cardName: "Active 2" }),
    ]);

    const activeTab = page.locator('button#tab-active');
    await expect(activeTab).toHaveAttribute("aria-selected", "true");
  });

  test("can switch between tabs in new order (All → Valhalla → Active → Hunt → Howl)", async ({
    page,
  }) => {
    await setupDashboard(page, [
      makeCard({ cardName: "Active" }),
      makeUrgentCard({ cardName: "Urgent" }),
      makePromoCard({ cardName: "Promo" }),
    ]);

    const allTab = page.locator('button#tab-all');
    const valhallaTab = page.locator('button#tab-valhalla');
    const activeTab = page.locator('button#tab-active');
    const huntTab = page.locator('button#tab-hunt');
    const howlTab = page.locator('button#tab-howl');

    // Click All tab
    await allTab.click();
    await expect(page.locator('[role="tabpanel"]#panel-all')).not.toHaveAttribute("hidden");

    // Click Valhalla tab
    await valhallaTab.click();
    await expect(page.locator('[role="tabpanel"]#panel-valhalla')).not.toHaveAttribute("hidden");

    // Click Active tab
    await activeTab.click();
    await expect(page.locator('[role="tabpanel"]#panel-active')).not.toHaveAttribute("hidden");

    // Click Hunt tab
    await huntTab.click();
    await expect(page.locator('[role="tabpanel"]#panel-hunt')).not.toHaveAttribute("hidden");

    // Click Howl tab
    await howlTab.click();
    await expect(page.locator('[role="tabpanel"]#panel-howl')).not.toHaveAttribute("hidden");
  });

  test("arrow right keyboard navigation respects new tab order", async ({ page }) => {
    await setupDashboard(page, [
      makeCard({ cardName: "Active" }),
      makeUrgentCard({ cardName: "Urgent" }),
      makePromoCard({ cardName: "Promo" }),
    ]);

    // Tab order: All → Valhalla → Active → Hunt → Howl
    const allTab = page.locator('button#tab-all');
    const valhallaTab = page.locator('button#tab-valhalla');
    const activeTab = page.locator('button#tab-active');
    const huntTab = page.locator('button#tab-hunt');
    const howlTab = page.locator('button#tab-howl');

    // Start at All
    await allTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(valhallaTab).toHaveAttribute("aria-selected", "true");

    // Navigate to Active
    await page.keyboard.press("ArrowRight");
    await expect(activeTab).toHaveAttribute("aria-selected", "true");

    // Navigate to Hunt
    await page.keyboard.press("ArrowRight");
    await expect(huntTab).toHaveAttribute("aria-selected", "true");

    // Navigate to Howl
    await page.keyboard.press("ArrowRight");
    await expect(howlTab).toHaveAttribute("aria-selected", "true");

    // Wrap around to All
    await page.keyboard.press("ArrowRight");
    await expect(allTab).toHaveAttribute("aria-selected", "true");
  });

  test("arrow left keyboard navigation respects new tab order (reverse)", async ({ page }) => {
    await setupDashboard(page, [
      makeCard({ cardName: "Active" }),
      makeUrgentCard({ cardName: "Urgent" }),
    ]);

    const allTab = page.locator('button#tab-all');
    const howlTab = page.locator('button#tab-howl');

    // Start at All, go left to wrap to Howl
    await allTab.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(howlTab).toHaveAttribute("aria-selected", "true");

    // Go left to Hunt
    const huntTab = page.locator('button#tab-hunt');
    await page.keyboard.press("ArrowLeft");
    await expect(huntTab).toHaveAttribute("aria-selected", "true");
  });

  test("AC3: mobile tab display matches new order", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await setupDashboard(page, [
      makeCard({ cardName: "Active 1" }),
      makeCard({ cardName: "Active 2" }),
      makeUrgentCard({ cardName: "Urgent 1" }),
      makePromoCard({ cardName: "Promo 1" }),
    ]);

    // Get all tab buttons
    const tabs = page.locator('[role="tab"]');
    const tabCount = await tabs.count();

    // Verify we have exactly 5 tabs on mobile
    expect(tabCount).toBe(5);

    // Extract labels in order
    const tabLabels: string[] = [];
    for (let i = 0; i < tabCount; i++) {
      const tab = tabs.nth(i);
      const text = await tab.textContent();
      const labelMatch = text?.match(/([A-Za-z\s]+)/);
      const label = labelMatch?.[1]?.trim() || "";
      if (label) tabLabels.push(label);
    }

    // Verify order is preserved on mobile
    expect(tabLabels).toEqual([
      "All",
      "Valhalla",
      "Active",
      "The Hunt",
      "The Howl",
    ]);
  });

  test("home/end keys navigate to first/last tab in new order", async ({ page }) => {
    await setupDashboard(page, [
      makeCard({ cardName: "Active" }),
      makeUrgentCard({ cardName: "Urgent" }),
    ]);

    const allTab = page.locator('button#tab-all');
    const howlTab = page.locator('button#tab-howl');

    // Start at any tab and press Home to go to All (first)
    await howlTab.focus();
    await page.keyboard.press("Home");
    await expect(allTab).toHaveAttribute("aria-selected", "true");

    // Press End to go to Howl (last)
    await page.keyboard.press("End");
    await expect(howlTab).toHaveAttribute("aria-selected", "true");
  });
});
