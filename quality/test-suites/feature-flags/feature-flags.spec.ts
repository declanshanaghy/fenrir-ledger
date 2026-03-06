/**
 * Feature Flags — Playwright Test Suite (Post-Patreon Removal)
 *
 * After removing all Patreon code, these tests verify:
 *   - Settings page loads and renders correctly
 *   - Stripe subscription section is visible
 *   - Premium feature gates render correctly
 *   - No JS errors on page load
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

const BASE_URL = process.env.SERVER_URL ?? "http://localhost:9653";

/**
 * Clear all entitlement state from localStorage.
 */
async function clearEntitlementState(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/`);
  await page.evaluate(() => {
    localStorage.removeItem("fenrir:entitlement");
    localStorage.removeItem("fenrir:stripe_upsell_dismissed");
    sessionStorage.clear();
  });
}

// ===========================================================================
// Settings page structure
// ===========================================================================

test.describe("Settings page structure", () => {
  test("TC-FF-101: /settings page loads with HTTP 200", async ({ page }) => {
    await clearEntitlementState(page);
    const response = await page.goto(`${BASE_URL}/settings`, {
      waitUntil: "networkidle",
    });
    expect(response?.status()).toBe(200);
  });

  test("TC-FF-102: Settings page renders the page heading", async ({ page }) => {
    await clearEntitlementState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    const heading = page.getByRole("heading", { level: 1, name: /Settings/i });
    await expect(heading).toBeVisible();
  });

  test("TC-FF-103: Stripe subscription section is visible", async ({
    page,
  }) => {
    await clearEntitlementState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    const stripeSection = page.locator('[role="region"][aria-label="Subscription"]');
    await expect(stripeSection).toBeVisible();
  });

  test("TC-FF-104: Cloud Sync gate shows locked upsell card for Thrall users", async ({
    page,
  }) => {
    await clearEntitlementState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    // SubscriptionGate renders a locked upsell card (aria-label ends with "(locked)")
    // instead of children for Thrall users
    const cloudSyncLocked = page.locator('[aria-label="Cloud Sync (locked)"]');
    await expect(cloudSyncLocked).toBeVisible({ timeout: 5000 });
  });

  test("TC-FF-105: All three gates show locked upsell cards for Thrall users", async ({
    page,
  }) => {
    await clearEntitlementState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    // All three SubscriptionGate instances render locked upsell cards with
    // aria-label="<Feature Name> (locked)" when the user is a Thrall
    const cloudSyncLocked = page.locator('[aria-label="Cloud Sync (locked)"]');
    const multiHouseholdLocked = page.locator('[aria-label="Multi-Household (locked)"]');
    const dataExportLocked = page.locator('[aria-label="Data Export (locked)"]');
    await expect(cloudSyncLocked).toBeVisible({ timeout: 5000 });
    await expect(multiHouseholdLocked).toBeVisible({ timeout: 5000 });
    await expect(dataExportLocked).toBeVisible({ timeout: 5000 });
  });

  test("TC-FF-106: Each locked gate has an 'Unlock with Karl' button", async ({
    page,
  }) => {
    await clearEntitlementState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    // Locked upsell cards render an "Unlock with Karl" CTA button
    const unlockButtons = page.getByRole("button", { name: /unlock with karl/i });
    const count = await unlockButtons.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("TC-FF-107: Gated sections do NOT render children for Thrall users", async ({
    page,
  }) => {
    await clearEntitlementState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    // The actual feature sections (Cloud Sync, Multi-Household, Data Export)
    // should NOT be visible -- SubscriptionGate replaces them with the locked placeholder
    const cloudSync = page.locator('[aria-label="Cloud Sync"]');
    const multiHousehold = page.locator('[aria-label="Multi-Household"]');
    const dataExport = page.locator('[aria-label="Data Export"]');
    expect(await cloudSync.count()).toBe(0);
    expect(await multiHousehold.count()).toBe(0);
    expect(await dataExport.count()).toBe(0);
  });

  test("TC-FF-108: Settings page header tagline is visible", async ({ page }) => {
    await clearEntitlementState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    const tagline = page.getByText("Forge your preferences. Shape the ledger to your will.");
    await expect(tagline).toBeVisible();
  });

  test("TC-FF-109: 'Coming soon to Karl supporters' text is NOT visible for Thrall users", async ({
    page,
  }) => {
    await clearEntitlementState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    // "Coming soon to Karl supporters" is inside gated children -- Thrall users
    // see the locked placeholder instead, so this text should NOT be visible
    const comingSoonText = page.getByText("Coming soon to Karl supporters.");
    expect(await comingSoonText.count()).toBe(0);
  });

  test("TC-FF-110: Dashboard loads without errors", async ({
    page,
  }) => {
    await clearEntitlementState(page);
    const response = await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    expect(response?.status()).toBe(200);
  });

  test("TC-FF-111: Settings page is accessible at mobile viewport (375px)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await clearEntitlementState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    const heading = page.getByRole("heading", { level: 1, name: /Settings/i });
    await expect(heading).toBeVisible();
    const stripeSection = page.locator('[role="region"][aria-label="Subscription"]');
    await expect(stripeSection).toBeVisible();
  });

  test("TC-FF-112: No JS errors on settings page load", async ({ page }) => {
    await clearEntitlementState(page);
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    expect(
      errors.filter((e) => !e.includes("hydration") && !e.includes("Warning:")),
    ).toHaveLength(0);
  });
});

// ===========================================================================
// API route sanity checks
// ===========================================================================

test.describe("Stripe API route sanity checks", () => {
  test("TC-FF-201: POST /api/stripe/checkout exists", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/stripe/checkout`, {
      data: {},
    });
    // Should respond (possibly 200/400/401/429/500), but NOT 404
    expect(response.status()).not.toBe(404);
  });

  test("TC-FF-202: GET /api/stripe/membership requires auth", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/stripe/membership`);
    expect(response.status()).toBe(401);
  });

  test("TC-FF-203: POST /api/stripe/webhook handles missing signature", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/stripe/webhook`, {
      data: "{}",
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status()).toBe(400);
  });

  test("TC-FF-204: non-subscription routes are unaffected", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/token`, { data: {} });
    expect(response.status()).not.toBe(404);
  });
});
