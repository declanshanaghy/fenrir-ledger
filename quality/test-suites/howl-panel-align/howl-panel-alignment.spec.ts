/**
 * Issue #152 + Issue #279: Dashboard alignment
 *
 * Updated for Issue #279: The HowlPanel sidebar has been replaced by a tab bar
 * inside the Dashboard component. The old "Howl panel top aligns with card grid"
 * tests are no longer applicable since there is no fixed right sidebar.
 *
 * This suite now validates that the tab bar and card grid alignment are correct
 * and that the dashboard layout is not broken by the redesign.
 *
 * Spec references:
 *   - development/frontend/src/components/dashboard/Dashboard.tsx
 *   - ux/wireframes/app/dashboard-tabs.html
 */

import { test, expect, type Page } from "@playwright/test";
import {
  clearAllStorage,
  seedCards,
  seedHousehold,
  makeUrgentCard,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

test.describe("Dashboard Layout — Issue #152/#279", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearAllStorage(page);
  });

  test("tab bar appears above card grid on desktop (tab bar y < card grid y)", async ({
    page,
  }) => {
    // Desktop lg breakpoint (1024px width)
    await page.setViewportSize({ width: 1280, height: 800 });

    // Setup household + urgent card so Howl tab is default
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [makeUrgentCard()]);
    await page.goto("/", { waitUntil: "networkidle" });

    // Wait for tab bar
    const tabList = page.locator('[role="tablist"][aria-label="Card dashboard tabs"]');
    await expect(tabList).toBeVisible({ timeout: 10000 });

    // Wait for card grid
    const cardGrid = page.locator('[role="tabpanel"]').first();
    await expect(cardGrid).toBeVisible();

    // Get bounding boxes
    const tabBox = await tabList.boundingBox();
    const gridBox = await cardGrid.boundingBox();

    expect(tabBox).toBeTruthy();
    expect(gridBox).toBeTruthy();

    if (tabBox && gridBox) {
      // Tab bar must appear above the panel content
      expect(tabBox.y + tabBox.height).toBeLessThanOrEqual(gridBox.y + 1);
    }
  });

  test("HowlPanel aside is NOT in the DOM (sidebar removed in Issue #279)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [makeUrgentCard()]);
    await page.goto("/", { waitUntil: "networkidle" });

    // The old aside panel must not exist
    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(howlPanel).not.toBeAttached();
  });

  test("tab bar layout is consistent across multiple viewport widths (desktop)", async ({
    page,
  }) => {
    const viewportWidths = [1280, 1440, 1920];

    for (const width of viewportWidths) {
      await page.goto("/");
      await clearAllStorage(page);
      await page.setViewportSize({ width, height: 800 });

      await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
      await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [makeUrgentCard()]);
      await page.goto("/", { waitUntil: "networkidle" });

      const tabList = page.locator('[role="tablist"][aria-label="Card dashboard tabs"]');
      await expect(tabList).toBeVisible({ timeout: 10000 });

      const tabListBox = await tabList.boundingBox();
      expect(tabListBox).toBeTruthy();
      if (tabListBox) {
        // Tab list should span the full content width (not clipped)
        expect(tabListBox.width).toBeGreaterThan(200);
      }
    }
  });

  test("tab bar is visible on mobile viewport (375px)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });

    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [makeUrgentCard()]);
    await page.goto("/", { waitUntil: "networkidle" });

    // Tab bar must be visible on mobile (not hidden like the old sidebar was)
    const tabList = page.locator('[role="tablist"][aria-label="Card dashboard tabs"]');
    await expect(tabList).toBeVisible();
  });

  test("no HowlPanel sticky sidebar exists — cards are not constrained to left column", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [makeUrgentCard()]);
    await page.goto("/", { waitUntil: "networkidle" });

    // Verify cards span the full content width (no sidebar pushing them left)
    const howlPanel = page.locator('[role="tabpanel"][id="panel-howl"]');
    await expect(howlPanel).not.toHaveAttribute("hidden");

    const panelBox = await howlPanel.boundingBox();
    expect(panelBox).not.toBeNull();
    // Panel should span at least 600px of width at 1280px viewport
    // (old layout with HowlPanel sidebar would have been constrained to ~800px)
    expect(panelBox!.width).toBeGreaterThan(600);
  });
});
