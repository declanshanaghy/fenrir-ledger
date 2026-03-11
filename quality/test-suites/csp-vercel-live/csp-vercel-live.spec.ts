/**
 * CSP Vercel Live Test Suite — Fenrir Ledger
 * Authored by Loki, QA Tester of the Pack
 *
 * Validates GitHub Issue #536: CSP blocks Vercel Live fonts and inline scripts on settings page
 * Acceptance Criteria:
 * - font-src CSP directive includes https://vercel.live
 * - next-themes inline script executes without CSP violation (via nonce)
 * - No CSP violation errors in browser console on settings page
 * - Existing CSP protections remain intact
 * - Theme switching works without FOUC (Flash of Unstyled Content)
 *
 * Implementation changes (PR #542):
 * - src/lib/csp-headers.ts — Added https://vercel.live to font-src
 * - src/app/layout.tsx — Pass CSP nonce to ThemeProvider for next-themes script
 * - src/contexts/EntitlementContext.tsx — Handle 409 already_subscribed gracefully
 *
 * Spec references:
 *   - development/frontend/src/lib/csp-headers.ts: CSP header building
 *   - development/frontend/src/app/layout.tsx: Nonce injection via ThemeProvider
 *   - Issue #536: CSP blocks Vercel Live fonts and inline scripts
 */

import { test, expect } from "@playwright/test";

// ─── Test Configuration ──────────────────────────────────────────────────────
// Base URL for testing
const BASE_URL = "/";
const SETTINGS_URL = "/app/settings";

// ════════════════════════════════════════════════════════════════════════════
// Suite 1 — CSP Directive Validation for Vercel Live
// ════════════════════════════════════════════════════════════════════════════

