/**
 * Stale Auth Nudge — Playwright Test Suite
 * Authored by Loki, QA Tester of the Pack
 *
 * Trimmed to 2 core tests per issue #613:
 *   1. Banner visible when stale entitlement cache exists
 *   2. Clicking dismiss hides the banner
 */

import { test, expect, type Page } from "@playwright/test";
import { clearAllStorage } from "../helpers/test-fixtures";

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
  await page.goto("/ledger", { waitUntil: "domcontentloaded" });
  await clearAllStorage(page);
  await page.evaluate((key: string) => {
    sessionStorage.removeItem(key);
  }, NUDGE_DISMISSED_KEY);
}

function getBanner(page: Page) {
  return page
    .locator("header")
    .locator('div:has(> span:has-text("The wolf remembers"))')
    .first();
}

function getDesktopDismissBtn(page: Page) {
  return getBanner(page).locator(
    '[aria-label="Dismiss sign-in reminder"]'
  );
}

test.beforeEach(async ({ page }) => {
  await resetAllState(page);
});

test("Banner visible when stale entitlement cache exists and user is anonymous", async ({
  page,
}) => {
  await seedStaleEntitlement(page, STALE_ENTITLEMENT);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(getBanner(page)).toBeVisible({ timeout: 5000 });
});

test("Clicking dismiss hides the banner", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedStaleEntitlement(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(getBanner(page)).toBeVisible({ timeout: 5000 });
  await getDesktopDismissBtn(page).click();
  await expect(getBanner(page)).not.toBeVisible({ timeout: 2000 });
});
