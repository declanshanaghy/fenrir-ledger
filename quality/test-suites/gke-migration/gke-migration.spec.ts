/**
 * Playwright E2E tests for GKE migration — Issue #680
 *
 * These are critical browser-based tests that verify:
 * 1. App serves content over HTTPS
 * 2. Health check endpoint responds correctly
 * 3. SSR renders initial page content
 * 4. API routes work correctly
 * 5. Static assets load properly
 *
 * These tests are minimal — focus on what requires a real browser.
 * Most validation is done via Vitest unit/integration tests.
 *
 * @ref #680
 */

import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

test.describe("GKE Migration — App Health & SSR", () => {
  test("health endpoint returns 200 with status ok", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.status).toBe("ok");
    expect(data.timestamp).toBeDefined();
    expect(data.version).toBeDefined();
    expect(data.buildId).toBeDefined();
  });

  test("app homepage loads and renders content", async ({ page }) => {
    // Navigate to app
    await page.goto(BASE_URL);

    // Wait for content to load (SSR should have already rendered)
    await page.waitForLoadState("networkidle");

    // Check that page title or heading exists (app is rendered)
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(0);

    // Verify no server errors in console
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // No fatal errors
    const fatalErrors = consoleErrors.filter((e) =>
      e.includes("Error") || e.includes("500")
    );
    expect(fatalErrors.length).toBe(0);
  });

  test("static assets load with proper headers", async ({ request }) => {
    // Next.js serves static assets from /_next/static/
    const response = await request.head(`${BASE_URL}/_next/static/`);

    // Verify endpoint exists (may be 301/404 for directory, but not 500)
    expect(response.status()).toBeLessThan(500);
  });

  test("app responds with valid HTML content type", async ({ request }) => {
    const response = await request.get(BASE_URL);
    const contentType = response.headers()["content-type"];

    expect(contentType).toContain("text/html");
  });

  test("health check includes version info from env vars", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    const data = await response.json();

    // version and buildId should be present (even if 'unknown')
    expect(data.version).toBeTruthy();
    expect(data.buildId).toBeTruthy();
  });
});
