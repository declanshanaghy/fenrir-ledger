import { test, expect } from "@playwright/test";

/**
 * TC-450-01: Card Count Subtitle Removed from Dashboard
 *
 * Validates that the summary div containing the card count subtitle
 * has been completely removed from the dashboard page header.
 *
 * Acceptance Criteria:
 * - Card count subtitle removed from dashboard
 */
test.describe("TC-450-01: Card Count Subtitle Removed", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the dashboard
    await page.goto("/dashboard");
    // Wait for the page to fully load
    await page.waitForLoadState("networkidle");
  });

  test("should not display card count subtitle on dashboard", async ({
    page,
  }) => {
    // The summary div that contained card counts has been removed
    // Try to find any element that contains the card count pattern (e.g., "10 cards")
    // This should not exist after the removal

    // Look for text patterns that would indicate the summary is present
    const cardCountText = page.locator('text=/^\\d+\\s+(card|cards)$/');
    const needsAttentionText = page.locator('text=/need.*attention/i');

    // Neither the card count nor the "needs attention" text should appear
    // in the summary section (which no longer exists)
    await expect(cardCountText).toHaveCount(0);
    await expect(needsAttentionText).toHaveCount(0);
  });

  test("should not have the summary div block in page structure", async ({
    page,
  }) => {
    // Get the dashboard main content area
    const dashboardContent = page.locator("main, [role='main']");

    // Look for the specific structure that was removed:
    // <div className="flex items-center gap-6 mb-4 ...">
    const summaryDiv = page.locator(
      "div.flex.items-center.gap-6.mb-4.text-base.text-muted-foreground"
    );

    // Verify that the summary div does not exist
    await expect(summaryDiv).toHaveCount(0);
  });

  test("should still display tab bar with counts intact", async ({ page }) => {
    // The tab bar should still be present with its count badges
    // (e.g., "ALL 10", "VALHALLA 7", etc.)
    const tabBar = page.locator('[role="tablist"]');
    await expect(tabBar).toBeVisible();

    // Verify that tabs are present
    const tabs = page.locator('[role="tab"]');
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThan(0);
  });

  test("should verify page layout without redundant count summary", async ({
    page,
  }) => {
    // Take a visual snapshot to verify the layout is as expected
    // The dashboard should only show the tab bar with category counts,
    // not a separate summary header
    const main = page.locator("main");

    // Get the first visible text element after the page header
    // It should be the tab bar, not a summary section
    const pageContent = page.locator("body");
    const text = await pageContent.innerText();

    // The removed text patterns should not appear
    expect(text).not.toMatch(/^\d+\s+cards?$/m);
    expect(text).not.toMatch(/\d+\s+need.*attention/i);
  });
});
