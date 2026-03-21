/**
 * POST /api/auth/token
 *
 * Server-side proxy for the Google OAuth2 token exchange.
 *
 * Why this route exists:
 *   Google requires a `client_secret` for Web Application type OAuth clients
 *   even when PKCE is used. Desktop/Installed app types omit the secret but
 *   restrict redirect URIs to localhost only — incompatible with production deployments.
 *   This thin proxy keeps `GOOGLE_CLIENT_SECRET` server-side while the browser
 *   retains full ownership of the PKCE flow (code_verifier, code_challenge, state).
 *   PKCE still protects against code interception; this route is an implementation
 *   detail, not a security boundary.
 *
 * See ADR-005 for the full auth architecture decision.
 *
 * Supports two flows:
 *
 * 1. Authorization code exchange (initial login):
 *    Request:  { code: string; code_verifier: string; redirect_uri: string }
 *    Response: Google's token response (access_token, id_token, refresh_token, expires_in)
 *
 * 2. Refresh token (silent session renewal — DEF-001 fix):
 *    Request:  { refresh_token: string }
 *    Response: Google's token response (access_token, id_token, expires_in)
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import { initTrialForUser } from "@/lib/trial/init-trial";

/**
 * Whitelisted origins that may call this endpoint.
 * APP_BASE_URL is set per-environment (K8s secret for production,
 * .env.local for dev). When set, its origin is added to the allow-list.
 */
const ALLOWED_ORIGINS = new Set([
  "http://localhost:9653",
  ...(process.env.APP_BASE_URL ? [process.env.APP_BASE_URL] : []),
  // Support www variant — redirect_uri origin must match
  ...(process.env.APP_BASE_URL?.includes("://") && !process.env.APP_BASE_URL.includes("://www.")
    ? [`${process.env.APP_BASE_URL.replace("://", "://www.")}`]
    : []),
]);

/** Google token endpoint. */
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

interface AuthCodeRequestBody {
  code: string;
  code_verifier: string;
  redirect_uri: string;
}

interface RefreshRequestBody {
  refresh_token: string;
}

type TokenRequestBody = AuthCodeRequestBody | RefreshRequestBody;

function isRefreshRequest(body: TokenRequestBody): body is RefreshRequestBody {
  return "refresh_token" in body;
}

/**
 * Validates that the `redirect_uri` origin is in the allow-list.
 * Prevents cross-origin request forgery by ensuring only known origins
 * can trigger a token exchange through this proxy.
 */
