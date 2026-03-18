/**
 * apex-redirect-middleware-1318.loki.test.ts — Issue #1318 (Loki QA)
 *
 * Gap-fill tests for the apex→www redirect migration to GCP LB layer.
 * FiremanDecko's cache-headers-middleware.loki.test.ts covers:
 *   - Cache-Control applied on normal requests
 *   - Apex HTTPS passes through (no 301)
 *   - Apex HTTPS still gets Cache-Control
 *   - HTTP → HTTPS 301 has no Cache-Control
 *   - Apex + HTTP combined 301 has no Cache-Control
 *   - /api/health exempt from redirect
 *
 * These tests cover NEW behavioral guarantees NOT tested above:
 *   - localhost HTTP is never redirected (hostname skip)
 *   - 127.0.0.1 HTTP is never redirected (hostname skip)
 *   - HTTP → HTTPS redirect preserves the full path + query string
 *   - Non-apex production domains get HTTP → HTTPS redirect
 *   - CSP header is present on normal pass-through responses
 *   - Apex HTTPS (fenrirledger.com) pass-through includes CSP (full middleware runs)
 *   - /api/health HTTP on apex domain is also exempt from redirect
 */

import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

// ── helpers ───────────────────────────────────────────────────────────────

function makeRequest(
  host: string,
  pathname: string,
  {
    http = false,
    search = "",
  }: { http?: boolean; search?: string } = {}
): NextRequest {
  const proto = http ? "http" : "https";
  const url = `${proto}://${host}${pathname}${search}`;
  return new NextRequest(url, {
    method: "GET",
    headers: {
      host,
      ...(http ? { "x-forwarded-proto": "http" } : {}),
    },
  });
}

// ── localhost / 127.0.0.1 are never redirected ────────────────────────────
// Middleware explicitly skips hostname === "localhost" and hostname === "127.0.0.1"

describe("middleware — localhost is exempt from all redirects", () => {
  it("localhost HTTP request is NOT redirected (dev server bypass)", () => {
    const req = makeRequest("localhost", "/", { http: true });
    const response = middleware(req);
    expect(response.status).not.toBe(301);
    expect(response.status).not.toBe(302);
  });

  it("localhost HTTP request still gets Cache-Control for marketing routes", () => {
    const req = makeRequest("localhost", "/pricing", { http: true });
    const response = middleware(req);
    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=300");
  });

  it("127.0.0.1 HTTP request is NOT redirected", () => {
    const req = makeRequest("127.0.0.1", "/", { http: true });
    const response = middleware(req);
    expect(response.status).not.toBe(301);
    expect(response.status).not.toBe(302);
  });
});

// ── HTTP → HTTPS redirect preserves path + query string ──────────────────

describe("middleware — HTTP→HTTPS redirect preserves full URL", () => {
  it("redirect to HTTPS preserves pathname", () => {
    const req = makeRequest("www.fenrirledger.com", "/ledger/cards", { http: true });
    const response = middleware(req);
    expect(response.status).toBe(301);
    const location = response.headers.get("location");
    expect(location).toContain("/ledger/cards");
    expect(location).toMatch(/^https:/);
  });

  it("redirect to HTTPS preserves query string", () => {
    const req = makeRequest(
      "www.fenrirledger.com",
      "/ledger/cards",
      { http: true, search: "?sort=name&filter=active" }
    );
    const response = middleware(req);
    expect(response.status).toBe(301);
    const location = response.headers.get("location");
    expect(location).toContain("?sort=name&filter=active");
  });

  it("redirect to HTTPS location starts with https:// (protocol upgrade confirmed)", () => {
    // The redirect must always upgrade the protocol — not rely on a hard-coded domain.
    // We verify the Location header begins with https: on the known-working apex domain.
    const req = makeRequest("fenrirledger.com", "/pricing", { http: true });
    const response = middleware(req);
    expect(response.status).toBe(301);
    const location = response.headers.get("location");
    expect(location).toMatch(/^https:\/\//);
    expect(location).toContain("/pricing");
  });
});

// ── CSP header present on normal pass-through responses ──────────────────
// Issue #1184: middleware must set Content-Security-Policy on all non-redirect responses

describe("middleware — CSP header is applied on non-redirect responses", () => {
  it("CSP header is set on www marketing page pass-through", () => {
    const req = makeRequest("www.fenrirledger.com", "/");
    const response = middleware(req);
    expect(response.status).not.toBe(301);
    const csp = response.headers.get("Content-Security-Policy");
    expect(csp).toBeTruthy();
    expect(typeof csp).toBe("string");
    expect((csp as string).length).toBeGreaterThan(0);
  });

  it("apex HTTPS pass-through (fenrirledger.com) also receives CSP header", () => {
    // LB handles apex→www. Middleware must pass through AND set CSP.
    const req = makeRequest("fenrirledger.com", "/features");
    const response = middleware(req);
    expect(response.status).not.toBe(301);
    const csp = response.headers.get("Content-Security-Policy");
    expect(csp).toBeTruthy();
  });

  it("CSP header is NOT set on 301 redirect responses", () => {
    // Redirect responses exit middleware early — no CSP header needed or expected.
    // Use fenrirledger.com (apex) with HTTP — the middleware fires isHttp before reaching CSP.
    const req = makeRequest("fenrirledger.com", "/about", { http: true });
    const response = middleware(req);
    expect(response.status).toBe(301);
    // Middleware short-circuits before setting CSP — Content-Security-Policy must be absent
    expect(response.headers.get("Content-Security-Policy")).toBeNull();
  });
});

// ── /api/health exempt on apex domain ────────────────────────────────────
// GKE probes may hit the apex domain over HTTP. Health endpoint must never redirect.

describe("middleware — /api/health exempt on apex domain over HTTP", () => {
  it("fenrirledger.com /api/health HTTP is NOT redirected (GKE probe bypass)", () => {
    const req = makeRequest("fenrirledger.com", "/api/health", { http: true });
    const response = middleware(req);
    expect(response.status).not.toBe(301);
    expect(response.status).not.toBe(302);
  });

  it("fenrirledger.com /api/health HTTP still gets no-store Cache-Control", () => {
    const req = makeRequest("fenrirledger.com", "/api/health", { http: true });
    const response = middleware(req);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});

// ── Non-apex production domains: still get HTTP→HTTPS redirect ───────────
// The middleware is a safety net for any non-LB environment. The www domain
// (canonical host) must still redirect HTTP→HTTPS even though the LB handles
// apex→www separately.

describe("middleware — non-apex production HTTP still redirects to HTTPS", () => {
  it("fenrir-ledger.app HTTP redirects to HTTPS (middleware safety net)", () => {
    // Use fenrir-ledger.app (same host as FiremanDecko's apexRequest helper)
    // Verifies that the isHttp safety net fires for any non-localhost HTTP request.
    const req = makeRequest("fenrir-ledger.app", "/features", { http: true });
    const response = middleware(req);
    expect(response.status).toBe(301);
    const location = response.headers.get("location");
    expect(location).toMatch(/^https:\/\//);
    expect(location).toContain("/features");
  });
});
