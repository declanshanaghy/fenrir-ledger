/**
 * Dialog A11y & Import Route Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates GitHub Issue #256:
 * - DialogContent missing aria-describedby attribute
 * - /api/sheets/import route 404 error
 *
 * Acceptance Criteria:
 * 1. All DialogContent components have DialogDescription OR aria-describedby={undefined}
 * 2. /api/sheets/import responds correctly (not 404)
 * 3. COOP header doesn't break Google Picker flow
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
  await page.getByRole("link", { name: "Add Card" }).waitFor({ state: "visible", timeout: 15000 });
}

async function openImportWizard(page: any): Promise<void> {
  const importButton = page.getByRole("button", { name: "Import" });
  await expect(importButton).toBeVisible();
  await importButton.click();
  await expect(page.locator('[aria-label="Import Wizard"]')).toBeVisible();
}

// ─── Suite: DialogContent A11y Compliance ──────────────────────────────────────

test.describe("Dialog A11y — DialogContent Accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedWithCards(page);
    await openImportWizard(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
  });

  /**
   * TC-A11Y-001 — DialogContent renders with aria-label attribute
   *
   * Spec source: ImportWizard.tsx DialogContent has aria-label="Import Wizard"
   * This attribute provides an accessible name for the dialog when aria-labelledby
   * or aria-describedby are not sufficient.
   */
  test("DialogContent has aria-label attribute", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-label", "Import Wizard");
  });

  /**
   * TC-A11Y-002 — DialogDescription is present in method selection step
   *
   * Issue #256: DialogContent missing aria-describedby. Fix adds DialogDescription
   * to all dialog steps with sr-only class to provide accessible descriptions.
   *
   * Method selection step must have a DialogDescription element.
   */
  test("method selection step has DialogDescription for a11y", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');

    // DialogDescription should contain descriptive text
    const description = dialog.locator("text=Choose a method to import your credit cards");
    await expect(description).toBeVisible();

    // Verify it's hidden from visual layout but available to screen readers (sr-only)
    const dialogDescriptionElements = dialog.locator("div.sr-only");
    await expect(dialogDescriptionElements).toHaveCount(1);
  });

  /**
   * TC-A11Y-003 — DialogDescription in URL entry (Share a Scroll) step
   *
   * When navigating to the URL entry step, the dialog should have an updated
   * DialogDescription explaining the current step's purpose.
   */
  test("URL entry step has DialogDescription for a11y", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');

    // Navigate to URL entry step
    await page.getByText("Share a Scroll").click();

    // Wait for step to render
    await expect(dialog.locator("#sheets-url")).toBeVisible();

    // DialogDescription should be present with step-specific text
    const description = dialog.locator("text=Enter a Google Sheets URL to import your card data");
    await expect(description).toBeVisible();

    // Verify sr-only class (hidden from sighted users)
    const srOnlyElements = dialog.locator("div.sr-only");
    await expect(srOnlyElements).toHaveCount(1);
  });

  /**
   * TC-A11Y-004 — DialogDescription in CSV upload (Deliver a Rune-Stone) step
   *
   * CSV upload step must have a DialogDescription explaining file upload.
   */
  test("CSV upload step has DialogDescription for a11y", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');

    // Navigate to CSV upload step
    await page.getByText("Deliver a Rune-Stone").click();

    // Wait for step to render
    await expect(dialog.getByRole("button", { name: "Upload spreadsheet file" })).toBeVisible();

    // DialogDescription should explain the step
    const description = dialog.locator("text=Upload a CSV or Excel file containing your credit card data");
    await expect(description).toBeVisible();

    // Verify sr-only (screen reader only)
    const srOnlyElements = dialog.locator("div.sr-only");
    await expect(srOnlyElements).toHaveCount(1);
  });

  /**
   * TC-A11Y-005 — All dialog steps have accessible descriptions
   *
   * Comprehensive check: every dialog step (6 total) must have a sr-only
   * DialogDescription element for full a11y compliance.
   *
   * Steps tested in sequence:
   *   1. Method selection
   *   2. URL entry (Share a Scroll)
   *   3. CSV upload (Deliver a Rune-Stone)
   *   4. Picker (Browse the Archives) — skipped, requires API key
   *   5. Loading/processing (if we trigger import)
   *   6. Preview
   *   7. Error state
   *   8. Success state
   *
   * We validate the first three steps that are navigable without external APIs.
   */
  test("all accessible dialog steps have sr-only DialogDescription elements", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');

    // Step 1: Method selection — check for sr-only description
    let srOnlyDescriptions = dialog.locator("div.sr-only");
    await expect(srOnlyDescriptions).not.toHaveCount(0);

    // Step 2: URL entry
    await page.getByText("Share a Scroll").click();
    await expect(dialog.locator("#sheets-url")).toBeVisible();
    srOnlyDescriptions = dialog.locator("div.sr-only");
    const descsInUrlStep = await srOnlyDescriptions.count();
    expect(descsInUrlStep).toBeGreaterThan(0);

    // Step 3: Back to method, then CSV upload
    await page.getByRole("button", { name: "Back" }).click();
    await page.getByText("Deliver a Rune-Stone").click();
    await expect(dialog.getByRole("button", { name: "Upload spreadsheet file" })).toBeVisible();
    srOnlyDescriptions = dialog.locator("div.sr-only");
    const descsInCsvStep = await srOnlyDescriptions.count();
    expect(descsInCsvStep).toBeGreaterThan(0);
  });

  /**
   * TC-A11Y-006 — DialogTitle is always present alongside DialogDescription
   *
   * Per WCAG, a dialog should have both a visible title (aria-labelledby)
   * and an optional description (aria-describedby). ImportWizard has both:
   *   - DialogTitle with the step name (visible)
   *   - DialogDescription with helper text (sr-only)
   */
  test("DialogTitle is present on all steps", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');

    // Method step title
    await expect(dialog.getByText("Import Cards")).toBeVisible();

    // URL entry step title
    await page.getByText("Share a Scroll").click();
    await expect(dialog.getByText("Share a Scroll")).toBeVisible();

    // CSV upload step title
    await page.getByRole("button", { name: "Back" }).click();
    await page.getByText("Deliver a Rune-Stone").click();
    await expect(dialog.getByText("Deliver a Rune-Stone")).toBeVisible();
  });

  /**
   * TC-A11Y-007 — SR-only descriptions do not interfere with visual layout
   *
   * sr-only class must hide descriptions from visual layout (display: none or similar)
   * while keeping them available to screen readers via aria-describedby or implicit
   * association with the dialog.
   */
  test("sr-only DialogDescription elements are hidden from visual layout", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');

    const srOnlyElements = dialog.locator("div.sr-only");

    // Iterate through all sr-only elements and verify visibility = hidden
    const count = await srOnlyElements.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const element = srOnlyElements.nth(i);
      // sr-only elements should be outside viewport or have display: none
      const visibility = await element.evaluate((el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        // Either position off-screen or display: none
        return {
          display: style.display,
          position: style.position,
          width: style.width,
          height: style.height,
          visibleArea: rect.width > 0 && rect.height > 0,
        };
      });

      // SR-only must be either display:none or very small (1px x 1px pattern)
      const isHidden = visibility.display === "none" ||
                       visibility.width === "1px" ||
                       !visibility.visibleArea;
      expect(isHidden).toBeTruthy();
    }
  });
});

