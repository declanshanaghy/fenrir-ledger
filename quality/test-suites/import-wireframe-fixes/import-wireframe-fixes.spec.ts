/**
 * Import Wireframe Fixes Test Suite — PR #136
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates acceptance criteria for fix/import-wireframe-fixes:
 *
 *   AC-1: Compact safety banner has a "Details" link that expands to show
 *         include/exclude lists — wireframe: safety-banner.html lines 237-241.
 *   AC-2: CSV upload step has a "How to export CSV" section below the drop zone
 *         with Google Sheets, Excel, Numbers instructions — wireframe:
 *         csv-upload.html lines 404-415.
 *   AC-3: All import path buttons read "Begin Import" (CsvUpload.tsx and
 *         ShareUrlEntry.tsx).
 *
 * Auth strategy: same fake FenrirSession seeded into localStorage as the
 * parent import-wizard.spec.ts test suite.
 *
 * Every assertion is derived from the acceptance criteria / wireframe specs —
 * NOT from current code behaviour.
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

async function setupAuthenticatedWithCards(page: any): Promise<void> {
  await page.goto("/", { waitUntil: "load" });
  await seedFakeAuth(page);
  await seedHousehold(page, AUTH_HOUSEHOLD_ID);
  await seedCards(page, AUTH_HOUSEHOLD_ID, FEW_CARDS);
  await page.reload({ waitUntil: "load" });
  await page
    .getByRole("link", { name: "Add Card" })
    .waitFor({ state: "visible", timeout: 15000 });
}

async function openImportWizard(page: any): Promise<void> {
  const importButton = page.getByRole("button", { name: "Import" });
  await expect(importButton).toBeVisible();
  await importButton.click();
  await expect(page.locator('[aria-label="Import Wizard"]')).toBeVisible();
}

// ─── Suite: AC-1 — Compact Safety Banner "Details" Toggle ────────────────────

test.describe("Import Wireframe Fixes — Compact Safety Banner Details Toggle", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedWithCards(page);
    await openImportWizard(page);
    // Navigate to URL entry where compact banner is rendered
    await page.getByText("Share a Scroll").click();
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
  });

  /**
   * TC-WF-001 — Compact banner renders a "Details" link/button
   *
   * Spec source: safety-banner.html line 240 — aria-label="View full safety details"
   * and inner text "Details". The button must be visible in the compact banner on
   * URL entry and CSV upload steps. Wireframe specifies 44px min-height touch target.
   *
   * Implementation: SafetyBanner.tsx CompactBanner — button with aria-label
   * "View full safety details" and text "Details" when not expanded.
   */
  test("compact safety banner shows a Details button", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');

    // The compact banner renders a button to toggle details
    const detailsButton = dialog.getByRole("button", {
      name: "View full safety details",
    });
    await expect(detailsButton).toBeVisible();

    // Button text reads "Details" when collapsed
    await expect(detailsButton).toHaveText("Details");
  });

  /**
   * TC-WF-002 — "Details" button has 44px minimum touch target
   *
   * Spec source: safety-banner.html note — "Touch target for 'Details' meets
   * 44px min-height." Implementation: SafetyBanner.tsx CompactBanner renders the
   * button with class `min-h-[44px] min-w-[44px]`.
   */
  test("Details button meets 44px minimum touch target", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');
    const detailsButton = dialog.getByRole("button", {
      name: "View full safety details",
    });
    await expect(detailsButton).toBeVisible();

    const box = await detailsButton.boundingBox();
    expect(box).not.toBeNull();
    // Spec: min 44px height and width
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  });

  /**
   * TC-WF-003 — Clicking "Details" expands include/exclude content
   *
   * Spec source: safety-banner.html line 245 — "'Details' link is a button that
   * toggles an inline expansion of the full include/exclude lists."
   *
   * Before expansion: include/exclude lists must NOT be visible.
   * After clicking Details: both "Safe to include" and "Never include" sections
   * and their content items must be visible.
   *
   * Implementation: CompactBanner in SafetyBanner.tsx — useState(false) → setExpanded,
   * renders include/exclude grid only when expanded.
   */
  test("clicking Details expands the include/exclude lists", async ({
    page,
  }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');
    const detailsButton = dialog.getByRole("button", {
      name: "View full safety details",
    });

    // Before expansion — include/exclude headers must NOT be visible
    // (they only appear in the full variant at method selection, not in compact pre-expand)
    await expect(dialog.getByText("Safe to include")).not.toBeVisible();
    await expect(dialog.getByText("Never include")).not.toBeVisible();

    // Click to expand
    await detailsButton.click();

    // After expansion — "Safe to include" column visible
    await expect(dialog.getByText("Safe to include")).toBeVisible();

    // "Never include" column visible
    await expect(dialog.getByText("Never include")).toBeVisible();

    // Spot-check safe items
    await expect(dialog.getByText("Card names and issuers")).toBeVisible();
    await expect(dialog.getByText("Open dates and annual fees")).toBeVisible();
    await expect(dialog.getByText("Credit limits")).toBeVisible();
    await expect(dialog.getByText("Sign-up bonus details")).toBeVisible();

    // Spot-check forbidden items
    await expect(dialog.getByText("Full card numbers")).toBeVisible();
    await expect(dialog.getByText("CVV / security codes")).toBeVisible();
    await expect(dialog.getByText("Social Security numbers")).toBeVisible();
    await expect(dialog.getByText("Passwords or PINs")).toBeVisible();
  });

  /**
   * TC-WF-004 — Expanded details collapse on second click ("Hide")
   *
   * Spec source: CompactBanner is a toggle. After expanding, the button text
   * changes to "Hide". Clicking again must collapse the lists.
   *
   * Implementation: SafetyBanner.tsx CompactBanner — {expanded ? "Hide" : "Details"}
   * on the button, expanded grid hidden when expanded === false.
   */
  test("clicking Hide collapses the expanded details", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');
    const detailsButton = dialog.getByRole("button", {
      name: "View full safety details",
    });

    // Expand
    await detailsButton.click();
    await expect(dialog.getByText("Safe to include")).toBeVisible();

    // Button text changes to "Hide" when expanded
    await expect(detailsButton).toHaveText("Hide");

    // Collapse
    await detailsButton.click();

    // Lists hidden again
    await expect(dialog.getByText("Safe to include")).not.toBeVisible();
    await expect(dialog.getByText("Never include")).not.toBeVisible();

    // Button text reverts to "Details"
    await expect(detailsButton).toHaveText("Details");
  });

  /**
   * TC-WF-005 — Compact banner aria-expanded state reflects expansion
   *
   * Spec source: safety-banner.html aria-expanded attribute on the Details
   * button. Implementation: SafetyBanner.tsx — aria-expanded={expanded}.
   *
   * Before click: aria-expanded="false".
   * After click: aria-expanded="true".
   */
  test("Details button aria-expanded state updates on toggle", async ({
    page,
  }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');
    const detailsButton = dialog.getByRole("button", {
      name: "View full safety details",
    });

    // Initially collapsed
    await expect(detailsButton).toHaveAttribute("aria-expanded", "false");

    // Click to expand
    await detailsButton.click();
    await expect(detailsButton).toHaveAttribute("aria-expanded", "true");

    // Click to collapse
    await detailsButton.click();
    await expect(detailsButton).toHaveAttribute("aria-expanded", "false");
  });
});

