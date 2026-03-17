/**
 * Cache-Control Headers — Fenrir Ledger (Issue #1145)
 *
 * Defines Cache-Control TTL rules for Cloud CDN edge caching.
 * BackendConfig uses USE_ORIGIN_HEADERS cache mode — the CDN respects
 * whatever Cache-Control we set on origin responses.
 *
 * s-maxage: CDN edge TTL (overrides max-age at the edge)
 * max-age:  browser cache TTL
 */

/** Cache-Control header values for each asset/route category. */
export const CACHE_CONTROL = {
  /** /_next/static/* — content-hashed filenames, safe to cache for 1 year */
  STATIC_IMMUTABLE: "public, max-age=31536000, immutable",

  /** /_next/image/* — 24h browser TTL + 24h edge TTL */
  IMAGE: "public, max-age=86400, s-maxage=86400",

  /** Marketing pages — 5 min edge cache, infrequently updated content */
  MARKETING: "public, s-maxage=300",

  /**
   * App pages (/ledger/*) — 1 min edge cache.
   * Auth is PKCE + localStorage (client-side), so the HTML shell is identical
   * for all users. Safe for short edge caching.
   */
  APP: "public, s-maxage=60",

  /** API routes and health probes — never cache at edge or browser */
  NO_STORE: "no-store",

  /** Root static assets (ico, svg, png) — 1 day browser, 7 days edge */
  STATIC_ASSET: "public, max-age=86400, s-maxage=604800",
} as const;

/** Marketing page routes eligible for 5-min edge cache. */
const MARKETING_PATHS = new Set(["/", "/features", "/pricing", "/about", "/faq"]);

/**
 * Returns the Cache-Control header value for a given request pathname.
 *
 * Used by middleware for routes included in the middleware matcher
 * (pages and API routes). Static asset paths are handled by next.config.ts
 * headers() which runs outside the middleware matcher.
 *
 * Returns null for paths that have no explicit cache policy (e.g. unknown
 * non-marketing, non-ledger routes — Next.js default behaviour applies).
 */
export function getCacheControlForPath(pathname: string): string | null {
  // API routes — always no-store (includes /api/health and all /api/* sub-paths)
  if (pathname.startsWith("/api/")) {
    return CACHE_CONTROL.NO_STORE;
  }

  // Marketing pages — 5 min edge cache
  if (MARKETING_PATHS.has(pathname)) {
    return CACHE_CONTROL.MARKETING;
  }

  // App pages — 1 min edge cache
  if (pathname === "/ledger" || pathname.startsWith("/ledger/")) {
    return CACHE_CONTROL.APP;
  }

  return null;
}
