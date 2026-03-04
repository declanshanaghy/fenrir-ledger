/**
 * Patreon API v2 — Type Definitions
 *
 * Types for Patreon OAuth2, membership API, and webhook payloads.
 * Used exclusively by server-side code (API routes and the Patreon client).
 *
 * @module patreon/types
 */

// ---------------------------------------------------------------------------
// Tier model
// ---------------------------------------------------------------------------

/**
 * Subscription tier names using Norse-themed naming.
 * - thrall: Free tier (all current features, no Patreon required)
 * - karl: Paid supporter tier ($3-5/mo via Patreon)
 */
export type PatreonTier = "thrall" | "karl";

// ---------------------------------------------------------------------------
// OAuth token exchange
// ---------------------------------------------------------------------------

/** Response from POST https://www.patreon.com/api/oauth2/token */
export interface PatreonTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

// ---------------------------------------------------------------------------
// Identity + membership API
// ---------------------------------------------------------------------------

/** Top-level response from GET /api/oauth2/v2/identity?include=memberships */
export interface PatreonIdentityResponse {
  data: {
    id: string;
    attributes: {
      email?: string;
      full_name?: string;
    };
    type: "user";
  };
  included?: PatreonIncludedResource[];
}

/** A resource included in the identity response (membership or tier). */
export interface PatreonIncludedResource {
  id: string;
  type: "member" | "tier" | string;
  attributes: Record<string, unknown>;
  relationships?: Record<string, unknown>;
}

/** Extracted membership data from the included resources. */
export interface PatreonMember {
  /** Patreon patron status: active_patron, declined_patron, former_patron, etc. */
  patron_status: string | null;
  /** Array of tier IDs the patron is currently entitled to */
  currently_entitled_amount_cents: number;
  /** Campaign ID this membership belongs to */
  campaign_id?: string;
}

// ---------------------------------------------------------------------------
// Webhook payloads
// ---------------------------------------------------------------------------

/**
 * Patreon webhook event types that we handle.
 * See https://docs.patreon.com/#webhooks
 */
export type PatreonWebhookEvent =
  | "members:pledge:create"
  | "members:pledge:update"
  | "members:pledge:delete";

/** Patreon webhook payload structure (JSON:API format). */
export interface PatreonWebhookPayload {
  data: {
    id: string;
    type: "member";
    attributes: {
      patron_status: string | null;
      currently_entitled_amount_cents: number;
      email?: string;
      full_name?: string;
      pledge_relationship_start?: string;
      last_charge_date?: string;
      last_charge_status?: string;
    };
    relationships?: {
      user?: {
        data: { id: string; type: "user" };
      };
      campaign?: {
        data: { id: string; type: "campaign" };
      };
      currently_entitled_tiers?: {
        data: Array<{ id: string; type: "tier" }>;
      };
    };
  };
  included?: PatreonIncludedResource[];
  links?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Stored entitlement (Vercel KV)
// ---------------------------------------------------------------------------

/**
 * Entitlement record stored in Vercel KV.
 *
 * Keyed by Google user sub for authenticated users (`entitlement:{googleSub}`)
 * or by Patreon user ID for anonymous users (`entitlement:patreon:{patreonUserId}`).
 */
export interface StoredEntitlement {
  /** Current subscription tier */
  tier: PatreonTier;
  /** Whether the membership is currently active */
  active: boolean;
  /** Patreon user ID (for reverse lookup and re-verification) */
  patreonUserId: string;
  /** Encrypted Patreon access token (AES-256-GCM) */
  patreonAccessToken: string;
  /** Encrypted Patreon refresh token (AES-256-GCM) */
  patreonRefreshToken: string;
  /** ISO 8601 timestamp when Patreon was linked */
  linkedAt: string;
  /** ISO 8601 timestamp of last membership verification */
  checkedAt: string;
  /** Patreon campaign ID */
  campaignId: string;
}

// ---------------------------------------------------------------------------
// OAuth state token
// ---------------------------------------------------------------------------

/**
 * Decoded contents of the OAuth state parameter.
 *
 * For authenticated users, `googleSub` is the Google user sub and `mode` is `"authenticated"`.
 * For anonymous users (no Google sign-in), `googleSub` is `"anonymous"` and `mode` is `"anonymous"`.
 */
export interface PatreonOAuthState {
  /** Google user sub (identity), or `"anonymous"` for unauthenticated users */
  googleSub: string;
  /** CSRF nonce */
  nonce: string;
  /** Timestamp when state was created (for expiry) */
  createdAt: number;
  /** Whether the user was authenticated or anonymous when starting the flow */
  mode: "authenticated" | "anonymous";
}

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

/** Response from GET /api/patreon/membership */
export interface MembershipResponse {
  tier: PatreonTier;
  active: boolean;
  platform: "patreon";
  checkedAt: string;
  stale?: boolean;
  /** Patreon user ID — included when the user has a linked entitlement */
  userId?: string;
  /** ISO 8601 timestamp when Patreon was linked — included when linked */
  linkedAt?: string;
}
