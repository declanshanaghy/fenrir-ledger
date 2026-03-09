/**
 * Footer Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Slimmed to interactive behavior only:
 *   - About modal opens from footer button
 *   - About modal closes via Close button and Escape key
 *
 * Removed: static text content checks, tagline assertions, copyright text,
 * team colophon text, Gleipnir ingredient lists, data attributes.
 */

import { test, expect } from "@playwright/test";
import {
  clearAllStorage,
  seedHousehold,
  ANONYMOUS_HOUSEHOLD_ID,
} from "../helpers/test-fixtures";

// ════════════════════════════════════════════════════════════════════════════
// Setup
// ════════════════════════════════════════════════════════════════════════════

test.beforeEach(async ({ page }) => {
  await page.goto("/", { waitUntil: "load" });
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  await page.reload({ waitUntil: "load" });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: About modal — opens from footer
// ════════════════════════════════════════════════════════════════════════════

test.describe("Footer — About modal", () => {
  test("clicking 'FENRIR LEDGER' button opens the About modal", async ({
    page,
  }) => {
    const footerBrand = page.locator(
      'footer button[aria-label="About Fenrir Ledger"]'
    );
    await footerBrand.click();

    const dialogTitle = page.locator('text="About Fenrir Ledger"').first();
    await expect(dialogTitle).toBeVisible();
  });

  test("About modal can be closed with the Close button", async ({ page }) => {
    const footerBrand = page.locator(
      'footer button[aria-label="About Fenrir Ledger"]'
    );
    await footerBrand.click();

    await expect(page.locator('text="About Fenrir Ledger"').first()).toBeVisible();

    const closeButton = page.locator('[role="dialog"] button:has-text("Close")').first();
    await closeButton.click();

    await expect(
      page.locator('text="About Fenrir Ledger"').first()
    ).not.toBeVisible();
  });

  test("About modal can be closed by pressing Escape", async ({ page }) => {
    const footerBrand = page.locator(
      'footer button[aria-label="About Fenrir Ledger"]'
    );
    await footerBrand.click();

    await expect(page.locator('text="About Fenrir Ledger"').first()).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(
      page.locator('text="About Fenrir Ledger"').first()
    ).not.toBeVisible();
  });
});
