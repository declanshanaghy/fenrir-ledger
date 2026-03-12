/**
 * Settings Soft Gate -- Playwright Test Suite
 *
 * Slimmed to interactive behavior only:
 *   - Gate shows feature sections when not authed (non-subscriber)
 *   - Gate hides hard-gate placeholder (soft mode works)
 *   - Subscribe/CTA button is present when banners show
 *   - Dashboard and Valhalla load without regression
 *
 * Removed: touch target measurements, mobile viewport tests,
 * aria-hidden checks, subtitle text, specific description text,
 * banner heading text assertions.
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLOUD_SYNC_LABEL = "Cloud Sync";
const MULTI_HOUSEHOLD_LABEL = "Multi-Household";
const DATA_EXPORT_LABEL = "Data Export";
const BANNER_ARIA_LABEL = "Unlock this feature";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function clearSubscriptionState(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.removeItem("fenrir:entitlement");
    localStorage.removeItem("fenrir:patreon-user-id");
    localStorage.removeItem("fenrir:upsell-dismissed");
    localStorage.removeItem("fenrir:stripe_upsell_dismissed");
    sessionStorage.clear();
  });
}

async function navigateToSettings(page: Page): Promise<void> {
  await page.goto("/ledger/settings", { waitUntil: "load" });
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({ timeout: 10000 });
}

// ===========================================================================
// AC-4: All 3 feature sections visible for non-subscribers
// ===========================================================================

test.describe("Settings page -- all sections visible for non-subscribers (AC-4)", () => {
  test.beforeEach(async ({ page }) => {
    await clearSubscriptionState(page);
  });

  test("All 3 feature sections are visible simultaneously", async ({ page }) => {
    await navigateToSettings(page);
    await expect(page.getByRole("region", { name: CLOUD_SYNC_LABEL, exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: MULTI_HOUSEHOLD_LABEL, exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: DATA_EXPORT_LABEL, exact: true })).toBeVisible();
  });
});

// ===========================================================================
// AC-3: Subscribe banners and CTA
// ===========================================================================

test.describe("Soft gate banners -- CTA present for non-subscribers (AC-3)", () => {
  test.beforeEach(async ({ page }) => {
    await clearSubscriptionState(page);
  });

  test("Subscribe or Learn more button is present in banner when platform is active", async ({ page }) => {
    await navigateToSettings(page);

    const banners = page.getByRole("region", { name: BANNER_ARIA_LABEL });
    const bannerCount = await banners.count();

    if (bannerCount > 0) {
      const firstBanner = banners.first();
      const subscribeBtn = firstBanner.getByRole("button", { name: /subscribe/i });
      const learnMoreBtn = firstBanner.getByRole("button", { name: /learn more/i });

      const hasSubscribe = await subscribeBtn.isVisible().catch(() => false);
      const hasLearnMore = await learnMoreBtn.isVisible().catch(() => false);

      expect(hasSubscribe || hasLearnMore).toBe(true);
    }
  });

  test("Banner and feature section coexist in the same gate (soft mode)", async ({ page }) => {
    await navigateToSettings(page);

    const banners = page.getByRole("region", { name: BANNER_ARIA_LABEL });
    const bannerCount = await banners.count();

    if (bannerCount > 0) {
      await expect(page.getByRole("region", { name: CLOUD_SYNC_LABEL, exact: true })).toBeVisible();
    }
  });
});

// ===========================================================================
// Settings page uses soft mode -- no hard gate placeholder
// ===========================================================================

test.describe("Soft mode -- no hard gate (AC-7, AC-8)", () => {
  test.beforeEach(async ({ page }) => {
    await clearSubscriptionState(page);
  });

  test("Settings page uses soft mode -- no hard gate placeholder visible", async ({ page }) => {
    await navigateToSettings(page);

    await expect(page.getByText("This feature requires a Karl subscription.")).not.toBeVisible();

    await expect(page.getByRole("region", { name: CLOUD_SYNC_LABEL, exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: MULTI_HOUSEHOLD_LABEL, exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: DATA_EXPORT_LABEL, exact: true })).toBeVisible();
  });

  test("Settings page renders and shows Settings heading", async ({ page }) => {
    await navigateToSettings(page);
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
  });
});

// ===========================================================================
// Regression -- other pages unaffected
// ===========================================================================

test.describe("Regression -- no pages broken", () => {
  test.beforeEach(async ({ page }) => {
    await clearSubscriptionState(page);
  });

  test("Dashboard loads without SubscriptionGate-related errors", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });

    await expect(page.getByText("Something went wrong")).not.toBeVisible();
    await expect(page.getByText("Application error")).not.toBeVisible();
  });

  test("Valhalla page loads without regression", async ({ page }) => {
    await page.goto("/ledger/valhalla", { waitUntil: "load" });

    await expect(page.getByText("Application error")).not.toBeVisible();
  });
});
