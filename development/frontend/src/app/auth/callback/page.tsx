"use client";

/**
 * Auth Callback Page — /auth/callback
 *
 * Handles the redirect from Google's OAuth2 consent screen.
 * Expected URL params: ?code=<auth_code>&state=<csrf_state>
 *
 * Flow:
 *  1. Read { verifier, state, callbackUrl } from sessionStorage.
 *  2. Verify the state param matches to prevent CSRF.
 *  3. POST to /api/auth/token (server proxy) with code + code_verifier (PKCE).
 *     The server proxy forwards the request to Google with the client_secret,
 *     keeping the secret off the browser. The browser still owns the full
 *     PKCE flow (verifier, challenge, state).
 *  4. Decode the id_token JWT payload (base64url middle segment).
 *  5. Build a FenrirSession and write it to localStorage("fenrir:auth").
 *  6. Redirect to callbackUrl (default: /).
 *
 * See ADR-005 for the auth architecture decision.
 */

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { setSession } from "@/lib/auth/session";
import type { FenrirSession } from "@/lib/types";

/** sessionStorage key written by /sign-in */
const PKCE_SESSION_KEY = "fenrir:pkce";

/** Server-side token exchange proxy — keeps client_secret off the browser. */
const TOKEN_PROXY_URL = "/api/auth/token";

// ── id_token decoder ──────────────────────────────────────────────────────────

interface IdTokenClaims {
  sub: string;
  email: string;
  name: string;
  picture: string;
  exp: number;
}

/**
 * Decodes the payload of a JWT without verifying the signature.
 * Safe here because the token was received directly from Google's token
 * endpoint over HTTPS and the exchange was PKCE-protected.
 */
function decodeIdToken(idToken: string): IdTokenClaims {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid id_token format");
  }
  // Restore base64url padding before decoding.
  const payload = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
  const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
  const decoded = atob(padded);
  return JSON.parse(decoded) as IdTokenClaims;
}

// ── Callback URL validation ──────────────────────────────────────────────────

/**
 * Validates that a callback URL is safe to redirect to.
 * Prevents open-redirect attacks by ensuring the URL's origin matches the
 * current page's origin. Relative paths (e.g. "/dashboard") are always safe.
 */
