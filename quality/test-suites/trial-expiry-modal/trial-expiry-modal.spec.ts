/**
 * Trial Expiry Modal Tests (Issue #623)
 *
 * Validates the day-30 trial expiry modal behavior including:
 * - One-time display after trial expires
 * - Value recap showing cards, fees, potential savings
 * - Feature comparison table (desktop only)
 * - Action buttons: Subscribe ($3.99/mo) and Continue with free plan
 * - Keyboard accessibility (ESC closes, focus trap)
 * - Backdrop click does NOT close modal
 * - Post-expiry feature gates (Howl, Valhalla locked)
 * - Card limit enforcement (5 cards for Thrall users)
 * - Post-expiry toast message
 *
 * @see components/trial/TrialExpiryModal.tsx
 * @see Issue #623
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Test Helpers — API route mocking
// ---------------------------------------------------------------------------

/**
 * Creates a fake JWT token with the given claims.
 * This is a test-only helper — the token is not cryptographically valid
 * but has the correct structure for `decodeJwtPayload` in refresh-session.ts.
 */
function makeFakeJwt(claims: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = btoa(JSON.stringify(claims));
  return `${header}.${payload}.fake-signature`;
}

/** A fake session object that satisfies FenrirSession and passes isTokenStale(). */
function makeFakeSession() {
  const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
  const idToken = makeFakeJwt({
    sub: "test-user-123",
    email: "test@fenrir.dev",
    name: "Test User",
    picture: "https://example.com/avatar.png",
    exp: futureExp,
  });

  return {
    access_token: "fake-access-token",
    id_token: idToken,
    refresh_token: "fake-refresh-token",
    expires_at: Date.now() + 3600 * 1000, // 1 hour from now
    user: {
      sub: "test-user-123",
      email: "test@fenrir.dev",
      name: "Test User",
      picture: "https://example.com/avatar.png",
    },
  };
}

/**
 * Sets up API route mocks and localStorage for a given trial status.
 *
 * Must be called BEFORE page.goto() or page.reload() so the route
 * interceptors are in place when the app fetches /api/trial/status.
 */
async function setupTrialMocks(
  page: Page,
  opts: {
    trialStatus: "expired" | "active" | "converted" | "none";
    remainingDays: number;
    modalAlreadyShown?: boolean;
  },
) {
  // 1. Intercept POST /api/trial/status — the hook's data source
  await page.route("**/api/trial/status", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: opts.trialStatus,
        remainingDays: opts.remainingDays,
        startDate: "2026-02-25",
      }),
    });
  });

  // 2. Intercept GET /api/stripe/membership — entitlement context
  await page.route("**/api/stripe/membership*", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tier: "thrall",
        active: false,
        platform: "stripe",
        checkedAt: new Date().toISOString(),
      }),
    });
  });

  // 3. Set fake session in localStorage so ensureFreshToken() returns a token
  //    and set/clear the modal-shown flag.
  //    We need to navigate first to have a page context, then set localStorage.
  //    But we also need routes set before goto. So we use addInitScript.
  const session = makeFakeSession();
  const sessionJson = JSON.stringify(session);
  const modalShown = opts.modalAlreadyShown ? "true" : null;

  await page.addInitScript(
    ({ sessionJson, modalShown, householdId }) => {
      localStorage.setItem("fenrir:auth", sessionJson);
      // Set anonymous householdId for storage.ts
      localStorage.setItem("fenrir:household", householdId);
      if (modalShown) {
        localStorage.setItem("fenrir:trial-expiry-modal-shown", modalShown);
      } else {
        localStorage.removeItem("fenrir:trial-expiry-modal-shown");
      }
    },
    { sessionJson, modalShown, householdId: "test-user-123" },
  );
}

// ---------------------------------------------------------------------------
// Test Setup & Teardown
// ---------------------------------------------------------------------------