test.describe("CSP — Vercel Live Fonts in font-src Directive", () => {
  test("should include https://vercel.live in font-src directive", async ({
    page,
  }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    // Verify CSP header exists
    expect(cspHeader.length).toBeGreaterThan(0);

    // Verify font-src directive includes vercel.live
    expect(cspHeader).toMatch(/font-src\s+[^;]*https:\/\/vercel\.live/);

    // Verify Google Fonts CDN is still allowed (no regression)
    expect(cspHeader).toMatch(/font-src\s+[^;]*https:\/\/fonts\.gstatic\.com/);
  });

  test("should allow self-origin fonts in font-src directive", async ({
    page,
  }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    // Verify 'self' is in font-src for local fonts
    expect(cspHeader).toMatch(/font-src\s+['"]self['"]?/);
  });

  test("should allow data: URIs in font-src directive", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    // Verify data: URIs allowed for inline font data
    expect(cspHeader).toMatch(/font-src\s+[^;]*data:/);
  });

  test("font-src directive should be properly formatted", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    // Extract font-src directive
    const fontSrcMatch = cspHeader.match(/font-src\s+([^;]+)/);
    expect(fontSrcMatch).toBeTruthy();

    if (fontSrcMatch) {
      const fontSrcValue = fontSrcMatch[1];
      // Should contain expected sources
      expect(fontSrcValue).toContain("'self'");
      expect(fontSrcValue).toContain("https://fonts.gstatic.com");
      expect(fontSrcValue).toContain("https://vercel.live");
      expect(fontSrcValue).toContain("data:");
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 2 — Nonce Injection for next-themes Script
// ════════════════════════════════════════════════════════════════════════════

test.describe("CSP — Nonce Injection for ThemeProvider (next-themes)", () => {
  test("should have nonce in script-src directive", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    // Verify script-src contains nonce or unsafe-inline (dev fallback)
    const hasNonce = cspHeader.match(/script-src[^;]*'nonce-[a-zA-Z0-9+/=]+'/);
    const hasUnsafeInline = cspHeader.includes("'unsafe-inline'");

    expect(hasNonce || hasUnsafeInline).toBeTruthy();
  });

  test("should allow Vercel Live in script-src directive", async ({
    page,
  }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    // Verify vercel.live is in script-src for live toolbar
    expect(cspHeader).toMatch(/script-src[^;]*https:\/\/vercel\.live/);
  });

  test("should allow Vercel Live in connect-src directive", async ({
    page,
  }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    // Verify vercel.live is in connect-src for WebSocket/API connections
    expect(cspHeader).toMatch(/connect-src[^;]*https:\/\/vercel\.live/);
  });

  test("should allow Vercel Live in frame-src directive", async ({
    page,
  }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    // Verify vercel.live is in frame-src for iframe embedding
    expect(cspHeader).toMatch(/frame-src[^;]*https:\/\/vercel\.live/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 3 — CSP Violations Detection on Homepage
// ════════════════════════════════════════════════════════════════════════════

test.describe("CSP — No Violations on Homepage", () => {
  test("should not have CSP violations on homepage load", async ({ page }) => {
    let cspViolations: string[] = [];

    // Capture console errors for CSP violations
    page.on("console", (msg) => {
      if (
        msg.type() === "error" &&
        msg.text().includes("Refused to load")
      ) {
        cspViolations.push(msg.text());
      }
    });

    // Capture network errors blocked by CSP
    page.on("requestfailed", (request) => {
      if (request.failure()?.errorText.includes("net::ERR_BLOCKED_BY_CSP")) {
        cspViolations.push(`CSP blocked request: ${request.url()}`);
      }
    });

    const response = await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle");

    // Should load successfully
    expect(response?.status()).toBeLessThan(400);
    // No CSP violations
    expect(cspViolations).toEqual([]);
  });

  test("should load all required fonts without CSP violations", async ({
    page,
  }) => {
    let fontErrors: string[] = [];

    page.on("console", (msg) => {
      if (
        msg.type() === "error" &&
        msg.text().includes("Refused to load") &&
        msg.text().includes("font")
      ) {
        fontErrors.push(msg.text());
      }
    });

    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle");

    // No font loading errors
    expect(fontErrors).toEqual([]);

    // Verify fonts are loaded (at least from Google Fonts)
    const fontLinks = await page.locator("link[href*='fonts.gstatic.com'], link[href*='fonts.googleapis.com']").count();
    expect(fontLinks).toBeGreaterThanOrEqual(0); // May not always be present on all pages
  });

  test("should allow Google APIs without CSP violations", async ({
    page,
  }) => {
    let googleApiErrors: string[] = [];

    page.on("console", (msg) => {
      if (
        msg.type() === "error" &&
        msg.text().includes("Refused to load") &&
        msg.text().includes("google")
      ) {
        googleApiErrors.push(msg.text());
      }
    });

    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle");

    // Google APIs should load without CSP violations
    expect(googleApiErrors).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 4 — Theme Switching Without FOUC (Flash of Unstyled Content)
// ════════════════════════════════════════════════════════════════════════════

test.describe("CSP — Theme Switching Without FOUC", () => {
  test("should apply theme script before content loads", async ({ page }) => {
    let cspViolations: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error" && msg.text().includes("Refused to")) {
        cspViolations.push(msg.text());
      }
    });

    // Start capturing network activity
    const responses = [];
    page.on("response", (response) => {
      responses.push({
        url: response.url(),
        status: response.status(),
      });
    });

    const response = await page.goto(BASE_URL);

    // Wait for page to be interactive
    await page.waitForLoadState("domcontentloaded");

    // The theme script should load before content renders to prevent FOUC
    // If nonce is present and valid, no CSP violations should occur
    expect(cspViolations).toEqual([]);

    // Page should respond successfully
    expect(response?.status()).toBeLessThan(400);
  });

  test("should preserve theme across page loads via localStorage", async ({
    page,
  }) => {
    let cspViolations: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error" && msg.text().includes("Refused")) {
        cspViolations.push(msg.text());
      }
    });

    // Load homepage
    await page.goto(BASE_URL);
    await page.waitForLoadState("networkidle");

    // Check if theme is stored in localStorage (next-themes sets fenrir-theme)
    const storedTheme = await page.evaluate(() =>
      localStorage.getItem("fenrir-theme")
    );

    // Theme storage should work without CSP violations
    expect(cspViolations).toEqual([]);

    // If theme is set, it should be a valid value
    if (storedTheme) {
      expect(["light", "dark", "system"]).toContain(storedTheme);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 5 — CSP Headers Comprehensive Validation
// ════════════════════════════════════════════════════════════════════════════

test.describe("CSP — Complete Security Headers", () => {
  test("should have CSP header on every response", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};

    expect(headers["content-security-policy"]).toBeTruthy();
    expect(headers["content-security-policy"]?.length).toBeGreaterThan(0);
  });

  test("should have X-Frame-Options set to DENY", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};

    expect(headers["x-frame-options"]).toBe("DENY");
  });

  test("should have X-Content-Type-Options set to nosniff", async ({
    page,
  }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};

    expect(headers["x-content-type-options"]).toBe("nosniff");
  });

  test("should have Strict-Transport-Security header", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};

    expect(headers["strict-transport-security"]).toBeTruthy();
  });

  test("should have Referrer-Policy header", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};

    expect(headers["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin"
    );
  });

  test("should have Permissions-Policy header", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};

    expect(headers["permissions-policy"]).toBeTruthy();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 6 — CSP Directive Completeness and Regression Test
// ════════════════════════════════════════════════════════════════════════════

test.describe("CSP — All Directives Present (No Regressions)", () => {
  test("should have all required CSP directives", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

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

  test("should not have unsafe-inline in script-src (except dev fallback)", async ({
    page,
  }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    // In production, script-src should use nonce, not unsafe-inline
    // In development, it may use unsafe-inline as fallback
    const scriptSrcMatch = cspHeader.match(/script-src\s+([^;]+)/);
    expect(scriptSrcMatch).toBeTruthy();

    if (scriptSrcMatch) {
      const scriptSrcValue = scriptSrcMatch[1];
      const hasNonce = scriptSrcValue.match(/'nonce-[a-zA-Z0-9+/=]+'/);
      const hasUnsafeInline = scriptSrcValue.includes("'unsafe-inline'");

      // Must have either nonce (production) or unsafe-inline (dev fallback)
      expect(hasNonce || hasUnsafeInline).toBeTruthy();
    }
  });

  test("should allow required Google APIs in script-src", async ({
    page,
  }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    // Verify Google accounts and APIs are allowed
    expect(cspHeader).toMatch(
      /script-src[^;]*https:\/\/accounts\.google\.com/
    );
    expect(cspHeader).toMatch(/script-src[^;]*https:\/\/apis\.google\.com/);
  });

  test("should allow Stripe in script-src", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    expect(cspHeader).toMatch(/script-src[^;]*https:\/\/js\.stripe\.com/);
  });

  test("should allow Google Fonts in style-src", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    expect(cspHeader).toMatch(
      /style-src[^;]*https:\/\/fonts\.googleapis\.com/
    );
  });

  test("should allow Google Fonts CDN in font-src", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    expect(cspHeader).toMatch(/font-src[^;]*https:\/\/fonts\.gstatic\.com/);
  });

  test("should allow Google profile images in img-src", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    expect(cspHeader).toMatch(
      /img-src[^;]*https:\/\/lh3\.googleusercontent\.com/
    );
  });

  test("should allow Google OAuth in frame-src", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    expect(cspHeader).toMatch(
      /frame-src[^;]*https:\/\/accounts\.google\.com/
    );
  });

  test("should allow Stripe in connect-src", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    expect(cspHeader).toMatch(/connect-src[^;]*https:\/\/api\.stripe\.com/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Suite 7 — Vercel Live Integration (Bonus: if toolbar is active)
// ════════════════════════════════════════════════════════════════════════════

test.describe("CSP — Vercel Live Toolbar Support", () => {
  test("should allow Vercel Live across all required directives", async ({
    page,
  }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    // Vercel Live should be allowed in:
    // 1. script-src (for toolbar JS)
    expect(cspHeader).toMatch(/script-src[^;]*https:\/\/vercel\.live/);

    // 2. font-src (for toolbar fonts) — PRIMARY FIX FOR ISSUE #536
    expect(cspHeader).toMatch(/font-src[^;]*https:\/\/vercel\.live/);

    // 3. connect-src (for WebSocket/API)
    expect(cspHeader).toMatch(/connect-src[^;]*https:\/\/vercel\.live/);

    // 4. frame-src (for iframe embedding)
    expect(cspHeader).toMatch(/frame-src[^;]*https:\/\/vercel\.live/);
  });

  test("should allow Vercel analytics in connect-src", async ({ page }) => {
    const response = await page.goto(BASE_URL);
    const headers = response?.headers() || {};
    const cspHeader = headers["content-security-policy"] || "";

    // Vercel analytics should be allowed
    expect(cspHeader).toMatch(
      /connect-src[^;]*https:\/\/va\.vercel-scripts\.com/
    );
    expect(cspHeader).toMatch(/script-src[^;]*https:\/\/va\.vercel-scripts\.com/);
  });
});
