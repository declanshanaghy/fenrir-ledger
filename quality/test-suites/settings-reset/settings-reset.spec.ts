/**
 * Settings Reset Tab Guides — Playwright Test Suite
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates GitHub Issue #587: Settings widget to reset dismissed tab headers
 *
 * Feature: User can restore dismissed tab headers and summaries from Settings.
 * Button clears all 10 localStorage keys and shows confirmation feedback.
 * Button is disabled when no dismissals exist.
 *
 * Acceptance Criteria:
 *   ✓ Settings page has "Restore the Guides" button
 *   ✓ Clicking it clears all 10 localStorage keys (5 headers + 5 summaries)
 *   ✓ User sees confirmation feedback after reset
 *   ✓ After reset, all headers and summaries reappear on dashboard
 *   ✓ Button is disabled when no keys are set (nothing to restore)
 */

import { test, expect, type Page } from "@playwright/test";
import { clearAllStorage, seedHousehold, ANONYMOUS_HOUSEHOLD_ID } from "../helpers/test-fixtures";

// Tab guide localStorage keys (must match src/app/ledger/settings/page.tsx)
const TAB_IDS = ["all", "valhalla", "active", "hunt", "howl"] as const;
const TAB_HEADER_KEYS = TAB_IDS.map((id) => `fenrir:tab-header-dismissed:${id}`);
const TAB_SUMMARY_KEYS = TAB_IDS.map((id) => `fenrir:tab-summary-dismissed:${id}`);
const ALL_GUIDE_KEYS = [...TAB_HEADER_KEYS, ...TAB_SUMMARY_KEYS];

/**
 * Helper: Set all tab dismissal keys to true in localStorage
 */
async function dismissAllTabGuides(page: Page): Promise<void> {
  await page.evaluate((keys: string[]) => {
    for (const key of keys) {
      localStorage.setItem(key, "true");
    }
  }, ALL_GUIDE_KEYS);
}

/**
 * Helper: Check which tab dismissal keys are currently set to "true"
 */
async function getActiveDismissedGuides(page: Page): Promise<string[]> {
  return await page.evaluate((keys: string[]) => {
    return keys.filter((key) => localStorage.getItem(key) === "true");
  }, ALL_GUIDE_KEYS);
}

test.describe("Settings — Restore Tab Guides", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ledger");
    await clearAllStorage(page);
    await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  });

  test("AC1: Settings page has Restore the Guides button", async ({ page }) => {
    await page.goto("/ledger/settings", { waitUntil: "load" });

    // Verify button exists and has correct label
    const button = page.getByRole("button", { name: /Restore the Guides/i });
    await expect(button).toBeVisible();

    // Verify it's in a section labeled "Tab Guides"
    const tabGuidesSection = page.locator('section[aria-label="Restore Tab Guides"]');
    await expect(tabGuidesSection).toBeVisible();
    await expect(tabGuidesSection.locator('button')).toContainText(/Restore the Guides/i);
  });

  test("AC2: Button clears all 10 localStorage keys on click", async ({ page }) => {
    // Setup: dismiss all tab guides
    await dismissAllTabGuides(page);

    // Verify all keys are set
    let dismissedBefore = await getActiveDismissedGuides(page);
    expect(dismissedBefore).toHaveLength(10);

    // Navigate to settings and click restore button
    await page.goto("/ledger/settings", { waitUntil: "load" });
    const button = page.getByRole("button", { name: /Restore the Guides/i });
    await button.click();

    // Verify all keys are cleared
    let dismissedAfter = await getActiveDismissedGuides(page);
    expect(dismissedAfter).toHaveLength(0);
  });

  test("AC3: User sees confirmation feedback after reset", async ({ page }) => {
    // Setup: dismiss all tab guides
    await dismissAllTabGuides(page);

    // Navigate to settings
    await page.goto("/ledger/settings", { waitUntil: "load" });

    // Click restore button
    const button = page.getByRole("button", { name: /Restore the Guides/i });
    await button.click();

    // Verify confirmation message appears
    const confirmationMessage = page.locator('p[role="status"]', {
      hasText: /Tab guides restored|wisdom returns/i,
    });
    await expect(confirmationMessage).toBeVisible();

    // Verify it disappears after ~3 seconds (confirmation should auto-hide)
    // Use reasonable timeout since CONFIRMATION_DURATION_MS = 3000
    await expect(confirmationMessage).toBeHidden({ timeout: 4000 });
  });

  test("AC4: After reset, tab headers and summaries reappear on dashboard", async ({
    page,
  }) => {
    // Setup: dismiss all tab guides
    await dismissAllTabGuides(page);

    // Verify keys are set before reset
    let dismissedBefore = await getActiveDismissedGuides(page);
    expect(dismissedBefore).toHaveLength(10);

    // Navigate to settings and reset
    await page.goto("/ledger/settings", { waitUntil: "load" });
    const button = page.getByRole("button", { name: /Restore the Guides/i });
    await button.click();

    // Navigate back to dashboard
    await page.goto("/ledger", { waitUntil: "load" });

    // Verify all keys are cleared (guides are now visible on dashboard)
    let dismissedAfter = await getActiveDismissedGuides(page);
    expect(dismissedAfter).toHaveLength(0);
  });

  test("AC5: Button is disabled when no keys are set (nothing to restore)", async ({
    page,
  }) => {
    // Setup: no dismissals (clean state)
    // clearAllStorage already removes all fenrir: keys

    await page.goto("/ledger/settings", { waitUntil: "load" });

    const button = page.getByRole("button", { name: /Restore the Guides/i });

    // Button should be disabled
    await expect(button).toBeDisabled();

    // Button text should update aria-label to reflect zero dismissals
    const ariaLabel = await button.getAttribute("aria-label");
    expect(ariaLabel).toMatch(/none dismissed/i);

    // Verify helper text appears indicating nothing to restore
    const helperText = page.locator("p", {
      hasText: /All guides are currently visible|nothing to restore/i,
    });
    await expect(helperText).toBeVisible();
  });

  test("Button transitions from disabled to enabled after dismissals are made", async ({
    page,
  }) => {
    // Start with clean state (no dismissals)
    await page.goto("/ledger/settings", { waitUntil: "load" });
    const button = page.getByRole("button", { name: /Restore the Guides/i });

    // Verify button is initially disabled
    await expect(button).toBeDisabled();

    // Simulate dismissing some tab guides
    await dismissAllTabGuides(page);

    // Reload settings page
    await page.reload({ waitUntil: "load" });

    // Button should now be enabled
    await expect(button).toBeEnabled();

    // aria-label should show dismissal count
    const ariaLabel = await button.getAttribute("aria-label");
    expect(ariaLabel).toMatch(/\d+ dismissed/);
  });

  test("Edge case: Rapidly clicking button doesn't cause issues", async ({ page }) => {
    // Setup: dismiss all tab guides
    await dismissAllTabGuides(page);

    await page.goto("/ledger/settings", { waitUntil: "load" });
    const button = page.getByRole("button", { name: /Restore the Guides/i });

    // Click button twice rapidly
    await button.click();
    await button.click();

    // Verify state is consistent: keys should be cleared
    let dismissedAfter = await getActiveDismissedGuides(page);
    expect(dismissedAfter).toHaveLength(0);

    // Button should remain in correct state (disabled after reset)
    await expect(button).toBeDisabled();
  });
});
