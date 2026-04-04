/**
 * Session Utilities — Fenrir Ledger
 *
 * After issue #2060: Fenrir JWTs (30-day HS256 tokens) replace Google id_tokens
 * as the session credential. Sessions extend automatically via server-side sliding
 * window refresh (X-Fenrir-Token response header in API calls), with no background
 * timers or explicit refresh endpoints.
 *
 * This module retains:
 *  - `isTokenStale()` — checks Fenrir JWT expiry from stored session
 *  - `ensureFreshToken()` — returns the stored Fenrir JWT (replaces Google id_token flow)
 *  - `refreshSession()` — legacy alias; use ensureFreshToken() for new code
 *  - `refreshGoogleAccessToken()` — refreshes Google API tokens for Sheets import
 *    and Google Picker (NOT for session identity)
 *
 * After issue #2060: `ensureFreshToken()` returns `session.fenrir_token` directly.
 * No network call is needed — Fenrir JWTs are 30-day tokens. Sliding window refresh
 * is handled server-side via X-Fenrir-Token response header on every API call.
 *
 * See issue #2060 for the full migration.
 */

import type { FenrirSession } from "@/lib/types";
import { getSession } from "./session";

/** Buffer before expiry to consider the Fenrir JWT stale (5 minutes). */
const STALE_BUFFER_MS = 5 * 60 * 1000;

/**
 * Returns true if the stored Fenrir JWT is expired or about to expire.
 * Used by AuthContext on mount to decide whether to treat the session as valid.
 *
 * @param session - The stored FenrirSession (or null)
 */
export function isTokenStale(session: FenrirSession | null): boolean {
  if (!session) return true;
  return session.expires_at <= Date.now() + STALE_BUFFER_MS;
}

/**
 * Returns the stored Fenrir JWT for use as a Bearer token on Fenrir API calls.
 *
 * After issue #2060: no network call is needed. Fenrir JWTs are 30-day tokens.
 * Sliding window refresh happens server-side (X-Fenrir-Token response header).
 *
 * @returns The fenrir_token string, or null if no valid session exists.
 */
export async function ensureFreshToken(): Promise<string | null> {
  const session = getSession();
  return session?.fenrir_token ?? null;
}

/**
 * @deprecated Use ensureFreshToken() instead.
 * Legacy alias retained for callers that used refreshSession() for session renewal.
 * After issue #2060, session renewal is handled server-side via sliding window.
 * Returns the stored Fenrir JWT (same as ensureFreshToken()).
 */
export async function refreshSession(): Promise<FenrirSession | null> {
  const session = getSession();
  return session ?? null;
}

/** Server-side token proxy — used only for Google API access token refresh. */
const TOKEN_PROXY_URL = "/api/auth/token";

/**
 * Singleton in-flight promise for Google API token refresh.
 * Prevents concurrent refresh races when multiple requests trigger simultaneously.
 */
let _googleRefreshInFlight: Promise<string | null> | null = null;

/**
 * Refreshes the Google OAuth access_token using the stored refresh_token.
 * Used ONLY for Google API calls (Sheets import, Google Picker) — NOT for
 * session identity (Fenrir JWT handles sessions after issue #2060).
 *
 * @returns A fresh Google access_token, or null if refresh failed.
 */
export async function refreshGoogleAccessToken(): Promise<string | null> {
  if (_googleRefreshInFlight) return _googleRefreshInFlight;

  _googleRefreshInFlight = _doRefreshGoogleToken().finally(() => {
    _googleRefreshInFlight = null;
  });
  return _googleRefreshInFlight;
}

async function _doRefreshGoogleToken(): Promise<string | null> {
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
      console.error("[Fenrir] Google access token refresh failed:", response.status);
      return null;
    }

    const tokens = (await response.json()) as { access_token?: string };
    return tokens.access_token ?? null;
  } catch (err) {
    console.error("[Fenrir] Google access token refresh error:", err instanceof Error ? err.message : err);
    return null;
  }
}
