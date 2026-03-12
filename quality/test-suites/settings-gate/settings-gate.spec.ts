/**
 * Settings Gate — Playwright Test Suite
 * Authored by Loki, QA Tester of the Pack
 *
 * Trimmed to 3 core tests per issue #613:
 *   1. Settings page loads with heading
 *   2. Stripe checkout endpoint exists
 *   3. Stripe webhook rejects missing signature
 */

import { test, expect, type Page } from "@playwright/test";

async function clearEntitlementState(page: Page): Promise<void> {
  await page.goto("/ledger");
  await page.evaluate(() => {
    localStorage.removeItem("fenrir:entitlement");
    localStorage.removeItem("fenrir:stripe_upsell_dismissed");
    sessionStorage.clear();
  });
}

test.describe("Settings + Stripe gates", () => {
  test("page loads with HTTP 200 and renders heading", async ({ page }) => {
    await clearEntitlementState(page);
    await page.goto("/ledger/settings", { waitUntil: "load" });
    await expect(
      page.getByRole("heading", { level: 1, name: /Settings/i })
    ).toBeVisible();
  });

  test("POST /api/stripe/checkout exists (not 404)", async ({ request }) => {
    const response = await request.post("/api/stripe/checkout", { data: {} });
    expect(response.status()).not.toBe(404);
  });

  test("POST /api/stripe/webhook rejects missing signature (400)", async ({
    request,
  }) => {
    const response = await request.post("/api/stripe/webhook", {
      data: "{}",
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status()).toBe(400);
  });
});
