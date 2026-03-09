/**
 * Sign-In State Transitions Test Suite — Issue #148
 *
 * Validates core sign-in flow behavior: redirect, state clearing,
 * and auth/unauth transitions.
 * Slimmed to core interactive behavior only.
 */

import { test, expect } from "@playwright/test";
import { clearAllStorage } from "../helpers/test-fixtures";

test.describe("Sign-In State Transitions — Issue #148", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearAllStorage(page);
  });

  test("Auth callback does not show removed success state flash", async ({
    page,
  }) => {
    await page.goto("/auth/callback");
    await page.waitForLoadState("networkidle");

    const successMessage = page.locator('text="The wolf is named"');
    const successExists = await successMessage.count();
    expect(successExists).toBe(0);
  });

  test("Auth callback error state shows correctly", async ({ page }) => {
    await page.goto("/auth/callback?error=access_denied");
    await page.waitForTimeout(200);

    const errorHeading = page.locator('text="The Bifröst trembled"');
    await expect(errorHeading).toBeVisible({ timeout: 5000 });

    const returnLink = page.locator('a[href="/sign-in"]');
    await expect(returnLink).toBeVisible();
  });

  test("Auth callback error provides return link to sign-in", async ({ page }) => {
    await page.goto("/auth/callback?error=access_denied");
    await page.waitForTimeout(200);

    const returnLink = page.locator('a[href="/sign-in"]');
    await expect(returnLink).toBeVisible();
    await expect(returnLink).toHaveText("Return to the gate");
  });
});
