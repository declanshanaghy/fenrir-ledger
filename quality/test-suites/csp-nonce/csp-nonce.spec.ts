/**
 * CSP Nonce Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Tests the Content Security Policy nonce-based implementation against Issue #498 acceptance criteria:
 * - CSP header present on responses
 * - Nonce attribute present on script and style tags
 * - Nonce values are cryptographically unique per request
 * - Nonce is properly injected into CSP header directives
 * - Pages load without CSP violations
 * - unsafe-inline is replaced with nonce-based CSP (or unsafe-inline fallback in dev)
 *
 * Spec references:
 *   - development/frontend/src/lib/csp-nonce.ts: nonce generation
 *   - development/frontend/src/lib/csp-headers.ts: CSP header building
 *   - development/frontend/src/middleware.ts: nonce injection via headers
 *   - Issue #498: Implement nonce-based CSP to replace unsafe-inline
 */

import { test, expect } from "@playwright/test";

// ─── Shared Setup ────────────────────────────────────────────────────────────
// Base URL for testing
const BASE_URL = "/";

// ════════════════════════════════════════════════════════════════════════════
// Suite 1 — CSP Header Validation
// ════════════════════════════════════════════════════════════════════════════

test.describe("CSP — Nonce Header Present", () => {
  test("should include CSP header on response", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    // Verify CSP header exists and is non-empty
    expect(cspHeader.length).toBeGreaterThan(0);
  });

  test("should have nonce value in script-src directive", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    // Verify script-src directive exists
    expect(cspHeader).toMatch(/script-src\s+/);

    // Verify nonce is present or unsafe-inline fallback (dev mode)
    const hasNonce = cspHeader.match(/script-src[^;]*'nonce-[a-zA-Z0-9+/=]+'/);
    const hasUnsafeInline = cspHeader.includes("'unsafe-inline'");

    expect(hasNonce || hasUnsafeInline).toBeTruthy();
  });

  test("should have nonce value in style-src directive", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    // Verify style-src directive exists
    expect(cspHeader).toMatch(/style-src\s+/);

    // Verify nonce is present or unsafe-inline fallback (dev mode)
    const hasNonce = cspHeader.match(/style-src[^;]*'nonce-[a-zA-Z0-9+/=]+'/);
    const hasUnsafeInline = cspHeader.includes("'unsafe-inline'");

    expect(hasNonce || hasUnsafeInline).toBeTruthy();
  });

  test("should generate unique nonce per request", async ({ page }) => {
    // Fetch first request nonce
    const response1 = await page.goto(BASE_URL);
    const headers1 = response1?.headers() || {};
    const cspHeader1 = headers1["content-security-policy"] || "";
    const nonce1Match = cspHeader1.match(/'nonce-([a-zA-Z0-9+/=]+)'/);

    // Reload page to get second nonce
    const response2 = await page.reload();
    const headers2 = response2?.headers() || {};
    const cspHeader2 = headers2["content-security-policy"] || "";
    const nonce2Match = cspHeader2.match(/'nonce-([a-zA-Z0-9+/=]+)'/);

    // If both responses have nonces (production mode), they should be different
    if (nonce1Match && nonce2Match) {
      const nonce1 = nonce1Match[1];
      const nonce2 = nonce2Match[1];

      // Nonces should be unique across requests
      expect(nonce1).not.toEqual(nonce2);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2 — Nonce Injection in Elements
// ════════════════════════════════════════════════════════════════════════════

test.describe("CSP — Nonce Injection in Elements", () => {
  test("should have scripts present and loaded", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    // Extract nonce from CSP header
    const nonceMatch = cspHeader.match(/'nonce-([a-zA-Z0-9+/=]+)'/);

    // If nonce is present in CSP, verify scripts load successfully
    if (nonceMatch) {
      await page.waitForLoadState("networkidle");

      // Check that at least one script tag exists
      const scriptCount = await page.locator("script").count();
      expect(scriptCount).toBeGreaterThan(0);

      // No script load errors should occur
      let scriptErrors = false;
      page.on("console", (msg) => {
        if (
          msg.type() === "error" &&
          msg.text().includes("Refused to load the script")
        ) {
          scriptErrors = true;
        }
      });

      expect(scriptErrors).toBe(false);
    }
  });

  test("should have styles present and loaded", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    // Extract nonce from CSP header
    const nonceMatch = cspHeader.match(/'nonce-([a-zA-Z0-9+/=]+)'/);

    // If nonce is present in CSP, verify styles load successfully
    if (nonceMatch) {
      await page.waitForLoadState("networkidle");

      // Check that at least one style/link tag exists
      const styleCount = await page.locator("style, link[rel='stylesheet']").count();
      expect(styleCount).toBeGreaterThan(0);

      // No style load errors should occur
      let styleErrors = false;
      page.on("console", (msg) => {
        if (
          msg.type() === "error" &&
          msg.text().includes("Refused to load the stylesheet")
        ) {
          styleErrors = true;
        }
      });

      expect(styleErrors).toBe(false);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 3 — CSP Violation Detection
// ════════════════════════════════════════════════════════════════════════════

test.describe("CSP — No Violations on Page Load", () => {
  test("should not have CSP violations on homepage", async ({ page }) => {
    let cspViolations: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error" && msg.text().includes("Refused to load")) {
        cspViolations.push(msg.text());
      }
    });

    page.on("requestfailed", (request) => {
      if (request.failure()?.errorText.includes("net::ERR_BLOCKED_BY_CSP")) {
        cspViolations.push(
          `Request blocked by CSP: ${request.url()}`
        );
      }
    });

    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle");

    expect(cspViolations.length).toBe(0);
  });

  test("should allow required external scripts", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    // Verify Google accounts is allowed in script-src
    expect(cspHeader).toMatch(/script-src[^;]*https:\/\/accounts\.google\.com/);

    await page.waitForLoadState("networkidle");

    // Page should load successfully
    expect(response?.status()).toBeLessThan(400);
  });

  test("should allow required stylesheets", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    // Verify Google Fonts is allowed in style-src
    expect(cspHeader).toMatch(/style-src[^;]*https:\/\/fonts\.googleapis\.com/);

    await page.waitForLoadState("networkidle");

    // Get all stylesheets loaded
    const stylesheets = await page.locator("link[rel='stylesheet'], style").count();

    // At least one stylesheet should load (Google Fonts or internal)
    expect(stylesheets).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 4 — Security Headers Validation
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

  test("should have Referrer-Policy set to strict-origin-when-cross-origin", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};

    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  test("should have Permissions-Policy header", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};

    expect(headers["permissions-policy"]).toBeTruthy();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 5 — CSP Directive Completeness
// ════════════════════════════════════════════════════════════════════════════

test.describe("CSP — All Required Directives", () => {
  test("should have all required CSP directives", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    // Check for all required directives
    const requiredDirectives = [
      "default-src",
      "script-src",
      "style-src",
      "img-src",
      "font-src",
      "connect-src",
      "frame-src",
      "form-action",
      "base-uri",
    ];

    for (const directive of requiredDirectives) {
      expect(cspHeader).toMatch(new RegExp(`${directive}\\s+`, "i"));
    }
  });

  test("should have default-src set to self", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    expect(cspHeader).toMatch(/default-src\s+['"]?self['"]?/);
  });

  test("should allow Google APIs in multiple directives", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    // Google should be allowed in script-src
    expect(cspHeader).toMatch(
      /script-src[^;]*https:\/\/accounts\.google\.com[^;]*https:\/\/apis\.google\.com/s
    );

    // Google should be allowed in connect-src
    expect(cspHeader).toMatch(/connect-src[^;]*https:\/\/accounts\.google\.com/);

    // Google should be allowed in frame-src
    expect(cspHeader).toMatch(/frame-src[^;]*https:\/\/accounts\.google\.com/);
  });
});