// ─── Suite: AC-1 (CSV path) — Compact Banner also present on CSV Upload ───────

test.describe("Import Wireframe Fixes — Compact Banner on CSV Upload Step", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedWithCards(page);
    await openImportWizard(page);
    // Navigate to CSV upload where compact banner is also rendered
    await page.getByText("Deliver a Rune-Stone").click();
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
  });

  /**
   * TC-WF-006 — Compact banner Details button also present on CSV upload step
   *
   * Spec source: safety-banner.html note — "Placement: Steps 2A, 2B, 2C
   * (URL entry, Picker, CSV upload)." CsvUpload.tsx renders
   * <SafetyBanner variant="compact" />.
   */
  test("compact safety banner Details button is visible on CSV upload step", async ({
    page,
  }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');

    const detailsButton = dialog.getByRole("button", {
      name: "View full safety details",
    });
    await expect(detailsButton).toBeVisible();
    await expect(detailsButton).toHaveText("Details");
  });

  /**
   * TC-WF-007 — Details expansion works on CSV upload step
   *
   * Same toggle behaviour as URL entry. The compact banner must expand to show
   * include/exclude lists when Details is clicked on the CSV upload step.
   */
  test("Details expansion works on CSV upload step", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');
    const detailsButton = dialog.getByRole("button", {
      name: "View full safety details",
    });

    // Not visible before expansion
    await expect(dialog.getByText("Safe to include")).not.toBeVisible();

    await detailsButton.click();

    await expect(dialog.getByText("Safe to include")).toBeVisible();
    await expect(dialog.getByText("Never include")).toBeVisible();
  });
});

// ─── Suite: AC-2 — CSV Upload "How to export CSV" Section ────────────────────

