/**
 * Fenrir JWT — sign and verify server-issued session tokens
 *
 * Fenrir JWTs are HS256 tokens signed with the secret from KMS (via getJwtSecret()).
 * They replace Google id_tokens as the ongoing session credential after login.
 *
 * Lifetime: 30 days. Sliding window: re-issued when age > 15 days.
 * Payload: { sub, email, householdId, iat, exp }
 *
 * Sign: uses jose SignJWT (Edge + Node compatible)
 * Verify: uses jose jwtVerify with the module-cached KMS secret
 *
 * Server-only — never import from client components.
 * See instrumentation.ts for initJwtSecret() startup call.
 */

import { SignJWT, jwtVerify } from "jose";
import { getJwtSecret } from "./kms";
import { log } from "@/lib/logger";

/** JWT lifetime: 30 days in seconds */
export const JWT_LIFETIME_S = 30 * 24 * 60 * 60;

/** Sliding window threshold: 15 days in seconds */
export const SLIDING_WINDOW_S = 15 * 24 * 60 * 60;

/** Claims embedded in every Fenrir JWT */
export interface FenrirJwtPayload {
  /** Google account immutable ID */
  sub: string;
  /** User email address */
  email: string;
  /** Household ID (defaults to sub for new users) */
  householdId: string;
  /** Issued-at (seconds) — set automatically by SignJWT */
  iat: number;
  /** Expiry (seconds) — set automatically by setExpirationTime */
  exp: number;
}

/**
 * Returns a Uint8Array HMAC key derived from the KMS-cached signing secret.
 * Called per-operation (not cached) since the secret is already in module memory.
 */
function getKey(): Uint8Array {
  return new TextEncoder().encode(getJwtSecret());
}

/**
 * Signs a new Fenrir JWT with a 30-day expiry.
 *
 * @param sub - Google account sub claim
 * @param email - User email address
 * @param householdId - Household ID (use sub for new users)
 * @returns Signed compact JWT string
 */
export async function signFenrirJwt(
  sub: string,
  email: string,
  householdId: string,
): Promise<string> {
  const token = await new SignJWT({ sub, email, householdId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${JWT_LIFETIME_S}s`)
    .sign(getKey());

  log.debug("signFenrirJwt: minted new token", { sub, email, householdId });
  return token;
}

/** Result type from verifyFenrirJwt() */
export type FenrirJwtResult =
  | { ok: true; payload: FenrirJwtPayload }
  | { ok: false; error: string; status: 401 | 500 };

/**
 * Verifies a Fenrir JWT and returns its payload.
 *
 * Checks: signature (HS256), expiry (exp).
 *
 * @param token - Compact JWT string from the Authorization header
 * @returns FenrirJwtResult
 */
export async function verifyFenrirJwt(token: string): Promise<FenrirJwtResult> {
  try {
    const { payload } = await jwtVerify(token, getKey());

    const fenrirPayload: FenrirJwtPayload = {
      sub: payload.sub as string,
      email: (payload as Record<string, unknown>).email as string,
      householdId: (payload as Record<string, unknown>).householdId as string,
      iat: payload.iat as number,
      exp: payload.exp as number,
    };

    log.debug("verifyFenrirJwt: verified", { sub: fenrirPayload.sub });
    return { ok: true, payload: fenrirPayload };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Token verification failed";
    log.warn("verifyFenrirJwt: failed", { error: message });

    if (message.includes("expired") || message.includes('"exp"')) {
      return { ok: false, error: "Token expired.", status: 401 };
    }
    return { ok: false, error: "Invalid token.", status: 401 };
  }
}

/**
 * Returns true if the token's age exceeds the sliding window threshold (15 days).
 * When true, the caller should re-issue a new JWT.
 *
 * @param iat - Issued-at timestamp in seconds
 */
export function needsSlidingRefresh(iat: number): boolean {
  const nowS = Math.floor(Date.now() / 1000);
  return nowS - iat > SLIDING_WINDOW_S;
}
