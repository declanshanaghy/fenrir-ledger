/**
 * CSV Format Help Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates the "How to export CSV" format help section added by PR #265 (Issue #132).
 *
 * Acceptance Criteria (from Issue #132):
 *   AC1 — "How to export CSV" section is visible below the drop zone in the CSV upload step.
 *   AC2 — Includes instructions for Google Sheets, Excel, and Numbers.
 *   AC3 — Matches wireframe spec layout (section is below drop zone, lists all three tools).
 *
 * Spec source:
 *   - CsvUpload.tsx — format help section rendered as a <div> after the drop zone, containing:
 *       - Heading: "How to export CSV"
 *       - Google Sheets: "File > Download > Comma-separated values (.csv)"
 *       - Excel:         "File > Save As > CSV UTF-8"
 *       - Numbers:       "File > Export To > CSV"
 *
 * Auth / navigation strategy:
 *   - Seeds a fake FenrirSession into localStorage (matches import-wizard.spec.ts pattern).
 *   - Seeds household and cards so the toolbar Import button is visible.
 *   - Navigates: Import button → wizard dialog → "Deliver a Rune-Stone" → CSV upload step.
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

const AUTH_HOUSEHOLD_ID = ANONYMOUS_HOUSEHOLD_ID; // "test-household-id"

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Seeds a fake FenrirSession so the app treats the browser context as authenticated. */
async function seedFakeAuth(page: any): Promise<void> {
  await page.evaluate((householdId: string) => {
    const fakeSession = {
      access_token: "fake-access-token",
      id_token: "fake-id-token",
      expires_at: Date.now() + 3_600_000,
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
 * Full setup: auth + household + cards + reload.
 * After this the toolbar Import button is visible.
 */
async function setupAuthenticatedWithCards(page: any): Promise<void> {
  await page.goto("/", { waitUntil: "load" });
  await seedFakeAuth(page);
  await seedHousehold(page, AUTH_HOUSEHOLD_ID);
  await seedCards(page, AUTH_HOUSEHOLD_ID, FEW_CARDS);
  await page.reload({ waitUntil: "load" });
  await page.getByRole("link", { name: "Add Card" }).waitFor({ state: "visible", timeout: 15000 });
}

/** Opens the Import Wizard via the toolbar Import button. */
async function openImportWizard(page: any): Promise<void> {
  const importButton = page.getByRole("button", { name: "Import" });
  await expect(importButton).toBeVisible();
  await importButton.click();
  await expect(page.locator('[aria-label="Import Wizard"]')).toBeVisible();
}

/** Navigates to the CSV upload step (Deliver a Rune-Stone). */
async function navigateToCsvUploadStep(page: any): Promise<void> {
  await page.getByText("Deliver a Rune-Stone").click();
  const dialog = page.locator('[aria-label="Import Wizard"]');
  // Confirm we are on the CSV upload step by waiting for the drop zone
  await expect(dialog.getByRole("button", { name: "Upload spreadsheet file" })).toBeVisible();
}

// ─── Suite: CSV Format Help Section ───────────────────────────────────────────

test.describe("CSV Upload — Format Help Section (#132)", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedWithCards(page);
    await openImportWizard(page);
    await navigateToCsvUploadStep(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
  });

  /**
   * TC-132-001 — "How to export CSV" heading is visible below the drop zone
   *
   * AC1: "How to export CSV" section is visible below the drop zone.
   *
   * Spec source: CsvUpload.tsx — the format help <div> is rendered after the
   * drop zone div and contains a <p> with text "How to export CSV".
   */
  test("How to export CSV heading is visible in the CSV upload step", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');

    // The heading must be visible
    await expect(dialog.getByText("How to export CSV")).toBeVisible();
  });

  /**
   * TC-132-002 — Format help section appears AFTER the drop zone in DOM order
   *
   * AC3: Matches wireframe spec layout (section is below drop zone).
   *
   * Spec source: CsvUpload.tsx — the flex column container orders:
   *   1. <SafetyBanner />
   *   2. Drop zone div (role="button")
   *   3. Format help div
   *   4. Actions div
   *
   * We verify that both the drop zone and the format help text are present
   * and that the drop zone bounding box top is less than the format help text top.
   */
  test("format help section appears below the drop zone", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');

    const dropZone = dialog.getByRole("button", { name: "Upload spreadsheet file" });
    const formatHelpHeading = dialog.getByText("How to export CSV");

    await expect(dropZone).toBeVisible();
    await expect(formatHelpHeading).toBeVisible();

    const dropZoneBox = await dropZone.boundingBox();
    const helpBox = await formatHelpHeading.boundingBox();

    // The format help heading must be positioned below the drop zone
    expect(dropZoneBox).not.toBeNull();
    expect(helpBox).not.toBeNull();
    expect(helpBox!.y).toBeGreaterThan(dropZoneBox!.y + dropZoneBox!.height - 1);
  });

  /**
   * TC-132-003 — Google Sheets export instruction is visible
   *
   * AC2: Includes instructions for Google Sheets.
   *
   * Spec source: CsvUpload.tsx line ~379:
   *   <li>Google Sheets: File &gt; Download &gt; Comma-separated values (.csv)</li>
   */
  test("Google Sheets export instruction is visible", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');

    // The instruction contains the key navigation path
    await expect(
      dialog.getByText(/Google Sheets.*File.*Download.*Comma-separated values/)
    ).toBeVisible();
  });

  /**
   * TC-132-004 — Excel export instruction is visible
   *
   * AC2: Includes instructions for Excel.
   *
   * Spec source: CsvUpload.tsx line ~380:
   *   <li>Excel: File &gt; Save As &gt; CSV UTF-8</li>
   */
  test("Excel export instruction is visible", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');

    await expect(
      dialog.getByText(/Excel.*File.*Save As.*CSV UTF-8/)
    ).toBeVisible();
  });

  /**
   * TC-132-005 — Numbers export instruction is visible
   *
   * AC2: Includes instructions for Numbers (Apple).
   *
   * Spec source: CsvUpload.tsx line ~381:
   *   <li>Numbers: File &gt; Export To &gt; CSV</li>
   */
  test("Numbers export instruction is visible", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');

    await expect(
      dialog.getByText(/Numbers.*File.*Export To.*CSV/)
    ).toBeVisible();
  });

  /**
   * TC-132-006 — All three export instructions are present together
   *
   * AC2: The section includes instructions for all three tools simultaneously.
   *
   * Spec source: CsvUpload.tsx — the <ul> contains exactly the three <li> items.
   * This test confirms all three are rendered in the same step without needing
   * to scroll or expand any accordion.
   */
  test("all three export instructions are visible together in the CSV upload step", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');

    // All three tool names must be visible at the same time
    await expect(dialog.getByText(/Google Sheets/)).toBeVisible();
    await expect(dialog.getByText(/Excel.*File/)).toBeVisible();
    await expect(dialog.getByText(/Numbers.*File/)).toBeVisible();

    // The heading and all three instructions are co-present
    await expect(dialog.getByText("How to export CSV")).toBeVisible();
  });

  /**
   * TC-132-007 — Format help section is NOT present on method selection step
   *
   * Regression guard: the help section must only appear on the CSV upload step,
   * not on the method selection step where the user has not yet chosen CSV.
   *
   * We navigate back to method selection and assert the heading is gone.
   */
  test("format help section does not appear on the method selection step", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');

    // Navigate back to method selection
    const backButton = dialog.getByRole("button", { name: "Back" });
    await expect(backButton).toBeVisible();
    await backButton.click();

    // Method selection is visible
    await expect(dialog.getByRole("listbox", { name: "Choose import method" })).toBeVisible();

    // The CSV format help heading must NOT be visible on this step
    await expect(dialog.getByText("How to export CSV")).not.toBeVisible();
  });

  /**
   * TC-132-008 — Format help section is NOT present on URL entry step
   *
   * Regression guard: the help section must not bleed into the URL entry (Share a Scroll) step.
   *
   * We navigate back then forward to URL entry.
   */
  test("format help section does not appear on the URL entry step", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');

    // Navigate back to method selection
    await dialog.getByRole("button", { name: "Back" }).click();
    await expect(dialog.getByRole("listbox", { name: "Choose import method" })).toBeVisible();

    // Navigate to URL entry step
    await page.getByText("Share a Scroll").click();
    await expect(dialog.locator("#sheets-url")).toBeVisible();

    // CSV format help heading must NOT be visible on the URL entry step
    await expect(dialog.getByText("How to export CSV")).not.toBeVisible();
  });

  /**
   * TC-132-009 — Drop zone is still functional alongside the format help section
   *
   * Regression guard: adding the format help section must not break the existing
   * drop zone behavior. The drop zone must still be interactive (role="button",
   * tabIndex=0, aria-label present).
   */
  test("drop zone remains interactive alongside the format help section", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');
    const dropZone = dialog.getByRole("button", { name: "Upload spreadsheet file" });

    // Drop zone must be present and focusable
    await expect(dropZone).toBeVisible();
    await expect(dropZone).toHaveAttribute("tabindex", "0");

    // Idle state text must still be present
    await expect(dialog.getByText("Drop a spreadsheet here, or click to browse")).toBeVisible();
    await expect(dialog.getByText(".csv, .tsv, .xls, .xlsx — up to 5 MB")).toBeVisible();

    // Format help coexists with the drop zone
    await expect(dialog.getByText("How to export CSV")).toBeVisible();
  });
});
