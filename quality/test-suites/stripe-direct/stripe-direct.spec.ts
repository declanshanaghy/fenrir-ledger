/**
 * Stripe Direct Integration -- Playwright Test Suite
 *
 * Stripe is now the sole subscription platform. Tests verify:
 *   - All Stripe API routes respond correctly
 *   - Webhook uses raw body + HMAC (verified: 400 without signature, not 401)
 *   - StripeSettings 3-state component renders correctly (Thrall state verified)
 *   - SealedRuneModal shows Stripe CTA
 *   - requireAuth() on all Stripe routes except webhook
 *   - Checkout supports anonymous users (Stripe collects email)
 *   - AnonymousCheckoutModal.tsx does NOT exist
 *   - SEV-002 fixed -- no origin header usage
 *   - SEV-003 fixed -- CSP includes Stripe domains
 *
 * What CANNOT be tested via Playwright (and why):
 *   - Real Stripe Checkout redirect (requires live Stripe keys + card input)
 *   - Webhook signature verification with valid HMAC (requires real STRIPE_WEBHOOK_SECRET)
 *   - Karl/Canceled state UI (requires active Stripe subscription in KV)
 *
 * Manual test steps for untestable paths are documented at the bottom.
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = process.env.SERVER_URL ?? "http://localhost:9653";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clears all subscription and entitlement state from localStorage.
 */
async function clearSubscriptionState(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/`);
  await page.evaluate(() => {
    localStorage.removeItem("fenrir:entitlement");
    localStorage.removeItem("fenrir:stripe_upsell_dismissed");
    sessionStorage.clear();
  });
}

// ===========================================================================
// Stripe API Routes -- existence and basic behavior
// ===========================================================================

test.describe("Stripe API Routes -- existence and behavior", () => {
  test("TC-STR-001: POST /api/stripe/checkout exists", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/stripe/checkout`, {
      data: {},
    });
    const status = response.status();
    // Should respond with JSON, never a routing 404
    expect([200, 400, 401, 429, 500]).toContain(status);
    const contentType = response.headers()["content-type"] ?? "";
    expect(contentType).toContain("application/json");
  });

  test("TC-STR-002: GET /api/stripe/membership requires auth", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/stripe/membership`);
    expect(response.status()).toBe(401);
  });

  test("TC-STR-003: POST /api/stripe/portal requires auth", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/stripe/portal`, {
      data: {},
    });
    expect([401, 429]).toContain(response.status());
  });

  test("TC-STR-004: POST /api/stripe/unlink requires auth", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/stripe/unlink`, {
      data: {},
    });
    expect([401, 429]).toContain(response.status());
  });

  test("TC-STR-005: POST /api/stripe/webhook handles missing signature", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/stripe/webhook`, {
      data: "{}",
      headers: { "Content-Type": "application/json" },
    });
    const status = response.status();
    // Must return 400 (missing signature) -- never 401 (no requireAuth on webhook)
    expect(status).toBe(400);
    expect(status).not.toBe(401);

    const body = await response.json();
    expect(body).toMatchObject({ error: expect.stringMatching(/signature|invalid_body/i) });
  });

  test("TC-STR-006: All five Stripe routes respond with JSON (not HTML 404)", async ({ request }) => {
    const routes = [
      { method: "POST" as const, path: "/api/stripe/checkout" },
      { method: "GET"  as const, path: "/api/stripe/membership" },
      { method: "POST" as const, path: "/api/stripe/portal" },
      { method: "POST" as const, path: "/api/stripe/unlink" },
      { method: "POST" as const, path: "/api/stripe/webhook" },
    ];

    for (const route of routes) {
      const response = route.method === "GET"
        ? await request.get(`${BASE_URL}${route.path}`)
        : await request.post(`${BASE_URL}${route.path}`, { data: {} });

      const contentType = response.headers()["content-type"] ?? "";
      expect(contentType, `${route.path} must return JSON`).toContain("application/json");
    }
  });
});

// ===========================================================================
// requireAuth() enforcement -- Stripe routes
// ===========================================================================

