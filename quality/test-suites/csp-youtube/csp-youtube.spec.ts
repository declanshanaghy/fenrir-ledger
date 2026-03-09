/**
 * CSP YouTube img-src Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests the Content Security Policy img-src directive against Issue #455 acceptance criteria:
 * - https://img.youtube.com added to CSP img-src directive
 * - YouTube thumbnail images load without CSP errors
 * - No other CSP directives regressed
 * - Build passes
 *
 * Spec references:
 *   - development/frontend/next.config.ts: cspDirectives, img-src
 *   - Issue #455: CSP img-src blocks YouTube thumbnail images
 */

import { test, expect } from "@playwright/test";

// ─── Shared Setup ────────────────────────────────────────────────────────────
// Base URL for testing
const BASE_URL = "/";

// ════════════════════════════════════════════════════════════════════════════
// Suite 1 — CSP Header Validation
// ════════════════════════════════════════════════════════════════════════════

test.describe("CSP — img-src Directive", () => {
  test("should include https://img.youtube.com in img-src directive", async ({
    page,
  }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    // Verify CSP header exists
    expect(cspHeader.length).toBeGreaterThan(0);

    // Verify img-src directive exists
    expect(cspHeader).toMatch(/img-src\s+/);

    // Verify https://img.youtube.com is in img-src
    expect(cspHeader).toMatch(/img-src[^;]*https:\/\/img\.youtube\.com/);
  });

  test("should have img-src directive with self and Google profile images", async ({
    page,
  }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    // Extract img-src directive
    const imgSrcMatch = cspHeader.match(/img-src\s+([^;]+)/);
    expect(imgSrcMatch).toBeTruthy();

    const imgSrcValue = imgSrcMatch?.[1] || "";

    // Verify self is included
    expect(imgSrcValue).toContain("'self'");

    // Verify Google profile images are included
    expect(imgSrcValue).toContain("https://lh3.googleusercontent.com");

    // Verify YouTube images are included
    expect(imgSrcValue).toContain("https://img.youtube.com");

    // Verify data: URIs are allowed (for inline images)
    expect(imgSrcValue).toContain("data:");
  });

  test("should not have CSP violations for img-src", async ({ page }) => {
    let cspViolations = false;

    page.on("console", (msg) => {
      if (msg.type() === "error" && msg.text().includes("Refused to load the image")) {
        cspViolations = true;
      }
    });

    page.on("requestfailed", (request) => {
      if (request.failure()?.errorText.includes("net::ERR_BLOCKED_BY_CSP")) {
        cspViolations = true;
      }
    });

    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle");

    expect(cspViolations).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2 — CSP Directive Regression Testing
// ════════════════════════════════════════════════════════════════════════════

test.describe("CSP — No Regressions", () => {
  test("should have script-src directive with required sources", async ({
    page,
  }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    // Verify script-src directive exists and includes required sources
    expect(cspHeader).toMatch(/script-src\s+[^;]*'self'[^;]*'unsafe-inline'/);
    expect(cspHeader).toMatch(/script-src[^;]*https:\/\/accounts\.google\.com/);
    expect(cspHeader).toMatch(/script-src[^;]*https:\/\/apis\.google\.com/);
    expect(cspHeader).toMatch(/script-src[^;]*https:\/\/js\.stripe\.com/);
  });

  test("should have style-src directive with required sources", async ({
    page,
  }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    // Verify style-src directive exists and includes required sources
    expect(cspHeader).toMatch(/style-src\s+[^;]*'self'[^;]*'unsafe-inline'/);
    expect(cspHeader).toMatch(/style-src[^;]*https:\/\/fonts\.googleapis\.com/);
  });

  test("should have connect-src directive with required sources", async ({
    page,
  }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    // Verify connect-src directive includes API endpoints
    expect(cspHeader).toMatch(/connect-src[^;]*https:\/\/accounts\.google\.com/);
    expect(cspHeader).toMatch(/connect-src[^;]*https:\/\/api\.stripe\.com/);
    expect(cspHeader).toMatch(/connect-src[^;]*https:\/\/api\.anthropic\.com/);
  });

  test("should have font-src directive with Google Fonts", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    // Verify font-src directive includes Google Fonts CDN
    expect(cspHeader).toMatch(/font-src[^;]*https:\/\/fonts\.gstatic\.com/);
  });

  test("should have frame-src directive for OAuth and Stripe", async ({
    page,
  }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    // Verify frame-src directive includes required sources
    expect(cspHeader).toMatch(/frame-src[^;]*https:\/\/accounts\.google\.com/);
    expect(cspHeader).toMatch(/frame-src[^;]*https:\/\/js\.stripe\.com/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 3 — Security Headers Validation
// ════════════════════════════════════════════════════════════════════════════

test.describe("CSP — Supporting Security Headers", () => {
  test("should have X-Frame-Options set to DENY", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};

    expect(headers["x-frame-options"]).toBe("DENY");
  });

  test("should have X-Content-Type-Options set to nosniff", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};

    expect(headers["x-content-type-options"]).toBe("nosniff");
  });

  test("should have Strict-Transport-Security header", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};

    expect(headers["strict-transport-security"]).toBeTruthy();
  });
});