function isSafeCallbackUrl(url: string): boolean {
  if (!url || url === "/") return true;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

type CallbackStatus = "exchanging" | "success" | "error";

function AuthCallbackContent() {
  const searchParams = useSearchParams();
  const [callbackStatus, setCallbackStatus] = useState<CallbackStatus>("exchanging");
  const [errorMessage, setErrorMessage] = useState<string>("");
  // Guard against React StrictMode double-mount: only one exchange should run.
  const exchangeStartedRef = useRef(false);

  useEffect(() => {
    // If an exchange is already in progress (StrictMode re-mount), skip silently
    // instead of falling through to the "PKCE data missing" error state.
    if (exchangeStartedRef.current) return;
    exchangeStartedRef.current = true;

    const code = searchParams.get("code");
    const stateParam = searchParams.get("state");
    const errorParam = searchParams.get("error");

    // Google returned an error (e.g., access_denied)
    if (errorParam) {
      setErrorMessage(`Google returned: ${errorParam}`);
      setCallbackStatus("error");
      return;
    }

    if (!code || !stateParam) {
      setErrorMessage("Missing code or state in callback URL.");
      setCallbackStatus("error");
      return;
    }

    // Read PKCE transient values stored by /sign-in
    const raw = sessionStorage.getItem(PKCE_SESSION_KEY);
    if (!raw) {
      setErrorMessage("PKCE session data missing. Please try signing in again.");
      setCallbackStatus("error");
      return;
    }

    let pkceData: { verifier: string; state: string; callbackUrl: string };
    try {
      pkceData = JSON.parse(raw) as typeof pkceData;
    } catch {
      setErrorMessage("Corrupt PKCE session data.");
      setCallbackStatus("error");
      return;
    }

    // CSRF check
    if (pkceData.state !== stateParam) {
      setErrorMessage("State mismatch — possible CSRF attack. Please sign in again.");
      setCallbackStatus("error");
      return;
    }

    // NOTE: PKCE data is NOT cleared here. It is cleared only after a successful
    // token exchange (below). This prevents a race condition where React StrictMode
    // double-mount or a re-render would find the data already cleared and flash
    // an error before the first mount's async exchange completes.

    const redirectUri = `${window.location.origin}/auth/callback`;

    // Exchange code for tokens via the server-side proxy.
    // The proxy adds the client_secret before forwarding to Google — the secret
    // never touches the browser.
    async function exchangeCode() {
      try {
        const response = await fetch(TOKEN_PROXY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: code!,
            code_verifier: pkceData.verifier,
            redirect_uri: redirectUri,
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Token exchange failed (${response.status}): ${text}`);
        }

        const tokens = (await response.json()) as {
          access_token: string;
          id_token: string;
          expires_in: number;
          refresh_token?: string; // only present on first consent (access_type=offline)
        };

        // Decode id_token to get user profile claims.
        const claims = decodeIdToken(tokens.id_token);

        const session: FenrirSession = {
          access_token: tokens.access_token,
          id_token: tokens.id_token,
          ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
          expires_at: Date.now() + tokens.expires_in * 1000,
          user: {
            sub: claims.sub,
            email: claims.email,
            name: claims.name,
            picture: claims.picture,
          },
        };

        setSession(session);

        // Clean up PKCE transient data only after successful exchange.
        sessionStorage.removeItem(PKCE_SESSION_KEY);

        // Silent merge: carry anonymous cards into the Google household
        const { getAnonHouseholdId } = await import("@/lib/auth/household");
        const { mergeAnonymousCards, isMergeComplete } = await import("@/lib/merge-anonymous");

        const anonId = getAnonHouseholdId();
        if (anonId && !isMergeComplete(anonId)) {
          const result = mergeAnonymousCards(session.user.sub, anonId);
          if (result.merged > 0) {
            sessionStorage.setItem("fenrir:merge-result", JSON.stringify(result));
          }
        }

        setCallbackStatus("success");

        // Redirect to the original destination (with origin validation).
        const destination = isSafeCallbackUrl(pkceData.callbackUrl)
          ? pkceData.callbackUrl
          : "/";
        window.location.href = destination;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[Fenrir] Auth callback error:", message);
        setErrorMessage(message);
        setCallbackStatus("error");
      }
    }

    exchangeCode();
    // Run only once on mount — searchParams content is stable for callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center flex flex-col items-center gap-4">
        {callbackStatus === "exchanging" && (
          <>
            <p className="font-display text-gold tracking-wide text-sm">
              Binding the oath...
            </p>
            <p className="text-muted-foreground font-body italic text-xs">
              Securing your passage through the Bifröst.
            </p>
          </>
        )}

        {callbackStatus === "success" && (
          <>
            <p className="font-display text-gold tracking-wide text-sm">
              The wolf is named.
            </p>
            <p className="text-muted-foreground font-body italic text-xs">
              Entering the hall...
            </p>
          </>
        )}

        {callbackStatus === "error" && (
          <>
            <p className="font-heading text-sm text-destructive uppercase tracking-wide">
              The Bifröst trembled
            </p>
            <p className="text-muted-foreground font-body text-xs max-w-xs">
              {errorMessage}
            </p>
            <a
              href="/sign-in"
              className="mt-2 text-sm text-gold hover:text-gold-bright font-heading tracking-wide underline underline-offset-4"
            >
              Return to the gate
            </a>
          </>
        )}
      </div>
    </div>
  );
}

// useSearchParams requires Suspense in Next.js 15 App Router static export.
export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="text-center flex flex-col items-center gap-4">
            <p className="font-display text-gold tracking-wide text-sm">
              Binding the oath...
            </p>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