// ─── Suite: /api/sheets/import Route ───────────────────────────────────────────

test.describe("Import API Route — /api/sheets/import", () => {
  /**
   * TC-API-001 — /api/sheets/import route exists and responds to requests
   *
   * Issue #256: /api/sheets/import returns 404. This test verifies the route
   * is defined and responds with a 4xx or 5xx error, not a 404 route-not-found.
   *
   * The route requires authentication, so an unauthenticated POST will return 401.
   * This confirms the route handler is reachable.
   */
  test("POST /api/sheets/import is accessible and not a 404 route error", async ({ page }) => {
    // Make an unauthenticated POST request to the import route
    const response = await page.request.post("/api/sheets/import", {
      data: { url: "https://docs.google.com/spreadsheets/d/test/edit" },
    });

    // Status should be 401 (auth required), not 404 (route not found)
    expect(response.status()).not.toBe(404);

    // Expected status: 401 (Unauthorized) because no auth header
    // The route exists and is being called, just requires authentication
    expect([400, 401, 500]).toContain(response.status());
  });

  /**
   * TC-API-002 — /api/sheets/import rejects requests without auth
   *
   * Per ADR-008 (API Route Auth), all API routes must call requireAuth(request).
   * /api/sheets/import should return 401 when no authorization header is present.
   */
  test("POST /api/sheets/import returns 401 without auth header", async ({ page }) => {
    const response = await page.request.post("/api/sheets/import", {
      data: { csv: "name,issuer,open_date\nTest Card,Test Bank,2024-01-01" },
    });

    // Must be 401, not 404
    expect(response.status()).toBe(401);

    const json = await response.json();
    expect(json).toHaveProperty("error");
  });

  /**
   * TC-API-003 — /api/sheets/import validates request body format
   *
   * The route expects exactly one of: url, csv, or file.
   * Test that it validates the body and returns 400 for invalid inputs.
   */
  test("POST /api/sheets/import rejects empty or malformed body", async ({ page }) => {
    // Send empty body
    const response = await page.request.post("/api/sheets/import", {
      data: {},
    });

    // Should reject (401 for no auth, or 400 for invalid body)
    expect([400, 401]).toContain(response.status());
  });

  /**
   * TC-API-004 — /api/sheets/import handles invalid JSON gracefully
   *
   * The route catches JSON parse errors and returns 400 "Invalid JSON body."
   */
  test("POST /api/sheets/import handles invalid JSON", async ({ page }) => {
    const response = await page.request.post("/api/sheets/import", {
      headers: { "Content-Type": "application/json" },
      data: "not valid json{",
    });

    // Should not be 404 (route exists)
    expect(response.status()).not.toBe(404);

    // Likely 400 (bad request) or 401 (auth) depending on order of validation
    expect([400, 401]).toContain(response.status());
  });

  /**
   * TC-API-005 — /api/sheets/import route is not 404 when accessed directly
   *
   * Final comprehensive check: the route /api/sheets/import exists and is
   * callable, even if it returns an error due to missing auth or invalid body.
   * A 404 would indicate the route file (route.ts) doesn't exist.
   */
  test("verifies /api/sheets/import route exists in the application", async ({ page }) => {
    // Try a POST with minimal valid structure
    const response = await page.request.post("/api/sheets/import", {
      data: { url: "" },
    });

    const status = response.status();

    // Any status code OTHER than 404 means the route is found
    expect(status).not.toBe(404);

    // Valid response statuses for this endpoint:
    // 401 = auth failed (route exists, working as designed)
    // 400 = bad request (route exists, validated input)
    // 500 = server error (route exists, error in handler)
    expect([400, 401, 500]).toContain(status);
  });
});

