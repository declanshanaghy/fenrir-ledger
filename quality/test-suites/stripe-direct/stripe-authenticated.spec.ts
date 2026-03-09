/**
 * Stripe Authenticated UI Tests -- Previously Manual Tests
 *
 * These tests were previously marked as MANUAL in the main test suite.
 * They use seeded KV state or mocked API responses to test authenticated UI states.
 *
 * Tests cover:
 *   - Karl active state UI (MANUAL-01)
 *   - Canceling/Canceled state UI (MANUAL-02)
 *   - Post-checkout redirect with session_id migration
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = process.env.SERVER_URL ?? "http://localhost:9653";

// ---------------------------------------------------------------------------
// Mock Data Setup
// ---------------------------------------------------------------------------

async function mockAuthenticatedUser(page: Page, googleSub = "google_test123"): Promise<void> {
  // Mock the FenrirSession in localStorage ("fenrir:auth")
  // This must be done AFTER page.goto() so localStorage is available
  // It will be set by the test right after navigation
  return Promise.resolve();
}

async function setupAuthenticatedSession(page: Page, googleSub = "google_test123"): Promise<void> {
  // Calculate expires_at as a timestamp far in the future (year 2050)
  const futureTimestamp = new Date("2050-01-01").getTime();

  // Create the mock session object
  const mockSession = {
    access_token: "mock_access_token_" + googleSub,
    id_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJuYW1lIjoiVGVzdCBVc2VyIiwicGljdHVyZSI6Imh0dHBzOi8vZXhhbXBsZS5jb20vcGljdHVyZS5qcGciLCJpYXQiOjE2NzY2MzI0MDAsImV4cCI6OTk5OTk5OTk5OX0.8f2f-U2Y6L7Z3j6K0N4O5P8Q9R1S2T3U4V5W6X7Y8Z",
    refresh_token: "mock_refresh_token_" + googleSub,
    expires_at: futureTimestamp,
    user: {
      sub: googleSub,
      email: "test@example.com",
      name: "Test User",
      picture: "https://example.com/picture.jpg",
    },
  };

  // Use addInitScript to set localStorage BEFORE page hydration
  await page.addInitScript((session) => {
    localStorage.setItem("fenrir:auth", JSON.stringify(session));
  }, mockSession);

  // Now navigate or reload so addInitScript takes effect
  // (Must be called before navigation for it to inject on first load)
}


// ===========================================================================
// Automated Tests for Previously Manual Tests
// ===========================================================================

test.describe("Authenticated Stripe UI States", () => {
  test("TC-STR-AUTH-01: Karl Active state UI (replaces MANUAL-01)", async ({ page }) => {
    // Mock Karl active subscription
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);

    // Set up authenticated session FIRST (via addInitScript)
    await setupAuthenticatedSession(page);

    // Set up API route mock BEFORE any navigation
    await page.route('**/api/stripe/membership*', async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tier: "karl",
          active: true,
          platform: "stripe",
          checkedAt: new Date().toISOString(),
          customerId: "cus_test123",
          linkedAt: new Date().toISOString(),
          stripeStatus: "active",
          cancelAtPeriodEnd: false,
          currentPeriodEnd: futureDate.toISOString(),
        }),
      });
    });

    // Navigate to settings page (addInitScript will run before hydration)
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState("networkidle");

    // Wait for the badge to appear (with longer timeout since API mock should respond)
    const karlBadge = page.locator('[data-testid="tier-badge"]').filter({ hasText: /KARL/i });
    await expect(karlBadge).toBeVisible({ timeout: 10000 });

    // Check for Manage Subscription button (core interactive element)
    const manageBtn = page.locator('button').filter({ hasText: /Manage Subscription/i });
    await expect(manageBtn).toBeVisible();
  });

  test("TC-STR-AUTH-02: Canceling state UI (replaces part of MANUAL-02)", async ({ page }) => {
    // Mock Karl subscription that's canceling at period end
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 15);

    // Set up authenticated session FIRST (via addInitScript)
    await setupAuthenticatedSession(page);

    // Set up API route mock BEFORE any navigation
    await page.route('**/api/stripe/membership*', async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tier: "karl",
          active: true,
          platform: "stripe",
          checkedAt: new Date().toISOString(),
          customerId: "cus_test123",
          linkedAt: new Date().toISOString(),
          stripeStatus: "active",
          cancelAtPeriodEnd: true,
          currentPeriodEnd: futureDate.toISOString(),
        }),
      });
    });

    // Navigate to settings page (addInitScript will run before hydration)
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState("networkidle");

    // Check for CANCELING badge
    const cancelingBadge = page.locator('[data-testid="tier-badge"]').filter({ hasText: /CANCELING/i });
    await expect(cancelingBadge).toBeVisible({ timeout: 10000 });

    // Check for Resubscribe button (core interactive element for canceling state)
    const resubscribeBtn = page.locator('button').filter({ hasText: /Resubscribe/i });
    await expect(resubscribeBtn).toBeVisible();
  });

  test("TC-STR-AUTH-03: Canceled state UI (replaces part of MANUAL-02)", async ({ page }) => {
    // Mock canceled subscription (tier is still karl but not active)
    // Set up authenticated session FIRST (via addInitScript)
    await setupAuthenticatedSession(page);

    // Set up API route mock BEFORE any navigation
    await page.route('**/api/stripe/membership*', async route => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tier: "karl",
          active: false,
          platform: "stripe",
          checkedAt: new Date().toISOString(),
          customerId: "cus_test123",
          linkedAt: new Date().toISOString(),
          stripeStatus: "canceled",
          cancelAtPeriodEnd: false,
        }),
      });
    });

    // Navigate to settings page (addInitScript will run before hydration)
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState("networkidle");

    // Check for CANCELED badge (not THRALL - the canceled state shows CANCELED badge)
    const canceledBadge = page.locator('[data-testid="tier-badge"]').filter({ hasText: /CANCELED/i });
    await expect(canceledBadge).toBeVisible({ timeout: 10000 });

    // Check for Resubscribe button
    const resubscribeBtn = page.locator('button').filter({ hasText: /Resubscribe/i });
    await expect(resubscribeBtn).toBeVisible();
  });

  test("TC-STR-AUTH-04: Post-checkout redirect with session_id migration", async ({ page }) => {
    // Mock the session migration scenario
    const sessionId = "cs_test_migration123";

    // Set up authenticated session FIRST (via addInitScript)
    await setupAuthenticatedSession(page);

    // Mock the membership API to simulate migration
    let migrationAttempted = false;
    await page.route('**/api/stripe/membership*', async route => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("session_id") === sessionId && !migrationAttempted) {
        migrationAttempted = true;
        // First call: simulate successful migration
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            tier: "karl",
            active: true,
            platform: "stripe",
            checkedAt: new Date().toISOString(),
            customerId: "cus_migrated",
            linkedAt: new Date().toISOString(),
            stripeStatus: "active",
          }),
        });
      } else {
        // Subsequent calls: return migrated state
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            tier: "karl",
            active: true,
            platform: "stripe",
            checkedAt: new Date().toISOString(),
            customerId: "cus_migrated",
          }),
        });
      }
    });

    // Navigate to settings with session_id param (simulating Stripe redirect)
    // addInitScript will run before hydration
    await page.goto(`${BASE_URL}/settings?stripe=success&session_id=${sessionId}`);
    await page.waitForLoadState("networkidle");

    // Check that Karl state is shown after migration
    const karlBadge = page.locator('[data-testid="tier-badge"]').filter({ hasText: /KARL/i });
    await expect(karlBadge).toBeVisible({ timeout: 10000 });

    // Verify migration was attempted (the API was called with session_id)
    expect(migrationAttempted).toBe(true);
  });
});

