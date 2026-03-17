/**
 * Fenrir Ledger — Next.js Middleware
 *
 * Page-level auth is client-side (PKCE + localStorage). API route auth is
 * handled per-route via requireAuth() which verifies the Google id_token JWT.
 * See ADR-008 for the API auth decision.
 *
 * Page protection is handled by AuthContext on the client:
 *  - On mount, AuthContext reads "fenrir:auth" from localStorage.
 *  - If missing or expired, it redirects to /sign-in.
 *
 * API route protection is handled per-route via requireAuth():
 *  - Each protected route calls requireAuth(request) at the top of its handler.
 *  - The guard verifies the Google id_token JWT against Google's JWKS public keys.
 *  - /api/auth/token is exempt (token exchange endpoint -- no token exists yet).
 *
 * CSP (Issue #1184 — fix for #1144):
 *  - Hybrid nonce + hash CSP. A per-request nonce covers Next.js RSC inline
 *    scripts (dynamic, can't be pre-hashed). Pre-computed hashes cover known
 *    static inline scripts (next-themes, GA4 init).
 *  - The nonce is set on the request headers so Next.js can read it and attach
 *    it to RSC streaming <script> tags.
 *  - Non-CSP security headers remain as static headers in next.config.ts.
 *
 * See ADR-005 for the auth architecture. See ADR-008 for API route auth.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCacheControlForPath } from "@/lib/cache-headers";
import { buildCspDirectives } from "@/lib/csp-headers";

export function middleware(request: NextRequest) {
  const { hostname, protocol, pathname, search } = request.nextUrl;

  // -----------------------------------------------------------------------
  // Canonical domain redirect: www → apex, HTTP → HTTPS
  // Skip in development (localhost) and health check endpoint (GCP probes use HTTP)
  // -----------------------------------------------------------------------
  if (hostname !== "localhost" && hostname !== "127.0.0.1" && pathname !== "/api/health") {
    const isWww = hostname.startsWith("www.");
    const isHttp = protocol === "http:" || request.headers.get("x-forwarded-proto") === "http";

    if (isWww || isHttp) {
      const canonicalHost = hostname.replace(/^www\./, "");
      const url = `https://${canonicalHost}${pathname}${search}`;
      return NextResponse.redirect(url, 301);
    }
  }

  // -----------------------------------------------------------------------
  // CSP with per-request nonce — Issue #1184 (fix for #1144)
  //
  // Next.js App Router streams RSC data as inline <script> tags whose content
  // varies per request. These cannot be pre-hashed. A per-request nonce covers
  // them. Next.js reads the nonce from the request's Content-Security-Policy
  // header and attaches it to all inline <script> tags it generates.
  //
  // Known static inline scripts (next-themes, GA4 init) also get hashes so
  // they work regardless of nonce presence.
  // -----------------------------------------------------------------------
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const cspDirectives = buildCspDirectives(nonce);
  const cspHeaderValue = cspDirectives.join("; ");

  // Set CSP on request headers so Next.js can read the nonce
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", cspHeaderValue);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Set CSP on response headers for the browser to enforce
  response.headers.set("Content-Security-Policy", cspHeaderValue);

  // -----------------------------------------------------------------------
  // Cache-Control headers — Issue #1145
  // Apply per-route CDN TTL rules. Static asset paths (_next/static,
  // _next/image, ico/svg/png) are excluded from the middleware matcher and
  // get their Cache-Control from next.config.ts headers() instead.
  // -----------------------------------------------------------------------
  const cacheControl = getCacheControlForPath(pathname);
  if (cacheControl) {
    response.headers.set("Cache-Control", cacheControl);
  }

  return response;
}

/**
 * Matcher — apply middleware to all routes except:
 * - Next.js internals (_next/*)
 * - Static assets (favicons, images, etc.)
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
