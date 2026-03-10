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
 * CSP Nonce:
 *  - Generate a unique nonce per request for Content Security Policy.
 *  - Inject nonce into request headers for use in layout/scripts.
 *  - Build CSP header with nonce and inject into response.
 *
 * See ADR-005 for the auth architecture. See ADR-008 for API route auth.
 */

import { NextResponse } from "next/server";
import { generateNonce } from "@/lib/csp-nonce";
import { buildSecurityHeaders } from "@/lib/csp-headers";

export function middleware() {
  const nonce = generateNonce();

  // Clone response and inject nonce into headers for layout/scripts to read
  const response = NextResponse.next();
  response.headers.set("x-nonce-csp", nonce);

  // Build security headers with nonce and inject into response
  const securityHeaders = buildSecurityHeaders(nonce);
  securityHeaders.forEach((header) => {
    response.headers.set(header.key, header.value);
  });

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
