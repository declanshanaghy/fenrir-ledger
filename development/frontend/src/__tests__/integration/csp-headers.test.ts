/**
 * CSP Headers — Integration tests
 *
 * Validates Content Security Policy header generation and nonce injection.
 * Supersedes E2E csp-nonce/ and csp-youtube/ test suites that were
 * previously testing HTTP headers via a real browser — unnecessary overhead.
 */

import { describe, it, expect } from "vitest";
import {
  buildCspDirectives,
  buildSecurityHeaders,
} from "@/lib/csp-headers";
import { generateNonce, getNonceFromHeaders } from "@/lib/csp-nonce";

describe("CSP Nonce Generation", () => {
  it("generates a base64-encoded string", () => {
    const nonce = generateNonce();
    expect(typeof nonce).toBe("string");
    expect(nonce.length).toBeGreaterThan(0);
    // Base64 pattern: A-Z, a-z, 0-9, +, /, =
    expect(nonce).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it("generates unique nonces on each call", () => {
    const nonces = new Set(Array.from({ length: 10 }, () => generateNonce()));
    expect(nonces.size).toBe(10);
  });
});

describe("getNonceFromHeaders", () => {
  it("returns the nonce from x-nonce-csp header", () => {
    const nonce = getNonceFromHeaders({ "x-nonce-csp": "abc123" });
    expect(nonce).toBe("abc123");
  });

  it("returns undefined when header is missing", () => {
    const nonce = getNonceFromHeaders({});
    expect(nonce).toBeUndefined();
  });
});

describe("CSP Directives — with nonce", () => {
  const nonce = "test-nonce-value";
  const directives = buildCspDirectives(nonce);
  const csp = directives.join("; ");

  it("includes nonce in script-src", () => {
    const scriptSrc = directives.find((d) => d.startsWith("script-src"));
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).toContain(`'nonce-${nonce}'`);
  });

  it("includes 'self' in default-src", () => {
    const defaultSrc = directives.find((d) => d.startsWith("default-src"));
    expect(defaultSrc).toContain("'self'");
  });

  it("allows Google Accounts in script-src for OAuth", () => {
    expect(csp).toContain("https://accounts.google.com");
  });

  it("allows Google APIs in script-src for Picker", () => {
    expect(csp).toContain("https://apis.google.com");
  });

  it("allows Stripe.js in script-src", () => {
    expect(csp).toContain("https://js.stripe.com");
  });

  it("allows YouTube in frame-src for Heilung easter egg", () => {
    const frameSrc = directives.find((d) => d.startsWith("frame-src"));
    expect(frameSrc).toBeDefined();
    expect(frameSrc).toContain("https://www.youtube.com");
  });

  it("allows Google Drive and Docs in frame-src for Picker", () => {
    const frameSrc = directives.find((d) => d.startsWith("frame-src"));
    expect(frameSrc).toContain("https://drive.google.com");
    expect(frameSrc).toContain("https://docs.google.com");
  });

  it("includes Anthropic in connect-src for LLM extraction", () => {
    const connectSrc = directives.find((d) => d.startsWith("connect-src"));
    expect(connectSrc).toBeDefined();
    expect(connectSrc).toContain("https://api.anthropic.com");
  });

  it("includes Google Fonts in font-src", () => {
    const fontSrc = directives.find((d) => d.startsWith("font-src"));
    expect(fontSrc).toContain("https://fonts.gstatic.com");
  });

  it("restricts form-action to self", () => {
    const formAction = directives.find((d) => d.startsWith("form-action"));
    expect(formAction).toBe("form-action 'self'");
  });
});

describe("CSP Directives — no Vercel references after GKE migration (#682)", () => {
  const directives = buildCspDirectives("test-nonce");
  const csp = directives.join("; ");

  it("should not reference vercel-scripts.com in script-src", () => {
    expect(csp).not.toContain("vercel-scripts.com");
  });

  it("should not reference vercel.live in any directive", () => {
    expect(csp).not.toContain("vercel.live");
  });

  it("should not reference vercel in connect-src", () => {
    const connectSrc = directives.find((d) => d.startsWith("connect-src"));
    expect(connectSrc).not.toContain("vercel");
  });

  it("should not reference vercel in frame-src", () => {
    const frameSrc = directives.find((d) => d.startsWith("frame-src"));
    expect(frameSrc).not.toContain("vercel");
  });

  it("should not reference vercel in font-src", () => {
    const fontSrc = directives.find((d) => d.startsWith("font-src"));
    expect(fontSrc).not.toContain("vercel");
  });
});

describe("CSP Directives — without nonce (fallback)", () => {
  it("falls back to unsafe-inline when no nonce provided", () => {
    const directives = buildCspDirectives();
    const scriptSrc = directives.find((d) => d.startsWith("script-src"));
    expect(scriptSrc).toContain("'unsafe-inline'");
  });
});

describe("Security Headers", () => {
  const nonce = "test-nonce";
  const headers = buildSecurityHeaders(nonce);

  it("includes Content-Security-Policy header", () => {
    const cspHeader = headers.find((h) => h.key === "Content-Security-Policy");
    expect(cspHeader).toBeDefined();
    expect(cspHeader!.value).toContain(`'nonce-${nonce}'`);
  });

  it("includes X-Frame-Options: DENY", () => {
    const xfo = headers.find((h) => h.key === "X-Frame-Options");
    expect(xfo).toBeDefined();
    expect(xfo!.value).toBe("DENY");
  });

  it("includes X-Content-Type-Options: nosniff", () => {
    const xcto = headers.find((h) => h.key === "X-Content-Type-Options");
    expect(xcto).toBeDefined();
    expect(xcto!.value).toBe("nosniff");
  });

  it("includes Strict-Transport-Security with max-age", () => {
    const hsts = headers.find((h) => h.key === "Strict-Transport-Security");
    expect(hsts).toBeDefined();
    expect(hsts!.value).toContain("max-age=");
    expect(hsts!.value).toContain("includeSubDomains");
  });

  it("includes Referrer-Policy", () => {
    const rp = headers.find((h) => h.key === "Referrer-Policy");
    expect(rp).toBeDefined();
    expect(rp!.value).toBe("strict-origin-when-cross-origin");
  });

  it("includes restrictive Permissions-Policy", () => {
    const pp = headers.find((h) => h.key === "Permissions-Policy");
    expect(pp).toBeDefined();
    expect(pp!.value).toContain("camera=()");
    expect(pp!.value).toContain("microphone=()");
  });
});
