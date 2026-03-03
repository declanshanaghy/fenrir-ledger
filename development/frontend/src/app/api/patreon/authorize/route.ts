/**
 * GET /api/patreon/authorize
 *
 * Initiates the Patreon OAuth linking flow.
 *
 * Authentication is required (ADR-008). Since this route is accessed via
 * full-page redirect (not a fetch), the Google id_token is passed as a
 * query parameter (?id_token=...) rather than an Authorization header.
 * The route validates the token server-side before proceeding.
 *
 * Flow:
 *   1. User clicks "Link Patreon" in the frontend
 *   2. Frontend redirects to this route with ?id_token=...
 *   3. This route validates the token, generates an encrypted state token
 *   4. Redirects to Patreon's OAuth authorize URL
 *   5. After user grants consent, Patreon redirects to /api/patreon/callback
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/auth/verify-id-token";
import { generateState } from "@/lib/patreon/state";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

/** Patreon OAuth2 authorization endpoint. */
const PATREON_AUTHORIZE_URL = "https://www.patreon.com/oauth2/authorize";

/**
 * Builds the full redirect URI for the Patreon callback based on the incoming request.
 * Auto-detects the host to work in both development and production.
 */
function buildRedirectUri(request: NextRequest): string {
  log.debug("buildRedirectUri called");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("host") ?? "localhost:9653";
  const uri = `${proto}://${host}/api/patreon/callback`;
  log.debug("buildRedirectUri returning", { uri });
  return uri;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  log.debug("GET /api/patreon/authorize called");

  // Rate limit
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success: rateLimitOk } = rateLimit(`patreon-auth:${ip}`, {
    limit: 5,
    windowMs: 60_000,
  });
  if (!rateLimitOk) {
    log.debug("GET /api/patreon/authorize returning", {
      status: 429,
      error: "rate_limited",
    });
    return NextResponse.json(
      {
        error: "rate_limited",
        error_description: "Too many requests. Try again later.",
      },
      { status: 429 },
    );
  }

  // Authenticate the user via Google id_token.
  // This route is accessed via full-page redirect, so the token comes as a
  // query parameter rather than an Authorization header (requireAuth pattern).
  // The token is still validated server-side before proceeding.
  const idToken =
    request.nextUrl.searchParams.get("id_token") ??
    request.headers.get("authorization")?.slice(7);
  if (!idToken) {
    log.debug("GET /api/patreon/authorize returning", {
      status: 401,
      reason: "no id_token provided",
    });
    return NextResponse.json(
      {
        error: "missing_token",
        error_description:
          "Google id_token is required (query param or Authorization header).",
      },
      { status: 401 },
    );
  }

  const authResult = await verifyIdToken(idToken);
  if (!authResult.ok) {
    log.debug("GET /api/patreon/authorize returning", {
      status: authResult.status,
      reason: "invalid id_token",
    });
    return NextResponse.json(
      {
        error: "invalid_token",
        error_description: authResult.error,
      },
      { status: authResult.status },
    );
  }

  const auth = { user: authResult.user };

  // Validate Patreon configuration
  const clientId = process.env.PATREON_CLIENT_ID;
  if (!clientId) {
    log.error("GET /api/patreon/authorize: PATREON_CLIENT_ID not configured");
    log.debug("GET /api/patreon/authorize returning", {
      status: 500,
      error: "not_configured",
    });
    return NextResponse.json(
      {
        error: "not_configured",
        error_description: "Patreon integration is not configured.",
      },
      { status: 500 },
    );
  }

  // Generate encrypted state token containing the Google user sub
  const state = generateState(auth.user.sub);
  const redirectUri = buildRedirectUri(request);

  // Build the Patreon authorize URL
  const authorizeUrl = new URL(PATREON_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set(
    "scope",
    "identity identity[email] campaigns.members",
  );
  authorizeUrl.searchParams.set("state", state);

  log.debug("GET /api/patreon/authorize returning", {
    status: 302,
    redirectTo: "patreon.com/oauth2/authorize",
    googleSub: auth.user.sub,
  });

  return NextResponse.redirect(authorizeUrl.toString());
}
