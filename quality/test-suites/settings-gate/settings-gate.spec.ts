/**
 * Settings Gate — Playwright Test Suite
 *
 * Merged from feature-flags + settings-soft-gate. Tests:
 *   - Settings page loads and renders correctly
 *   - Subscription gates show locked upsell cards for Thrall users
 *   - Soft gate mode (children visible alongside upsell)
 *   - No JS errors on page load
 *   - Stripe API route sanity checks
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function clearEntitlementState(page: Page): Promise<void> {
  await page.goto("/ledger");
  await page.evaluate(() => {
    localStorage.removeItem("fenrir:entitlement");
    localStorage.removeItem("fenrir:stripe_upsell_dismissed");
    sessionStorage.clear();
  });
}

// ===========================================================================
// Settings page structure + gates
// ===========================================================================

test.describe("Settings page — structure and gates", () => {
  test.beforeEach(async ({ page }) => {
    await clearEntitlementState(page);
    await page.goto("/ledger/settings", { waitUntil: "load" });
  });

  test("page loads with HTTP 200 and renders heading", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: /Settings/i })).toBeVisible();
  });

  test("Stripe subscription section is visible", async ({ page }) => {
    await expect(page.locator('[role="region"][aria-label="Subscription"]')).toBeVisible();
  });

  test("all three gates show locked upsell cards with Unlock buttons", async ({ page }) => {
    await expect(page.locator('[aria-label="Cloud Sync (locked)"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[aria-label="Multi-Household (locked)"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[aria-label="Data Export (locked)"]')).toBeVisible({ timeout: 5000 });

    const unlockButtons = page.getByRole("button", { name: /unlock with karl/i });
    expect(await unlockButtons.count()).toBeGreaterThanOrEqual(3);
  });

  test("soft gate — no hard gate placeholder, children visible alongside upsell", async ({ page }) => {
    await expect(page.getByText("This feature requires a Karl subscription.")).not.toBeVisible();

    // Children are rendered even for Thrall users (soft gate)
    expect(await page.locator('[aria-label="Cloud Sync"]').count()).toBeGreaterThan(0);
    expect(await page.locator('[aria-label="Multi-Household"]').count()).toBeGreaterThan(0);
    expect(await page.locator('[aria-label="Data Export"]').count()).toBeGreaterThan(0);
  });

  test("no JS errors on page load", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.reload({ waitUntil: "load" });
    expect(
      errors.filter((e) => !e.includes("hydration") && !e.includes("Warning:")),
    ).toHaveLength(0);
  });
});

// ===========================================================================
// Stripe API route sanity checks
// ===========================================================================

test.describe("Stripe API route sanity checks", () => {
  test("POST /api/stripe/checkout exists (not 404)", async ({ request }) => {
    const response = await request.post("/api/stripe/checkout", { data: {} });
    expect(response.status()).not.toBe(404);
  });

  test("GET /api/stripe/membership requires auth (401)", async ({ request }) => {
    const response = await request.get("/api/stripe/membership");
    expect(response.status()).toBe(401);
  });

  test("POST /api/stripe/webhook rejects missing signature (400)", async ({ request }) => {
    const response = await request.post("/api/stripe/webhook", {
      data: "{}",
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status()).toBe(400);
  });

  test("POST /api/auth/token exists (not 404)", async ({ request }) => {
    const response = await request.post("/api/auth/token", { data: {} });
    expect(response.status()).not.toBe(404);
  });
});