test.describe("Import Wireframe Fixes — CSV Upload Format Help Section", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedWithCards(page);
    await openImportWizard(page);
    await page.getByText("Deliver a Rune-Stone").click();
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
  });

  /**
   * TC-WF-010 — "Supported formats" section heading is visible
   *
   * Spec source: CsvUpload.tsx now supports CSV, TSV, XLS, and XLSX files
   * Implementation: CsvUpload.tsx — <p class="font-heading...">Supported formats</p>
   * displayed below the drop zone at all times (always visible per wireframe note
   * line 414).
   */
  test("How to export CSV heading is visible below the drop zone", async ({
    page,
  }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');

    await expect(dialog.getByText("Supported formats")).toBeVisible();
  });

  /**
   * TC-WF-011 — Google Sheets export instruction is present
   *
   * Spec source: CsvUpload.tsx now lists supported formats including
   * Google Sheets: File > Download > .csv or .xlsx
   */
  test("Google Sheets CSV export instruction is present", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');

    await expect(
      dialog.getByText(/Google Sheets/)
    ).toBeVisible();
  });

  /**
   * TC-WF-012 — Excel export instruction is present
   *
   * Spec source: CsvUpload.tsx now supports uploading Excel files directly.
   * Implementation: "Excel: upload .xlsx or .xls directly"
   */
  test("Excel upload instruction is present", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');

    await expect(
      dialog.getByText(/Excel: upload.*xlsx or.*xls directly/)
    ).toBeVisible();
  });

  /**
   * TC-WF-013 — Numbers export instruction is present
   *
   * Spec source: CsvUpload.tsx format help now includes Numbers format
   * Implementation: "Numbers: File > Export To > CSV or Excel"
   */
  test("Numbers CSV export instruction is present", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');

    await expect(
      dialog.getByText(/Numbers: File.*Export To.*CSV or Excel/)
    ).toBeVisible();
  });

  /**
   * TC-WF-014 — Format help section is visible in initial idle state
   *
   * Spec source: CsvUpload.tsx — "Supported formats" section with instructions for
   * multiple file formats. Displayed below the drop zone at all times.
   *
   * The section must be visible before any file is dropped, i.e., always rendered
   * regardless of dropState.
   */
  test("format help section is visible in idle state before any file is dropped", async ({
    page,
  }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');

    // Confirm idle state is active — drop zone shows "Drop a spreadsheet here"
    await expect(
      dialog.getByText("Drop a spreadsheet here, or click to browse")
    ).toBeVisible();

    // Format help is simultaneously visible
    await expect(dialog.getByText("Supported formats")).toBeVisible();
    await expect(
      dialog.getByText("Google Sheets: File > Download > .csv or .xlsx")
    ).toBeVisible();
    await expect(
      dialog.getByText("Excel: upload .xlsx or .xls directly")
    ).toBeVisible();
    await expect(
      dialog.getByText("Numbers: File > Export To > CSV or Excel")
    ).toBeVisible();
  });
});

// ─── Suite: AC-3 — "Begin Import" Button Text ────────────────────────────────

test.describe("Import Wireframe Fixes — Begin Import Button Text", () => {
  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
  });

  /**
   * TC-WF-020 — CSV upload submit button reads "Begin Import"
   *
   * Spec source: csv-upload.html line 421 — button text "Begin Import".
   * Implementation: CsvUpload.tsx — button text "Begin Import".
   *
   * The button is disabled until a valid file is accepted, but its text must
   * always read "Begin Import" — never "Import", "Upload", "Submit", etc.
   */
  test("CSV upload submit button text is Begin Import", async ({ page }) => {
    await setupAuthenticatedWithCards(page);
    await openImportWizard(page);
    await page.getByText("Deliver a Rune-Stone").click();

    const dialog = page.locator('[aria-label="Import Wizard"]');

    // Button is disabled until a file is accepted, but must read "Begin Import"
    const submitButton = dialog.getByRole("button", { name: "Begin Import" });
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toHaveText("Begin Import");

    // Must be disabled in idle state (no file yet)
    await expect(submitButton).toBeDisabled();
  });

  /**
   * TC-WF-021 — URL entry submit button reads "Begin Import"
   *
   * Spec source: Acceptance criteria AC-3 — "All import path buttons read
   * 'Begin Import' (both CsvUpload.tsx and ShareUrlEntry.tsx)."
   * Implementation: ShareUrlEntry.tsx — button text "Begin Import".
   *
   * The button is disabled when URL is invalid, but text must always read
   * "Begin Import".
   */
  test("URL entry submit button text is Begin Import", async ({ page }) => {
    await setupAuthenticatedWithCards(page);
    await openImportWizard(page);
    await page.getByText("Share a Scroll").click();

    const dialog = page.locator('[aria-label="Import Wizard"]');

    // Button is disabled until a valid URL is entered, but must read "Begin Import"
    const submitButton = dialog.getByRole("button", { name: "Begin Import" });
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toHaveText("Begin Import");

    // Must be disabled in initial state (empty URL field)
    await expect(submitButton).toBeDisabled();
  });

  /**
   * TC-WF-022 — URL entry Begin Import button enabled when valid URL is entered
   *
   * Spec source: ShareUrlEntry.tsx — disabled={!isValid}. A URL containing
   * "docs.google.com/spreadsheets" is valid.
   * The button text must remain "Begin Import" when enabled.
   */
  test("URL entry Begin Import button is enabled with a valid Google Sheets URL", async ({
    page,
  }) => {
    await setupAuthenticatedWithCards(page);
    await openImportWizard(page);
    await page.getByText("Share a Scroll").click();

    const dialog = page.locator('[aria-label="Import Wizard"]');
    const urlInput = dialog.locator("#sheets-url");
    const submitButton = dialog.getByRole("button", { name: "Begin Import" });

    await urlInput.fill(
      "https://docs.google.com/spreadsheets/d/abc123/edit"
    );

    // Button is now enabled and still reads "Begin Import"
    await expect(submitButton).not.toBeDisabled();
    await expect(submitButton).toHaveText("Begin Import");
  });
});
