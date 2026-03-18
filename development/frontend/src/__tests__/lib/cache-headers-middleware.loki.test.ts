/**
 * cache-headers-middleware.loki.test.ts — Issue #1145 (Loki QA)
 *
 * Integration tests for the middleware function itself.
 * FiremanDecko's tests cover getCacheControlForPath() exhaustively.
 * These tests validate that the middleware APPLIES headers correctly and
 * that NO redirects occur — redirects are handled at the GCP LB layer.
 *
 * Acceptance criteria validated:
 * - AC3: Marketing pages get Cache-Control: public, s-maxage=300
 * - AC4: App pages (/ledger/*) get Cache-Control: public, s-maxage=60
 * - AC5: /api/* routes get Cache-Control: no-store
 * - Edge: middleware does NOT redirect HTTP requests (GKE cert provisioner needs port 80 clean)
 * - Edge: middleware does NOT redirect apex domain (GCP LB URL map handles apex→www)
 */

import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

// ── helpers ───────────────────────────────────────────────────────────────

/** Build a NextRequest as if it came through a normal HTTPS request. */
function makeRequest(pathname: string, { host = "www.fenrirledger.com", http = false } = {}): NextRequest {
  const proto = http ? "http" : "https";
  return new NextRequest(`${proto}://${host}${pathname}`, {
    method: "GET",
    headers: {
      host,
      ...(http ? { "x-forwarded-proto": "http" } : {}),
    },
  });
}

// ── Cache-Control is set for normal requests ──────────────────────────────

describe("middleware — Cache-Control applied on normal HTTPS requests", () => {
  it("marketing page / gets public, s-maxage=300", () => {
    const response = middleware(makeRequest("/"));
    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=300");
  });

  it("marketing page /pricing gets public, s-maxage=300", () => {
    const response = middleware(makeRequest("/pricing"));
    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=300");
  });

  it("/ledger app page gets public, s-maxage=60", () => {
    const response = middleware(makeRequest("/ledger"));
    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=60");
  });

  it("/ledger/cards app sub-page gets public, s-maxage=60", () => {
    const response = middleware(makeRequest("/ledger/cards"));
    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=60");
  });

  it("/api/auth/token gets no-store", () => {
    const response = middleware(makeRequest("/api/auth/token"));
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("path with no explicit policy (/sign-in) returns a response with no Cache-Control header", () => {
    const response = middleware(makeRequest("/sign-in"));
    expect(response.headers.get("Cache-Control")).toBeNull();
  });
});

// ── Middleware must NOT redirect — all redirects are at GCP LB layer ──────
// GKE managed cert provisioner requires port 80 to respond without redirect.
// Apex→www and HTTP→HTTPS are handled by GCP URL map / LB frontend policy.

describe("middleware — no redirects (GCP LB handles all redirects)", () => {
  it("www on HTTP is NOT redirected (cert provisioner needs clean port 80)", () => {
    const response = middleware(makeRequest("/pricing", { http: true }));
    expect(response.status).not.toBe(301);
    expect(response.status).not.toBe(302);
  });

  it("apex domain on HTTPS is NOT redirected by middleware (GCP LB URL map handles it)", () => {
    const response = middleware(makeRequest("/", { host: "fenrirledger.com" }));
    expect(response.status).not.toBe(301);
    expect(response.status).not.toBe(302);
  });

  it("apex domain on HTTP is NOT redirected by middleware", () => {
    const response = middleware(makeRequest("/about", { host: "fenrirledger.com", http: true }));
    expect(response.status).not.toBe(301);
    expect(response.status).not.toBe(302);
  });

  it("/api/health on HTTP is NOT redirected (GKE probes use plain HTTP)", () => {
    const response = middleware(makeRequest("/api/health", { http: true }));
    expect(response.status).not.toBe(301);
    expect(response.status).not.toBe(302);
  });

  it("/api/health on HTTP gets Cache-Control: no-store (edge must not cache health)", () => {
    const response = middleware(makeRequest("/api/health", { http: true }));
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
