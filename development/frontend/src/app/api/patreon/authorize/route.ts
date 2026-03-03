/**
 * GET /api/patreon/authorize
 *
 * Initiates the Patreon OAuth linking flow.
 *
 * This route is behind requireAuth (ADR-008) because the user must be
 * signed in with Google before linking Patreon. The Google user sub is
 * embedded in the encrypted state parameter for the callback to use.
 *
 * Flow:
 *   1. User clicks "Link Patreon" in the frontend
 *   2. Frontend redirects to this route
 *   3. This route generates an encrypted state token containing the Google sub
 *   4. Redirects to Patreon's OAuth authorize URL
 *   5. After user grants consent, Patreon redirects to /api/patreon/callback
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
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

  // Require Google authentication (ADR-008)
  const auth = await requireAuth(request);
  if (!auth.ok) {
    log.debug("GET /api/patreon/authorize returning", {
      status: 401,
      reason: "auth failed",
    });
    return auth.response;
  }

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
