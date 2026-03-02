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
 * See ADR-005 for the auth architecture. See ADR-008 for API route auth.
 */

import { NextResponse } from "next/server";

export function middleware(/* req: NextRequest */) {
  return NextResponse.next();
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
