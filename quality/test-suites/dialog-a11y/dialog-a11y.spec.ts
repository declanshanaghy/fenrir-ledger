/**
 * Dialog A11y Test Suite — Fenrir Ledger Issue #256
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates that all DialogContent components have proper accessibility:
 * - Each DialogContent has either a DialogDescription child or aria-describedby={undefined}
 * - The Import Wizard dialog has DialogDescription on every step
 * - /api/sheets/import route exists and responds (not 404)
 * - COOP header configuration doesn't break Google Picker flow
 *
 * Acceptance Criteria:
 *   AC1: All DialogContent components have either a DialogDescription child or aria-describedby={undefined}
 *   AC2: /api/sheets/import route responds correctly (not 404)
 *   AC3: COOP header configuration doesn't break Google Picker flow
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
 * Seeds a fake FenrirSession into localStorage so the app treats the browser
 * context as authenticated without a real Google OAuth round-trip.
 */
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
 * Full setup for tests that need the toolbar Import button.
 */
async function setupAuthenticatedWithCards(page: any): Promise<void> {
  await page.goto("/", { waitUntil: "load" });
  await seedFakeAuth(page);
  await seedHousehold(page, AUTH_HOUSEHOLD_ID);
  await seedCards(page, AUTH_HOUSEHOLD_ID, FEW_CARDS);
  await page.reload({ waitUntil: "load" });
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

// ─── Suite: Dialog A11y Structure ─────────────────────────────────────────────

test.describe("Dialog A11y — Import Wizard DialogContent accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedWithCards(page);
    await openImportWizard(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
  });

  /**
   * AC1 — Method Selection Step has DialogDescription
   *
   * Verifies that DialogContent in the Method Selection step has
   * either a child DialogDescription or aria-describedby={undefined}.
   * The Import Wizard adds: "Choose a method to import your credit cards into Fenrir Ledger"
   */
  test("method selection dialog has DialogDescription", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');
    await expect(dialog).toBeVisible();

    // Check for DialogDescription presence in the step
    // The sr-only class hides it visually but keeps it in the accessibility tree
    const description = dialog.locator("text='Choose a method to import your credit cards into Fenrir Ledger'");
    await expect(description).toBeVisible();

    // Verify sr-only class is applied (screen-reader only)
    const classAttr = await description.getAttribute("class");
    expect(classAttr).toContain("sr-only");
  });

  /**
   * AC1 — Dialog has properly structured DialogDescription
   *
   * Validates that the DialogContent includes DialogDescription elements
   * for accessibility. Each step should have a description in the DOM.
   */
  test("dialog has DialogDescription elements for accessibility", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');
    await expect(dialog).toBeVisible();

    // Find all sr-only elements in the dialog (these are the DialogDescription elements)
    const srOnlyElements = dialog.locator(".sr-only");
    const count = await srOnlyElements.count();

    // Should have at least one sr-only description element
    expect(count).toBeGreaterThanOrEqual(1);

    // Verify at least one contains substantial text (not just "Close" or aria-live content)
    let hasValidDescription = false;
    for (let i = 0; i < Math.min(3, count); i++) {
      const text = await srOnlyElements.nth(i).textContent();
      if (text && text.length > 20) {
        hasValidDescription = true;
        break;
      }
    }
    expect(hasValidDescription).toBe(true);
  });

  /**
   * AC1 — Dialog descriptions use sr-only class
   *
   * Verifies that DialogDescription elements are hidden visually
   * using the sr-only class while remaining accessible to screen readers.
   */
  test("dialog descriptions use sr-only accessibility class", async ({ page }) => {
    const dialog = page.locator('[aria-label="Import Wizard"]');

    // Count sr-only elements that contain description text
    const srOnlyElements = dialog.locator(".sr-only");
    const count = await srOnlyElements.count();

    // Should have at least one sr-only element (the Method Selection description)
    expect(count).toBeGreaterThanOrEqual(1);

    // Get the first sr-only element's text
    const firstDescription = await srOnlyElements.first().textContent();
    expect(firstDescription).toBeTruthy();
    expect(firstDescription?.length).toBeGreaterThan(0);
  });
});

// ─── Suite: API Route & COOP Header ────────────────────────────────────────────

test.describe("Dialog A11y — /api/sheets/import route and COOP header", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedWithCards(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
  });

  /**
   * AC2 — /api/sheets/import route exists and responds
   *
   * Verifies that the import API endpoint is reachable and does not return 404.
   * This is called during the import flow when cards are fetched from a Google Sheet.
   */
  test("/api/sheets/import route exists and responds", async ({ page }) => {
    // Make a POST request to the import API endpoint (expected method)
    const response = await page.request.post("/api/sheets/import", {
      data: { url: "https://docs.google.com/spreadsheets/d/test" },
    });

    // Should not be 404
    expect(response.status()).not.toBe(404);

    // Should be either 200, 400 (bad request), 401 (unauthorized), 403 (forbidden), or 405 (method not allowed)
    // depending on the request validity and auth state
    expect([200, 400, 401, 403, 405]).toContain(response.status());
  });

  /**
   * AC3 — COOP header doesn't break Google Picker
   *
   * The app may set Cross-Origin-Opener-Policy header.
   * This test verifies that the header is either not set or is compatible
   * with Google Picker's cross-origin communication requirements.
   */
  test("COOP header configuration is compatible with Google Picker", async ({ page }) => {
    // Navigate to home to get base page response headers
    await page.goto("/", { waitUntil: "load" });

    // Check response headers from the main page
    // Google Picker requires certain COOP policies to function
    // COOP: unsafe-none allows cross-origin access (needed for Google Picker)
    // COOP: same-origin-allow-popups is also compatible

    // Make a request and check the response headers
    const response = await page.context().request?.get("/") as any;
    const coopHeader = response?.headers?.()?.["cross-origin-opener-policy"] ||
                       response?.headers?.()?.["cross-origin-opener-policy".toLowerCase()];

    // If COOP header is set, it should allow popups for Google Picker
    if (coopHeader) {
      expect(coopHeader).toMatch(/unsafe-none|same-origin-allow-popups/i);
    }
  });
});

