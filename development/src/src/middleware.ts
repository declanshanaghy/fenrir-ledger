/**
 * Fenrir Ledger — Route Protection Middleware
 *
 * All routes except /api/auth/* require an authenticated session.
 * Unauthenticated users are redirected directly to the Google OAuth
 * consent screen (no custom sign-in page).
 *
 * Auth.js v5 middleware integrates via the exported `auth` function.
 * When a request arrives without a valid session, auth() returns null
 * and we redirect to the sign-in URL.
 *
 * See ADR-004 for the authentication architecture decision.
 *
 * Protected routes:
 *   /                  — dashboard
 *   /cards/*           — card add/edit pages
 *   /valhalla          — Valhalla archive
 *
 * Public routes:
 *   /api/auth/*        — Auth.js callback and sign-in endpoints
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth(function middleware(req) {
  const { nextUrl } = req;

  // Allow Auth.js API routes through without authentication check
  if (nextUrl.pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // If no session, redirect to Google sign-in
  if (!req.auth) {
    const signInUrl = new URL("/api/auth/signin", nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", nextUrl.href);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

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
