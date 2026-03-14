/**
 * Playwright E2E tests for Issue #682: GKE migration
 *
 * Validates critical journeys for GKE deployment:
 * - App is accessible and renders without Vercel components
 * - CSP headers do not reference Vercel services
 * - Auth callback path exists for APP_BASE_URL validation
 * - App container is healthy (K8s readiness)
 *
 * @ref #682
 */

import { test, expect } from "@playwright/test";

const baseURL = process.env.TEST_BASE_URL || "http://localhost:9653";

// ──────────────────────────────────────────────────────────────────────────────
// App accessibility and rendering
// ──────────────────────────────────────────────────────────────────────────────

test("Issue #682 — marketing homepage loads successfully (GKE ready)", async ({
  page,
}) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);

  // Verify page title
  await expect(page).toHaveTitle(/Fenrir Ledger/);

  // Verify HTML is rendered
  const html = page.locator("html");
  await expect(html).toBeVisible();
});

test("Issue #682 — health probe endpoint responds (K8s liveness/readiness)", async ({
  request,
}) => {
  const response = await request.get(`${baseURL}/api/health`);
  expect(response.ok()).toBe(true);

  const json = await response.json();
  expect(json).toHaveProperty("status");
});

// ──────────────────────────────────────────────────────────────────────────────
// CSP headers — Vercel cleanup validation
// ──────────────────────────────────────────────────────────────────────────────

test("Issue #682 — CSP headers do not reference vercel.live or vercel-scripts.com", async ({
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

  // No Vercel console errors should appear after loading
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  await page.waitForTimeout(500);
  const vercelErrors = consoleErrors.filter((e) => e.toLowerCase().includes("vercel"));
  expect(vercelErrors.length).toBe(0);
});

// ──────────────────────────────────────────────────────────────────────────────
// Auth flow — APP_BASE_URL validation (edge case from handoff)
// ──────────────────────────────────────────────────────────────────────────────

test("Issue #682 — auth callback path is accessible (APP_BASE_URL routing)", async ({
  page,
}) => {
  // Callback route should exist (may return 401 if invalid state, but not 404)
  const response = await page.goto("/auth/callback?code=test&state=test");
  expect(response?.status()).not.toBe(404);
});

// ──────────────────────────────────────────────────────────────────────────────
// GKE environment validation (not Vercel)
// ──────────────────────────────────────────────────────────────────────────────

test("Issue #682 — app environment is GKE (no Vercel meta tags)", async ({
  page,
}) => {
  await page.goto("/");

  // Document should not have Vercel-specific meta tags
  const vercelMetaTags = await page.locator('meta[name*="vercel"]').count();
  expect(vercelMetaTags).toBe(0);

  // App should load without Vercel service errors
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });

  await page.waitForTimeout(500);
  const vercelServiceErrors = errors.filter((e) =>
    e.toLowerCase().match(/vercel.*service|vercel.*undefined/),
  );
  expect(vercelServiceErrors.length).toBe(0);
});
