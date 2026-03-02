/**
 * Server-side Google id_token verification — Fenrir Ledger
 *
 * Uses jose to verify the JWT signature against Google's JWKS public keys,
 * check the `aud` claim matches GOOGLE_CLIENT_ID, and check `exp`.
 *
 * jose handles JWKS key caching and rotation transparently:
 *   - Keys are fetched once on first verification and cached in memory.
 *   - When an unknown `kid` is encountered, jose re-fetches the JWKS.
 *   - Google rotates keys roughly every 6 hours; this is handled automatically.
 *
 * This module is server-only. Never import from client components.
 *
 * See ADR-008 for the decision to use id_token + local JWKS verification.
 */

import { jwtVerify, createRemoteJWKSet } from "jose";

/** Google's public JWKS endpoint for verifying id_token signatures. */
const GOOGLE_JWKS_URL = new URL("https://www.googleapis.com/oauth2/v3/certs");

/**
 * Remote JWKS set — fetches and caches Google's public keys.
 * Instantiated once at module level (singleton across requests in the same
 * serverless function instance).
 */
const jwks = createRemoteJWKSet(GOOGLE_JWKS_URL);

/** Decoded user claims from a verified id_token. */
export interface VerifiedUser {
  /** Google account immutable ID (maps to householdId) */
  sub: string;
  /** User's email address */
  email: string;
  /** User's display name */
  name: string;
  /** Google CDN avatar URL */
  picture: string;
}

/** Discriminated union result from verifyIdToken(). */
export type VerifyResult =
  | { ok: true; user: VerifiedUser }
  | { ok: false; error: string; status: 401 | 403 | 500 };

/**
 * Verifies a Google id_token JWT.
 *
 * Checks:
 *   1. Signature — against Google's JWKS public keys
 *   2. Issuer   — must be "https://accounts.google.com" or "accounts.google.com"
 *   3. Audience — must match NEXT_PUBLIC_GOOGLE_CLIENT_ID
 *   4. Expiry   — must not be expired (jose checks `exp` automatically)
 *
 * @param token - The raw id_token JWT string from the Authorization header
 * @returns VerifyResult — either { ok: true, user } or { ok: false, error, status }
 */
export async function verifyIdToken(token: string): Promise<VerifyResult> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    console.error("[Fenrir] verifyIdToken: NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set");
    return { ok: false, error: "Auth not configured.", status: 500 };
  }

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: clientId,
    });

    return {
      ok: true,
      user: {
        sub: payload.sub as string,
        email: (payload as Record<string, unknown>).email as string,
        name: (payload as Record<string, unknown>).name as string,
        picture: (payload as Record<string, unknown>).picture as string,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Token verification failed";

    if (message.includes("expired") || message.includes('"exp"')) {
      return { ok: false, error: "Token expired.", status: 401 };
    }
    if (message.includes("audience") || message.includes('"aud"')) {
      return { ok: false, error: "Token audience mismatch.", status: 403 };
    }
    return { ok: false, error: "Invalid token.", status: 401 };
  }
}
