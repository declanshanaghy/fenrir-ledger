/**
 * GET /api/patreon/authorize
 *
 * Initiates the Patreon OAuth linking flow.
 *
 * Supports two modes:
 *   - **Authenticated**: Google id_token is present (query param or Authorization header).
 *     Verifies the token and embeds the Google sub in the state.
 *   - **Anonymous**: No id_token. Generates state with `googleSub: "anonymous"`.
 *
 * This route is exempt from requireAuth because:
 *   1. It is accessed via full-page redirect (not a fetch call)
 *   2. Anonymous users must be able to start the Patreon OAuth flow
 *   3. CSRF protection is provided by the encrypted state parameter
 *
 * Flow:
 *   1. User clicks "Link Patreon" in the frontend
 *   2. Frontend redirects to this route (with or without ?id_token=...)
 *   3. This route generates an encrypted state token
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
 * Builds the full redirect URI for the Patreon callback.
 * Prefers APP_BASE_URL env var for deterministic redirect URIs in production
 * (SEV-002 fix). Falls back to header-based detection for preview deployments
 * and local development where the URL varies.
 */
function buildRedirectUri(request: NextRequest): string {
  log.debug("buildRedirectUri called");
  const appBaseUrl = process.env.APP_BASE_URL;
  if (appBaseUrl) {
    const uri = `${appBaseUrl}/api/patreon/callback`;
    log.debug("buildRedirectUri returning (APP_BASE_URL)", { uri });
    return uri;
  }
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("host") ?? "localhost:9653";
  const uri = `${proto}://${host}/api/patreon/callback`;
  log.debug("buildRedirectUri returning (header fallback)", { uri });
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

  // Attempt to authenticate the user via Google id_token.
  // If present: authenticated flow (embed Google sub in state).
  // If absent: anonymous flow (embed "anonymous" in state).
  const idToken =
    request.nextUrl.searchParams.get("id_token") ??
    request.headers.get("authorization")?.slice(7);

  let googleSub: string | undefined;

  if (idToken) {
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
    googleSub = authResult.user.sub;
    log.debug("GET /api/patreon/authorize: authenticated mode", { googleSub });
  } else {
    log.debug("GET /api/patreon/authorize: anonymous mode (no id_token)");
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

  // Generate encrypted state token containing the Google user sub (or anonymous)
  let state: string;
  try {
    state = generateState(googleSub);
  } catch (err) {
    log.error("GET /api/patreon/authorize: generateState failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        error: "state_generation_failed",
        error_description:
          "Failed to generate OAuth state. Check ENTITLEMENT_ENCRYPTION_KEY.",
      },
      { status: 500 },
    );
  }

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

  const mode = googleSub ? "authenticated" : "anonymous";
  log.debug("GET /api/patreon/authorize returning", {
    status: 302,
    redirectTo: "patreon.com/oauth2/authorize",
    mode,
    googleSub: googleSub ?? "anonymous",
  });

  return NextResponse.redirect(authorizeUrl.toString());
}
