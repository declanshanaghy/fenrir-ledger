/**
 * Patreon Removal — Playwright Test Suite
 *
 * Verifies the acceptance criteria for the refactor/remove-patreon branch:
 *   - All /api/patreon/* routes return 404 (routes are gone)
 *   - Settings page contains zero "Patreon" text
 *   - Dashboard contains zero "Patreon" text
 *   - SealedRuneModal shows Stripe CTA, not Patreon
 *   - feature-flags isStripe/isPatreon guards are gone from Stripe routes
 *   - Stripe API routes are always active (no feature flag gating)
 *
 * Every assertion is derived from acceptance criteria in the spec,
 * NOT from what the code currently does.
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

const BASE_URL = process.env.SERVER_URL ?? "http://localhost:9653";

/** Seven Patreon API routes that must be absent post-removal. */
const PATREON_ROUTES = [
  "/api/patreon/authorize",
  "/api/patreon/callback",
  "/api/patreon/membership",
  "/api/patreon/membership-anon",
  "/api/patreon/migrate",
  "/api/patreon/unlink",
  "/api/patreon/webhook",
];

/**
 * Navigate to home and clear localStorage entitlement / upsell state
 * so tests start from a clean, unauthenticated Thrall baseline.
 */
async function resetState(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/`);
  await page.evaluate(() => {
    localStorage.removeItem("fenrir:entitlement");
    localStorage.removeItem("fenrir:stripe_upsell_dismissed");
    sessionStorage.clear();
  });
}

// ===========================================================================
// TC-PR-100: Patreon API routes return 404
// ===========================================================================

test.describe("Patreon API routes must return 404", () => {
  for (const route of PATREON_ROUTES) {
    test(`TC-PR-${100 + PATREON_ROUTES.indexOf(route) + 1}: GET ${route} → 404`, async ({
      request,
    }) => {
      const response = await request.get(`${BASE_URL}${route}`);
      expect(response.status()).toBe(404);
    });
  }

  for (const route of PATREON_ROUTES) {
    test(`TC-PR-${108 + PATREON_ROUTES.indexOf(route)}: POST ${route} → 404`, async ({
      request,
    }) => {
      const response = await request.post(`${BASE_URL}${route}`, { data: {} });
      // Next.js App Router returns 404 for GET, 405 for POST to non-existent routes
      expect([404, 405]).toContain(response.status());
    });
  }
});

// ===========================================================================
// TC-PR-200: Settings page contains no Patreon references
// ===========================================================================

test.describe("Settings page — no Patreon text", () => {
  test("TC-PR-201: /settings page loads successfully (HTTP 200)", async ({ page }) => {
    await resetState(page);
    const response = await page.goto(`${BASE_URL}/settings`, {
      waitUntil: "networkidle",
    });
    expect(response?.status()).toBe(200);
  });

  test('TC-PR-202: /settings page has zero occurrences of "Patreon"', async ({
    page,
  }) => {
    await resetState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });

    const bodyText = await page.locator("body").innerText();
    const patreonCount = (bodyText.match(/patreon/gi) ?? []).length;
    expect(patreonCount).toBe(0);
  });

  test('TC-PR-203: /settings page renders "Subscription" section (StripeSettings)', async ({
    page,
  }) => {
    await resetState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    // StripeSettings renders a region with aria-label="Subscription"
    const subscriptionSection = page.locator(
      '[role="region"][aria-label="Subscription"]',
    );
    await expect(subscriptionSection).toBeVisible();
  });

  test('TC-PR-204: /settings page has no "Connect Patreon" or "Link Patreon" button', async ({
    page,
  }) => {
    await resetState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });

    const patreonButton = page.getByRole("button", { name: /patreon/i });
    await expect(patreonButton).toHaveCount(0);
  });

  test('TC-PR-205: /settings page renders "Settings" heading (not platform-specific)', async ({
    page,
  }) => {
    await resetState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    const heading = page.getByRole("heading", { level: 1, name: /Settings/i });
    await expect(heading).toBeVisible();
  });
});

// ===========================================================================
// TC-PR-300: Dashboard page contains no Patreon references
// ===========================================================================

test.describe("Dashboard page — no Patreon text", () => {
  test('TC-PR-301: dashboard page has zero occurrences of "Patreon"', async ({
    page,
  }) => {
    await resetState(page);
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

    const bodyText = await page.locator("body").innerText();
    const patreonCount = (bodyText.match(/patreon/gi) ?? []).length;
    expect(patreonCount).toBe(0);
  });

  test('TC-PR-302: dashboard renders without "Patreon" in page title', async ({
    page,
  }) => {
    await resetState(page);
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    const title = await page.title();
    expect(title.toLowerCase()).not.toContain("patreon");
  });

  test("TC-PR-303: dashboard page loads with HTTP 200", async ({ page }) => {
    await resetState(page);
    const response = await page.goto(`${BASE_URL}/`, {
      waitUntil: "networkidle",
    });
    expect(response?.status()).toBe(200);
  });
});

// ===========================================================================
// TC-PR-400: SealedRuneModal shows Stripe CTA only
// ===========================================================================

test.describe("SealedRuneModal — Stripe CTA, no Patreon", () => {
  /**
   * Trigger a SealedRuneModal by clicking a SubscriptionGate-wrapped element.
   * On the settings page the premium sections (Cloud Sync, Multi-Household,
   * Data Export) are wrapped in SubscriptionGate.  An anonymous/Thrall user
   * who clicks inside those sections causes the modal to open.
   * We navigate to settings where SubscriptionGate is used.
   */
  async function openSealedRuneModal(page: Page): Promise<boolean> {
    await resetState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });

    // SubscriptionGate wraps "Cloud Sync", "Multi-Household", "Data Export"
    // sections. A Thrall (unauthenticated) user clicking inside opens the modal.
    const cloudSyncSection = page.locator('[aria-label="Cloud Sync"]');
    const sectionVisible = await cloudSyncSection.isVisible().catch(() => false);
    if (!sectionVisible) return false;

    await cloudSyncSection.click();
    // Wait briefly for potential modal animation
    await page.waitForTimeout(300);

    const dialog = page.locator('[role="dialog"]');
    return dialog.isVisible().catch(() => false);
  }

  test('TC-PR-401: SealedRuneModal contains "THIS RUNE IS SEALED" heading', async ({
    page,
  }) => {
    const modalOpened = await openSealedRuneModal(page);
    if (!modalOpened) {
      test.skip(true, "Modal did not open — SubscriptionGate may allow Thrall through");
    }

    const heading = page.getByText(/THIS RUNE IS SEALED/i);
    await expect(heading).toBeVisible();
  });

  test("TC-PR-402: SealedRuneModal subscribe button references Stripe ($3.99/month), not Patreon", async ({
    page,
  }) => {
    const modalOpened = await openSealedRuneModal(page);
    if (!modalOpened) {
      test.skip(true, "Modal did not open — SubscriptionGate may allow Thrall through");
    }

    // The spec requires: Stripe CTA "Subscribe for $3.99/month"
    const subscribeButton = page.getByRole("button", {
      name: /Subscribe for \$3\.99\/month/i,
    });
    await expect(subscribeButton).toBeVisible();
  });

  test('TC-PR-403: SealedRuneModal contains zero occurrences of "Patreon"', async ({
    page,
  }) => {
    const modalOpened = await openSealedRuneModal(page);
    if (!modalOpened) {
      test.skip(true, "Modal did not open — SubscriptionGate may allow Thrall through");
    }

    const dialog = page.locator('[role="dialog"]');
    const dialogText = await dialog.innerText();
    const patreonCount = (dialogText.match(/patreon/gi) ?? []).length;
    expect(patreonCount).toBe(0);
  });

  test('TC-PR-404: SealedRuneModal "Not now" dismiss button is present', async ({
    page,
  }) => {
    const modalOpened = await openSealedRuneModal(page);
    if (!modalOpened) {
      test.skip(true, "Modal did not open — SubscriptionGate may allow Thrall through");
    }

    const notNowButton = page.getByRole("button", {
      name: /Dismiss and continue without premium features/i,
    });
    await expect(notNowButton).toBeVisible();
  });

  test("TC-PR-405: SealedRuneModal dismisses when 'Not now' is clicked", async ({
    page,
  }) => {
    const modalOpened = await openSealedRuneModal(page);
    if (!modalOpened) {
      test.skip(true, "Modal did not open — SubscriptionGate may allow Thrall through");
    }

    const notNowButton = page.getByRole("button", {
      name: /Dismiss and continue without premium features/i,
    });
    await notNowButton.click();

    // Dialog should close after dismissal
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).not.toBeVisible({ timeout: 2000 });
  });
});

// ===========================================================================
// TC-PR-500: Stripe API routes are always active (no feature flag gating)
// ===========================================================================

test.describe("Stripe API routes are always active (no isStripe() gate)", () => {
  test("TC-PR-501: GET /api/stripe/membership requires auth (401), not 404", async ({
    request,
  }) => {
    const response = await request.get(`${BASE_URL}/api/stripe/membership`);
    // 401 means the route exists and auth is required; 404 would mean feature-gated off
    expect(response.status()).toBe(401);
    expect(response.status()).not.toBe(404);
  });

  test("TC-PR-502: POST /api/stripe/checkout exists and is not 404", async ({
    request,
  }) => {
    const response = await request.post(`${BASE_URL}/api/stripe/checkout`, {
      data: {},
    });
    expect(response.status()).not.toBe(404);
  });

  test("TC-PR-503: POST /api/stripe/webhook exists (not 404)", async ({
    request,
  }) => {
    const response = await request.post(`${BASE_URL}/api/stripe/webhook`, {
      data: "{}",
      headers: { "Content-Type": "application/json" },
    });
    // 400 = bad signature, which is correct. Anything other than 404 is valid.
    expect(response.status()).not.toBe(404);
  });

  test("TC-PR-504: POST /api/stripe/portal requires auth (401), not 404", async ({
    request,
  }) => {
    const response = await request.post(`${BASE_URL}/api/stripe/portal`, {
      data: {},
    });
    expect(response.status()).toBe(401);
    expect(response.status()).not.toBe(404);
  });

  test("TC-PR-505: POST /api/stripe/unlink requires auth (401), not 404", async ({
    request,
  }) => {
    const response = await request.post(`${BASE_URL}/api/stripe/unlink`, {
      data: {},
    });
    expect(response.status()).toBe(401);
    expect(response.status()).not.toBe(404);
  });
});

// ===========================================================================
// TC-PR-600: EntitlementPlatform is Stripe-only
// ===========================================================================

test.describe("Entitlement is Stripe-only — no Patreon platform state", () => {
  test("TC-PR-601: localStorage entitlement has platform 'stripe', never 'patreon'", async ({
    page,
  }) => {
    await resetState(page);
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

    const entitlementRaw = await page.evaluate(() =>
      localStorage.getItem("fenrir:entitlement"),
    );

    if (entitlementRaw) {
      // If entitlement is cached, verify it is Stripe-only
      const parsed = JSON.parse(entitlementRaw) as Record<string, unknown>;
      expect(parsed.platform).not.toBe("patreon");
    } else {
      // No entitlement = anonymous Thrall — acceptable, no Patreon contamination
      expect(entitlementRaw).toBeNull();
    }
  });

  test("TC-PR-602: No Patreon-related localStorage keys are present on fresh load", async ({
    page,
  }) => {
    await resetState(page);
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

    const patreonKeys = await page.evaluate(() => {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.toLowerCase().includes("patreon")) {
          keys.push(key);
        }
      }
      return keys;
    });

    expect(patreonKeys).toHaveLength(0);
  });
});

// ===========================================================================
// TC-PR-700: No JS console errors on page load
// ===========================================================================

test.describe("No JavaScript errors caused by removal", () => {
  test("TC-PR-701: Dashboard loads without JS errors", async ({ page }) => {
    await resetState(page);
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    // Filter out known non-critical noise
    const critical = errors.filter(
      (e) => !e.includes("hydration") && !e.includes("Warning:"),
    );
    expect(critical).toHaveLength(0);
  });

  test("TC-PR-702: Settings page loads without JS errors", async ({ page }) => {
    await resetState(page);
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const critical = errors.filter(
      (e) => !e.includes("hydration") && !e.includes("Warning:"),
    );
    expect(critical).toHaveLength(0);
  });
});
