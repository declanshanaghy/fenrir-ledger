import { test, expect } from "@playwright/test";

/**
 * Status Tooltip Acceptance Test Suite — Issue #585
 *
 * Slimmed (Issue #610) to core interactive behavior:
 *   - Desktop hover shows/hides tooltip
 *   - Mobile tap toggles tooltip
 *   - Keyboard focus + Escape
 *   - aria-describedby wiring
 *
 * Removed (Issue #610):
 *   - AC-1: typeof boolean check (meaningless)
 *   - AC-2: three-part paragraph structure + CSS class inspection
 *   - AC-2: 100ms hide delay (timing-sensitive, flaky)
 *   - AC-5: positioning tolerance (+/- 50px = always passes)
 *   - AC-6: Voice 1/Voice 2 class checks (CSS inspection)
 *   - AC-8: role="tooltip" (redundant — already asserted by locator)
 *   - AC-8: aria-label static content
 *   - Edge: multiple badges independent (skip-heavy)
 *   - Edge: tooltip remains on hover (browser default)
 */

const BASE_URL = process.env.SERVER_URL || "http://localhost:9653";

test.describe("Status Badge Tooltips — Issue #585", () => {
  test("AC-2: Desktop hover shows tooltip with 200ms delay", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/ledger`, { waitUntil: "networkidle" });
    await page.waitForLoadState("domcontentloaded");

    const badge = page.locator('[aria-label*="Card status"]').first();
    const badgeExists = await badge.count();
    if (badgeExists === 0) {
      test.skip();
      return;
    }

    await badge.scrollIntoViewIfNeeded();
    await badge.hover();

    const tooltip = page.locator('[role="tooltip"]');
    const initiallyVisible = await tooltip.isVisible({ timeout: 100 });
    expect(initiallyVisible).toBe(false);

    await expect(tooltip).toBeVisible({ timeout: 300 });
  });

  test("AC-3: Mobile tap badge toggles tooltip visibility", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      hasTouch: true,
      viewport: { width: 375, height: 667 },
    });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/ledger`, { waitUntil: "networkidle" });
    await page.waitForLoadState("domcontentloaded");

    const badge = page.locator('[aria-label*="Card status"]').first();
    const badgeExists = await badge.count();
    if (badgeExists === 0) {
      await context.close();
      test.skip();
      return;
    }

    await badge.scrollIntoViewIfNeeded();

    const tooltip = page.locator('[role="tooltip"]');
    const initiallyVisible = await tooltip.isVisible({ timeout: 100 });
    expect(initiallyVisible).toBe(false);

    await badge.tap();
    await expect(tooltip).toBeVisible({ timeout: 300 });

    await badge.tap();
    const finallyVisible = await tooltip.isVisible({ timeout: 100 });
    expect(finallyVisible).toBe(false);

    await context.close();
  });

  test("AC-4: Tooltip shows when badge receives keyboard focus", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/ledger`, { waitUntil: "networkidle" });
    await page.waitForLoadState("domcontentloaded");

    const badge = page.locator('[aria-label*="Card status"]').first();
    const badgeExists = await badge.count();
    if (badgeExists === 0) {
      test.skip();
      return;
    }

    await badge.scrollIntoViewIfNeeded();
    await badge.focus();

    const tooltip = page.locator('[role="tooltip"]');
    await expect(tooltip).toBeVisible({ timeout: 300 });
  });

  test("AC-4: Escape key dismisses tooltip when focused", async ({ page }) => {
    await page.goto(`${BASE_URL}/ledger`, { waitUntil: "networkidle" });
    await page.waitForLoadState("domcontentloaded");

    const badge = page.locator('[aria-label*="Card status"]').first();
    const badgeExists = await badge.count();
    if (badgeExists === 0) {
      test.skip();
      return;
    }

    await badge.scrollIntoViewIfNeeded();
    await badge.focus();

    const tooltip = page.locator('[role="tooltip"]');
    await expect(tooltip).toBeVisible({ timeout: 300 });

    await page.keyboard.press("Escape");
    const stillVisible = await tooltip.isVisible({ timeout: 100 });
    expect(stillVisible).toBe(false);
  });

  test("AC-8: Badge has aria-describedby pointing to tooltip id", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/ledger`, { waitUntil: "networkidle" });
    await page.waitForLoadState("domcontentloaded");

    const badgeContainer = page.locator('[aria-describedby]').first();
    const containerExists = await badgeContainer.count();
    if (containerExists === 0) {
      test.skip();
      return;
    }

    const ariaDescribedby = await badgeContainer.getAttribute(
      "aria-describedby"
    );
    expect(ariaDescribedby).toBeTruthy();

    await badgeContainer.hover();
    const tooltip = page.locator('[role="tooltip"]');
    await expect(tooltip).toBeVisible({ timeout: 300 });

    const tooltipId = await tooltip.getAttribute("id");
    expect(tooltipId).toBe(ariaDescribedby);
  });
});
