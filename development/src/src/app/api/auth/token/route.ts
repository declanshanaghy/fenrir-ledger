/**
 * POST /api/auth/token
 *
 * Server-side proxy for the Google OAuth2 token exchange.
 *
 * Why this route exists:
 *   Google requires a `client_secret` for Web Application type OAuth clients
 *   even when PKCE is used. Desktop/Installed app types omit the secret but
 *   restrict redirect URIs to localhost only — incompatible with Vercel production.
 *   This thin proxy keeps `GOOGLE_CLIENT_SECRET` server-side while the browser
 *   retains full ownership of the PKCE flow (code_verifier, code_challenge, state).
 *   PKCE still protects against code interception; this route is an implementation
 *   detail, not a security boundary.
 *
 * See ADR-005 for the full auth architecture decision.
 *
 * Request body (JSON):
 *   { code: string; code_verifier: string; redirect_uri: string }
 *
 * Response:
 *   Google's token response forwarded as-is (status + body).
 */

import { NextRequest, NextResponse } from "next/server";

/** Whitelisted origins that may call this endpoint. */
const ALLOWED_ORIGINS = new Set([
  "http://localhost:9653",
  "https://fenrir-ledger.vercel.app",
]);

/** Google token endpoint. */
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

interface TokenRequestBody {
  code: string;
  code_verifier: string;
  redirect_uri: string;
}

/**
 * Validates that the `redirect_uri` origin is in the allow-list.
 * Prevents cross-origin request forgery by ensuring only known origins
 * can trigger a token exchange through this proxy.
 */
function isAllowedRedirectUri(redirectUri: string): boolean {
  try {
    const { origin } = new URL(redirectUri);
    return ALLOWED_ORIGINS.has(origin);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Parse and validate request body.
  let body: TokenRequestBody;
  try {
    body = (await request.json()) as TokenRequestBody;
  } catch {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const { code, code_verifier, redirect_uri } = body;

  if (!code || !code_verifier || !redirect_uri) {
    return NextResponse.json(
      {
        error: "invalid_request",
        error_description: "Missing required fields: code, code_verifier, redirect_uri.",
      },
      { status: 400 }
    );
  }

  // Validate redirect_uri origin against the allow-list.
  if (!isAllowedRedirectUri(redirect_uri)) {
    return NextResponse.json(
      {
        error: "invalid_request",
        error_description: "redirect_uri origin is not whitelisted.",
      },
      { status: 400 }
    );
  }

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("[Fenrir] Token proxy: missing NEXT_PUBLIC_GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
    return NextResponse.json(
      { error: "server_error", error_description: "Auth configuration error." },
      { status: 500 }
    );
  }

  // Proxy the token exchange to Google.
  const params = new URLSearchParams({
    code,
    code_verifier,
    redirect_uri,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
  });

  let googleResponse: Response;
  try {
    googleResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Fenrir] Token proxy: fetch to Google failed:", message);
    return NextResponse.json(
      { error: "server_error", error_description: "Failed to reach Google token endpoint." },
      { status: 502 }
    );
  }

  // Forward Google's response (status + body) unchanged.
  const responseBody = await googleResponse.text();
  if (!googleResponse.ok) {
    console.error(`[Fenrir] Token proxy: Google returned ${googleResponse.status}:`, responseBody);
  }
  return new NextResponse(responseBody, {
    status: googleResponse.status,
    headers: { "Content-Type": "application/json" },
  });
}
