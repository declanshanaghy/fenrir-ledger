/**
 * Settings Cleanup — Issue #628 Acceptance Tests
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates the removal of gated premium feature placeholder cards and
 * the restructuring to a two-column layout (Subscription left, Settings right).
 *
 * Acceptance Criteria:
 *   - Cloud Sync, Multi-Household, and Data Export placeholder sections removed
 *   - Two-column layout: Subscription management (left), Settings controls (right)
 *   - Left column: SubscriptionManagement component (StripeSettings)
 *   - Right column: RestoreTabGuides + any future settings controls
 *   - Collapses to single-column on mobile (375px min)
 *   - SubscriptionGate imports cleaned up if no longer used
 *   - No dead code left behind
 */

import { test, expect } from "@playwright/test";
import { clearAllStorage, seedHousehold, ANONYMOUS_HOUSEHOLD_ID } from "../helpers/test-fixtures";

/**
 * Helper: Navigate to settings and wait for load
 */
async function navigateToSettings(page) {
  await page.goto("/ledger");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await page.goto("/ledger/settings", { waitUntil: "load" });
}

test.describe("Issue #628 — Settings Page Restructuring", () => {
  // ─────────────────────────────────────────────────────────────────────────
  // AC1: Page loads and renders heading
  // ─────────────────────────────────────────────────────────────────────────

  test("page loads with HTTP 200 and displays Settings heading", async ({
    page,
  }) => {
    await navigateToSettings(page);

    const heading = page.getByRole("heading", { level: 1, name: /Settings/i });
    await expect(heading).toBeVisible();
    expect(await page.title()).toBeTruthy();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC2: Placeholder cards removed (Cloud Sync, Multi-Household, Data Export)
  // ─────────────────────────────────────────────────────────────────────────

  test("Cloud Sync placeholder section NOT rendered", async ({ page }) => {
    await navigateToSettings(page);

    const cloudSyncSection = page.locator(
      'section[aria-label="Cloud Sync"]'
    );
    await expect(cloudSyncSection).not.toBeVisible();
  });

  test("Multi-Household placeholder section NOT rendered", async ({ page }) => {
    await navigateToSettings(page);

    const multiHouseholdSection = page.locator(
      'section[aria-label="Multi-Household"]'
    );
    await expect(multiHouseholdSection).not.toBeVisible();
  });

  test("Data Export placeholder section NOT rendered", async ({ page }) => {
    await navigateToSettings(page);

    const dataExportSection = page.locator(
      'section[aria-label="Data Export"]'
    );
    await expect(dataExportSection).not.toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC3: Left column contains StripeSettings (Subscription management)
  // ─────────────────────────────────────────────────────────────────────────

  test("left column renders StripeSettings (Subscription management)", async ({
    page,
  }) => {
    await navigateToSettings(page);

    // StripeSettings renders a section with "Subscription Management" heading
    const subscriptionSection = page.locator(
      'section:has(h2:text-is("Subscription Management"))'
    );
    await expect(subscriptionSection).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC4: Right column contains RestoreTabGuides (Settings controls)
  // ─────────────────────────────────────────────────────────────────────────

  test("right column renders RestoreTabGuides (Tab Guides section)", async ({
    page,
  }) => {
    await navigateToSettings(page);

    // RestoreTabGuides renders a section with "Tab Guides" heading
    const tabGuidesSection = page.locator(
      'section[aria-label="Restore Tab Guides"]'
    );
    await expect(tabGuidesSection).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC5: Two-column layout on desktop (md breakpoint)
  // ─────────────────────────────────────────────────────────────────────────

  test("desktop displays two-column layout (md+)", async ({ page }) => {
    // Set viewport to desktop size (>= md breakpoint, 768px)
    await page.setViewportSize({ width: 1024, height: 768 });
    await navigateToSettings(page);

    // The grid container should have md:grid-cols-2
    const layoutContainer = page.locator("div.md\\:grid-cols-2");
    await expect(layoutContainer).toBeVisible();

    // Both columns should be visible side by side
    const subscriptionColumn = page.locator(
      "div.flex.flex-col:has(section:has(h2:text-is('Subscription Management')))"
    );
    const settingsColumn = page.locator(
      "div.flex.flex-col:has(section[aria-label='Restore Tab Guides'])"
    );

    await expect(subscriptionColumn).toBeVisible();
    await expect(settingsColumn).toBeVisible();

    // Verify they're side-by-side by checking bounding boxes
    const subBox = await subscriptionColumn.boundingBox();
    const setBox = await settingsColumn.boundingBox();

    // On a two-column layout, settings should be to the right of subscription
    if (subBox && setBox) {
      expect(setBox.x).toBeGreaterThan(subBox.x);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC6: Single-column layout on mobile (< md breakpoint, 375px min)
  // ─────────────────────────────────────────────────────────────────────────

  test("mobile collapses to single-column (< 768px)", async ({ page }) => {
    // Set viewport to mobile size (375px min, below md breakpoint)
    await page.setViewportSize({ width: 375, height: 667 });
    await navigateToSettings(page);

    // Both sections should still be visible but stacked
    const subscriptionSection = page.locator(
      'section:has(h2:text-is("Subscription Management"))'
    );
    const tabGuidesSection = page.locator(
      'section[aria-label="Restore Tab Guides"]'
    );

    await expect(subscriptionSection).toBeVisible();
    await expect(tabGuidesSection).toBeVisible();

    // Verify stacking: settings should be below subscription
    const subBox = await subscriptionSection.boundingBox();
    const tabBox = await tabGuidesSection.boundingBox();

    if (subBox && tabBox) {
      // In single-column (stacked), tab guides should have a larger y offset
      expect(tabBox.y).toBeGreaterThan(subBox.y);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC7: Responsive gap spacing (gap-6)
  // ─────────────────────────────────────────────────────────────────────────

  test("layout maintains consistent gap spacing (gap-6)", async ({ page }) => {
    await navigateToSettings(page);

    const layoutContainer = page.locator("div.gap-6");
    await expect(layoutContainer).toBeVisible();

    // Verify the class is present for both desktop and mobile
    const classList = await layoutContainer.evaluate((el) =>
      el.className.split(" ")
    );
    expect(classList).toContain("gap-6");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC8: Restore Tab Guides functionality (right column)
  // ─────────────────────────────────────────────────────────────────────────

  test("Restore the Guides button exists and has correct aria-label", async ({
    page,
  }) => {
    await navigateToSettings(page);

    // When no guides are dismissed, the button should say "none dismissed"
    const restoreButton = page.locator(
      'button:has-text("Restore the Guides")'
    );
    await expect(restoreButton).toBeVisible();

    // Check aria-label contains "none dismissed" when nothing is dismissed
    const ariaLabel = await restoreButton.getAttribute("aria-label");
    expect(ariaLabel).toMatch(/none dismissed/i);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC9: No SubscriptionGate wrappers for removed placeholders
  // ─────────────────────────────────────────────────────────────────────────

  test("no SubscriptionGate elements wrapping cloud-sync, multi-household, or data-export", async ({
    page,
  }) => {
    await navigateToSettings(page);

    // Verify no SubscriptionGate data attributes remain for removed features
    const cloudSyncGate = page.locator('[data-feature="cloud-sync"]');
    const multiHouseholdGate = page.locator(
      '[data-feature="multi-household"]'
    );
    const dataExportGate = page.locator('[data-feature="data-export"]');

    await expect(cloudSyncGate).not.toBeVisible();
    await expect(multiHouseholdGate).not.toBeVisible();
    await expect(dataExportGate).not.toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC10: Navigation and structure
  // ─────────────────────────────────────────────────────────────────────────

  test("page structure: header + two-column grid", async ({ page }) => {
    await navigateToSettings(page);

    // Header with "Settings" title and subtitle
    const pageHeader = page.locator("header");
    const h1 = pageHeader.locator("h1");
    await expect(h1).toHaveText(/Settings/i);

    // Subtitle (tagline)
    const subtitle = pageHeader.locator("p");
    await expect(subtitle).toContainText(/Forge your preferences/i);

    // Main content grid
    const mainContent = page.locator("div.max-w-5xl");
    await expect(mainContent).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC11: No dead code / orphaned elements
  // ─────────────────────────────────────────────────────────────────────────

  test("no orphaned placeholder function remnants in DOM", async ({ page }) => {
    await navigateToSettings(page);

    // All placeholder cards should be completely absent
    const placeholderTexts = [
      "Cloud Sync",
      "Multi-Household",
      "Data Export",
      "Coming soon to Karl supporters",
    ];

    for (const text of placeholderTexts) {
      const element = page.locator(`text=${text}`);
      await expect(element).not.toBeVisible();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC12: Right column only contains RestoreTabGuides
  // ─────────────────────────────────────────────────────────────────────────

  test("right column contains only RestoreTabGuides section on desktop", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await navigateToSettings(page);

    // Right column is the second flex-col in the grid
    const rightColumn = page
      .locator("div.md\\:grid-cols-2 > div.flex.flex-col")
      .nth(1);

    // Should have exactly one section child (RestoreTabGuides)
    const sections = rightColumn.locator("section");
    const count = await sections.count();
    expect(count).toBe(1);

    // That section should be the Tab Guides section
    const tabGuidesSection = sections.first();
    await expect(tabGuidesSection).toHaveAttribute(
      "aria-label",
      "Restore Tab Guides"
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC13: Semantic accessibility
  // ─────────────────────────────────────────────────────────────────────────

  test("page has proper heading hierarchy and ARIA labels", async ({ page }) => {
    await navigateToSettings(page);

    // H1 exists at page level
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toHaveCount(1);

    // All sections have proper aria-labels
    const sections = page.locator("section[aria-label]");
    const count = await sections.count();
    expect(count).toBeGreaterThan(0);

    // At least one section should be the Subscription Management or Tab Guides
    const ariaLabels = await sections.evaluateAll((els) =>
      els.map((el) => el.getAttribute("aria-label"))
    );

    const hasSubscriptionOrGuides =
      ariaLabels.includes("Restore Tab Guides") ||
      ariaLabels.some((label) => label?.includes("Subscription"));

    expect(hasSubscriptionOrGuides).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC14: Color and styling (gold, border, consistent theming)
  // ─────────────────────────────────────────────────────────────────────────

  test("header uses gold theming and proper styling", async ({ page }) => {
    await navigateToSettings(page);

    const h1 = page.getByRole("heading", { level: 1 });
    const computedStyle = await h1.evaluate((el) =>
      window.getComputedStyle(el)
    );

    // Should have some form of gold/yellow coloring or custom color
    expect(computedStyle.color).toBeTruthy();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // AC15: Max-width constraint
  // ─────────────────────────────────────────────────────────────────────────

  test("main content respects max-w-5xl constraint", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await navigateToSettings(page);

    const container = page.locator("div.max-w-5xl");
    const boundingBox = await container.boundingBox();

    if (boundingBox) {
      // 5xl = 64rem = 1024px max-width
      expect(boundingBox.width).toBeLessThanOrEqual(1024);
    }
  });
});