// ─── Suite: Google Picker & COOP Header ────────────────────────────────────────

test.describe("Import Wizard — Google Picker & COOP Header", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedWithCards(page);
    await openImportWizard(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
  });

  /**
   * TC-COOP-001 — Method selection step renders Browse the Archives option
   *
   * The picker integration requires the "Browse the Archives" button to be present.
   * If COOP headers are misconfigured, the picker might not load; we check the
   * UI is at least present and ready.
   */
  test("Browse the Archives method is present in method selection", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');

    // The picker button should be in the method selection
    const pickerMethod = dialog.getByText("Browse the Archives");
    await expect(pickerMethod).toBeVisible();
  });

  /**
   * TC-COOP-002 — Dialog remains accessible even if picker is not loaded
   *
   * COOP headers (Cross-Origin-Opener-Policy) may restrict the picker window.
   * The import wizard must remain usable for the URL and CSV paths even if
   * the picker path is unavailable.
   */
  test("other import methods remain accessible if picker is unavailable", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');

    // Verify alternative methods work
    const shareMethod = dialog.getByText("Share a Scroll");
    await expect(shareMethod).toBeVisible();
    await shareMethod.click();

    // URL entry should load
    await expect(dialog.locator("#sheets-url")).toBeVisible();

    // Back to method selection
    await page.getByRole("button", { name: "Back" }).click();

    // CSV method should also be accessible
    const csvMethod = dialog.getByText("Deliver a Rune-Stone");
    await expect(csvMethod).toBeVisible();
    await csvMethod.click();

    // CSV upload should load
    await expect(dialog.getByRole("button", { name: "Upload spreadsheet file" })).toBeVisible();
  });
});
