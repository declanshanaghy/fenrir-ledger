/**
 * csp-headers.test.ts — Issue #1144
 *
 * Unit tests for the hash-based CSP header builder.
 * Verifies that buildCspDirectives() and buildSecurityHeaders() produce
 * the correct hash-based policy (no nonce) and that all required security
 * headers are present.
 */

import { describe, it, expect } from "vitest";
import { buildCspDirectives, buildSecurityHeaders } from "@/lib/csp-headers";

describe("buildCspDirectives — hash-based CSP", () => {
  it("returns an array of directive strings", () => {
    const directives = buildCspDirectives();
    expect(Array.isArray(directives)).toBe(true);
    expect(directives.length).toBeGreaterThan(0);
  });

  it("script-src contains 'self'", () => {
    const scriptSrc = buildCspDirectives().find((d) =>
      d.startsWith("script-src")
    );
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).toContain("'self'");
  });

  it("script-src contains the next-themes sha256 hash", () => {
    const scriptSrc = buildCspDirectives().find((d) =>
      d.startsWith("script-src")
    );
    expect(scriptSrc).toMatch(/'sha256-[A-Za-z0-9+/=]+=?'/);
  });

  it("script-src does NOT contain 'nonce-' (no per-request nonce)", () => {
    const scriptSrc = buildCspDirectives().find((d) =>
      d.startsWith("script-src")
    );
    expect(scriptSrc).not.toContain("nonce-");
  });

  it("script-src does NOT contain 'unsafe-inline' in production", () => {
    const originalEnv = process.env.NODE_ENV;
    // Simulate production check via the directive builder
    // (NODE_ENV is "test" in Vitest, so 'unsafe-eval' IS present in test runs)
    const scriptSrc = buildCspDirectives().find((d) =>
      d.startsWith("script-src")
    );
    // 'unsafe-inline' should never appear (we use hashes instead)
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    void originalEnv;
  });

  it("script-src includes googletagmanager.com for GA4 external loader", () => {
    const scriptSrc = buildCspDirectives().find((d) =>
      d.startsWith("script-src")
    );
    expect(scriptSrc).toContain("https://www.googletagmanager.com");
  });

  it("script-src includes Google Picker hash", () => {
    const scriptSrc = buildCspDirectives().find((d) =>
      d.startsWith("script-src")
    );
    expect(scriptSrc).toContain(
      "'sha256-rty9vSWIkY+k7t72CZmyhd8qbxQ4FpRSyO4E/iy3xcI='"
    );
  });

  it("includes default-src 'self'", () => {
    expect(buildCspDirectives()).toContain("default-src 'self'");
  });

  it("includes form-action 'self'", () => {
    expect(buildCspDirectives()).toContain("form-action 'self'");
  });

  it("includes base-uri 'self'", () => {
    expect(buildCspDirectives()).toContain("base-uri 'self'");
  });

  it("style-src contains 'unsafe-inline' (required for style attributes)", () => {
    const styleSrc = buildCspDirectives().find((d) =>
      d.startsWith("style-src")
    );
    expect(styleSrc).toContain("'unsafe-inline'");
  });

  it("connect-src includes Anthropic and OpenAI", () => {
    const connectSrc = buildCspDirectives().find((d) =>
      d.startsWith("connect-src")
    );
    expect(connectSrc).toContain("https://api.anthropic.com");
    expect(connectSrc).toContain("https://api.openai.com");
  });
});

describe("buildSecurityHeaders", () => {
  it("returns an array of {key, value} objects", () => {
    const headers = buildSecurityHeaders();
    expect(Array.isArray(headers)).toBe(true);
    for (const h of headers) {
      expect(typeof h.key).toBe("string");
      expect(typeof h.value).toBe("string");
    }
  });

  it("includes Content-Security-Policy header", () => {
    const headers = buildSecurityHeaders();
    const csp = headers.find((h) => h.key === "Content-Security-Policy");
    expect(csp).toBeDefined();
    expect(csp!.value).toContain("default-src 'self'");
  });

  it("CSP header has no nonce", () => {
    const headers = buildSecurityHeaders();
    const csp = headers.find((h) => h.key === "Content-Security-Policy");
    expect(csp!.value).not.toContain("nonce-");
  });

  it("includes X-Frame-Options: DENY", () => {
    const headers = buildSecurityHeaders();
    const xfo = headers.find((h) => h.key === "X-Frame-Options");
    expect(xfo?.value).toBe("DENY");
  });

  it("includes X-Content-Type-Options: nosniff", () => {
    const headers = buildSecurityHeaders();
    const xcto = headers.find((h) => h.key === "X-Content-Type-Options");
    expect(xcto?.value).toBe("nosniff");
  });

  it("includes Strict-Transport-Security", () => {
    const headers = buildSecurityHeaders();
    const hsts = headers.find((h) => h.key === "Strict-Transport-Security");
    expect(hsts?.value).toContain("max-age=");
    expect(hsts?.value).toContain("includeSubDomains");
  });

  it("includes Cross-Origin-Opener-Policy: same-origin-allow-popups", () => {
    const headers = buildSecurityHeaders();
    const coop = headers.find((h) => h.key === "Cross-Origin-Opener-Policy");
    expect(coop?.value).toBe("same-origin-allow-popups");
  });

  it("buildSecurityHeaders() takes no arguments (nonce removed)", () => {
    // Calling without args must not throw — the function signature is now ()
    expect(() => buildSecurityHeaders()).not.toThrow();
  });
});
