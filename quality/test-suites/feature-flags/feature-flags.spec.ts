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

  test("TC-FF-104: Cloud Sync section is visible", async ({
    page,
  }) => {
    await clearEntitlementState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    const cloudSyncSection = page.locator('[aria-label="Cloud Sync"]');
    await expect(cloudSyncSection).toBeVisible();
  });

  test("TC-FF-105: Multi-Household section is visible", async ({
    page,
  }) => {
    await clearEntitlementState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    const multiHouseholdSection = page.locator('[aria-label="Multi-Household"]');
    await expect(multiHouseholdSection).toBeVisible();
  });

  test("TC-FF-106: Data Export section is visible", async ({
    page,
  }) => {
    await clearEntitlementState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    const dataExportSection = page.locator('[aria-label="Data Export"]');
    await expect(dataExportSection).toBeVisible();
  });

  test("TC-FF-107: Data Export button is present but disabled", async ({
    page,
  }) => {
    await clearEntitlementState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    const exportButton = page.locator('button[aria-label="Export data (coming soon)"]');
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toBeDisabled();
  });

  test("TC-FF-108: Settings page header tagline is visible", async ({ page }) => {
    await clearEntitlementState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    const tagline = page.getByText("Forge your preferences. Shape the ledger to your will.");
    await expect(tagline).toBeVisible();
  });

  test("TC-FF-109: 'Coming soon to Karl supporters' text renders", async ({
    page,
  }) => {
    await clearEntitlementState(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    const comingSoonText = page.getByText("Coming soon to Karl supporters.").first();
    await expect(comingSoonText).toBeVisible();
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
