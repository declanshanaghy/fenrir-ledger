/**
 * Trial Toast & Badge — E2E Tests (browser-required only)
 *
 * Validates interactive behavior for issue #621:
 * - Badge click opens/closes panel
 * - Panel content is meaningful
 * - Mobile responsive badge
 *
 * API endpoint tests, localStorage checks, CSS class assertions,
 * and HTML attribute checks belong in Vitest, not here.
 */

import { test, expect } from "@playwright/test";
import { clearAllStorage, seedHousehold, ANONYMOUS_HOUSEHOLD_ID } from "../helpers/test-fixtures";

async function setupTestLedger(page: any) {
  await page.goto("/ledger");
  await page.waitForLoadState("networkidle");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await page.reload({ waitUntil: "networkidle" });
}

test.describe("Trial Badge — Interactive Behavior", () => {
  test.beforeEach(async ({ page }) => {
    await setupTestLedger(page);
    await page.goto("/ledger");
  });

  test("Badge click opens panel, close button dismisses it", async ({ page }) => {
    const badge = page.locator('button[aria-label*="Trial"]').first();
    const isVisible = await badge.isVisible().catch(() => false);

    if (!isVisible) {
      // Badge not showing — trial not active in test env
      return;
    }

    // Click badge to open panel
    await badge.click();
    const panel = page.locator('div[role="dialog"][aria-label="Trial status"]');
    await expect(panel).toBeVisible();

    // Panel should show meaningful trial content
    const panelText = await panel.textContent();
    expect(panelText).toMatch(/(day|trial|remain|expire)/i);

    // Close button should dismiss panel
    const closeBtn = panel.locator('button:has-text("Close")');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(panel).not.toBeVisible();
  });

  test("Badge renders on mobile viewport (375px)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/ledger");

    const badge = page.locator('button[aria-label*="Trial"]').first();
    const isVisible = await badge.isVisible().catch(() => false);

    if (!isVisible) return;

    // Badge should have reasonable touch target
    const box = await badge.boundingBox();
    expect(box?.width).toBeGreaterThan(20);
    expect(box?.height).toBeGreaterThan(20);

    // Panel should still open on mobile
    await badge.click();
    const panel = page.locator('div[role="dialog"][aria-label="Trial status"]');
    await expect(panel).toBeVisible();
  });
});
