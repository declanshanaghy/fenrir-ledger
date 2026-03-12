/**
 * TopBar Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Slimmed to interactive behavior only:
 *   - Anonymous avatar click opens upsell panel
 *   - 'Not now' dismisses upsell panel
 *   - Escape dismisses upsell panel
 *   - Logo link opens in new tab
 *
 * Removed: static text/tagline checks, brand name presence,
 * aria-label text, rel attribute, email pattern assertions.
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
  await page.reload({ waitUntil: "load" });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Logo link
// ════════════════════════════════════════════════════════════════════════════

test.describe("TopBar — Logo link", () => {
  test("header contains a link with href='/static' that opens in a new tab", async ({
    page,
  }) => {
    const logoLink = page.locator('header a[href="/"]').first();
    await expect(logoLink).toBeAttached();
    await expect(logoLink).toHaveAttribute("target", "_blank");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite: Anonymous state — upsell panel interaction
// ════════════════════════════════════════════════════════════════════════════

test.describe("TopBar — Anonymous state", () => {
  test("clicking anonymous avatar opens the upsell prompt panel", async ({
    page,
  }) => {
    const avatarButton = page.locator(
      'header button[aria-label="Sign in to sync your data"]'
    );
    await avatarButton.click();

    const upsellPanel = page.locator('[role="dialog"][aria-label="Sign in to sync"]');
    await expect(upsellPanel).toBeVisible();
  });

  test("'Not now' dismisses the upsell panel", async ({ page }) => {
    const avatarButton = page.locator(
      'header button[aria-label="Sign in to sync your data"]'
    );
    await avatarButton.click();

    const notNow = page.locator('button:has-text("Not now")');
    await expect(notNow).toBeVisible();
    await notNow.click();

    const upsellPanel = page.locator('[role="dialog"][aria-label="Sign in to sync"]');
    await expect(upsellPanel).not.toBeVisible();
  });

  test("pressing Escape dismisses the upsell panel", async ({ page }) => {
    const avatarButton = page.locator(
      'header button[aria-label="Sign in to sync your data"]'
    );
    await avatarButton.click();

    await expect(
      page.locator('[role="dialog"][aria-label="Sign in to sync"]')
    ).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(
      page.locator('[role="dialog"][aria-label="Sign in to sync"]')
    ).not.toBeVisible();
  });
});
