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
  // Mock the Google auth token in localStorage (but NOT entitlement - that comes from API)
  await page.evaluate((sub) => {
    const mockUser = {
      sub,
      email: "test@example.com",
      name: "Test User",
      picture: "https://example.com/picture.jpg",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    localStorage.setItem("fenrir:google-credential", JSON.stringify(mockUser));
    // Don't set entitlement in localStorage - let it come from the mocked API
  }, googleSub);
}

async function mockStripeEntitlement(
  page: Page,
  entitlement: {
    tier: string;
    active: boolean;
    stripeStatus?: string;
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: string;
    customerId?: string;
  }
): Promise<void> {
  // Intercept the membership API call and return mocked data
  await page.route(`${BASE_URL}/api/stripe/membership*`, async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tier: entitlement.tier,
        active: entitlement.active,
        platform: "stripe",
        checkedAt: new Date().toISOString(),
        customerId: entitlement.customerId || "cus_test123",
        linkedAt: new Date().toISOString(),
        stripeStatus: entitlement.stripeStatus,
        cancelAtPeriodEnd: entitlement.cancelAtPeriodEnd,
        currentPeriodEnd: entitlement.currentPeriodEnd,
      }),
    });
  });

  // Also update localStorage
  await page.evaluate((ent) => {
    localStorage.setItem("fenrir:entitlement", JSON.stringify({
      tier: ent.tier,
      active: ent.active,
      platform: "stripe",
      checkedAt: new Date().toISOString(),
      stripeStatus: ent.stripeStatus,
      cancelAtPeriodEnd: ent.cancelAtPeriodEnd,
      currentPeriodEnd: ent.currentPeriodEnd,
    }));
  }, entitlement);
}

// ===========================================================================
// Automated Tests for Previously Manual Tests
// ===========================================================================

test.describe("Authenticated Stripe UI States", () => {
  test("TC-STR-AUTH-01: Karl Active state UI (replaces MANUAL-01)", async ({ page }) => {
    // Mock Karl active subscription
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);

    // Set up API route mock BEFORE any navigation
    await page.route('**/api/stripe/membership', async route => {
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

    // Navigate to page and set auth state
    await page.goto(`${BASE_URL}/`);
    await mockAuthenticatedUser(page);

    // Navigate to settings page
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState("networkidle");

    // Wait for the badge to appear (with longer timeout since API mock should respond)
    const karlBadge = page.locator('[data-testid="tier-badge"]').filter({ hasText: /KARL/i });
    await expect(karlBadge).toBeVisible({ timeout: 10000 });

    // Check for subscription price
    const price = page.locator('text=/$3\\.99.*month/i');
    await expect(price).toBeVisible();

    // Check for billing date
    const billingDate = page.locator('text=/Next billing/i');
    await expect(billingDate).toBeVisible();

    // Check for Manage Subscription button
    const manageBtn = page.locator('button').filter({ hasText: /Manage Subscription/i });
    await expect(manageBtn).toBeVisible();

    // Check for Cancel button with proper aria-label
    const cancelBtn = page.locator('button[aria-label*="Cancel"]');
    await expect(cancelBtn).toBeVisible();
  });

  test("TC-STR-AUTH-02: Canceling state UI (replaces part of MANUAL-02)", async ({ page }) => {
    // Mock Karl subscription that's canceling at period end
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 15);

    // Set up API route mock BEFORE any navigation
    await page.route('**/api/stripe/membership', async route => {
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

    // Navigate to page and set auth state
    await page.goto(`${BASE_URL}/`);
    await mockAuthenticatedUser(page);

    // Navigate to settings page
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState("networkidle");

    // Check for CANCELING badge
    const cancelingBadge = page.locator('[data-testid="tier-badge"]').filter({ hasText: /CANCELING/i });
    await expect(cancelingBadge).toBeVisible();

    // Check for Canceling status text
    const cancelingStatus = page.locator('text=/Canceling/i');
    await expect(cancelingStatus).toBeVisible();

    // Check for period end date message
    const periodEndMessage = page.locator('text=/set to cancel|full Karl access until/i');
    await expect(periodEndMessage).toBeVisible();

    // Check for Resubscribe button
    const resubscribeBtn = page.locator('button').filter({ hasText: /Resubscribe/i });
    await expect(resubscribeBtn).toBeVisible();
  });

  test("TC-STR-AUTH-03: Canceled state UI (replaces part of MANUAL-02)", async ({ page }) => {
    // Mock canceled subscription (tier is still karl but not active)
    // Set up API route mock BEFORE any navigation
    await page.route('**/api/stripe/membership', async route => {
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

    // Navigate to page and set auth state
    await page.goto(`${BASE_URL}/`);
    await mockAuthenticatedUser(page);

    // Navigate to settings page
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState("networkidle");

    // Check for CANCELED badge (not THRALL - the canceled state shows CANCELED badge)
    const canceledBadge = page.locator('[data-testid="tier-badge"]').filter({ hasText: /CANCELED/i });
    await expect(canceledBadge).toBeVisible();

    // Check for Resubscribe button
    const resubscribeBtn = page.locator('button').filter({ hasText: /Resubscribe/i });
    await expect(resubscribeBtn).toBeVisible();
  });

  test("TC-STR-AUTH-04: Post-checkout redirect with session_id migration", async ({ page }) => {
    // Mock the session migration scenario
    const sessionId = "cs_test_migration123";

    // Mock the membership API to simulate migration
    let migrationAttempted = false;
    await page.route('**/api/stripe/membership', async route => {
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

    // Navigate to page and set auth state
    await page.goto(`${BASE_URL}/`);
    await mockAuthenticatedUser(page);

    // Navigate to settings with session_id param (simulating Stripe redirect)
    await page.goto(`${BASE_URL}/settings?stripe=success&session_id=${sessionId}`);
    await page.waitForLoadState("networkidle");

    // Check that Karl state is shown after migration
    const karlBadge = page.locator('[data-testid="tier-badge"]').filter({ hasText: /KARL/i });
    await expect(karlBadge).toBeVisible();

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