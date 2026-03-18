/**
 * csp-headers.test.ts — Issue #1144
 *
 * Unit tests for the CSP header builder.
 * The policy uses 'unsafe-inline' for script-src — nonce-based CSP is
 * incompatible with PPR + CDN caching (pre-rendered shell has no nonces).
 */

import { describe, it, expect } from "vitest";
import { buildCspDirectives, buildSecurityHeaders } from "@/lib/csp-headers";

describe("buildCspDirectives", () => {
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

  it("script-src contains 'unsafe-inline' (required for PPR + CDN)", () => {
    const scriptSrc = buildCspDirectives().find((d) =>
      d.startsWith("script-src")
    );
    expect(scriptSrc).toContain("'unsafe-inline'");
  });

  it("script-src does NOT contain a nonce", () => {
    const scriptSrc = buildCspDirectives().find((d) =>
      d.startsWith("script-src")
    );
    expect(scriptSrc).not.toContain("nonce-");
  });

  it("script-src includes googletagmanager.com for GA4 external loader", () => {
    const scriptSrc = buildCspDirectives().find((d) =>
      d.startsWith("script-src")
    );
    expect(scriptSrc).toContain("https://www.googletagmanager.com");
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

  it("does NOT include Content-Security-Policy (CSP is set per-request in middleware)", () => {
    const headers = buildSecurityHeaders();
    const csp = headers.find((h) => h.key === "Content-Security-Policy");
    expect(csp).toBeUndefined();
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

  it("includes Referrer-Policy: strict-origin-when-cross-origin", () => {
    const headers = buildSecurityHeaders();
    const ref = headers.find((h) => h.key === "Referrer-Policy");
    expect(ref?.value).toBe("strict-origin-when-cross-origin");
  });

  it("includes Cross-Origin-Embedder-Policy: unsafe-none (required for Google Picker iframes)", () => {
    const headers = buildSecurityHeaders();
    const coep = headers.find((h) => h.key === "Cross-Origin-Embedder-Policy");
    expect(coep?.value).toBe("unsafe-none");
  });
});

describe("buildCspDirectives — edge cases", () => {
  it("frame-src allows YouTube for the Heilung easter egg video embed", () => {
    const frameSrc = buildCspDirectives().find((d) =>
      d.startsWith("frame-src")
    );
    expect(frameSrc).toContain("https://www.youtube.com");
  });

  it("img-src allows data: URIs (required for Google Fonts embedded images)", () => {
    const imgSrc = buildCspDirectives().find((d) => d.startsWith("img-src"));
    expect(imgSrc).toContain("data:");
  });

  it("connect-src includes Google Sheets API for spreadsheet import feature", () => {
    const connectSrc = buildCspDirectives().find((d) =>
      d.startsWith("connect-src")
    );
    expect(connectSrc).toContain("https://sheets.googleapis.com");
  });

  it("connect-src includes Google Docs for Picker file access", () => {
    const connectSrc = buildCspDirectives().find((d) =>
      d.startsWith("connect-src")
    );
    expect(connectSrc).toContain("https://docs.google.com");
  });
});
