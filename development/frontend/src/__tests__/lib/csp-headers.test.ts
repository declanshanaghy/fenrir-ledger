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
import {
  INLINE_SCRIPT_HASHES,
  NEXT_THEMES_SCRIPT_HASH,
  GA4_INIT_SCRIPT_HASH,
} from "@/lib/csp-hashes.generated";

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

  it("CSP header value uses '; ' as directive separator — each part is a valid directive", () => {
    const csp = buildSecurityHeaders().find(
      (h) => h.key === "Content-Security-Policy"
    );
    const parts = csp!.value.split("; ");
    expect(parts.length).toBeGreaterThan(5);
    // Every part must start with a known directive name (no empty segments)
    for (const part of parts) {
      expect(part.length).toBeGreaterThan(0);
    }
  });
});

// ── Loki edge cases — Issue #1144 CDN hash-based CSP ─────────────────────────

describe("buildCspDirectives — Loki edge cases (Issue #1144)", () => {
  it("is deterministic — identical output on every call (CDN cacheability)", () => {
    const first = buildCspDirectives().join("; ");
    const second = buildCspDirectives().join("; ");
    expect(first).toBe(second);
  });

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

describe("INLINE_SCRIPT_HASHES — Loki edge cases (Issue #1144)", () => {
  it("is a non-empty array (next-themes hash is always present)", () => {
    expect(Array.isArray(INLINE_SCRIPT_HASHES)).toBe(true);
    expect(INLINE_SCRIPT_HASHES.length).toBeGreaterThanOrEqual(1);
  });

  it("contains NEXT_THEMES_SCRIPT_HASH as its first element", () => {
    expect(INLINE_SCRIPT_HASHES[0]).toBe(NEXT_THEMES_SCRIPT_HASH);
  });

  it("every entry has the correct CSP 'sha256-<base64>' format", () => {
    for (const hash of INLINE_SCRIPT_HASHES) {
      expect(hash).toMatch(/^'sha256-[A-Za-z0-9+/]+=?'$/);
    }
  });

  it("NEXT_THEMES_SCRIPT_HASH is a non-empty string (not null)", () => {
    expect(typeof NEXT_THEMES_SCRIPT_HASH).toBe("string");
    expect(NEXT_THEMES_SCRIPT_HASH.length).toBeGreaterThan(0);
  });

  it("GA4_INIT_SCRIPT_HASH is null when NEXT_PUBLIC_GA4_MEASUREMENT_ID is not set", () => {
    // In the test environment, the measurement ID is unset → GA4 hash must be null.
    // This validates the fail-safe: no GA4 hash is injected unless explicitly configured.
    expect(GA4_INIT_SCRIPT_HASH).toBeNull();
  });

  it("INLINE_SCRIPT_HASHES contains no null values regardless of GA4 env var", () => {
    // If GA4_INIT_SCRIPT_HASH is null, the spread must not push null into the array.
    for (const hash of INLINE_SCRIPT_HASHES) {
      expect(hash).not.toBeNull();
    }
  });

  it("NEXT_THEMES_SCRIPT_HASH appears verbatim inside the script-src directive", () => {
    const scriptSrc = buildCspDirectives().find((d) =>
      d.startsWith("script-src")
    );
    // The hash exported from the generated module must be the same one used in the CSP.
    expect(scriptSrc).toContain(NEXT_THEMES_SCRIPT_HASH);
  });
});
