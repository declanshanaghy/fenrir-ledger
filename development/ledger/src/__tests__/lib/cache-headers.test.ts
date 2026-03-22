/**
 * cache-headers.test.ts — Issue #1145
 *
 * Unit tests for getCacheControlForPath() and the CACHE_CONTROL constants.
 * Verifies that each route category receives the correct Cache-Control value
 * for Cloud CDN edge caching.
 */

import { describe, it, expect } from "vitest";
import { CACHE_CONTROL, getCacheControlForPath } from "@/lib/cache-headers";

// ── CACHE_CONTROL constants ───────────────────────────────────────────────────

describe("CACHE_CONTROL constants", () => {
  it("STATIC_IMMUTABLE is public + immutable + 1 year max-age", () => {
    expect(CACHE_CONTROL.STATIC_IMMUTABLE).toBe("public, max-age=31536000, immutable");
  });

  it("IMAGE is public + 24h browser + 24h edge", () => {
    expect(CACHE_CONTROL.IMAGE).toBe("public, max-age=86400, s-maxage=86400");
  });

  it("MARKETING is public + 5 min edge (s-maxage=300)", () => {
    expect(CACHE_CONTROL.MARKETING).toBe("public, s-maxage=300");
  });

  it("APP is public + 1 min edge (s-maxage=60)", () => {
    expect(CACHE_CONTROL.APP).toBe("public, s-maxage=60");
  });

  it("NO_STORE is no-store", () => {
    expect(CACHE_CONTROL.NO_STORE).toBe("no-store");
  });

  it("STATIC_ASSET is public + 1 day browser + 7 day edge", () => {
    expect(CACHE_CONTROL.STATIC_ASSET).toBe("public, max-age=86400, s-maxage=604800");
  });
});

// ── getCacheControlForPath — API routes ───────────────────────────────────────

describe("getCacheControlForPath — API routes", () => {
  it("/api/health returns no-store", () => {
    expect(getCacheControlForPath("/api/health")).toBe(CACHE_CONTROL.NO_STORE);
  });

  it("/api/auth/token returns no-store", () => {
    expect(getCacheControlForPath("/api/auth/token")).toBe(CACHE_CONTROL.NO_STORE);
  });

  it("/api/sync/pull returns no-store", () => {
    expect(getCacheControlForPath("/api/sync/pull")).toBe(CACHE_CONTROL.NO_STORE);
  });

  it("/api/stripe/membership returns no-store", () => {
    expect(getCacheControlForPath("/api/stripe/membership")).toBe(CACHE_CONTROL.NO_STORE);
  });

  it("any /api/* path returns no-store", () => {
    const apiPaths = ["/api/", "/api/foo", "/api/foo/bar/baz"];
    for (const p of apiPaths) {
      expect(getCacheControlForPath(p)).toBe(CACHE_CONTROL.NO_STORE);
    }
  });
});

// ── getCacheControlForPath — Marketing pages ──────────────────────────────────

describe("getCacheControlForPath — Marketing pages", () => {
  it("/ (home) returns marketing cache", () => {
    expect(getCacheControlForPath("/")).toBe(CACHE_CONTROL.MARKETING);
  });

  it("/features returns marketing cache", () => {
    expect(getCacheControlForPath("/features")).toBe(CACHE_CONTROL.MARKETING);
  });

  it("/pricing returns marketing cache", () => {
    expect(getCacheControlForPath("/pricing")).toBe(CACHE_CONTROL.MARKETING);
  });

  it("/about returns marketing cache", () => {
    expect(getCacheControlForPath("/about")).toBe(CACHE_CONTROL.MARKETING);
  });

  it("/faq returns marketing cache", () => {
    expect(getCacheControlForPath("/faq")).toBe(CACHE_CONTROL.MARKETING);
  });
});

// ── getCacheControlForPath — App pages ────────────────────────────────────────

describe("getCacheControlForPath — App pages (/ledger/*)", () => {
  it("/ledger returns app cache", () => {
    expect(getCacheControlForPath("/ledger")).toBe(CACHE_CONTROL.APP);
  });

  it("/ledger/ returns app cache", () => {
    expect(getCacheControlForPath("/ledger/")).toBe(CACHE_CONTROL.APP);
  });

  it("/ledger/cards returns app cache", () => {
    expect(getCacheControlForPath("/ledger/cards")).toBe(CACHE_CONTROL.APP);
  });

  it("/ledger/settings/profile returns app cache", () => {
    expect(getCacheControlForPath("/ledger/settings/profile")).toBe(CACHE_CONTROL.APP);
  });
});

// ── getCacheControlForPath — No explicit policy ───────────────────────────────

describe("getCacheControlForPath — paths with no explicit policy", () => {
  it("unknown path returns null", () => {
    expect(getCacheControlForPath("/unknown-page")).toBeNull();
  });

  it("/sign-in returns null (not a marketing page, not /ledger/*)", () => {
    expect(getCacheControlForPath("/sign-in")).toBeNull();
  });

  it("/chronicles returns null", () => {
    expect(getCacheControlForPath("/chronicles")).toBeNull();
  });
});

// ── getCacheControlForPath — Loki edge cases ─────────────────────────────────

describe("getCacheControlForPath — Loki edge cases (Issue #1145)", () => {
  it("API sub-paths of /api/health still return no-store", () => {
    // /api/health has no sub-routes, but if it did, they must also be no-store
    expect(getCacheControlForPath("/api/health/check")).toBe(CACHE_CONTROL.NO_STORE);
  });

  it("path that starts with /ledger but isn't /ledger or /ledger/* returns null", () => {
    // e.g. /ledger-app is NOT an app page — must not match /ledger prefix check
    expect(getCacheControlForPath("/ledger-app")).toBeNull();
  });

  it("/api prefix match is exact — /apiary does NOT return no-store", () => {
    // Only /api/* matches, not /apiary/...
    expect(getCacheControlForPath("/apiary")).toBeNull();
  });

  it("marketing paths are exact — /features/extra returns null (sub-pages not cached)", () => {
    // Marketing set uses Set.has for exact match; sub-paths return null
    expect(getCacheControlForPath("/features/extra")).toBeNull();
  });

  it("marketing path values contain s-maxage but not max-age (browser TTL not set)", () => {
    const v = CACHE_CONTROL.MARKETING;
    expect(v).toContain("s-maxage=300");
    expect(v).not.toContain("max-age=300");
  });

  it("APP cache value contains s-maxage=60 for 1-min edge TTL", () => {
    expect(CACHE_CONTROL.APP).toContain("s-maxage=60");
  });

  it("STATIC_IMMUTABLE contains immutable keyword", () => {
    expect(CACHE_CONTROL.STATIC_IMMUTABLE).toContain("immutable");
  });
});
