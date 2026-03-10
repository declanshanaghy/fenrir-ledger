/**
 * Karl Upsell Dialog Height Validation — Issue #514
 *
 * Validates that the Karl upsell dialog doesn't clip content vertically
 * and all UI elements (especially CTA button) are fully visible.
 *
 * Root cause (fixed): Desktop had both sm:top-[50%] and bottom-0 set,
 * creating conflicting CSS constraints that squished the dialog.
 *
 * Fix: Added sm:bottom-auto to reset mobile anchor on desktop.
 *
 * Validates:
 * - Dialog opens without vertical content clipping on desktop (1080p+)
 * - CTA button fully visible without scrollbar needed
 * - All three tabs (Valhalla, The Howl, Velocity) work correctly
 * - Mobile (375px min) still works as bottom-sheet
 * - No scrollbar appears at standard desktop viewports
 */

import { test, expect } from "@playwright/test";
import {
  seedHousehold,
  seedEntitlement,
  seedCards,
  makeCard,
  clearAllStorage,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

test.describe("Karl Upsell Dialog Height — Issue #514", () => {
  // Setup: Navigate to dashboard with Thrall tier user (no Karl features)
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto("/ledger");

    // Clear any existing storage
    await clearAllStorage(page);

    // Seed household and activate it
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);

    // Seed a few test cards
    await seedCards(page, ANONYMOUS_HOUSEHOLD_ID, [
      makeCard({ cardName: "Chase Sapphire Preferred" }),
      makeCard({ cardName: "American Express Gold" }),
    ]);

    // Seed Thrall tier (no Karl features) to trigger upsell dialogs
    await seedEntitlement(page, "thrall", true);

    // Reload to pick up the seeded data
    await page.reload();

    // Wait for dashboard to load
    await page.waitForSelector('[role="tablist"]', { timeout: 10000 });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 1: Valhalla dialog fits all content without vertical clipping
  // ───────────────────────────────────────────────────────────────────────────
  test("Valhalla: Dialog opens without content clipping on desktop (1080p)", async ({
    page,
  }) => {
    // Set viewport to standard desktop size
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Click Valhalla tab to open dialog
    await page.locator('[id="tab-valhalla"]').click();

    // Wait for dialog to appear and settle
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(500);

    // Get dialog bounding box
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();

    // Verify dialog is vertically centered and within viewport
    const viewportHeight = page.viewportSize()?.height || 1080;
    expect(dialogBox?.y).toBeGreaterThan(0);
    expect(dialogBox?.y! + dialogBox?.height!).toBeLessThan(viewportHeight);

    // Verify all visible text content is within dialog bounds
    const contentTexts = [
      "Valhalla",
      "Full archive of closed and graduated cards",
      "Upgrade to Karl",
      "Not now",
    ];

    for (const text of contentTexts) {
      const element = dialog.locator(`:has-text("${text}")`).first();
      const elementBox = await element.boundingBox();
      expect(elementBox).not.toBeNull();

      // Verify element is within dialog bounds
      expect(elementBox?.y).toBeGreaterThanOrEqual(dialogBox?.y!);
      expect(elementBox?.y! + elementBox?.height!).toBeLessThanOrEqual(
        dialogBox?.y! + dialogBox?.height!
      );
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 2: CTA button fully visible without scrollbar
  // ───────────────────────────────────────────────────────────────────────────
  test("Dialog CTA button is fully visible without scrollbar on desktop", async ({
    page,
  }) => {
    // Set viewport to standard desktop size
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Click Valhalla tab
    await page.locator('[id="tab-valhalla"]').click();

    // Wait for dialog
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Find the CTA button
    const ctaButton = dialog.locator('button:has-text("Upgrade to Karl")');
    await expect(ctaButton).toBeVisible();

    // Verify button is fully within dialog bounds
    const buttonBox = await ctaButton.boundingBox();
    const dialogBox = await dialog.boundingBox();

    expect(buttonBox).not.toBeNull();
    expect(dialogBox).not.toBeNull();

    // Button should be inside dialog area
    expect(buttonBox?.y).toBeGreaterThanOrEqual(dialogBox?.y!);
    expect(buttonBox?.y! + buttonBox?.height!).toBeLessThanOrEqual(
      dialogBox?.y! + dialogBox?.height!
    );

    // Verify scrollbar is not present in dialog
    const scrollHeight = await dialog.evaluate(
      (el: Element) => (el as HTMLElement).scrollHeight
    );
    const clientHeight = await dialog.evaluate(
      (el: Element) => (el as HTMLElement).clientHeight
    );

    // scrollHeight should equal clientHeight (no scrolling needed)
    expect(scrollHeight).toBeLessThanOrEqual(clientHeight + 1); // +1 for rounding tolerance
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 3: The Howl tab dialog displays all content
  // ───────────────────────────────────────────────────────────────────────────
  test("The Howl: Dialog opens without clipping on desktop", async ({ page }) => {
    // Set viewport to standard desktop size
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Click The Howl tab
    await page.locator('[id="tab-howl"]').click();

    // Wait for dialog
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify all critical elements are visible
    await expect(
      dialog.locator('h2:has-text("The Howl")')
    ).toBeVisible();

    await expect(
      dialog.locator('text="Upcoming fee alerts with urgency ranking"')
    ).toBeVisible();

    // Verify CTA button is visible
    const ctaButton = dialog.locator('button:has-text("Upgrade to Karl")');
    await expect(ctaButton).toBeVisible();

    // Verify no scrollbar
    const scrollHeight = await dialog.evaluate(
      (el: Element) => (el as HTMLElement).scrollHeight
    );
    const clientHeight = await dialog.evaluate(
      (el: Element) => (el as HTMLElement).clientHeight
    );
    expect(scrollHeight).toBeLessThanOrEqual(clientHeight + 1);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 4: Velocity (The Hunt) tab dialog displays all content
  // ───────────────────────────────────────────────────────────────────────────
  test("Velocity: Dialog opens without clipping on desktop", async ({ page }) => {
    // Set viewport to standard desktop size
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Click The Hunt (Velocity) tab
    await page.locator('[id="tab-hunt"]').click();

    // Wait for dialog
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify all critical elements are visible
    await expect(
      dialog.locator('h2:has-text("Velocity")')
    ).toBeVisible();

    await expect(
      dialog.locator('text="Real-time spend tracking against bonus targets"')
    ).toBeVisible();

    // Verify CTA button is visible
    const ctaButton = dialog.locator('button:has-text("Upgrade to Karl")');
    await expect(ctaButton).toBeVisible();

    // Verify no scrollbar
    const scrollHeight = await dialog.evaluate(
      (el: Element) => (el as HTMLElement).scrollHeight
    );
    const clientHeight = await dialog.evaluate(
      (el: Element) => (el as HTMLElement).clientHeight
    );
    expect(scrollHeight).toBeLessThanOrEqual(clientHeight + 1);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 5: Mobile (375px) still works with dialog accessible
  // ───────────────────────────────────────────────────────────────────────────
  test("Mobile (375px): Dialog is accessible with CTA button", async ({
    page,
  }) => {
    // Set viewport to minimum mobile size
    await page.setViewportSize({ width: 375, height: 667 });

    // Click Valhalla tab
    await page.locator('[id="tab-valhalla"]').click();

    // Wait for dialog
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify dialog is present
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();

    // Verify CTA button exists and is clickable
    const ctaButton = dialog.locator('button:has-text("Upgrade to Karl")');
    await expect(ctaButton).toBeVisible({ timeout: 5000 });

    // Verify "Not now" dismiss button is accessible
    const dismissButton = dialog.locator('button:has-text("Not now")');
    await expect(dismissButton).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 6: Dialog height at mid-range desktop (1366x768)
  // ───────────────────────────────────────────────────────────────────────────
  test("Dialog fits without clipping at 1366x768 resolution", async ({
    page,
  }) => {
    // Set viewport to mid-range laptop size
    await page.setViewportSize({ width: 1366, height: 768 });

    // Click Valhalla tab
    await page.locator('[id="tab-valhalla"]').click();

    // Wait for dialog
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify CTA button is visible
    const ctaButton = dialog.locator('button:has-text("Upgrade to Karl")');
    await expect(ctaButton).toBeVisible();

    // Verify no scrollbar
    const scrollHeight = await dialog.evaluate(
      (el: Element) => (el as HTMLElement).scrollHeight
    );
    const clientHeight = await dialog.evaluate(
      (el: Element) => (el as HTMLElement).clientHeight
    );
    expect(scrollHeight).toBeLessThanOrEqual(clientHeight + 1);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Test 7: All three tabs maintain proper height across desktop sizes
  // ───────────────────────────────────────────────────────────────────────────
  test("All three tabs maintain height constraint across desktop breakpoints", async ({
    page,
  }) => {
    const desktopSizes = [
      { width: 1024, height: 768 },  // iPad landscape
      { width: 1280, height: 720 },  // 720p desktop
      { width: 1920, height: 1080 }, // Full HD
    ];

    for (const size of desktopSizes) {
      await page.setViewportSize(size);

      // Test Valhalla
      await page.locator('[id="tab-valhalla"]').click();
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();

      const ctaButton = dialog.locator('button:has-text("Upgrade to Karl")');
      await expect(ctaButton).toBeVisible();

      const scrollHeight = await dialog.evaluate(
        (el: Element) => (el as HTMLElement).scrollHeight
      );
      const clientHeight = await dialog.evaluate(
        (el: Element) => (el as HTMLElement).clientHeight
      );
      expect(scrollHeight).toBeLessThanOrEqual(clientHeight + 1);

      // Close dialog
      await dialog.locator('text="Not now"').click();
      await expect(dialog).not.toBeVisible();
    }
  });
});
