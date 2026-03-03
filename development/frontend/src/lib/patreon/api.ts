/**
 * Patreon API v2 client — server-side only.
 *
 * All communication with Patreon's API is proxied through our Next.js API routes.
 * This module provides the low-level functions for:
 *   - OAuth authorization code exchange
 *   - Access token refresh
 *   - Membership status checking
 *
 * Uses native fetch() — no Patreon SDK dependency.
 * Uses fenrir logger for structured logging with automatic secret masking.
 *
 * @module patreon/api
 */

import { log } from "@/lib/logger";
import type {
  PatreonTokenResponse,
  PatreonIdentityResponse,
  PatreonTier,
} from "./types";

/** Patreon OAuth token endpoint. */
const PATREON_TOKEN_URL = "https://www.patreon.com/api/oauth2/token";

/** Patreon API v2 identity endpoint with membership + campaign includes. */
const PATREON_IDENTITY_URL =
  "https://www.patreon.com/api/oauth2/v2/identity" +
  "?include=memberships.campaign" +
  "&fields%5Buser%5D=email,full_name" +
  "&fields%5Bmember%5D=patron_status,currently_entitled_amount_cents,campaign_lifetime_support_cents" +
  "&fields%5Bcampaign%5D=";

/**
 * Exchanges an OAuth authorization code for Patreon access and refresh tokens.
 *
 * @param code - The authorization code from the Patreon OAuth callback
 * @param redirectUri - The redirect URI used in the original authorization request
 * @returns Token response containing access_token, refresh_token, etc.
 * @throws Error if the exchange fails or credentials are missing
 */
export async function exchangeCode(
  code: string,
  redirectUri: string,
): Promise<PatreonTokenResponse> {
  log.debug("exchangeCode called", {
    codeLength: code.length,
    redirectUri,
  });

  const clientId = process.env.PATREON_CLIENT_ID;
  const clientSecret = process.env.PATREON_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    log.error("exchangeCode: missing Patreon credentials", {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
    });
    throw new Error("Patreon OAuth credentials are not configured.");
  }

  const params = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  log.debug("exchangeCode: posting to Patreon token endpoint", {
    clientIdLength: clientId.length,
    clientSecretLength: clientSecret.length,
  });

  const response = await fetch(PATREON_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    log.error("exchangeCode: Patreon token exchange failed", {
      status: response.status,
      body: errorBody,
    });
    throw new Error(
      `Patreon token exchange failed with status ${response.status}`,
    );
  }

  const tokenResponse = (await response.json()) as PatreonTokenResponse;
  log.debug("exchangeCode returning", {
    hasAccessToken: !!tokenResponse.access_token,
    hasRefreshToken: !!tokenResponse.refresh_token,
    expiresIn: tokenResponse.expires_in,
    scope: tokenResponse.scope,
  });
  return tokenResponse;
}

/**
 * Checks a user's membership status for a specific campaign.
 *
 * Calls the Patreon identity endpoint with membership includes, then
 * matches the membership to the specified campaign ID to determine
 * the user's tier and active status.
 *
 * @param accessToken - A valid Patreon access token
 * @param campaignId - The Patreon campaign ID to check membership for
 * @returns Object with tier, active status, and Patreon user ID
 */
export async function getMembership(
  accessToken: string,
  campaignId: string,
): Promise<{
  tier: PatreonTier;
  active: boolean;
  patreonUserId: string;
}> {
  log.debug("getMembership called", {
    accessTokenLength: accessToken.length,
    campaignId,
  });

  const response = await fetch(PATREON_IDENTITY_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    log.error("getMembership: Patreon identity API failed", {
      status: response.status,
      body: errorBody,
    });
    throw new Error(
      `Patreon identity API failed with status ${response.status}`,
    );
  }

  const identity = (await response.json()) as PatreonIdentityResponse;
  const patreonUserId = identity.data.id;

  log.debug("getMembership: identity fetched", {
    patreonUserId,
    includedCount: identity.included?.length ?? 0,
  });

  // Look through included resources for a membership matching our campaign.
  // We filter by campaignId to ensure only pledges to the Fenrir Ledger campaign
  // grant Karl tier — not pledges to unrelated creators.
  let tier: PatreonTier = "thrall";
  let active = false;

  if (identity.included) {
    for (const resource of identity.included) {
      if (resource.type === "member") {
        // Verify this membership belongs to the Fenrir Ledger campaign
        const memberCampaign = resource.relationships as
          | { campaign?: { data?: { id?: string } } }
          | undefined;
        const memberCampaignId = memberCampaign?.campaign?.data?.id;

        const patronStatus = resource.attributes.patron_status as
          | string
          | null;
        const amountCents =
          resource.attributes.currently_entitled_amount_cents as
            | number
            | undefined;

        log.debug("getMembership: checking member resource", {
          resourceId: resource.id,
          patronStatus,
          amountCents,
          memberCampaignId,
          expectedCampaignId: campaignId,
        });

        // Skip memberships that do not belong to the target campaign
        if (memberCampaignId !== campaignId) {
          log.debug("getMembership: skipping member — campaign mismatch", {
            resourceId: resource.id,
            memberCampaignId,
            expectedCampaignId: campaignId,
          });
          continue;
        }

        if (patronStatus === "active_patron") {
          active = true;
          // Any paying patron (amount > 0) is a Karl
          if (amountCents && amountCents > 0) {
            tier = "karl";
          }
        }
      }
    }
  }

  log.debug("getMembership returning", {
    tier,
    active,
    patreonUserId,
  });
  return { tier, active, patreonUserId };
}

/**
 * Refreshes an expired Patreon access token using a refresh token.
 *
 * @param refreshTokenValue - The Patreon refresh token
 * @returns New token response with fresh access_token and possibly new refresh_token
 * @throws Error if the refresh fails or credentials are missing
 */
export async function refreshToken(
  refreshTokenValue: string,
): Promise<PatreonTokenResponse> {
  log.debug("refreshToken called", {
    refreshTokenLength: refreshTokenValue.length,
  });

  const clientId = process.env.PATREON_CLIENT_ID;
  const clientSecret = process.env.PATREON_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    log.error("refreshToken: missing Patreon credentials", {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
    });
    throw new Error("Patreon OAuth credentials are not configured.");
  }

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshTokenValue,
    client_id: clientId,
    client_secret: clientSecret,
  });

  log.debug("refreshToken: posting to Patreon token endpoint");

  const response = await fetch(PATREON_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    log.error("refreshToken: Patreon token refresh failed", {
      status: response.status,
      body: errorBody,
    });
    throw new Error(
      `Patreon token refresh failed with status ${response.status}`,
    );
  }

  const tokenResponse = (await response.json()) as PatreonTokenResponse;
  log.debug("refreshToken returning", {
    hasAccessToken: !!tokenResponse.access_token,
    hasRefreshToken: !!tokenResponse.refresh_token,
    expiresIn: tokenResponse.expires_in,
  });
  return tokenResponse;
}
