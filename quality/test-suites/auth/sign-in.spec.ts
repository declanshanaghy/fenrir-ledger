/**
 * Sign-In Page Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Trimmed to 2 core tests per issue #613:
 *   1. Sign-in happy path: page loads, Google button visible
 *   2. Continue without signing in navigates to dashboard
 *
 * Data isolation: clearAllStorage() before each test.
 */

import { test, expect } from "../helpers/analytics-block";
import { clearAllStorage } from "../helpers/test-fixtures";

test.beforeEach(async ({ page }) => {
  await page.goto("/ledger");
  await clearAllStorage(page);
  await page.goto("/ledger/sign-in", { waitUntil: "load" });
});

test("sign-in page loads with Google button visible", async ({ page }) => {
  const heading = page.locator("h1#signin-heading");
  await expect(heading).toBeVisible();

  const btn = page.locator('button:has-text("Sign in to Google")');
  await expect(btn).toBeVisible();
  await expect(btn).toBeEnabled();
});

test("'Continue without signing in' navigates to dashboard", async ({
  page,
}) => {
  const btn = page.locator('button:has-text("Continue without signing in")');
  await expect(btn).toBeVisible();
  await btn.click();
  await page.waitForURL("**/ledger", { timeout: 5000 });
  expect(page.url()).not.toContain("/ledger/sign-in");
});
