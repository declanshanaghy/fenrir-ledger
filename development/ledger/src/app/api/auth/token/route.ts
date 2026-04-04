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
 * See issue #2060 for the Fenrir JWT session migration.
 *
 * Supports two flows:
 *
 * 1. Authorization code exchange (initial login):
 *    Request:  { code: string; code_verifier: string; redirect_uri: string }
 *    Response: { fenrir_token, access_token, refresh_token, expires_in, user }
 *              Google id_token is verified once server-side; a 30-day Fenrir JWT
 *              is minted and returned as the session credential. Google tokens are
 *              retained for Google API calls (Sheets import, Picker).
 *
 * 2. Refresh token (Google API access renewal — for Sheets import only):
 *    Request:  { refresh_token: string }
 *    Response: Google's token response (access_token, id_token, expires_in)
 *    Note: NOT used for session renewal after #2060. Sessions extend via sliding
 *          window on the Fenrir JWT (X-Fenrir-Token header in API responses).
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import { initTrialForUser } from "@/lib/trial/init-trial";
import { signFenrirJwt, JWT_LIFETIME_S } from "@/lib/auth/fenrir-jwt";

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

/**
 * Builds URLSearchParams for the refresh_token grant, or returns an error response.
 */
function buildRefreshParams(
  body: RefreshRequestBody,
  clientId: string,
  clientSecret: string,
): URLSearchParams | NextResponse {
  if (!body.refresh_token) {
    log.debug("POST /api/auth/token returning", { status: 400, error: "invalid_request", reason: "missing refresh_token" });
    return NextResponse.json(
      { error: "invalid_request", error_description: "Missing required field: refresh_token." },
      { status: 400 }
    );
  }
  return new URLSearchParams({
    refresh_token: body.refresh_token,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });
}

/**
 * Builds URLSearchParams for the authorization_code grant, or returns an error response.
 */
function buildAuthCodeParams(
  body: AuthCodeRequestBody,
  clientId: string,
  clientSecret: string,
): URLSearchParams | NextResponse {
  const { code, code_verifier, redirect_uri } = body;
  if (!code || !code_verifier || !redirect_uri) {
    log.debug("POST /api/auth/token returning", { status: 400, error: "invalid_request", reason: "missing fields" });
    return NextResponse.json(
      { error: "invalid_request", error_description: "Missing required fields: code, code_verifier, redirect_uri." },
      { status: 400 }
    );
  }
  if (!isAllowedRedirectUri(redirect_uri)) {
    log.debug("POST /api/auth/token returning", { status: 400, error: "invalid_request", reason: "redirect_uri not whitelisted" });
    return NextResponse.json(
      { error: "invalid_request", error_description: "redirect_uri origin is not whitelisted." },
      { status: 400 }
    );
  }
  return new URLSearchParams({
    code,
    code_verifier,
    redirect_uri,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
  });
}

/**
 * Issue #1722: Initialize trial server-side after a successful auth code exchange.
 * Fire-and-forget: failures are logged but do not block the token response.
 */