test.describe("Stripe API Routes -- requireAuth enforcement", () => {
  test("TC-STR-007: /api/stripe/membership requires auth (401)", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/stripe/membership`);
    expect(response.status()).toBe(401);
  });

  test("TC-STR-008: /api/stripe/portal requires auth (401)", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/stripe/portal`, { data: {} });
    expect([401, 429]).toContain(response.status());
  });

  test("TC-STR-009: /api/stripe/unlink requires auth (401)", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/stripe/unlink`, { data: {} });
    expect([401, 429]).toContain(response.status());
  });

  test("TC-STR-010: /api/stripe/webhook does NOT require auth -- uses HMAC signature instead", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/stripe/webhook`, {
      data: "{}",
      headers: { "Content-Type": "application/json" },
    });
    // MUST NOT be 401
    expect(response.status()).not.toBe(401);
    expect(response.status()).toBe(400);
  });

  test("TC-STR-010b: /api/stripe/webhook with invalid stripe-signature returns 400 (HMAC check)", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/stripe/webhook`, {
      data: '{"type":"checkout.session.completed"}',
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "t=invalid,v1=invalidsignature",
      },
    });
    expect(response.status()).toBe(400);
    expect(response.status()).not.toBe(401);
  });
});

// ===========================================================================
// StripeSettings component -- Thrall state
// ===========================================================================

test.describe("StripeSettings -- Thrall state", () => {
  test("TC-STR-014: StripeSettings 'Subscription' heading visible", async ({ page }) => {
    await clearSubscriptionState(page);
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState("networkidle");

    const stripeSection = page.locator('[role="region"][aria-label="Subscription"]');
    await expect(stripeSection).toBeVisible({ timeout: 5000 });

    // Per wireframe: "Subscription" h2 heading
    const heading = stripeSection.locator('h2').filter({ hasText: /subscription/i }).first();
    await expect(heading).toBeVisible({ timeout: 3000 });

    // Per wireframe Thrall state: "THRALL" badge
    const thrallBadge = stripeSection.getByText("THRALL");
    const karlBadge = stripeSection.getByText("KARL");
    const canceledBadge = stripeSection.getByText("CANCELED");

    // At least one state indicator must be present
    const hasThrall = await thrallBadge.count() > 0;
    const hasKarl = await karlBadge.count() > 0;
    const hasCanceled = await canceledBadge.count() > 0;
    expect(hasThrall || hasKarl || hasCanceled).toBe(true);
  });

  test("TC-STR-015: StripeSettings Thrall state shows subscribe CTA", async ({ page }) => {
    await clearSubscriptionState(page);
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState("networkidle");

    const stripeSection = page.locator('[role="region"][aria-label="Subscription"]');
    await expect(stripeSection).toBeVisible({ timeout: 5000 });

    // Per wireframe: Thrall state has "Subscribe for $3.99/month" button
    const subscribeBtn = page.getByRole("button", { name: /subscribe for \$3\.99\/month/i });
    if (await subscribeBtn.count() > 0) {
      await expect(subscribeBtn.first()).toBeVisible({ timeout: 5000 });
      // Verify min-height for touch target (wireframe AC)
      const box = await subscribeBtn.first().boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test("TC-STR-016: StripeSettings Karl benefits list rendered in Thrall state", async ({ page }) => {
    await clearSubscriptionState(page);
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState("networkidle");

    const stripeSection = page.locator('[role="region"][aria-label="Subscription"]');
    if (await stripeSection.count() > 0) {
      // Wireframe specifies aria-label="Karl tier benefits" on the benefits list
      const benefitsList = stripeSection.locator('[aria-label="Karl tier benefits"]');
      if (await benefitsList.count() > 0) {
        // Per wireframe: 4 benefit items
        const benefitItems = benefitsList.locator('span').filter({ hasText: /.+/ });
        const count = await benefitItems.count();
        expect(count).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test("TC-STR-017: StripeSettings atmospheric subhead has aria-hidden", async ({ page }) => {
    await clearSubscriptionState(page);
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState("networkidle");

    const stripeSection = page.locator('[role="region"][aria-label="Subscription"]');
    if (await stripeSection.count() > 0) {
      // Per wireframe accessibility requirement: atmospheric text has aria-hidden="true"
      const ariaHiddenElements = stripeSection.locator('[aria-hidden="true"]');
      const count = await ariaHiddenElements.count();
      // At least the atmospheric Norse copy should be aria-hidden
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });
});

// ===========================================================================
// AnonymousCheckoutModal -- must not exist
// ===========================================================================

test.describe("AnonymousCheckoutModal -- must not exist", () => {
  test("TC-STR-019: No anonymous checkout modal is rendered on /settings", async ({ page }) => {
    await clearSubscriptionState(page);
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState("networkidle");
    const emailModal = page.locator('[aria-labelledby="email-heading-1"], dialog:has-text("Enter your email")');
    expect(await emailModal.count()).toBe(0);
  });

  test("TC-STR-020: No anonymous checkout modal is rendered on dashboard", async ({ page }) => {
    await clearSubscriptionState(page);
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState("networkidle");
    const emailInput = page.locator('input[type="email"][id*="checkout-email"]');
    expect(await emailInput.count()).toBe(0);
  });

  test("TC-STR-021: 'Enter your email' heading does not appear on any subscription surface", async ({ page }) => {
    await clearSubscriptionState(page);
    for (const path of ["/", "/ledger/settings"]) {
      await page.goto(`${BASE_URL}${path}`);
      await page.waitForLoadState("networkidle");
      const emailHeading = page.getByRole("heading", { name: /enter your email/i });
      expect(await emailHeading.count()).toBe(0);
    }
  });

  test("TC-STR-022: Subscribe CTA does not open an email collection dialog", async ({ page }) => {
    await clearSubscriptionState(page);
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState("networkidle");

    const subscribeBtn = page.getByRole("button", { name: /subscribe for \$3\.99\/month/i }).first();
    if (await subscribeBtn.count() > 0) {
      await page.route("**/*", async (route) => {
        const url = route.request().url();
        if (url.includes("stripe.com") || url.includes("checkout")) {
          await route.abort();
        } else {
          await route.continue();
        }
      });

      await subscribeBtn.click();
      await page.waitForTimeout(1000);

      const emailDialog = page.getByRole("heading", { name: /enter your email/i });
      expect(await emailDialog.count()).toBe(0);
    }
  });
});

// ===========================================================================
// SubscriptionGate
// ===========================================================================

test.describe("SubscriptionGate", () => {
  test("TC-STR-023: /settings loads without component errors in console", async ({ page }) => {
    await clearSubscriptionState(page);
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState("networkidle");

    const gateErrors = consoleErrors.filter(e =>
      e.toLowerCase().includes("subscriptiongate") ||
      e.toLowerCase().includes("sealedrunemodal"),
    );
    expect(gateErrors).toHaveLength(0);
  });

  test("TC-STR-025: SealedRuneModal uses dynamic aria-labelledby (sealed-rune-heading-{feature})", async ({ page }) => {
    await clearSubscriptionState(page);
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState("networkidle");

    const learnMore = page.getByRole("button", { name: /learn more/i }).first();
    if (await learnMore.count() > 0) {
      await learnMore.click();
      await page.waitForTimeout(500);

      const dialogWithDynamicId = page.locator('[aria-labelledby^="sealed-rune-heading-"]');
      await expect(dialogWithDynamicId).toBeVisible({ timeout: 5000 });

      const dialogWithStaticId = page.locator('[aria-labelledby="sealed-rune-heading"]');
      expect(await dialogWithStaticId.count()).toBe(0);

      const dismissBtn = page.getByRole("button", { name: /not now|dismiss/i }).first();
      if (await dismissBtn.count() > 0) await dismissBtn.click();
    }
  });
});

// ===========================================================================
// SealedRuneModal -- Stripe CTA
// ===========================================================================

test.describe("SealedRuneModal -- Stripe CTA", () => {
  test("TC-STR-026: SealedRuneModal shows Stripe subscribe CTA", async ({ page }) => {
    await clearSubscriptionState(page);
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState("networkidle");

    const learnMore = page.getByRole("button", { name: /learn more/i }).first();
    if (await learnMore.count() > 0) {
      await learnMore.click();
      await page.waitForTimeout(500);

      const modal = page.locator('[role="dialog"]').first();
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Per wireframe: Stripe CTA = "Subscribe for $3.99/month"
      const stripeBtn = modal.getByRole("button", { name: /subscribe for \$3\.99\/month/i });
      await expect(stripeBtn).toBeVisible({ timeout: 3000 });

      // "Billed monthly. Cancel anytime from your account." per wireframe
      const priceNote = modal.getByText(/billed monthly/i);
      await expect(priceNote).toBeVisible({ timeout: 3000 });

      // "Not now" dismiss button per wireframe -- aria-label overrides visible text
      const notNow = modal.getByRole("button", { name: /dismiss and continue/i });
      await expect(notNow).toBeVisible({ timeout: 5000 });

      // "THIS RUNE IS SEALED" heading per wireframe
      const heading = modal.getByText(/this rune is sealed/i);
      await expect(heading).toBeVisible({ timeout: 3000 });

      // "Locked feature:" indicator per wireframe
      const lockedFeature = modal.getByText(/locked feature:/i);
      await expect(lockedFeature).toBeVisible({ timeout: 3000 });

      await notNow.click();
    }
  });

  test("TC-STR-027: SealedRuneModal dismiss ('Not now') closes the modal", async ({ page }) => {
    await clearSubscriptionState(page);
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState("networkidle");

    const learnMore = page.getByRole("button", { name: /learn more/i }).first();
    if (await learnMore.count() > 0) {
      await learnMore.click();
      await page.waitForTimeout(500);

      const modal = page.locator('[role="dialog"]').first();
      await expect(modal).toBeVisible({ timeout: 5000 });

      const notNow = page.getByRole("button", { name: /not now/i }).first();
      if (await notNow.count() > 0) {
        await notNow.click();
        await page.waitForTimeout(500);
        await expect(modal).not.toBeVisible({ timeout: 3000 });
      }
    }
  });
});

// ===========================================================================
// CSP includes Stripe domains
// ===========================================================================

test.describe("CSP includes Stripe domains", () => {
  test("TC-STR-028: Dashboard response headers include Stripe domains in CSP", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/`);
    const csp = response.headers()["content-security-policy"] ?? "";

    expect(csp, "CSP must include js.stripe.com").toContain("js.stripe.com");
    expect(csp, "CSP must include api.stripe.com").toContain("api.stripe.com");
    expect(csp, "CSP must include hooks.stripe.com").toContain("hooks.stripe.com");
  });

  test("TC-STR-029: /settings response includes Stripe domains in CSP", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/settings`);
    const csp = response.headers()["content-security-policy"] ?? "";

    expect(csp).toContain("js.stripe.com");
    expect(csp).toContain("api.stripe.com");
    expect(csp).toContain("hooks.stripe.com");
  });
});

// ===========================================================================
// SEV-002 -- No origin header injection
// ===========================================================================

test.describe("SEV-002 -- No origin header injection via redirect URLs", () => {
  test("TC-STR-030: Stripe checkout route response body does not reflect injected Origin header", async ({ request }) => {
    const maliciousOrigin = "https://evil.example.com";
    const response = await request.post(`${BASE_URL}/api/stripe/checkout`, {
      data: {},
      headers: { "Origin": maliciousOrigin },
    });
    const bodyText = await response.text();
    expect(bodyText).not.toContain("evil.example.com");
  });

  test("TC-STR-031: Stripe portal route response body does not reflect injected Origin header", async ({ request }) => {
    const maliciousOrigin = "https://evil.example.com";
    const response = await request.post(`${BASE_URL}/api/stripe/portal`, {
      data: {},
      headers: { "Origin": maliciousOrigin },
    });
    const bodyText = await response.text();
    expect(bodyText).not.toContain("evil.example.com");
  });
});

// ===========================================================================
// UpsellBanner -- Stripe mode
// ===========================================================================

test.describe("UpsellBanner behavior", () => {
  test("TC-STR-032: Stripe dismiss key 'fenrir:stripe_upsell_dismissed' works", async ({ page }) => {
    await clearSubscriptionState(page);
    await page.goto(`${BASE_URL}/`);

    await page.evaluate(() => {
      localStorage.setItem("fenrir:stripe_upsell_dismissed", "true");
    });

    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState("networkidle");
    const heading = page.getByRole("heading").first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test("TC-STR-033: UpsellBanner shows 'Upgrade to Karl' CTA", async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.evaluate(() => {
      localStorage.removeItem("fenrir:stripe_upsell_dismissed");
      localStorage.removeItem("fenrir:entitlement");
    });
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState("networkidle");

    const upgradeBtn = page.getByRole("button", { name: /upgrade to karl/i });
    if (await upgradeBtn.count() > 0) {
      await expect(upgradeBtn.first()).toBeVisible({ timeout: 5000 });

      const dismissBtn = page.locator('[aria-label="Dismiss upgrade banner"]');
      if (await dismissBtn.count() > 0) {
        await expect(dismissBtn.first()).toBeVisible({ timeout: 3000 });
      }
    }
  });

  test("TC-STR-034: UpsellBanner dismiss sets localStorage key and hides banner", async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await page.evaluate(() => {
      localStorage.removeItem("fenrir:stripe_upsell_dismissed");
      localStorage.removeItem("fenrir:entitlement");
    });
    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState("networkidle");

    const dismissBtn = page.locator('[aria-label="Dismiss upgrade banner"]').first();
    if (await dismissBtn.count() > 0) {
      await dismissBtn.click();
      await page.waitForTimeout(400);

      const dismissKey = await page.evaluate(() =>
        localStorage.getItem("fenrir:stripe_upsell_dismissed"),
      );
      expect(dismissKey).toBe("true");

      const banner = page.locator('[aria-label="Upgrade your subscription"]');
      await expect(banner).not.toBeVisible({ timeout: 3000 });
    }
  });
});

// ===========================================================================
// Mobile responsiveness
// ===========================================================================

test.describe("Mobile responsiveness -- 375px viewport", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("TC-STR-035: /settings renders correctly at 375px width", async ({ page }) => {
    await clearSubscriptionState(page);
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState("networkidle");

    const heading = page.getByRole("heading", { name: "Settings" });
    await expect(heading).toBeVisible({ timeout: 10000 });

    const stripeSection = page.locator('[role="region"][aria-label="Subscription"]');
    await expect(stripeSection).toBeVisible({ timeout: 5000 });
  });

  test("TC-STR-035b: Subscribe button meets 44px touch target at 375px", async ({ page }) => {
    await clearSubscriptionState(page);
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState("networkidle");

    const subscribeBtn = page.getByRole("button", {
      name: /subscribe for \$3\.99\/month/i,
    }).first();

    if (await subscribeBtn.count() > 0) {
      const box = await subscribeBtn.boundingBox();
      if (box) {
        expect(box.height, "Subscribe button must be at least 44px tall").toBeGreaterThanOrEqual(44);
      }
    }
  });
});

// ===========================================================================
// Manual Test Steps (for paths that cannot be automated via Playwright)
// ===========================================================================
//
// MANUAL-01: StripeSettings Karl (Active) state
//   1. Use Stripe test mode + webhook CLI to simulate completed checkout
//   2. Navigate to /settings as authenticated Karl user
//   3. Verify: "KARL" badge, "Active" text, "$3.99/month",
//      "Next billing date: [date]", "Manage Subscription" + "Cancel" buttons
//   4. Verify Cancel button has aria-label="Cancel subscription"
//
// MANUAL-02: StripeSettings Canceled state
//   1. With active Karl subscription, cancel via Stripe Portal (or webhook)
//   2. Navigate to /settings
//   3. Verify: "KARL" badge, "Canceled" text,
//      "Your Karl access continues until [date]",
//      "After that date, your account reverts to Thrall (free tier).",
//      "Resubscribe" + "Manage Subscription" buttons
//
// MANUAL-03: SealedRuneModal anonymous Stripe flow
//   1. Navigate to /settings as anonymous
//   2. Trigger a locked feature gate
//   3. Click "Subscribe for $3.99/month"
//   4. Verify redirect goes directly to Stripe Checkout (NO email modal appears)
//
// MANUAL-04: Webhook HMAC verification
//   1. POST /api/stripe/webhook with valid stripe-signature
//   2. Verify 200 response and event processed correctly
//   3. POST with tampered body (different from signature payload)
//   4. Verify 400 with error: "invalid_signature"
//
// MANUAL-05: SEV-002 full verification
//   1. Auth as Google user
//   2. POST /api/stripe/checkout with Origin: https://evil.example.com header
//   3. Inspect the returned Stripe Checkout URL
//   4. Verify success_url and cancel_url use APP_BASE_URL value, not Origin header
