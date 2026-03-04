/**
 * GET /api/patreon/callback
 *
 * OAuth callback handler for the Patreon linking flow.
 *
 * NOT behind requireAuth — the user is mid-OAuth flow, redirected here from
 * Patreon. This follows the same exemption pattern as /api/auth/token.
 * CSRF protection is provided by the encrypted state parameter.
 *
 * Flow:
 *   1. Patreon redirects here with ?code=...&state=...
 *   2. Validate state parameter (decrypt, check expiry, extract Google sub)
 *   3. Exchange authorization code for Patreon tokens
 *   4. Fetch membership status from Patreon API
 *   5. Encrypt tokens, store entitlement + tokens in Vercel KV
 *   6. Redirect to /settings?patreon=linked&tier={tier} on success
 *   7. Redirect to /settings?patreon=error&reason={code} on failure
 */

import { NextRequest, NextResponse } from "next/server";
import { validateState } from "@/lib/patreon/state";
import { exchangeCode, getMembership } from "@/lib/patreon/api";
import { encrypt } from "@/lib/crypto/encrypt";
import { setEntitlement } from "@/lib/kv/entitlement-store";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import type { StoredEntitlement } from "@/lib/patreon/types";

/**
 * Builds the application base URL.
 * Prefers APP_BASE_URL env var for deterministic URLs in production (SEV-002 fix).
 * Falls back to header-based detection for preview deployments and local development.
 */
function getBaseUrl(request: NextRequest): string {
  log.debug("getBaseUrl called");
  const appBaseUrl = process.env.APP_BASE_URL;
  if (appBaseUrl) {
    log.debug("getBaseUrl returning (APP_BASE_URL)", { url: appBaseUrl });
    return appBaseUrl;
  }
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("host") ?? "localhost:9653";
  const url = `${proto}://${host}`;
  log.debug("getBaseUrl returning (header fallback)", { url });
  return url;
}

/**
 * Builds the redirect URI that was used for the original authorize request.
 * Must match exactly what was sent to Patreon.
 */
function buildRedirectUri(request: NextRequest): string {
  log.debug("buildRedirectUri called");
  const uri = `${getBaseUrl(request)}/api/patreon/callback`;
  log.debug("buildRedirectUri returning", { uri });
  return uri;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  log.debug("GET /api/patreon/callback called");

  // Rate limit by IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success: rateLimitOk } = rateLimit(`patreon-callback:${ip}`, {
    limit: 10,
    windowMs: 60_000,
  });
  if (!rateLimitOk) {
    log.debug("GET /api/patreon/callback returning", {
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

  const baseUrl = getBaseUrl(request);
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");

  // --- Handle user denial ---
  const error = searchParams.get("error");
  if (error) {
    log.debug("GET /api/patreon/callback: user denied or error", { error });
    log.debug("GET /api/patreon/callback returning", {
      status: 302,
      redirect: "settings?patreon=denied",
    });
    return NextResponse.redirect(`${baseUrl}/settings?patreon=denied`);
  }

  // --- Validate required params ---
  if (!code || !stateParam) {
    log.debug("GET /api/patreon/callback returning", {
      status: 302,
      redirect: "settings?patreon=error",
      reason: "missing code or state",
    });
    return NextResponse.redirect(
      `${baseUrl}/settings?patreon=error&reason=invalid_request`,
    );
  }

  // --- Validate state (CSRF protection + Google sub extraction) ---
  const state = validateState(stateParam);
  if (!state) {
    log.debug("GET /api/patreon/callback returning", {
      status: 302,
      redirect: "settings?patreon=error&reason=state_mismatch",
    });
    return NextResponse.redirect(
      `${baseUrl}/settings?patreon=error&reason=state_mismatch`,
    );
  }

  const { googleSub } = state;
  log.debug("GET /api/patreon/callback: state validated", { googleSub });

  try {
    // --- Exchange authorization code for tokens ---
    const redirectUri = buildRedirectUri(request);
    const tokens = await exchangeCode(code, redirectUri);

    // --- Fetch membership status ---
    const campaignId = process.env.PATREON_CAMPAIGN_ID;
    if (!campaignId) {
      log.error("GET /api/patreon/callback: PATREON_CAMPAIGN_ID not configured");
      log.debug("GET /api/patreon/callback returning", {
        status: 302,
        redirect: "settings?patreon=error&reason=server_error",
      });
      return NextResponse.redirect(
        `${baseUrl}/settings?patreon=error&reason=server_error`,
      );
    }

    // Fetch membership — if this fails (e.g. creator account, API error),
    // still link the account as thrall rather than failing the entire flow.
    let membership: { tier: "thrall" | "karl"; active: boolean; patreonUserId: string };
    try {
      membership = await getMembership(tokens.access_token, campaignId);
    } catch (membershipErr) {
      log.error("GET /api/patreon/callback: getMembership failed, linking as thrall", {
        error: membershipErr instanceof Error ? membershipErr.message : String(membershipErr),
      });
      // Extract patreonUserId from a simpler identity call as fallback
      let patreonUserId = "unknown";
      try {
        const idResp = await fetch("https://www.patreon.com/api/oauth2/v2/identity", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (idResp.ok) {
          const idData = await idResp.json() as { data: { id: string } };
          patreonUserId = idData.data.id;
        }
      } catch { /* best-effort */ }
      membership = { tier: "thrall", active: false, patreonUserId };
    }

    // --- Encrypt tokens for KV storage ---
    const encryptedAccessToken = encrypt(tokens.access_token);
    const encryptedRefreshToken = encrypt(tokens.refresh_token);

    // --- Store entitlement in Vercel KV ---
    const now = new Date().toISOString();
    const entitlement: StoredEntitlement = {
      tier: membership.tier,
      active: membership.active,
      patreonUserId: membership.patreonUserId,
      patreonAccessToken: encryptedAccessToken,
      patreonRefreshToken: encryptedRefreshToken,
      linkedAt: now,
      checkedAt: now,
      campaignId,
    };

    await setEntitlement(googleSub, entitlement);

    log.debug("GET /api/patreon/callback returning", {
      status: 302,
      redirect: `settings?patreon=linked&tier=${membership.tier}`,
      googleSub,
      tier: membership.tier,
      active: membership.active,
    });

    return NextResponse.redirect(
      `${baseUrl}/settings?patreon=linked&tier=${membership.tier}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    log.error("GET /api/patreon/callback: flow failed", {
      googleSub,
      error: message,
      stack,
    });
    // Encode a sanitized reason into the redirect for debugging.
    // Strip secrets/tokens but keep the error category.
    const reason = message.includes("token exchange")
      ? "token_exchange_failed"
      : message.includes("identity API")
        ? "membership_check_failed"
        : message.includes("ENTITLEMENT_ENCRYPTION_KEY")
          ? "encryption_key_error"
          : "oauth_failed";
    log.debug("GET /api/patreon/callback returning", {
      status: 302,
      redirect: `settings?patreon=error&reason=${reason}`,
    });
    return NextResponse.redirect(
      `${baseUrl}/settings?patreon=error&reason=${reason}`,
    );
  }
}
