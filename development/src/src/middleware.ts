/**
 * Fenrir Ledger — Next.js Middleware
 *
 * Auth is fully client-side (PKCE + localStorage). The server has no session
 * to inspect, so this middleware does nothing except define the matcher pattern
 * so Next.js knows which routes to process.
 *
 * Route protection is handled by AuthContext on the client:
 *  - On mount, AuthContext reads "fenrir:auth" from localStorage.
 *  - If missing or expired, it redirects to /sign-in.
 *
 * See ADR-005 for the auth architecture migration decision.
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
