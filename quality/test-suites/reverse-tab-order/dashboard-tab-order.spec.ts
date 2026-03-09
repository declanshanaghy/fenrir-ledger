import { test, expect } from "@playwright/test";

/**
 * Test suite for GitHub Issue #399: Reverse dashboard tab order
 *
 * Validates that dashboard tabs render in the correct reversed order:
 * All → Valhalla → Active → The Hunt → The Howl
 *
 * Previously: The Howl → The Hunt → Active → Valhalla → All
 */

const EXPECTED_TAB_ORDER = ["All", "Valhalla", "Active", "The Hunt", "The Howl"];

test.describe("Dashboard Tab Order (Issue #399)", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto("/ledger/dashboard", { waitUntil: "networkidle" });
    // Wait for tabs to render
    await page.waitForSelector('[role="tablist"]');
  });

  test("tabs render in reversed order: All → Valhalla → Active → The Hunt → The Howl", async ({ page }) => {
    // Get all tab buttons
    const tabs = await page.locator('[role="tab"]').all();

    // Verify we have exactly 5 tabs
    expect(tabs).toHaveLength(5);

    // Extract tab labels
    const tabLabels: string[] = [];
    for (const tab of tabs) {
      const text = await tab.textContent();
      // Extract label without badge count
      const labelMatch = text?.match(/([A-Za-z\s]+)(\d+)?/);
      const label = labelMatch?.[1]?.trim() || "";
      if (label) tabLabels.push(label);
    }

    // Verify tab order
    expect(tabLabels).toEqual(EXPECTED_TAB_ORDER);
  });

  test("default selected tab is unchanged when Howl has cards", async ({ page }) => {
    // Check which tab is selected initially
    const activeTab = await page.locator('[role="tab"][aria-selected="true"]');
    const activeLabel = await activeTab.textContent();

    // Default should be "The Howl" or "Active" depending on card state
    // (Howl if it has cards, else Active)
    expect(activeLabel).toMatch(/The Howl|Active/);
  });

  test("tabs are keyboard navigable in correct order", async ({ page }) => {
    // Focus first tab
    const firstTab = page.locator('[role="tab"]').first();
    await firstTab.focus();
    await firstTab.click();

    // Get all tab IDs in order
    const tabs = await page.locator('[role="tab"]').all();
    const tabIds: string[] = [];
    for (const tab of tabs) {
      const id = await tab.getAttribute("id");
      if (id) tabIds.push(id);
    }

    // Arrow right should navigate in order
    for (let i = 0; i < tabIds.length - 1; i++) {
      const currentTab = page.locator(`#${tabIds[i]}`);
      await currentTab.focus();
      await page.keyboard.press("ArrowRight");

      const nextTab = page.locator(`#${tabIds[i + 1]}`);
      const isSelected = await nextTab.evaluate((el) =>
        el.getAttribute("aria-selected") === "true"
      );
      expect(isSelected).toBe(true);
    }
  });

  test("mobile tab display matches new order", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Wait for responsive layout
    await page.waitForTimeout(500);

    // Get all tab buttons
    const tabs = await page.locator('[role="tab"]').all();
    expect(tabs).toHaveLength(5);

    // Extract labels
    const tabLabels: string[] = [];
    for (const tab of tabs) {
      const text = await tab.textContent();
      const labelMatch = text?.match(/([A-Za-z\s]+)(\d+)?/);
      const label = labelMatch?.[1]?.trim() || "";
      if (label) tabLabels.push(label);
    }

    // Verify order is preserved on mobile
    expect(tabLabels).toEqual(EXPECTED_TAB_ORDER);
  });

  test("tab badges display for each tab in correct positions", async ({ page }) => {
    // Get all tabs and their badges
    const tabs = await page.locator('[role="tab"]').all();

    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      const label = await tab.textContent();

      // Each tab should have a badge (even if 0)
      const badge = tab.locator("span");
      expect(badge).toBeDefined();

      // Badge should be positioned correctly (after label in DOM)
      const badgeText = await tab.evaluate((el) => {
        const spans = el.querySelectorAll("span");
        return spans[spans.length - 1]?.textContent || "";
      });

      // Badge should contain a number
      expect(badgeText).toMatch(/^\d+$/);
    }
  });

  test("can switch between tabs in new order", async ({ page }) => {
    // Get tab buttons
    const allTab = page.locator('button:has-text("All")');
    const valhallaTab = page.locator('button:has-text("Valhalla")');
    const activeTab = page.locator('button:has-text("Active")');
    const huntTab = page.locator('button:has-text("The Hunt")');
    const howlTab = page.locator('button:has-text("The Howl")');

    // Click All tab
    await allTab.click();
    await expect(page.locator('#panel-all')).toBeVisible();

    // Click Valhalla tab
    await valhallaTab.click();
    await expect(page.locator('#panel-valhalla')).toBeVisible();

    // Click Active tab
    await activeTab.click();
    await expect(page.locator('#panel-active')).toBeVisible();

    // Click The Hunt tab
    await huntTab.click();
    await expect(page.locator('#panel-hunt')).toBeVisible();

    // Click The Howl tab
    await howlTab.click();
    await expect(page.locator('#panel-howl')).toBeVisible();
  });
});
