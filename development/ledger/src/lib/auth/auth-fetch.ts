/**
 * authFetch — Authenticated Fetch Wrapper
 *
 * Drop-in replacement for fetch() that handles Google OAuth token lifecycle:
 *
 *   1. Calls ensureFreshToken() before every request — if the token is within
 *      5 minutes of expiry it is silently refreshed first.
 *   2. Injects Authorization: Bearer <token> into the request headers.
 *   3. On a 401 response: forces a refreshSession() and retries once with the
 *      new token (handles tokens that expire exactly mid-flight).
 *   4. If the token is unavailable (no session) or the retry also returns 401,
 *      and signOutOnFailure is true (default), redirects the user to /ledger/sign-in.
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

import { ensureFreshToken, refreshSession } from "./refresh-session";

export interface AuthFetchOptions extends RequestInit {
  /**
   * When true, redirects to /ledger/sign-in if the token is unavailable
   * or if the retry-on-401 also fails.
   * Default: false — callers handle the response/null themselves.
   */
  signOutOnFailure?: boolean;
}

/**
 * Makes an authenticated fetch request with automatic token refresh.
 * Returns the Response from fetch, or null if auth failed and signOutOnFailure=false.
 */
export async function authFetch(
  url: string,
  options?: AuthFetchOptions,
): Promise<Response | null> {
  const { signOutOnFailure = false, ...fetchOptions } = options ?? {};

  // Step 1: Ensure we have a fresh token (refreshes if within 5-min buffer)
  const token = await ensureFreshToken();

  if (!token) {
    if (signOutOnFailure && typeof window !== "undefined") {
      const returnTo = encodeURIComponent(window.location.pathname);
      window.location.href = `/ledger/sign-in?returnTo=${returnTo}`;
    }
    return null;
  }

  // Step 2: Inject Authorization header
  const headers = new Headers(fetchOptions.headers);
  headers.set("Authorization", `Bearer ${token}`);

  // Step 3: Make the request
  let response = await fetch(url, { ...fetchOptions, headers });

  // Step 4: On 401, force a refresh and retry once
  if (response.status === 401) {
    const refreshed = await refreshSession();
    const retryToken = refreshed?.id_token;

    if (retryToken) {
      headers.set("Authorization", `Bearer ${retryToken}`);
      response = await fetch(url, { ...fetchOptions, headers });
    }

    // If retry still 401 (or no token after refresh), handle auth failure
    if (response.status === 401) {
      if (signOutOnFailure && typeof window !== "undefined") {
        const returnTo = encodeURIComponent(window.location.pathname);
        window.location.href = `/ledger/sign-in?returnTo=${returnTo}`;
      }
      return response;
    }
  }

  return response;
}
