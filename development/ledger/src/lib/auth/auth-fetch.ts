/**
 * authFetch — Authenticated Fetch Wrapper
 *
 * Drop-in replacement for fetch() that handles Fenrir JWT session lifecycle:
 *
 *   1. Reads the Fenrir JWT (fenrir_token) from the stored session.
 *   2. Injects Authorization: Bearer <fenrir_token> into the request headers.
 *   3. On a successful response, checks for `X-Fenrir-Token` — if present, the
 *      server has issued a sliding-window refresh; the new token is swapped in
 *      transparently (no background timers, no separate refresh endpoint).
 *   4. On a 401 response: the Fenrir JWT is expired — the user must re-authenticate
 *      with Google. Redirects to sign-in if signOutOnFailure is true.
 *
 * Sliding window refresh (issue #2060):
 *   The server re-issues a new 30-day Fenrir JWT in the `X-Fenrir-Token` header
 *   when the existing JWT is older than 15 days. This client detects it and
 *   persists the new token to localStorage transparently.
 *   No setInterval, no visibilitychange listeners, no proactive polling.
 *
 * Usage:
 *   const res = await authFetch("/api/sync/push", {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify(payload),
 *   });
 *
 * Options:
 *   All standard RequestInit options are supported.
 *   signOutOnFailure (default: false) — redirect to sign-in if auth fails.
 *
 * Note: authFetch is only callable in browser contexts (requires localStorage).
 */

import { getSession, setSession } from "./session";
import type { FenrirSession } from "@/lib/types";

export interface AuthFetchOptions extends RequestInit {
  /**
   * When true, redirects to /ledger/sign-in if the token is unavailable
   * or if the request returns 401.
   * Default: false — callers handle the response/null themselves.
   */
  signOutOnFailure?: boolean;
}

/**
 * Swaps the stored Fenrir JWT with the new token from a sliding-window refresh.
 * Preserves all other session fields (user, access_token, refresh_token).
 */
function swapFenrirToken(newToken: string): void {
  const session = getSession();
  if (!session) return;

  // Decode exp from the new JWT to update expires_at
  try {
    const parts = newToken.split(".");
    if (parts.length === 3) {
      const payload = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
      const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
      const decoded = JSON.parse(atob(padded)) as { exp?: number };
      const expiresAt = decoded.exp ? decoded.exp * 1000 : session.expires_at;
      const updated: FenrirSession = { ...session, fenrir_token: newToken, expires_at: expiresAt };
      setSession(updated);
      return;
    }
  } catch {
    // Fallback: swap token without updating expires_at
  }

  setSession({ ...session, fenrir_token: newToken });
}

/**
 * Makes an authenticated fetch request using the stored Fenrir JWT.
 * Detects X-Fenrir-Token sliding-window refresh and swaps the token transparently.
 * Returns the Response from fetch, or null if no session and signOutOnFailure=false.
 */
export async function authFetch(
  url: string,
  options?: AuthFetchOptions,
): Promise<Response | null> {
  const { signOutOnFailure = false, ...fetchOptions } = options ?? {};

  const session = getSession();
  const token = session?.fenrir_token ?? null;

  if (!token) {
    if (signOutOnFailure && typeof window !== "undefined") {
      const returnTo = encodeURIComponent(window.location.pathname);
      window.location.href = `/ledger/sign-in?returnTo=${returnTo}`;
    }
    return null;
  }

  // Inject Authorization header
  const headers = new Headers(fetchOptions.headers);
  headers.set("Authorization", `Bearer ${token}`);

  // Make the request
  const response = await fetch(url, { ...fetchOptions, headers });

  // On 401: Fenrir JWT is expired — must re-authenticate with Google
  if (response.status === 401) {
    if (signOutOnFailure && typeof window !== "undefined") {
      const returnTo = encodeURIComponent(window.location.pathname);
      window.location.href = `/ledger/sign-in?returnTo=${returnTo}`;
    }
    return response;
  }

  // Sliding window refresh: swap in the new Fenrir JWT if provided
  const refreshedToken = response.headers.get("X-Fenrir-Token");
  if (refreshedToken) {
    swapFenrirToken(refreshedToken);
  }

  return response;
}