async function initTrialFromAuthCode(responseBody: string): Promise<void> {
  try {
    const tokenData = JSON.parse(responseBody) as { id_token?: string };
    if (!tokenData.id_token) return;

    // Decode id_token payload (base64url middle segment) to get user claims.
    const parts = tokenData.id_token.split(".");
    if (parts.length !== 3) return;

    const payload = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const decoded = Buffer.from(padded, "base64").toString("utf-8");
    const claims = JSON.parse(decoded) as { sub?: string; email?: string; name?: string };

    if (!claims.sub) return;
    await initTrialForUser({
      userId: claims.sub,
      email: claims.email ?? "",
      displayName: claims.name ?? "",
    });
    log.debug("POST /api/auth/token: trial init completed", { userId: claims.sub });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn("POST /api/auth/token: trial init failed (non-blocking)", { error: message });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  log.debug("POST /api/auth/token called", { ip });

  // Rate limit by IP — 10 requests per minute per IP address.
  const { success, retryAfter } = rateLimit(`token:${ip}`, { limit: 10, windowMs: 60_000 });
  if (!success) {
    log.debug("POST /api/auth/token returning", { status: 429, error: "rate_limited", retryAfter });
    return NextResponse.json(
      { error: "rate_limited", error_description: "Too many requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfter ?? 60) } }
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
  const paramsOrError = isRefreshRequest(body)
    ? buildRefreshParams(body, clientId, clientSecret)
    : buildAuthCodeParams(body, clientId, clientSecret);

  if (paramsOrError instanceof NextResponse) return paramsOrError;
  const params = paramsOrError;

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
  // Fire-and-forget: trial init failures are logged but don't block the token response.
  if (googleResponse.ok && grantType === "authorization_code") {
    await initTrialFromAuthCode(responseBody);
  }

  // Issue #2060: On authorization_code exchange, mint a Fenrir JWT and return it
  // as the session credential. The Google id_token is verified once here; from
  // this point on, only the Fenrir JWT is used for session identity.
  if (googleResponse.ok && grantType === "authorization_code") {
    const fenrirResponse = await mintFenrirSessionResponse(responseBody);
    if (fenrirResponse) {
      log.debug("POST /api/auth/token returning Fenrir session", { grantType });
      return fenrirResponse;
    }
    // If minting fails (e.g., KMS not initialised), fall through to return Google tokens.
    // This prevents login breakage if KMS is misconfigured — the client can handle the
    // missing fenrir_token field gracefully.
    log.warn("POST /api/auth/token: Fenrir JWT minting failed, returning raw Google response");
  }

  log.debug("POST /api/auth/token returning", { status: googleResponse.status, grantType });
  return new NextResponse(responseBody, {
    status: googleResponse.status,
    headers: { "Content-Type": "application/json" },
  });
}

// ─── Fenrir JWT minting ────────────────────────────────────────────────────────

/**
 * Parses the Google token response, mints a Fenrir JWT, and returns a combined
 * session response: { fenrir_token, access_token, refresh_token, expires_in, user }.
 *
 * Returns null if parsing fails or Fenrir JWT minting throws.
 */
async function mintFenrirSessionResponse(googleResponseBody: string): Promise<NextResponse | null> {
  try {
    const tokenData = JSON.parse(googleResponseBody) as {
      access_token?: string;
      id_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!tokenData.id_token) {
      log.warn("mintFenrirSessionResponse: no id_token in Google response");
      return null;
    }

    // Decode id_token payload to get user claims (no signature check needed here —
    // the token was received directly from Google's token endpoint over HTTPS).
    const parts = tokenData.id_token.split(".");
    if (parts.length !== 3) return null;

    const payloadB64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const padded = payloadB64 + "=".repeat((4 - (payloadB64.length % 4)) % 4);
    const claims = JSON.parse(Buffer.from(padded, "base64").toString("utf-8")) as {
      sub?: string;
      email?: string;
      name?: string;
      picture?: string;
    };

    if (!claims.sub) {
      log.warn("mintFenrirSessionResponse: missing sub in id_token claims");
      return null;
    }

    // Mint the Fenrir JWT. householdId defaults to sub — Firestore may have a
    // different value for users who joined another household, but requireAuthz
    // always resolves it from Firestore on every request.
    const fenrirToken = await signFenrirJwt(
      claims.sub,
      claims.email ?? "",
      claims.sub, // householdId defaults to sub
    );

    const sessionResponse = {
      fenrir_token: fenrirToken,
      access_token: tokenData.access_token ?? "",
      refresh_token: tokenData.refresh_token,
      // expires_in reflects Fenrir JWT lifetime (30 days), not Google's 1 hour
      expires_in: JWT_LIFETIME_S,
      user: {
        sub: claims.sub,
        email: claims.email ?? "",
        name: claims.name ?? "",
        picture: claims.picture ?? "",
      },
    };

    log.debug("mintFenrirSessionResponse: minted Fenrir session", { sub: claims.sub });
    return NextResponse.json(sessionResponse, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("mintFenrirSessionResponse: failed", { error: message });
    return null;
  }
}
