/**
 * Silent Token Refresh — Fenrir Ledger
 *
 * Refreshes the Google id_token + access_token using the stored refresh_token,
 * without redirecting the user. Called before API requests when the current
 * id_token is close to expiry.
 *
 * Flow:
 *   1. Read refresh_token from the stored session
 *   2. POST to /api/auth/token with { refresh_token } (server adds client_secret)
 *   3. Google returns new access_token + id_token (refresh_token is NOT rotated)
 *   4. Decode the new id_token and update the session in localStorage
 *
 * Google refresh token notes:
 *   - refresh_token is only issued on the first consent (access_type=offline)
 *   - Google does NOT rotate refresh_tokens on refresh — the same token works
 *     until the user revokes access or 6 months of inactivity
 *   - The new response does NOT include a refresh_token field — we keep the original
 */

import type { FenrirSession } from "@/lib/types";
import { getSession, setSession } from "./session";

/** Server-side token proxy. */
const TOKEN_PROXY_URL = "/api/auth/token";

/**
 * Singleton in-flight refresh promise.
 * Prevents concurrent refresh races when multiple requests trigger a refresh simultaneously.
 * Cleared when the refresh settles (success or failure).
 */
let _refreshInFlight: Promise<FenrirSession | null> | null = null;

/** Buffer before expiry to trigger refresh (5 minutes). */
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/**
 * Decodes the payload of a JWT without verifying the signature.
 * Safe here because the token was received directly from Google's token
 * endpoint over HTTPS via our server-side proxy.
 */
function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");
  const payload = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
  const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
  return JSON.parse(atob(padded)) as Record<string, unknown>;
}

/**
 * Checks whether the current session's id_token is expired or close to expiry.
 * Returns true if the token should be refreshed.
 */
export function isTokenStale(session: FenrirSession | null): boolean {
  if (!session) return true;

  // Check expires_at from session (set at login from expires_in)
  if (session.expires_at <= Date.now() + REFRESH_BUFFER_MS) {
    return true;
  }

  // Also check the actual JWT exp claim for extra safety
  try {
    const payload = decodeJwtPayload(session.id_token);
    const exp = payload.exp as number | undefined;
    if (exp && exp * 1000 <= Date.now() + REFRESH_BUFFER_MS) {
      return true;
    }
  } catch {
    // If we can't decode, treat as stale
    return true;
  }

  return false;
}

/**
 * Silently refreshes the session tokens using the stored refresh_token.
 * Deduplicates concurrent calls — multiple callers racing on a stale token
 * will all await the same single refresh request rather than issuing many.
 *
 * @returns The refreshed session, or null if refresh failed (no refresh_token,
 *          network error, or Google rejected the refresh).
 */
export async function refreshSession(): Promise<FenrirSession | null> {
  // Return the in-flight promise if a refresh is already underway
  if (_refreshInFlight) return _refreshInFlight;

  _refreshInFlight = _doRefreshSession().finally(() => {
    _refreshInFlight = null;
  });
  return _refreshInFlight;
}

async function _doRefreshSession(): Promise<FenrirSession | null> {
  const session = getSession();
  if (!session?.refresh_token) {
    return null;
  }

  try {
    const response = await fetch(TOKEN_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });

    if (!response.ok) {
      console.error("[Fenrir] Token refresh failed:", response.status);
      return null;
    }

    const tokens = (await response.json()) as {
      access_token: string;
      id_token: string;
      expires_in: number;
      // refresh_token is NOT returned on refresh — Google keeps the original
    };

    // Decode the new id_token for user claims
    const claims = decodeJwtPayload(tokens.id_token);

    const refreshed: FenrirSession = {
      access_token: tokens.access_token,
      id_token: tokens.id_token,
      // Keep the original refresh_token (Google doesn't rotate it)
      refresh_token: session.refresh_token,
      expires_at: Date.now() + tokens.expires_in * 1000,
      user: {
        sub: claims.sub as string,
        email: claims.email as string,
        name: claims.name as string,
        picture: claims.picture as string,
      },
    };

    setSession(refreshed);
    return refreshed;
  } catch (err) {
    console.error("[Fenrir] Token refresh error:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Ensures the session has a fresh id_token. If the current token is stale
 * and a refresh_token is available, silently refreshes in the background.
 *
 * @returns The current (or refreshed) id_token, or null if no valid session.
 */
export async function ensureFreshToken(): Promise<string | null> {
  const session = getSession();
  if (!session) return null;

  if (!isTokenStale(session)) {
    return session.id_token;
  }

  // Token is stale — attempt silent refresh
  const refreshed = await refreshSession();
  return refreshed?.id_token ?? null;
}
