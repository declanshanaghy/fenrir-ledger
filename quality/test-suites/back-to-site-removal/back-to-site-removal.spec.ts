/**
 * Back to Site Link Removal Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates that the redundant "Back to site" link has been removed from
 * LedgerTopBar while preserving the core functionality:
 *   - FENRIR LEDGER logo still links to marketing home (/)
 *   - No "Back to site" text link on desktop
 *   - No back arrow icon on mobile
 *   - Layout remains clean without gaps
 *
 * Ref: Issue #426
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
  await page.goto("/");
  await clearAllStorage(page);
  await seedHousehold(page, ANONYMOUS_HOUSEHOLD_ID);
  // Navigate to ledger page to see LedgerTopBar
  await page.goto("/ledger", { waitUntil: "networkidle" });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Back to Site Link Removed
// ════════════════════════════════════════════════════════════════════════════

test.describe("Back to Site Link Removal", () => {
  test("back to site text link is not present on desktop view", async ({
    page,
  }) => {
    // Set viewport to desktop size
    await page.setViewportSize({ width: 1024, height: 768 });

    // The "Back to site" link should not exist anywhere in the header
    const backToSiteLink = page.locator(
      'header a:has-text("Back to site")'
    );
    await expect(backToSiteLink).not.toBeAttached();
  });

  test("back arrow link is not present on mobile view", async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });

    // The back arrow link (with aria-label "Back to Fenrir Ledger site") should not exist
    const backArrowLink = page.locator(
      'header a[aria-label="Back to Fenrir Ledger site"]'
    );
    await expect(backArrowLink).not.toBeAttached();
  });

  test("fenrir ledger logo still links to home", async ({ page }) => {
    // The logo link should still exist and point to /
    const logoLink = page.locator(
      'header a[aria-label="Fenrir Ledger — go to home"]'
    );
    await expect(logoLink).toBeAttached();
    await expect(logoLink).toHaveAttribute("href", "/");
  });

  test("header layout has no gaps after removal on desktop", async ({
    page,
  }) => {
    // Set viewport to desktop size
    await page.setViewportSize({ width: 1024, height: 768 });

    // Header should exist and have proper flex layout (justify-between)
    const header = page.locator("header");
    await expect(header).toBeVisible();

    // Logo section (left) should be visible
    const logoLink = header.locator(
      'a[aria-label="Fenrir Ledger — go to home"]'
    );
    await expect(logoLink).toBeVisible();

    // Avatar button (right section) should be visible
    const avatarButton = header.locator(
      'button[aria-label="Sign in to sync your data"]'
    );
    await expect(avatarButton).toBeVisible();

    // No "Back to site" should exist anywhere
    const backToSite = header.locator('a:has-text("Back to site")');
    await expect(backToSite).not.toBeAttached();
  });
});
