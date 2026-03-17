/**
 * cache-headers-middleware.loki.test.ts — Issue #1145 (Loki QA)
 *
 * Integration tests for the middleware function itself.
 * FiremanDecko's tests cover getCacheControlForPath() exhaustively.
 * These tests validate that the middleware APPLIES headers correctly and
 * that the redirect safety guarantee holds (301 responses must be header-clean).
 *
 * Acceptance criteria validated:
 * - AC3: Marketing pages get Cache-Control: public, s-maxage=300
 * - AC4: App pages (/ledger/*) get Cache-Control: public, s-maxage=60
 * - AC5: /api/* routes get Cache-Control: no-store
 * - Edge: 301 redirect responses do NOT carry a Cache-Control header
 * - Edge: /api/health is NOT redirected on HTTP (GKE probe bypass)
 */

import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

// ── helpers ───────────────────────────────────────────────────────────────

/** Build a NextRequest as if it came through a normal HTTPS apex-domain request. */
function apexRequest(pathname: string, { www = false, http = false } = {}): NextRequest {
  const proto = http ? "http" : "https";
  const host = www ? "www.fenrir-ledger.app" : "fenrir-ledger.app";
  return new NextRequest(`${proto}://${host}${pathname}`, {
    method: "GET",
    headers: {
      host,
      // If simulating HTTP-behind-proxy, set the forwarded-proto header
      ...(http ? { "x-forwarded-proto": "http" } : {}),
    },
  });
}

// ── Cache-Control is set for normal requests ──────────────────────────────

describe("middleware — Cache-Control applied on normal HTTPS apex requests", () => {
  it("marketing page / gets public, s-maxage=300", () => {
    const response = middleware(apexRequest("/"));
    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=300");
  });

  it("marketing page /pricing gets public, s-maxage=300", () => {
    const response = middleware(apexRequest("/pricing"));
    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=300");
  });

  it("/ledger app page gets public, s-maxage=60", () => {
    const response = middleware(apexRequest("/ledger"));
    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=60");
  });

  it("/ledger/cards app sub-page gets public, s-maxage=60", () => {
    const response = middleware(apexRequest("/ledger/cards"));
    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=60");
  });

  it("/api/auth/token gets no-store", () => {
    const response = middleware(apexRequest("/api/auth/token"));
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("path with no explicit policy (/sign-in) returns a response with no Cache-Control header", () => {
    const response = middleware(apexRequest("/sign-in"));
    expect(response.headers.get("Cache-Control")).toBeNull();
  });
});

// ── 301 redirects must NOT carry Cache-Control ────────────────────────────

describe("middleware — 301 redirect responses must NOT carry Cache-Control", () => {
  it("www → apex redirect has no Cache-Control header", () => {
    const req = apexRequest("/", { www: true });
    const response = middleware(req);
    expect(response.status).toBe(301);
    expect(response.headers.get("Cache-Control")).toBeNull();
  });

  it("HTTP → HTTPS redirect (via x-forwarded-proto) has no Cache-Control header", () => {
    const req = apexRequest("/pricing", { http: true });
    const response = middleware(req);
    expect(response.status).toBe(301);
    expect(response.headers.get("Cache-Control")).toBeNull();
  });

  it("www + HTTP combined redirect has no Cache-Control header", () => {
    const req = apexRequest("/about", { www: true, http: true });
    const response = middleware(req);
    expect(response.status).toBe(301);
    expect(response.headers.get("Cache-Control")).toBeNull();
  });
});

// ── /api/health redirect bypass ───────────────────────────────────────────

describe("middleware — /api/health is exempt from redirect (GKE probe bypass)", () => {
  it("/api/health on HTTP (x-forwarded-proto: http) is NOT redirected", () => {
    const req = apexRequest("/api/health", { http: true });
    const response = middleware(req);
    // Must NOT be a redirect — GKE liveness probes use plain HTTP
    expect(response.status).not.toBe(301);
    expect(response.status).not.toBe(302);
  });

  it("/api/health on HTTP gets Cache-Control: no-store (edge must not cache health)", () => {
    const req = apexRequest("/api/health", { http: true });
    const response = middleware(req);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