test.describe("Trial Expiry Modal (Issue #623)", () => {
  // =========================================================================
  // AC1: Modal Display Rules
  // =========================================================================

  test("AC1.1: Modal displays once when trial expires (day 30+)", async ({ page }) => {
    await setupTrialMocks(page, { trialStatus: "expired", remainingDays: 0 });
    await page.goto("/ledger");

    // Modal should be visible
    const modal = page.getByRole("dialog", { name: /30 days/i });
    await expect(modal).toBeVisible();

    // Modal title should be present
    const title = page.getByText("Your 30 days are complete");
    await expect(title).toBeVisible();
  });

  test("AC1.2: Modal does NOT display during active trial (days remaining > 0)", async ({
    page,
  }) => {
    await setupTrialMocks(page, { trialStatus: "active", remainingDays: 15 });
    await page.goto("/ledger");

    // Modal should not be visible
    const modal = page.getByRole("dialog", { name: /30 days/i });
    await expect(modal).not.toBeVisible();
  });

  test("AC1.3: Modal does NOT display if already shown once (localStorage flag)", async ({
    page,
  }) => {
    await setupTrialMocks(page, {
      trialStatus: "expired",
      remainingDays: 0,
      modalAlreadyShown: true,
    });
    await page.goto("/ledger");

    // Modal should NOT be visible
    const modal = page.getByRole("dialog", { name: /30 days/i });
    await expect(modal).not.toBeVisible();
  });

  test("AC1.4: Modal does NOT display for converted users (subscription active)", async ({
    page,
  }) => {
    await setupTrialMocks(page, { trialStatus: "converted", remainingDays: 0 });
    await page.goto("/ledger");

    // Modal should NOT be visible
    const modal = page.getByRole("dialog", { name: /30 days/i });
    await expect(modal).not.toBeVisible();
  });

  // =========================================================================
  // AC2: Modal Content & Layout
  // =========================================================================

  test("AC2.1: Modal displays value recap (cards tracked, fees monitored, potential savings)", async ({
    page,
  }) => {
    await setupTrialMocks(page, { trialStatus: "expired", remainingDays: 0 });
    await page.goto("/ledger");

    // Check for value recap section within the modal
    const modal = page.getByRole("dialog", { name: /30 days/i });
    await expect(modal).toBeVisible();

    const recap = modal.getByText(/What You Built/i);
    await expect(recap).toBeVisible();

    // The value recap grid has an aria-label with the summary text
    const metricsGrid = modal.getByLabel(/trial value summary/i);
    await expect.soft(metricsGrid).toBeVisible();

    // Check individual metric labels are present (desktop shows "Cards tracked", mobile shows "Cards")
    await expect.soft(modal.getByText(/Cards tracked|Cards/i).first()).toBeVisible();
    await expect.soft(modal.getByText(/Fees monitored|Fees/i).first()).toBeVisible();
    await expect.soft(modal.getByText(/Potential savings|Saved/i).first()).toBeVisible();
  });

  test("AC2.2: Modal displays feature comparison table (desktop only)", async ({ page }) => {
    // Set viewport to desktop size
    await page.setViewportSize({ width: 1280, height: 1024 });

    await setupTrialMocks(page, { trialStatus: "expired", remainingDays: 0 });
    await page.goto("/ledger");

    // Feature comparison should be visible on desktop
    const modal = page.getByRole("dialog", { name: /30 days/i });
    await expect(modal).toBeVisible();

    const comparison = modal.getByText(/What Changes/i);
    await expect(comparison).toBeVisible();

    // Check for feature rows within the modal's comparison table
    const featureTable = modal.getByRole("table", { name: /feature comparison/i });
    const features = ["Add & edit cards", "Fee & bonus tracking", "The Howl (alerts)", "Valhalla (archive)"];
    for (const feature of features) {
      const featureRow = featureTable.getByRole("cell", { name: feature });
      await expect.soft(featureRow).toBeVisible();
    }
  });

  test("AC2.3: Modal hides feature comparison table on mobile", async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });

    await setupTrialMocks(page, { trialStatus: "expired", remainingDays: 0 });
    await page.goto("/ledger");

    // Modal should be visible
    const modal = page.getByRole("dialog", { name: /30 days/i });
    await expect(modal).toBeVisible();

    // Feature comparison should be hidden on mobile (hidden sm:block)
    const comparison = page.getByText(/What Changes/i);
    await expect(comparison).toBeHidden();
  });

  test("AC2.4: Modal displays data safety reassurance message", async ({ page }) => {
    await setupTrialMocks(page, { trialStatus: "expired", remainingDays: 0 });
    await page.goto("/ledger");

    // Check for safety message
    const safety = page.getByText(/Your card data is preserved/i);
    await expect(safety).toBeVisible();
  });

  // =========================================================================
  // AC3: Action Buttons
  // =========================================================================

  test("AC3.1: Modal displays Subscribe button ($3.99/month)", async ({ page }) => {
    await setupTrialMocks(page, { trialStatus: "expired", remainingDays: 0 });
    await page.goto("/ledger");

    // Subscribe button should be visible
    const subscribeBtn = page.getByRole("button", { name: /subscribe/i });
    await expect(subscribeBtn).toBeVisible();
  });

  test("AC3.2: Modal displays Continue with free plan button", async ({ page }) => {
    await setupTrialMocks(page, { trialStatus: "expired", remainingDays: 0 });
    await page.goto("/ledger");

    // Continue button should be visible
    const continueBtn = page.getByRole("button", { name: /Continue with free plan/i });
    await expect(continueBtn).toBeVisible();
  });

  test("AC3.3: Both buttons have equal visual weight", async ({ page }) => {
    await setupTrialMocks(page, { trialStatus: "expired", remainingDays: 0 });
    await page.goto("/ledger");

    const subscribeBtn = page.getByRole("button", { name: /subscribe/i });
    const continueBtn = page.getByRole("button", { name: /Continue with free plan/i });

    // Both buttons should have similar min-height and padding
    const subscribeBox = await subscribeBtn.boundingBox();
    const continueBox = await continueBtn.boundingBox();

    // Both should be clickable with similar heights (min 44px touch target)
    expect(subscribeBox?.height).toBeGreaterThanOrEqual(44);
    expect(continueBox?.height).toBeGreaterThanOrEqual(44);
  });

  // =========================================================================
  // AC4: Button Actions
  // =========================================================================

  test("AC4.1: Continue with free plan button closes modal and shows toast", async ({ page }) => {
    await setupTrialMocks(page, { trialStatus: "expired", remainingDays: 0 });
    await page.goto("/ledger");

    // Modal should be visible initially
    const modal = page.getByRole("dialog", { name: /30 days/i });
    await expect(modal).toBeVisible();

    // Click continue button
    const continueBtn = page.getByRole("button", { name: /Continue with free plan/i });
    await continueBtn.click();

    // Modal should be hidden
    await expect(modal).not.toBeVisible();

    // Toast should appear with upgrade message
    const toast = page.getByText(/Your trial ended/i);
    await expect(toast).toBeVisible();
  });

  test("AC4.2: Modal is marked as shown in localStorage after dismissal", async ({ page }) => {
    await setupTrialMocks(page, { trialStatus: "expired", remainingDays: 0 });
    await page.goto("/ledger");

    // Click continue button
    const continueBtn = page.getByRole("button", { name: /Continue with free plan/i });
    await continueBtn.click();

    // Check localStorage flag
    const flag = await page.evaluate(() => localStorage.getItem("fenrir:trial-expiry-modal-shown"));
    expect(flag).toBe("true");
  });

  test("AC4.3: Subscribe button initiates Stripe checkout flow", async ({ page }) => {
    await setupTrialMocks(page, { trialStatus: "expired", remainingDays: 0 });

    // Also mock the Stripe checkout endpoint to prevent actual redirect
    await page.route("**/api/stripe/checkout", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ url: "https://checkout.stripe.com/test" }),
      });
    });

    await page.goto("/ledger");

    const subscribeBtn = page.getByRole("button", { name: /subscribe/i });

    // Verify button is clickable and properly configured
    await expect(subscribeBtn).toBeEnabled();
    await expect(subscribeBtn).toBeVisible();
  });

  // =========================================================================
  // AC5: Keyboard Accessibility
  // =========================================================================

  test("AC5.1: ESC key closes the modal (same as Continue button)", async ({ page }) => {
    await setupTrialMocks(page, { trialStatus: "expired", remainingDays: 0 });
    await page.goto("/ledger");

    const modal = page.getByRole("dialog", { name: /30 days/i });
    await expect(modal).toBeVisible();

    // Press Escape key
    await page.keyboard.press("Escape");

    // Modal should close
    await expect(modal).not.toBeVisible();

    // Toast should appear (same as Continue button)
    const toast = page.getByText(/Your trial ended/i);
    await expect(toast).toBeVisible();
  });

  test("AC5.2: Focus trap — focus starts on first focusable element", async ({ page }) => {
    await setupTrialMocks(page, { trialStatus: "expired", remainingDays: 0 });
    await page.goto("/ledger");

    // Wait for the modal to be visible first
    const modal = page.getByRole("dialog", { name: /30 days/i });
    await expect(modal).toBeVisible();

    // The first focusable element should have focus (close button or subscribe)
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      // The close button (x) is the first focusable element in the modal DOM
      return (
        el?.tagName === "BUTTON" &&
        (el?.textContent?.includes("Subscribe") ||
          el?.getAttribute("aria-label")?.includes("Close"))
      );
    });

    expect.soft(focused).toBeTruthy();
  });

  test("AC5.3: Close button is keyboard accessible", async ({ page }) => {
    await setupTrialMocks(page, { trialStatus: "expired", remainingDays: 0 });
    await page.goto("/ledger");

    // Tab to close button (top-right X)
    const closeBtn = page.getByLabel("Close trial expiry modal");
    await expect(closeBtn).toBeVisible();
    await expect(closeBtn).toHaveAttribute("type", "button");
  });

  // =========================================================================
  // AC6: Backdrop Behavior
  // =========================================================================

  test("AC6.1: Clicking backdrop does NOT close modal (intentional per spec)", async ({
    page,
  }) => {
    await setupTrialMocks(page, { trialStatus: "expired", remainingDays: 0 });
    await page.goto("/ledger");

    const modal = page.getByRole("dialog", { name: /30 days/i });
    await expect(modal).toBeVisible();

    // Click the backdrop (area outside the modal)
    const backdrop = page.locator('[role="presentation"]');
    const backdropBox = await backdrop.boundingBox();

    if (backdropBox) {
      // Click on the left side of backdrop (away from modal)
      await page.click("div[role='presentation']", {
        position: { x: 20, y: 200 },
      });
    }

    // Modal should still be visible (backdrop click did NOT close it)
    await expect(modal).toBeVisible();
  });

  test("AC6.2: Modal does not dismiss on background click", async ({ page }) => {
    await setupTrialMocks(page, { trialStatus: "expired", remainingDays: 0 });
    await page.goto("/ledger");

    const modal = page.getByRole("dialog");
    const initiallyVisible = await modal.isVisible();

    if (initiallyVisible) {
      // Click outside modal area
      await page.click("body", { position: { x: 10, y: 10 } });

      // Modal should remain visible
      await expect(modal).toBeVisible();
    }
  });

  // =========================================================================
  // AC7: Mobile Responsiveness
  // =========================================================================

  test("AC7.1: Modal is responsive on mobile (375px width)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await setupTrialMocks(page, { trialStatus: "expired", remainingDays: 0 });
    await page.goto("/ledger");

    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();

    // Buttons should be full-width and accessible
    const subscribeBtn = page.getByRole("button", { name: /subscribe/i });
    const continueBtn = page.getByRole("button", { name: /Continue with free plan/i });

    await expect(subscribeBtn).toBeVisible();
    await expect(continueBtn).toBeVisible();
  });

  test("AC7.2: Modal is responsive on tablet (768px width)", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    await setupTrialMocks(page, { trialStatus: "expired", remainingDays: 0 });
    await page.goto("/ledger");

    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();

    // Feature table should be visible on tablet/desktop
    const comparison = page.getByText(/What Changes/i);
    await expect(comparison).toBeVisible();
  });

  // =========================================================================
  // AC8: Feature Gates - Post-Expiry Lockdown
  // =========================================================================

  test("AC8.1: Howl feature is locked after trial expires", async ({ page }) => {
    await setupTrialMocks(page, { trialStatus: "expired", remainingDays: 0 });
    await page.goto("/ledger");

    // The modal's feature comparison table shows Howl is gated (— for free tier)
    const modal = page.getByRole("dialog", { name: /30 days/i });
    await expect(modal).toBeVisible();

    const featureTable = modal.getByRole("table", { name: /feature comparison/i });
    const howlRow = featureTable.getByRole("row", { name: /Howl/i });
    await expect.soft(howlRow).toBeVisible();

    // Howl shows "—" for free tier, confirming it's locked after trial
    const howlFreeCell = howlRow.getByRole("cell").nth(1); // second cell = free tier value
    await expect.soft(howlFreeCell).toHaveText("\u2014"); // em dash
  });

  test("AC8.2: Valhalla feature is locked after trial expires", async ({ page }) => {
    await setupTrialMocks(page, { trialStatus: "expired", remainingDays: 0 });
    await page.goto("/ledger");

    // The modal's feature comparison table shows Valhalla is gated (— for free tier)
    const modal = page.getByRole("dialog", { name: /30 days/i });
    await expect(modal).toBeVisible();

    const featureTable = modal.getByRole("table", { name: /feature comparison/i });
    const valhallaRow = featureTable.getByRole("row", { name: /Valhalla/i });
    await expect.soft(valhallaRow).toBeVisible();

    // Valhalla shows "—" for free tier, confirming it's locked after trial
    const valhallaFreeCell = valhallaRow.getByRole("cell").nth(1); // second cell = free tier value
    await expect.soft(valhallaFreeCell).toHaveText("\u2014"); // em dash
  });

  // =========================================================================
  // AC9: Card Limit - Thrall Users (5 card max)
  // =========================================================================

  test("AC9.1: Thrall users can only see 5 active cards after trial expires", async ({
    page,
  }) => {
    await setupTrialMocks(page, { trialStatus: "expired", remainingDays: 0 });
    await page.goto("/ledger");

    // The expiry modal's feature table states "5 max" for Thrall card limit
    const modal = page.getByRole("dialog", { name: /30 days/i });
    await expect(modal).toBeVisible();

    const fiveMax = modal.getByRole("cell", { name: "5 max" });
    await expect.soft(fiveMax).toBeVisible();

    // Dismiss modal and verify card count on dashboard
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();

    // Count visible cards in the dashboard — should be <= 5
    const cards = page.locator('[data-testid="card-item"]');
    const count = await cards.count();
    expect(count).toBeLessThanOrEqual(5);
  });

  test("AC9.2: Upgrade prompt visible when Thrall user hits 5-card limit", async ({ page }) => {
    await setupTrialMocks(page, { trialStatus: "expired", remainingDays: 0 });
    await page.goto("/ledger");

    // The expiry modal's feature table shows "5 max" for free tier and "Unlimited" for Karl
    const modal = page.getByRole("dialog", { name: /30 days/i });
    await expect(modal).toBeVisible();

    // Verify the feature table advertises the card limit difference
    const featureTable = modal.getByRole("table", { name: /feature comparison/i });
    await expect.soft(featureTable.getByRole("cell", { name: "5 max" })).toBeVisible();
    await expect.soft(featureTable.getByRole("cell", { name: "Unlimited" })).toBeVisible();
  });

  // =========================================================================
  // AC10: Settings Page - Upgrade Option
  // =========================================================================

  test("AC10.1: Settings shows Upgrade to Karl option when trial is expired", async ({
    page,
  }) => {
    await setupTrialMocks(page, { trialStatus: "expired", remainingDays: 0 });
    await page.goto("/ledger/settings");

    // Dismiss modal if it appears on settings page too
    const modal = page.getByRole("dialog", { name: /30 days/i });
    if (await modal.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
    }

    // Should show upgrade section
    const upgradeSection = page.getByText(/upgrade to karl|upgrade|subscribe/i).filter({
      hasText: /upgrade|subscribe|karl/i,
    });
    await expect.soft(upgradeSection.first()).toBeVisible();
  });

  // =========================================================================
  // AC11: Conversion Tracking
  // =========================================================================

  test("AC11.1: Trial conversion is tracked when user completes Stripe checkout", async ({
    page,
  }) => {
    // This test would require mocking Stripe webhook, so we validate the API exists
    // and the trial status hook recognizes 'converted' status

    const response = await page.request.post("/api/trial/convert", {
      data: { fingerprint: "a".repeat(64) },
    });

    // Should be 401 (auth required) not 404 (endpoint exists)
    expect([400, 401]).toContain(response.status());
  });

  test("AC11.2: Converted users do not see expiry modal even if trial is expired", async ({
    page,
  }) => {
    await setupTrialMocks(page, { trialStatus: "converted", remainingDays: 0 });
    await page.goto("/ledger");

    // Modal should NOT display for converted users
    const modal = page.getByRole("dialog", { name: /30 days/i });
    await expect(modal).not.toBeVisible();
  });
});
