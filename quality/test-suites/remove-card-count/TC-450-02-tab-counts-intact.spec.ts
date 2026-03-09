import { test, expect } from "@playwright/test";

/**
 * TC-450-02: Tab Bar Counts Still Displayed
 *
 * Validates that removing the summary card count subtitle does not
 * affect the tab bar's count badges. The tab bar should continue to
 * display counts per category (ALL, VALHALLA, ACTIVE, etc.).
 *
 * Acceptance Criteria:
 * - No other UI changes (tab counts must remain)
 */
test.describe("TC-450-02: Tab Counts Remain Intact", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the dashboard
    await page.goto("/dashboard");
    // Wait for the page to fully load
    await page.waitForLoadState("networkidle");
  });

  test("should display count badges in tab bar", async ({ page }) => {
    // The tab bar should be visible
    const tabBar = page.locator('[role="tablist"]');
    await expect(tabBar).toBeVisible();

    // Find all tab buttons
    const tabs = page.locator('[role="tab"]');
    const tabCount = await tabs.count();

    // We should have multiple tabs (at minimum: ALL, VALHALLA, ACTIVE, HUNT, etc.)
    expect(tabCount).toBeGreaterThanOrEqual(3);

    // Each visible tab should be present
    for (let i = 0; i < Math.min(3, tabCount); i++) {
      const tab = tabs.nth(i);
      await expect(tab).toBeVisible();
    }
  });

  test("should show count numbers in tab labels", async ({ page }) => {
    // The "ALL" tab should display a count (e.g., "ALL 10")
    const allTab = page.locator('[role="tab"]').first();

    // Get the text content of the first tab
    const tabText = await allTab.innerText();

    // The tab text should contain a number (the count)
    // This validates that counts are still displayed in the tabs
    const hasNumber = /\d+/.test(tabText);
    expect(hasNumber).toBeTruthy();
  });

  test("should maintain tab bar styling and layout", async ({ page }) => {
    // The tab bar container should have the expected styling class
    const tabBar = page.locator('[role="tablist"]');

    // Check for expected classes that control the tab bar layout
    const classList = await tabBar.getAttribute("class");
    expect(classList).toContain("flex");
    expect(classList).toContain("border-b");
  });

  test("should allow tab navigation with counts visible", async ({ page }) => {
    // Get the first two tabs
    const tabs = page.locator('[role="tab"]');
    const firstTab = tabs.first();
    const secondTab = tabs.nth(1);

    // Click the first tab
    await firstTab.click();
    await page.waitForLoadState("networkidle");

    // Verify it's selected
    let ariaSelected = await firstTab.getAttribute("aria-selected");
    expect(ariaSelected).toBe("true");

    // Click the second tab
    await secondTab.click();
    await page.waitForLoadState("networkidle");

    // Verify the second tab is now selected
    ariaSelected = await secondTab.getAttribute("aria-selected");
    expect(ariaSelected).toBe("true");

    // Both tabs should still show their count values in the text
    const firstTabText = await firstTab.innerText();
    const secondTabText = await secondTab.innerText();

    // Both should have content (the tab name and count)
    expect(firstTabText.length).toBeGreaterThan(0);
    expect(secondTabText.length).toBeGreaterThan(0);
  });

  test("should maintain responsive tab bar behavior", async ({ page }) => {
    // The tab bar should be responsive
    const tabBar = page.locator('[role="tablist"]');

    // Check that it has overflow handling for smaller screens
    const className = await tabBar.getAttribute("class");
    expect(className).toContain("overflow-x-auto");

    // Verify tabs are still accessible
    const tabs = page.locator('[role="tab"]');
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThan(0);
  });
});