function isAllowedRedirectUri(redirectUri: string): boolean {
  log.debug("isAllowedRedirectUri called", { redirectUri });
  try {
    const { origin } = new URL(redirectUri);
    const allowed = ALLOWED_ORIGINS.has(origin);
    log.debug("isAllowedRedirectUri returning", { origin, allowed });
    return allowed;
  } catch {
    log.debug("isAllowedRedirectUri returning", { allowed: false, reason: "invalid URL" });
    return false;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  log.debug("POST /api/auth/token called", { ip });

  // Rate limit by IP — 10 requests per minute per IP address.
  const { success } = rateLimit(`token:${ip}`, { limit: 10, windowMs: 60_000 });
  if (!success) {
    log.debug("POST /api/auth/token returning", { status: 429, error: "rate_limited" });
    return NextResponse.json(
      {
        error: "rate_limited",
        error_description: "Too many requests. Try again later.",
      },
      { status: 429 }
    );
  }

  // Parse and validate request body.
  let body: TokenRequestBody;
  try {
    body = (await request.json()) as TokenRequestBody;
  } catch {
    log.debug("POST /api/auth/token returning", { status: 400, error: "invalid_request", reason: "invalid JSON" });
    return NextResponse.json(
      { error: "invalid_request", error_description: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const grantType = isRefreshRequest(body) ? "refresh_token" : "authorization_code";
  log.debug("POST /api/auth/token parsed body", {
    grantType,
    hasCode: "code" in body,
    hasCodeVerifier: "code_verifier" in body,
    hasRedirectUri: "redirect_uri" in body,
    hasRefreshToken: "refresh_token" in body,
  });

  // Load OAuth credentials (needed for both flows).
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    log.error("POST /api/auth/token: missing env vars", { hasClientId: !!clientId, hasClientSecret: !!clientSecret });
    log.debug("POST /api/auth/token returning", { status: 500, error: "server_error" });
    return NextResponse.json(
      { error: "server_error", error_description: "Auth configuration error." },
      { status: 500 }
    );
  }

  // Build the params for the appropriate grant type.
  let params: URLSearchParams;

  if (isRefreshRequest(body)) {
    // --- Refresh token flow (DEF-001) ---
    if (!body.refresh_token) {
      log.debug("POST /api/auth/token returning", { status: 400, error: "invalid_request", reason: "missing refresh_token" });
      return NextResponse.json(
        { error: "invalid_request", error_description: "Missing required field: refresh_token." },
        { status: 400 }
      );
    }

    params = new URLSearchParams({
      refresh_token: body.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    });
  } else {
    // --- Authorization code exchange flow (original) ---
    const { code, code_verifier, redirect_uri } = body;

    if (!code || !code_verifier || !redirect_uri) {
      log.debug("POST /api/auth/token returning", { status: 400, error: "invalid_request", reason: "missing fields" });
      return NextResponse.json(
        {
          error: "invalid_request",
          error_description: "Missing required fields: code, code_verifier, redirect_uri.",
        },
        { status: 400 }
      );
    }

    if (!isAllowedRedirectUri(redirect_uri)) {
      log.debug("POST /api/auth/token returning", { status: 400, error: "invalid_request", reason: "redirect_uri not whitelisted" });
      return NextResponse.json(
        {
          error: "invalid_request",
          error_description: "redirect_uri origin is not whitelisted.",
        },
        { status: 400 }
      );
    }

    params = new URLSearchParams({
      code,
      code_verifier,
      redirect_uri,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
    });
  }

  // Proxy to Google's token endpoint.
  log.debug("POST /api/auth/token proxying to Google", { grantType, clientIdLength: clientId.length, clientSecretLength: clientSecret.length });
  let googleResponse: Response;
  try {
    googleResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  } catch (err) {
    log.error("POST /api/auth/token: fetch to Google failed", err);
    log.debug("POST /api/auth/token returning", { status: 502, error: "server_error" });
    return NextResponse.json(
      { error: "server_error", error_description: "Failed to reach Google token endpoint." },
      { status: 502 }
    );
  }

  // Forward Google's response (status + body) unchanged.
  const responseBody = await googleResponse.text();
  if (!googleResponse.ok) {
    log.error("POST /api/auth/token: Google error", { status: googleResponse.status, grantType, body: responseBody });
  }

  // Issue #1722: Initialize trial server-side after successful auth code exchange.
  // This replaces the client-side /api/trial/init call that was unreliable because
  // window.location.replace() aborted in-flight fetches in the callback page.
  // Fire-and-forget: trial init failures are logged but don't block the token response.
  if (googleResponse.ok && grantType === "authorization_code") {
    try {
      const tokenData = JSON.parse(responseBody) as { id_token?: string };
      if (tokenData.id_token) {
        // Decode id_token payload (base64url middle segment) to get user claims.
        const parts = tokenData.id_token.split(".");
        if (parts.length === 3) {
          const payload = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
          const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
          const decoded = Buffer.from(padded, "base64").toString("utf-8");
          const claims = JSON.parse(decoded) as { sub?: string; email?: string; name?: string };
          if (claims.sub) {
            await initTrialForUser({
              userId: claims.sub,
              email: claims.email ?? "",
              displayName: claims.name ?? "",
            });
            log.debug("POST /api/auth/token: trial init completed", { userId: claims.sub });
          }
        }
      }
    } catch (err) {
      // Trial init is best-effort — don't block the token response
      const message = err instanceof Error ? err.message : String(err);
      log.warn("POST /api/auth/token: trial init failed (non-blocking)", { error: message });
    }
  }

  log.debug("POST /api/auth/token returning", { status: googleResponse.status, grantType });
  return new NextResponse(responseBody, {
    status: googleResponse.status,
    headers: { "Content-Type": "application/json" },
  });
}
