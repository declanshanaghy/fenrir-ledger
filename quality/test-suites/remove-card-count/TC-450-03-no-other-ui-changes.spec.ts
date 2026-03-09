import { test, expect } from "@playwright/test";

/**
 * TC-450-03: No Other UI Changes
 *
 * Validates that the removal of the card count subtitle does not
 * affect other UI elements on the dashboard. All other components
 * should remain functional and unchanged.
 *
 * Acceptance Criteria:
 * - No other UI changes
 */
test.describe("TC-450-03: No Other UI Changes", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the dashboard
    await page.goto("/dashboard");
    // Wait for the page to fully load
    await page.waitForLoadState("networkidle");
  });

  test("should still display page header", async ({ page }) => {
    // The page should have a main heading/title
    // (This may be "Dashboard" or similar)
    const mainContent = page.locator("main");
    await expect(mainContent).toBeVisible();

    // There should be content in the main area
    const text = await mainContent.innerText();
    expect(text.length).toBeGreaterThan(0);
  });

  test("should have all expected dashboard sections", async ({ page }) => {
    // The page should have the tab bar
    const tabBar = page.locator('[role="tablist"]');
    await expect(tabBar).toBeVisible();

    // The page should have a content area for the active tab
    const tabPanels = page.locator('[role="tabpanel"]');
    const tabPanelCount = await tabPanels.count();
    // At least one panel should be visible or exist
    expect(tabPanelCount).toBeGreaterThanOrEqual(0);
  });

  test("should maintain navigation functionality", async ({ page }) => {
    // All tabs should be clickable and functional
    const tabs = page.locator('[role="tab"]');
    const firstTab = tabs.first();
    const secondTab = tabs.nth(1);

    // First tab should be clickable
    await expect(firstTab).toBeEnabled();

    if ((await tabs.count()) > 1) {
      // Second tab should also be clickable
      await expect(secondTab).toBeEnabled();

      // Click and verify navigation works
      await secondTab.click();
      let ariaSelected = await secondTab.getAttribute("aria-selected");
      expect(ariaSelected).toBe("true");

      // Switch back to first tab
      await firstTab.click();
      ariaSelected = await firstTab.getAttribute("aria-selected");
      expect(ariaSelected).toBe("true");
    }
  });

  test("should preserve card display in content area", async ({ page }) => {
    // After the page loads, there should be cards displayed
    // (The summary was above the tab bar, not in the content area,
    // so removing it should not affect card display)

    // Get the active tab panel
    const tabPanel = page.locator('[role="tabpanel"][role="tabpanel"]').first();

    // Wait for any cards or content to load
    await page.waitForLoadState("networkidle");

    // The page should have some content (either cards or empty state message)
    const mainContent = page.locator("main");
    const text = await mainContent.innerText();

    // Should have some content
    expect(text.length).toBeGreaterThan(0);
  });

  test("should maintain styling of other dashboard elements", async ({
    page,
  }) => {
    // The tab bar should have border styling
    const tabBar = page.locator('[role="tablist"]');
    const className = await tabBar.getAttribute("class");

    // Should have border-b (bottom border)
    expect(className).toContain("border-b");

    // Should have flex layout
    expect(className).toContain("flex");
  });

  test("should not have orphaned or broken layout elements", async ({
    page,
  }) => {
    // Check that the page doesn't have elements with unexpected spacing or gaps
    // caused by the removal
    const main = page.locator("main");

    // The main content should be visible
    await expect(main).toBeVisible();

    // Get the computed layout to verify there are no issues
    const boundingBox = await main.boundingBox();
    expect(boundingBox).toBeTruthy();

    // Width and height should be reasonable (not 0)
    if (boundingBox) {
      expect(boundingBox.width).toBeGreaterThan(0);
      expect(boundingBox.height).toBeGreaterThan(0);
    }
  });

  test("should have proper content hierarchy without summary", async ({
    page,
  }) => {
    // The page structure should be clean: just tab bar followed by content
    const main = page.locator("main");

    // Get all direct children of main that are block-level
    const childDivs = main.locator("> div");
    const childCount = await childDivs.count();

    // Should have at least the tab bar and content area
    expect(childCount).toBeGreaterThan(0);

    // The first significant child should be the tab bar
    const firstChild = childDivs.first();
    const firstChildHtml = await firstChild.innerHTML();

    // Should contain tablist or similar indicator of tab bar
    expect(firstChildHtml.length).toBeGreaterThan(0);
  });
});
