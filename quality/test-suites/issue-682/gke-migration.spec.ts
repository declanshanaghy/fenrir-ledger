/**
 * Playwright E2E tests for Issue #682: GKE migration
 *
 * Tests critical user journeys for GKE deployment:
 * - App is accessible and renders
 * - CSP headers are enforced (no Vercel scripts)
 * - Auth flow redirects work with APP_BASE_URL
 *
 * @ref #682
 */

import { test, expect } from "@playwright/test";

const baseURL = process.env.TEST_BASE_URL || "http://localhost:9653";

test.describe("Issue #682 — GKE Migration E2E", () => {
  test.describe("App accessibility and rendering", () => {
    test("marketing homepage loads successfully", async ({ page, context }) => {
      // Navigate to the app
      const response = await page.goto("/");
      expect(response?.status()).toBe(200);

      // Verify page title and basic content
      await expect(page).toHaveTitle(/Fenrir Ledger/);

      // Check that the layout renders
      const html = page.locator("html");
      await expect(html).toBeVisible();

      // Verify no Vercel analytics script in document
      const scripts = page.locator("script");
      const scriptTexts = await scripts.allTextContents();
      const vercelAnalyticsFound = scriptTexts.some((text) =>
        text.toLowerCase().includes("vercel"),
      );
      expect(vercelAnalyticsFound).toBe(false);
    });

    test("app responds to health probe endpoint", async ({ fetch }) => {
      // Simulate K8s liveness/readiness probe
      const response = await fetch(`${baseURL}/api/health`);
      expect(response.status()).toBe(200);

      const json = await response.json();
      expect(json).toHaveProperty("status");
    });
  });

  test.describe("CSP headers validation", () => {
    test("CSP headers do not reference vercel.live or vercel-scripts.com", async ({
      page,
    }) => {
      const response = await page.goto("/");
      expect(response?.status()).toBe(200);

      const cspHeader = response?.headerValue("content-security-policy");
      if (cspHeader) {
        expect(cspHeader).not.toContain("vercel.live");
        expect(cspHeader).not.toContain("vercel-scripts.com");
        expect(cspHeader).not.toContain("vercel.app");
      }

      // Verify no blocked CSP violations for missing Vercel scripts
      // (i.e., we removed them, so they shouldn't be blocked)
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error" && msg.text().includes("CSP")) {
          consoleErrors.push(msg.text());
        }
      });

      // Wait a moment for any errors to appear
      await page.waitForTimeout(500);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe("Auth flow — APP_BASE_URL validation", () => {
    test("auth callback path is accessible", async ({ page }) => {
      // This test validates that the auth callback route exists and is accessible
      // We don't actually do OAuth (would need real credentials), but we verify the route exists
      const response = await page.goto("/auth/callback?code=test&state=test");

      // Route should exist (may return 401 or redirect, but not 404)
      expect(response?.status()).not.toBe(404);
    });

    test("environment is configured for GKE (not Vercel)", async ({ page }) => {
      // Navigate to a page and check that the app initializes correctly
      await page.goto("/");

      // Verify document doesn't have Vercel-specific initialization
      const vercelMetaTags = await page.locator('meta[name*="vercel"]').count();
      expect(vercelMetaTags).toBe(0);

      // Verify page loaded without Vercel Analytics errors
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          errors.push(msg.text());
        }
      });

      await page.waitForTimeout(500);

      // Should have no errors about missing Vercel services
      const vercelErrors = errors.filter((e) => e.toLowerCase().includes("vercel"));
      expect(vercelErrors.length).toBe(0);
    });
  });

  test.describe("Smoke test — GKE readiness", () => {
    test("app container is ready to serve traffic", async ({ page, request }) => {
      // Test basic routing
      const homeResponse = await request.get(`${baseURL}/`);
      expect(homeResponse.ok()).toBe(true);

      // Test API health endpoint (K8s probe)
      const healthResponse = await request.get(`${baseURL}/api/health`);
      expect(healthResponse.ok()).toBe(true);

      const health = await healthResponse.json();
      expect(health).toHaveProperty("status");
    });
  });
});
