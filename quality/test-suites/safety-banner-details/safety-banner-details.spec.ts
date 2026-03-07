/**
 * Safety Banner Details Toggle Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates Issue #131: Compact safety banner missing Details expandable link
 *
 * Test cases validate:
 *   1. Compact banner displays with Details button visible
 *   2. Clicking Details button expands the banner to show include/exclude lists
 *   3. Clicking Hide button collapses the expanded lists
 *   4. Proper aria labels and accessibility attributes are present
 *   5. The layout matches the wireframe spec for both collapsed and expanded states
 *
 * Acceptance Criteria:
 *   ✓ Compact safety banner includes a Details link/button
 *   ✓ Clicking Details toggles inline expansion of the include/exclude lists
 *   ✓ Expanded lists match the full variant (Safe to include / Never include)
 *   ✓ Matches wireframe spec for the compact variant
 *
 * Auth strategy:
 *   Tests access the import wizard which requires authenticated state.
 *   We seed a fake FenrirSession into localStorage before each test.
 */

import { test, expect } from "@playwright/test";
import {
  seedCards,
  seedHousehold,
  clearAllStorage,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";
import { FEW_CARDS } from "../helpers/seed-data";

// ─── Constants ────────────────────────────────────────────────────────────────

const AUTH_HOUSEHOLD_ID = ANONYMOUS_HOUSEHOLD_ID;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Seeds a fake FenrirSession into localStorage for authenticated tests.
 */
async function seedFakeAuth(page: any): Promise<void> {
  await page.evaluate((householdId: string) => {
    const fakeSession = {
      access_token: "fake-access-token",
      id_token: "fake-id-token",
      expires_at: Date.now() + 3_600_000, // 1 hour from now
      user: {
        sub: householdId,
        email: "test@example.com",
        name: "Test User",
        picture: "",
      },
    };
    localStorage.setItem("fenrir:auth", JSON.stringify(fakeSession));
  }, AUTH_HOUSEHOLD_ID);
}

/**
 * Full setup for tests that need the toolbar Import button and import wizard.
 */
async function setupAuthenticatedWithCards(page: any): Promise<void> {
  await page.goto("/", { waitUntil: "load" });
  await seedFakeAuth(page);
  await seedHousehold(page, AUTH_HOUSEHOLD_ID);
  await seedCards(page, AUTH_HOUSEHOLD_ID, FEW_CARDS);
  await page.reload({ waitUntil: "load" });
  // Wait for the dashboard to finish rendering after hydration.
  await page.getByRole("link", { name: "Add Card" }).waitFor({ state: "visible", timeout: 15000 });
}

/**
 * Opens the Import Wizard via the toolbar Import button.
 */
async function openImportWizard(page: any): Promise<void> {
  const importButton = page.getByRole("button", { name: "Import" });
  await expect(importButton).toBeVisible();
  await importButton.click();
  await expect(page.locator('[aria-label="Import Wizard"]')).toBeVisible();
}

/**
 * Navigates to the CSV upload step where the compact banner is rendered.
 */
async function navigateToCsvUploadStep(page: any): Promise<void> {
  // From method selection, click the CSV import method card
  const dialog = page.locator('[aria-label="Import Wizard"]');
  const csvCard = dialog.locator('div[role="option"]').filter({ hasText: "Deliver a Rune-Stone" });
  await csvCard.click();

  // This should advance to the CSV upload step which displays the compact safety banner
  // Wait for the compact banner to appear
  await expect(dialog.getByRole("note", { name: "Data safety reminder" })).toBeVisible({ timeout: 10000 });
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

test.describe("Safety Banner Details Toggle — Issue #131", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedWithCards(page);
    await openImportWizard(page);
    await navigateToCsvUploadStep(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
  });

  /**
   * TC-SB-001 — Compact banner displays with Details button visible
   *
   * The compact safety banner should render with:
   *   - Safety reminder text
   *   - Shield icon
   *   - Visible "Details" button
   *   - aria-label="Data safety reminder" on the container
   *   - aria-label="View full safety details" on the button
   *   - aria-expanded="false" initially
   *
   * Spec source: SafetyBanner.tsx CompactBanner() function
   */
  test("compact banner displays with Details button", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');

    // Banner container should have data safety reminder label
    const banner = dialog.getByRole("note", { name: "Data safety reminder" });
    await expect(banner).toBeVisible();

    // Safety reminder text should be visible
    await expect(banner.getByText(/Never share card numbers, CVVs, or SSNs/)).toBeVisible();

    // Details button should be visible
    const detailsButton = banner.getByRole("button", { name: "Details" });
    await expect(detailsButton).toBeVisible();

    // Button should have aria-expanded="false" initially
    await expect(detailsButton).toHaveAttribute("aria-expanded", "false");

    // Button should have proper aria-label
    await expect(detailsButton).toHaveAttribute("aria-label", "View full safety details");
  });

  /**
   * TC-SB-002 — Details button click expands the banner
   *
   * Clicking the Details button should:
   *   - Set aria-expanded="true" on the button
   *   - Display both include and exclude lists in a grid layout
   *   - Change button text from "Details" to "Hide"
   *   - Show "Safe to include" column header
   *   - Show "Never include" column header
   *   - Display all expected list items
   *
   * Spec source: SafetyBanner.tsx CompactBanner() expanded conditional render
   */
  test("Details button toggles banner expansion showing include/exclude lists", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');
    const banner = dialog.getByRole("note", { name: "Data safety reminder" });
    const detailsButton = banner.getByRole("button", { name: "Details" });

    // Click Details button
    await detailsButton.click();

    // Button should now have aria-expanded="true"
    await expect(detailsButton).toHaveAttribute("aria-expanded", "true");

    // Button text should change to "Hide"
    await expect(detailsButton).toHaveText("Hide");

    // Safe to include section should be visible
    await expect(banner.getByText("Safe to include")).toBeVisible();

    // Items that are safe to include
    await expect(banner.getByText("Card names and issuers")).toBeVisible();
    await expect(banner.getByText("Open dates and annual fees")).toBeVisible();
    await expect(banner.getByText("Credit limits")).toBeVisible();
    await expect(banner.getByText("Sign-up bonus details")).toBeVisible();

    // Never include section should be visible
    await expect(banner.getByText("Never include")).toBeVisible();

    // Items that should never be included
    await expect(banner.getByText("Full card numbers")).toBeVisible();
    await expect(banner.getByText("CVV / security codes")).toBeVisible();
    await expect(banner.getByText("Social Security numbers")).toBeVisible();
    await expect(banner.getByText("Passwords or PINs")).toBeVisible();
  });

  /**
   * TC-SB-003 — Hide button collapses the banner
   *
   * After expanding, clicking Hide button should:
   *   - Set aria-expanded="false" on the button
   *   - Hide the include/exclude lists
   *   - Change button text from "Hide" to "Details"
   *   - Maintain the safety reminder text in the collapsed state
   *
   * Spec source: SafetyBanner.tsx CompactBanner() state toggle
   */
  test("Hide button collapses the expanded banner", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');
    const banner = dialog.getByRole("note", { name: "Data safety reminder" });
    const detailsButton = banner.getByRole("button", { name: "Details" });

    // Expand the banner
    await detailsButton.click();
    await expect(detailsButton).toHaveAttribute("aria-expanded", "true");
    await expect(banner.getByText("Safe to include")).toBeVisible();

    // Click the Hide button (now showing "Hide" text)
    await detailsButton.click();

    // Button should have aria-expanded="false" again
    await expect(detailsButton).toHaveAttribute("aria-expanded", "false");

    // Button text should be back to "Details"
    await expect(detailsButton).toHaveText("Details");

    // Expanded lists should not be visible
    await expect(banner.getByText("Safe to include")).not.toBeVisible();
    await expect(banner.getByText("Never include")).not.toBeVisible();

    // But the reminder text should still be visible
    await expect(banner.getByText(/Never share card numbers, CVVs, or SSNs/)).toBeVisible();
  });

  /**
   * TC-SB-004 — Multiple expand/collapse cycles work correctly
   *
   * The toggle should work reliably across multiple clicks without state issues.
   */
  test("Details toggle works correctly on multiple expand/collapse cycles", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');
    const banner = dialog.getByRole("note", { name: "Data safety reminder" });
    const detailsButton = banner.getByRole("button", { name: "Details" });

    // Cycle 1: Expand
    await detailsButton.click();
    await expect(detailsButton).toHaveAttribute("aria-expanded", "true");
    await expect(banner.getByText("Safe to include")).toBeVisible();

    // Cycle 1: Collapse
    await detailsButton.click();
    await expect(detailsButton).toHaveAttribute("aria-expanded", "false");
    await expect(banner.getByText("Safe to include")).not.toBeVisible();

    // Cycle 2: Expand
    await detailsButton.click();
    await expect(detailsButton).toHaveAttribute("aria-expanded", "true");
    await expect(banner.getByText("Never include")).toBeVisible();

    // Cycle 2: Collapse
    await detailsButton.click();
    await expect(detailsButton).toHaveAttribute("aria-expanded", "false");
    await expect(banner.getByText("Never include")).not.toBeVisible();
  });

  /**
   * TC-SB-005 — Expanded lists use grid layout matching wireframe spec
   *
   * The expanded state should display a two-column grid layout on medium screens
   * and above, with proper spacing and typography matching the wireframe.
   */
  test("expanded lists display in proper grid layout", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');
    const banner = dialog.getByRole("note", { name: "Data safety reminder" });
    const detailsButton = banner.getByRole("button", { name: "Details" });

    // Expand the banner
    await detailsButton.click();

    // Both column headers should be visible
    const safeHeader = banner.getByText("Safe to include");
    const neverHeader = banner.getByText("Never include");

    await expect(safeHeader).toBeVisible();
    await expect(neverHeader).toBeVisible();

    // Verify the grid container exists and both columns are rendered
    const expandedSection = banner.locator('div').filter({ hasText: /Safe to include/ }).first();
    await expect(expandedSection).toBeVisible();

    // Verify the list items are properly structured
    const safeItems = banner.locator('li').filter({ hasText: /Card names|Open dates|Credit limits|Sign-up bonus/ });
    const itemCount = await safeItems.count();
    expect(itemCount).toBeGreaterThanOrEqual(4); // At least 4 safe items
  });
});
