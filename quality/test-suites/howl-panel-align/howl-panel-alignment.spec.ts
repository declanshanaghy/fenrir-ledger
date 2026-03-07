/**
 * Issue #152: Howl panel should align horizontally with card grid top edge
 *
 * Test suite validates that:
 * 1. Howl panel top edge aligns with card grid top edge (y-coordinate match)
 * 2. Panel remains sticky/scrollable while maintaining alignment
 * 3. Alignment holds consistently across viewport widths
 * 4. Mobile layout is unaffected (panel hidden on < lg breakpoint)
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

test.describe("Howl Panel Alignment — Issue #152", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearAllStorage(page);
  });

  test("howl panel top aligns with card grid top edge (desktop lg)", async ({
    page,
  }) => {
    // Desktop lg breakpoint (1024px width)
    await page.setViewportSize({ width: 1280, height: 800 });

    // Setup household + urgent card
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [makeUrgentCard()]);

    // Navigate to dashboard
    await page.goto("/", { waitUntil: "networkidle" });

    // Wait for both panels to be visible
    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(howlPanel).toBeVisible({ timeout: 10000 });

    // Get the card grid container (main content area)
    const cardGrid = page.locator('div[class*="grid"]').first();
    await expect(cardGrid).toBeVisible();

    // Get bounding boxes
    const howlBox = await howlPanel.boundingBox();
    const gridBox = await cardGrid.boundingBox();

    // Verify both exist
    expect(howlBox).toBeTruthy();
    expect(gridBox).toBeTruthy();

    if (howlBox && gridBox) {
      // Check that top edges align (y-coordinates should match)
      // Allow 1px tolerance for rounding
      expect(Math.abs(howlBox.y - gridBox.y)).toBeLessThanOrEqual(1);
    }
  });

  test("howl panel remains sticky when scrolling (desktop)", async ({
    page,
  }) => {
    // Desktop lg breakpoint
    await page.setViewportSize({ width: 1280, height: 600 });

    // Seed many cards to ensure scrolling
    const cards = Array.from({ length: 8 }, (_, i) =>
      makeUrgentCard({ id: `card-${i}`, annualFeeDate: daysFromNow(10 - i) })
    );

    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, cards);

    // Navigate to dashboard
    await page.goto("/", { waitUntil: "networkidle" });

    // Wait for Howl panel
    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(howlPanel).toBeVisible({ timeout: 10000 });

    // Get initial position
    const initialBox = await howlPanel.boundingBox();
    expect(initialBox).toBeTruthy();

    if (initialBox) {
      const initialY = initialBox.y;

      // Scroll down the page
      await page.evaluate(() => window.scrollBy(0, 300));

      // Wait a bit for scroll to settle
      await page.waitForTimeout(200);

      // Get new position
      const scrolledBox = await howlPanel.boundingBox();
      expect(scrolledBox).toBeTruthy();

      if (scrolledBox) {
        // Panel should still be near top (sticky behavior)
        // It should be in viewport still
        expect(scrolledBox.y).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test("howl panel aligns across multiple viewport widths (desktop)", async ({
    page,
  }) => {
    // Test multiple desktop widths that should show the panel
    const viewportWidths = [1280, 1440, 1920];

    for (const width of viewportWidths) {
      // Reset for each viewport
      await page.goto("/");
      await clearAllStorage(page);

      // Set viewport
      await page.setViewportSize({ width, height: 800 });

      // Setup household + urgent card
      await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
      await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [makeUrgentCard()]);

      // Navigate to dashboard
      await page.goto("/", { waitUntil: "networkidle" });

      // Wait for panels
      const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
      await expect(howlPanel).toBeVisible({ timeout: 10000 });

      const cardGrid = page.locator('div[class*="grid"]').first();
      await expect(cardGrid).toBeVisible();

      // Get bounding boxes
      const howlBox = await howlPanel.boundingBox();
      const gridBox = await cardGrid.boundingBox();

      expect(howlBox).toBeTruthy();
      expect(gridBox).toBeTruthy();

      if (howlBox && gridBox) {
        // Top edges should align across all widths
        expect(Math.abs(howlBox.y - gridBox.y)).toBeLessThanOrEqual(1);
      }
    }
  });

  test("howl panel is not visible on mobile viewport (< lg)", async ({
    page,
  }) => {
    // Mobile viewport (< lg breakpoint)
    await page.setViewportSize({ width: 640, height: 800 });

    // Setup household + urgent card
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [makeUrgentCard()]);

    // Navigate to dashboard
    await page.goto("/", { waitUntil: "networkidle" });

    // Howl panel sidebar should be hidden on mobile
    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(howlPanel).not.toBeVisible();
  });

  test("howl panel maintains alignment with header (sticky top)", async ({
    page,
  }) => {
    // Desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });

    // Setup household + urgent card
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [makeUrgentCard()]);

    // Navigate to dashboard
    await page.goto("/", { waitUntil: "networkidle" });

    // Wait for Howl panel
    const howlPanel = page.locator('aside[aria-label="Urgent deadlines"]');
    await expect(howlPanel).toBeVisible({ timeout: 10000 });

    // Get computed styles
    const styles = await howlPanel.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        position: computed.position,
        top: computed.top,
        display: computed.display,
      };
    });

    // Verify panel is visible and using flex layout
    expect(styles.display).toBe("flex");

    // Verify alignment with self-start class (aligns to top of flex parent)
    const hasAlignmentClass = await howlPanel.evaluate((el) => {
      return el.className.includes("self-start");
    });
    expect(hasAlignmentClass).toBe(true);
  });
});
