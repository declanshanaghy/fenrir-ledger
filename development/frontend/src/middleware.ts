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
 *  - Uses 'unsafe-inline' for scripts. Nonce-based CSP is incompatible with
 *    PPR + CDN caching: the pre-rendered shell has no nonces (built before
 *    middleware runs), and CDN caches the HTML. A per-request nonce in the
 *    CSP header never matches the nonce-less inline RSC scripts → blank page.
 *  - Static hashes cover next-themes (predictable script content).
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
  // HTTP → HTTPS redirect (safety net for non-GKE traffic / local dev)
  // Apex (fenrirledger.com) → www is handled at the GCP LB layer (issue #1318).
  // GKE terminates SSL and sets x-forwarded-proto: https, so this block will
  // not fire in production — it exists for non-LB environments only.
  // Skip health check endpoint (GKE liveness probes use plain HTTP).
  // -----------------------------------------------------------------------
  if (hostname !== "localhost" && hostname !== "127.0.0.1" && pathname !== "/api/health") {
    const rawHost = request.headers.get("host") ?? "";
    const host = rawHost.split(":")[0];
    const isHttp =
      request.headers.get("x-forwarded-proto") === "http" || protocol === "http:";

    if (isHttp && host !== "localhost" && host !== "127.0.0.1") {
      return NextResponse.redirect(`https://${host}${pathname}${search}`, 301);
    }
  }

  // -----------------------------------------------------------------------
  // CSP — Issue #1184 (fix for #1144)
  //
  // Uses 'unsafe-inline' for scripts. Nonce-based CSP is incompatible with
  // PPR + CDN caching: PPR pre-renders a static HTML shell at build time
  // (before middleware runs), so inline RSC payload scripts have no nonces.
  // CDN caches this shell. A per-request nonce in the CSP header never
  // matches the nonce-less scripts in the cached HTML → CSP violation → blank page.
  //
  // 'unsafe-inline' is acceptable here: the app has no user-generated content
  // displayed back on the page, so XSS injection risk is minimal.
  // -----------------------------------------------------------------------
  const cspDirectives = buildCspDirectives();
  const cspHeaderValue = cspDirectives.join("; ");

  const response = NextResponse.next();

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
