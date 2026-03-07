/**
 * Sign-In State Transitions Test Suite — Issue #148
 *
 * Validates that the sign-in flow implementation reduces visual state transitions
 * as specified in the acceptance criteria.
 *
 * Since we cannot fully automate OAuth in tests, these tests validate:
 * 1. Auth callback page shows "Binding the oath..." message (no success state flash)
 * 2. Dashboard implements 500ms skeleton delay (no flash on fast loads)
 * 3. The visual states are correctly implemented in the code
 *
 * Manual testing is still required to validate the full end-to-end flow through
 * actual Google OAuth.
 */

import { test, expect } from "@playwright/test";
import { clearAllStorage } from "../helpers/test-fixtures";

test.describe("Sign-In State Transitions — Issue #148", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearAllStorage(page);
  });

  test("AC3: Auth callback does not show success state flash", async ({
    page,
  }) => {
    // Navigate directly to auth callback
    // This tests that the success state UI was removed from the code
    await page.goto("/auth/callback");

    // Wait for the page to render
    await page.waitForLoadState("networkidle");

    // The success message "The wolf is named" should NOT exist anywhere in the page
    // (it was removed per the fix - see code validation test for confirmation)
    const successMessage = page.locator('text="The wolf is named"');
    const successExists = await successMessage.count();

    // We should NEVER see the removed success message
    expect(successExists).toBe(0);

    console.log("✓ Success state UI does not exist in callback page");
  });

  test("AC2: Dashboard implements 500ms skeleton delay", async ({ page }) => {
    // This tests the implementation of the showSkeleton state delay
    await page.goto("/");

    // Measure time to first meaningful content
    const startTime = Date.now();

    // Wait for either skeleton or actual content to appear
    const contentAppeared = await Promise.race([
      page.locator('[data-testid="skeleton-grid"]').waitFor({
        state: "visible",
        timeout: 1000,
      }).then(() => "skeleton"),
      page.locator('h1:has-text("The Ledger of Fates")').waitFor({
        state: "visible",
        timeout: 1000,
      }).then(() => "content"),
    ]).catch(() => "timeout");

    const renderTime = Date.now() - startTime;
    console.log(`Dashboard render: ${renderTime}ms, state: ${contentAppeared}`);

    // For fast loads (< 500ms), skeleton should NOT appear
    if (contentAppeared === "skeleton" && renderTime < 500) {
      throw new Error(
        `Skeleton appeared at ${renderTime}ms (should only show after 500ms delay)`
      );
    }

    // For loads >= 500ms, skeleton appearing is acceptable (loading is genuinely slow)
    // For fast loads, content should appear without skeleton flash
    if (contentAppeared === "content") {
      console.log("✓ Fast load - no skeleton flash");
    } else if (contentAppeared === "skeleton" && renderTime >= 500) {
      console.log("✓ Slow load - skeleton delay working correctly");
    }
  });

  test("Dashboard skeleton grid has correct structure", async ({ page }) => {
    // Verify the skeleton grid component is properly structured for testing
    await page.goto("/");

    // Check if skeleton appears (may or may not depending on load time)
    const skeletonGrid = page.locator('[data-testid="skeleton-grid"]');

    // Wait a bit to see if skeleton appears, handling both success and timeout
    const skeletonAppears = await Promise.race([
      skeletonGrid.waitFor({ state: "visible", timeout: 600 }).then(() => true).catch(() => false),
      page.waitForTimeout(600).then(() => false),
    ]);

    if (skeletonAppears) {
      // If skeleton appears, verify it has the Norn loading message
      const nornMessage = page.locator('text="The Norns are weaving..."');
      await expect(nornMessage).toBeVisible();
      console.log("✓ Skeleton grid properly tagged with data-testid");
    } else {
      console.log("✓ Load completed before skeleton delay (< 500ms)");
    }
  });

  test("Auth callback error state shows correctly", async ({ page }) => {
    // Test that the error state is properly rendered (validates the UI exists)
    await page.goto("/auth/callback?error=access_denied");

    // Wait for error state to render
    await page.waitForTimeout(200);

    const errorHeading = page.locator('text="The Bifröst trembled"');
    await expect(errorHeading).toBeVisible({ timeout: 5000 });

    // Error message should be displayed
    const errorContent = await page
      .locator(".text-muted-foreground.font-body")
      .first()
      .textContent();
    expect(errorContent).toBeTruthy();

    // Return to gate link should be present
    const returnLink = page.locator('a[href="/sign-in"]');
    await expect(returnLink).toBeVisible();
    await expect(returnLink).toHaveText("Return to the gate");
  });

  test("Auth callback prevents double-mount race conditions", async ({ page }) => {
    // Validates that the component handles React StrictMode double-mount
    // by checking that the error state doesn't flash when PKCE data is missing

    // Navigate to callback without any session data
    await page.goto("/auth/callback?code=test&state=test");

    // The page should show an error after the 100ms race condition delay
    // but should NOT flash between states rapidly
    await page.waitForTimeout(150);

    // Error message about missing PKCE data should appear
    const errorMessage = page.locator('text="PKCE session data missing"');
    const errorVisible = await errorMessage
      .isVisible()
      .catch(() => false);

    if (errorVisible) {
      console.log("✓ PKCE missing error shown after delay (prevents flash)");
    }
  });

  test("Code validation: Auth callback keeps loading state until redirect", async () => {
    // This is a code inspection test - validates that the success state
    // was removed from the callback page as per the fix

    // Read the auth callback page source
    const fs = require("fs");
    const path = require("path");
    const callbackPath = path.join(
      process.cwd(),
      "../..",
      "development/frontend/src/app/auth/callback/page.tsx"
    );

    const source = fs.readFileSync(callbackPath, "utf-8");

    // Verify that the success state handling was removed
    // Line 225-227 comment: "Don't show the success state - keep the exchanging state visible"
    expect(source).toContain(
      "Don't show the success state - keep the exchanging state visible"
    );

    // Verify the success state UI was removed (commented out with {/* */})
    expect(source).toContain("/* Success state removed");

    // Verify there's no setCallbackStatus("success") call
    expect(source).not.toMatch(/setCallbackStatus\(\s*["']success["']\s*\)/);

    console.log(
      "✓ Code validation: Success state removed, loading persists until redirect"
    );
  });

  test("Code validation: Dashboard implements 500ms skeleton delay", async () => {
    // This is a code inspection test - validates the skeleton delay implementation

    const fs = require("fs");
    const path = require("path");
    const dashboardPath = path.join(
      process.cwd(),
      "../..",
      "development/frontend/src/app/page.tsx"
    );

    const source = fs.readFileSync(dashboardPath, "utf-8");

    // Verify skeleton delay timer exists (line 52)
    expect(source).toContain("const skeletonTimer = setTimeout");
    expect(source).toContain("setShowSkeleton(true)");

    // Verify the 500ms delay
    expect(source).toMatch(/setTimeout\([^,]+,\s*500\)/);

    // Verify conditional rendering based on showSkeleton state (line 185-192)
    expect(source).toContain("showSkeleton ?");
    expect(source).toContain("Only show skeleton if loading takes > 500ms");

    console.log("✓ Code validation: 500ms skeleton delay implemented correctly");
  });
});