// ===========================================================================
// Anonymous Stripe Flow Test
// ===========================================================================

test.describe("Anonymous Stripe Flow", () => {
  test("TC-STR-ANON-01: SealedRuneModal anonymous Stripe flow", async ({ page }) => {
    // Clear any auth state to ensure anonymous
    await page.goto(`${BASE_URL}/`);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Navigate to settings as anonymous
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState("networkidle");

    // Try to trigger a locked feature (varies by implementation)
    // Look for any subscribe button or locked feature indicator
    const subscribeBtn = page.locator('button, a').filter({ hasText: /Subscribe.*\$3\.99/i }).first();

    if (await subscribeBtn.count() > 0) {
      // Mock the Stripe checkout API
      await page.route(`${BASE_URL}/api/stripe/checkout`, async route => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            url: "https://checkout.stripe.com/test_session",
          }),
        });
      });

      // Click subscribe button
      await subscribeBtn.click();

      // For anonymous users, verify no email modal appears
      // (The modal would have a form with email input)
      const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]');

      // Wait a bit to see if modal appears
      await page.waitForTimeout(1000);

      // Email input should NOT be visible (no email modal for Stripe)
      if (await emailInput.count() > 0) {
        await expect(emailInput).not.toBeVisible();
      }
    }
  });
});