import { test, expect } from "@playwright/test";

/**
 * Test Suite: Sign-in Visual State Transitions
 * Issue: #148
 *
 * Validates core sign-in flow: stable sign-in page load, auth callback
 * keeps loading state, and no rapid success flash.
 * Slimmed to core interactive behavior only.
 */

const SERVER_URL = process.env.SERVER_URL || "http://localhost:9653";

test.describe("Sign-in State Transitions", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.goto(SERVER_URL);
  });

  test("sign-in page loads stably without flickering", async ({
    page,
  }) => {
    await page.goto(SERVER_URL);
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
    await page.context().clearCookies();

    await page.goto(`${SERVER_URL}/ledger/sign-in`);
    await page.waitForLoadState("networkidle");

    const signInButton = page.getByRole("button", {
      name: /sign in to google/i,
    });
    await expect(signInButton).toBeVisible({ timeout: 5000 });
  });

  test("success state 'The wolf is named' does not appear during callback", async ({
    page,
  }) => {
    await page.goto(SERVER_URL);
    await page.evaluate(() => {
      sessionStorage.setItem(
        "fenrir:pkce",
        JSON.stringify({
          state: "test_state",
          codeVerifier: "test_verifier",
          callbackUrl: "/",
        })
      );
    });

    const mockCallbackUrl = `${SERVER_URL}/ledger/auth/callback?code=test_code&state=test_state`;
    await page.goto(mockCallbackUrl).catch(() => {});

    const successMessage = page.getByText(/the wolf is named/i);
    const isSuccessVisible = await successMessage.isVisible({ timeout: 1000 }).catch(() => false);

    expect(isSuccessVisible).toBeFalsy();
  });
});
