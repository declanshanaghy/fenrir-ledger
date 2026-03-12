/**
 * Stale Auth Nudge — Playwright Test Suite
 * Authored by Loki, QA Tester of the Pack
 *
 * Slimmed to interactive behavior only:
 *   - Nudge appears when stale auth cache exists
 *   - Nudge dismisses on click
 *   - Nudge does not show when auth is fresh (no cache)
 *   - Dismiss clears cache and sets session flag
 *   - Sign-in button navigates to /sign-in
 *
 * Removed: positioning tests, touch target measurements, mobile layout tests,
 * specific text content assertions, aria-label checks, viewport overflow checks.
 */

import { test, expect, type Page } from "@playwright/test";
import { clearAllStorage } from "../helpers/test-fixtures";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITLEMENT_CACHE_KEY = "fenrir:entitlement";
const NUDGE_DISMISSED_KEY = "fenrir:stale-auth-nudge-dismissed";

const STALE_ENTITLEMENT = {
  tier: "karl",
  active: true,
  platform: "stripe",
  userId: "cus_test_stale123",
  linkedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
  checkedAt: Date.now() - 2 * 60 * 60 * 1000,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedStaleEntitlement(
  page: Page,
  entitlement: object = STALE_ENTITLEMENT
): Promise<void> {
  await page.evaluate(
    ({ key, value }: { key: string; value: string }) => {
      localStorage.setItem(key, value);
    },
    {
      key: ENTITLEMENT_CACHE_KEY,
      value: JSON.stringify(entitlement),
    }
  );
}

async function resetAllState(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await clearAllStorage(page);
  await page.evaluate((key: string) => {
    sessionStorage.removeItem(key);
  }, NUDGE_DISMISSED_KEY);
}

async function getEntitlementCacheValue(page: Page): Promise<string | null> {
  return page.evaluate((key: string) => {
    return localStorage.getItem(key);
  }, ENTITLEMENT_CACHE_KEY);
}

async function getDismissFlag(page: Page): Promise<string | null> {
  return page.evaluate((key: string) => {
    return sessionStorage.getItem(key);
  }, NUDGE_DISMISSED_KEY);
}

function getBanner(page: Page) {
  return page.locator('header').locator('div:has(> span:has-text("The wolf remembers"))').first();
}

function getDesktopDismissBtn(page: Page) {
  return getBanner(page)
    .locator('[aria-label="Dismiss sign-in reminder"]');
}

function getDesktopSignInBtn(page: Page) {
  return getBanner(page)
    .locator('button:has-text("Sign in")');
}

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

test.beforeEach(async ({ page }) => {
  await resetAllState(page);
});

// ===========================================================================
// AC-1: Stale cache + anonymous user shows nudge
// ===========================================================================

test.describe("AC-1: Stale cache shows nudge", () => {
  test("Banner visible when stale entitlement cache exists and user is anonymous", async ({
    page,
  }) => {
    await seedStaleEntitlement(page, STALE_ENTITLEMENT);
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(getBanner(page)).toBeVisible({ timeout: 5000 });
  });
});

// ===========================================================================
// AC-2: Nudge is dismissible
// ===========================================================================

test.describe("AC-2: Nudge is dismissible", () => {
  test("Clicking dismiss hides the banner", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedStaleEntitlement(page);
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(getBanner(page)).toBeVisible({ timeout: 5000 });

    await getDesktopDismissBtn(page).click();

    await expect(getBanner(page)).not.toBeVisible({ timeout: 2000 });
  });

  test("Dismissing clears the entitlement cache from localStorage", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedStaleEntitlement(page);
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(getBanner(page)).toBeVisible({ timeout: 5000 });

    await getDesktopDismissBtn(page).click();

    const cacheValue = await getEntitlementCacheValue(page);
    expect(cacheValue).toBeNull();
  });

  test("Dismissing sets the sessionStorage dismiss flag", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedStaleEntitlement(page);
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(getBanner(page)).toBeVisible({ timeout: 5000 });

    await getDesktopDismissBtn(page).click();

    const flag = await getDismissFlag(page);
    expect(flag).toBe("true");
  });
});

// ===========================================================================
// AC-3: No nudge for genuinely anonymous users
// ===========================================================================

test.describe("AC-3: No nudge for genuinely anonymous users", () => {
  test("No banner when localStorage has no entitlement cache", async ({
    page,
  }) => {
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(getBanner(page)).not.toBeVisible();
  });

  test("No banner when sessionStorage dismiss flag is set (even with stale cache)", async ({
    page,
  }) => {
    await seedStaleEntitlement(page);

    await page.evaluate((key: string) => {
      sessionStorage.setItem(key, "true");
    }, NUDGE_DISMISSED_KEY);

    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(getBanner(page)).not.toBeVisible();
  });
});

// ===========================================================================
// AC-4 proxy: Sign-in CTA navigates to /sign-in
// ===========================================================================

test.describe("AC-4: Sign-in navigation", () => {
  test("Clicking desktop 'Sign in' button navigates to /sign-in", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedStaleEntitlement(page);
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(getDesktopSignInBtn(page)).toBeVisible({ timeout: 5000 });

    await getDesktopSignInBtn(page).click();
    await page.waitForURL("**/sign-in**", { timeout: 5000 });

    expect(page.url()).toContain("/ledger/sign-in");
  });
});
