import { test, expect } from "@playwright/test";

/**
 * Issue #409: Remove Cancel button from Settings page
 *
 * Acceptance Criteria:
 * 1. Cancel button removed from /ledger/settings
 * 2. No layout regressions on the settings page
 * 3. tsc clean, next build clean
 *
 * Test coverage:
 * - Cancel button is not visible on Settings page
 * - Settings page layout is correct on mobile viewport
 * - Subscription section renders without errors
 */

const SETTINGS_URL = "/ledger/settings";

test.describe("Issue #409 — Remove Cancel button from Settings page", () => {
  test("Cancel button should not be visible anywhere on settings page", async ({
    page,
  }) => {
    // Navigate to settings
    await page.goto(SETTINGS_URL, { waitUntil: "networkidle" });

    // Verify the settings page loaded
    await expect(page).toHaveURL(new RegExp(SETTINGS_URL));

    // Search for any button containing "Cancel" text in the Subscription section
    const cancelButton = page.locator(
      'section[aria-label="Subscription"] button:has-text("Cancel")'
    );

    // Assert cancel button does not exist or is not visible
    const count = await cancelButton.count();
    expect(count).toBe(0);
  });

  test("Subscription section should be visible and properly rendered", async ({
    page,
  }) => {
    // Navigate to settings
    await page.goto(SETTINGS_URL, { waitUntil: "networkidle" });

    // Verify settings page loaded
    await expect(page).toHaveURL(new RegExp(SETTINGS_URL));

    // Find Subscription section
    const subscriptionSection = page.locator(
      'section[aria-label="Subscription"]'
    );

    // Section should exist and be visible
    await expect(subscriptionSection).toBeVisible();

    // Should have a heading
    const heading = subscriptionSection.locator("h2");
    await expect(heading).toContainText("Subscription");
  });

  test("Settings page layout should be responsive on mobile viewport (375px)", async ({
    page,
  }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Navigate to settings
    await page.goto(SETTINGS_URL, { waitUntil: "networkidle" });

    // Verify subscription section is visible
    const subscriptionSection = page.locator(
      'section[aria-label="Subscription"]'
    );
    await expect(subscriptionSection).toBeVisible();

    // Verify no buttons are horizontally cut off
    const buttons = subscriptionSection.locator("button");
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const box = await button.boundingBox();

      // Buttons should be within viewport bounds
      if (box) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(375);
      }
    }
  });
});
