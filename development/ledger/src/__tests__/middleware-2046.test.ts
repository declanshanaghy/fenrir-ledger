/**
 * Unit tests for src/middleware.ts
 *
 * Covers: CSP header is always set, Cache-Control is set when the path
 * matches a rule, and Cache-Control is omitted when getCacheControlForPath
 * returns null.
 *
 * Issue: #2046
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks — declared before importing middleware
// ---------------------------------------------------------------------------

const mockGetCacheControl = vi.hoisted(() => vi.fn<(p: string) => string | null>());
const mockBuildCspDirectives = vi.hoisted(() => vi.fn());

vi.mock("@/lib/cache-headers", () => ({
  getCacheControlForPath: (p: string) => mockGetCacheControl(p),
}));

vi.mock("@/lib/csp-headers", () => ({
  buildCspDirectives: () => mockBuildCspDirectives(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(pathname: string): NextRequest {
  return new NextRequest(`http://localhost${pathname}`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildCspDirectives.mockReturnValue([
      "default-src 'self'",
      "script-src 'unsafe-inline'",
    ]);
    mockGetCacheControl.mockReturnValue(null);
  });

  it("always sets Content-Security-Policy header", async () => {
    const { middleware } = await import("@/middleware");
    const res = middleware(makeRequest("/"));
    expect(res.headers.get("Content-Security-Policy")).toBe(
      "default-src 'self'; script-src 'unsafe-inline'"
    );
  });

  it("joins multiple CSP directives with semicolon and space", async () => {
    mockBuildCspDirectives.mockReturnValue([
      "default-src 'self'",
      "img-src *",
      "frame-ancestors 'none'",
    ]);
    const { middleware } = await import("@/middleware");
    const res = middleware(makeRequest("/about"));
    const csp = res.headers.get("Content-Security-Policy");
    expect(csp).toBe("default-src 'self'; img-src *; frame-ancestors 'none'");
  });

  it("sets Cache-Control when getCacheControlForPath returns a value", async () => {
    mockGetCacheControl.mockReturnValue("public, max-age=300, s-maxage=300");
    const { middleware } = await import("@/middleware");
    const res = middleware(makeRequest("/chronicles"));
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300, s-maxage=300");
  });

  it("does not set Cache-Control when getCacheControlForPath returns null", async () => {
    mockGetCacheControl.mockReturnValue(null);
    const { middleware } = await import("@/middleware");
    const res = middleware(makeRequest("/ledger/dashboard"));
    expect(res.headers.get("Cache-Control")).toBeNull();
  });

  it("passes the pathname to getCacheControlForPath", async () => {
    const { middleware } = await import("@/middleware");
    middleware(makeRequest("/api/cards"));
    expect(mockGetCacheControl).toHaveBeenCalledWith("/api/cards");
  });

  it("returns a response even when CSP directives array is empty", async () => {
    mockBuildCspDirectives.mockReturnValue([]);
    const { middleware } = await import("@/middleware");
    const res = middleware(makeRequest("/"));
    expect(res).toBeDefined();
    expect(res.headers.get("Content-Security-Policy")).toBe("");
  });
});
