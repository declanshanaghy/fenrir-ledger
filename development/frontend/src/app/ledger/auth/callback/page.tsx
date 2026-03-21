"use client";

/**
 * Auth Callback Page — /ledger/auth/callback
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
import { validateReturnTo } from "@/lib/auth/sign-in-url";
import { track } from "@/lib/analytics/track";
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

// ── Component ─────────────────────────────────────────────────────────────────

type CallbackStatus = "exchanging" | "success" | "error" | "trial-expired";

function AuthCallbackContent() {
  const searchParams = useSearchParams();
  const [callbackStatus, setCallbackStatus] = useState<CallbackStatus>("exchanging");
  const [errorMessage, setErrorMessage] = useState<string>("");
  // Guard against React StrictMode double-mount: only one exchange should run.
  const exchangeStartedRef = useRef(false);
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  useEffect(() => {
    // Set mounted flag on mount and clear on unmount
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
      if (isMountedRef.current) {
        setErrorMessage(`Google returned: ${errorParam}`);
        setCallbackStatus("error");
      }
      return;
    }

    if (!code || !stateParam) {
      if (isMountedRef.current) {
        setErrorMessage("Missing code or state in callback URL.");
        setCallbackStatus("error");
      }
      return;
    }

    // Read PKCE transient values stored by /sign-in
    const raw = sessionStorage.getItem(PKCE_SESSION_KEY);
    if (!raw) {
      // Add a small delay to prevent flash in case of race condition
      setTimeout(() => {
        if (isMountedRef.current && !sessionStorage.getItem(PKCE_SESSION_KEY)) {
          setErrorMessage("PKCE session data missing. Please try signing in again.");
          setCallbackStatus("error");
        }
      }, 100);
      return;
    }

    let pkceData: { verifier: string; state: string; callbackUrl: string };
    try {
      pkceData = JSON.parse(raw) as typeof pkceData;
    } catch {
      if (isMountedRef.current) {
        setErrorMessage("Corrupt PKCE session data.");
        setCallbackStatus("error");
      }
      return;
    }

    // CSRF check
    if (pkceData.state !== stateParam) {
      if (isMountedRef.current) {
        setErrorMessage("State mismatch — possible CSRF attack. Please sign in again.");
        setCallbackStatus("error");
      }
      return;
    }

    // NOTE: PKCE data is NOT cleared here. It is cleared only after a successful
    // token exchange (below). This prevents a race condition where React StrictMode
    // double-mount or a re-render would find the data already cleared and flash
    // an error before the first mount's async exchange completes.

    const redirectUri = `${window.location.origin}/ledger/auth/callback`;

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

        // Track auth event — refresh_token is only present on first consent (signup).
        if (tokens.refresh_token) {
          track("auth-signup");
        } else {
          track("auth-login");
        }

        // Clean up PKCE transient data only after successful exchange.
        sessionStorage.removeItem(PKCE_SESSION_KEY);

        // Silent merge: carry anonymous cards into the Google household.
        // Issue #1671: reads from fixed "anon" key + legacy UUID key (backward compat).
        // Wrapped in its own try/catch — merge failures must NOT prevent trial init.
        // Issue #1707: merge throwing was the root cause of trial init never running.
        try {
          const { mergeAnonymousCards } = await import("@/lib/merge-anonymous");
          const result = mergeAnonymousCards(session.user.sub);
          if (result.merged > 0) {
            sessionStorage.setItem("fenrir:merge-result", JSON.stringify(result));
          }
        } catch (mergeErr) {
          console.error(
            "[Fenrir] Anonymous card merge failed (non-fatal):",
            mergeErr instanceof Error ? mergeErr.message : String(mergeErr)
          );
        }

        // Initialize trial for this Google account (issue #1637).
        // Idempotent for active/converted trials.
        // On 409 (expired restart blocked): show message — user continues in Thrall tier.
        try {
          const trialResponse = await fetch("/api/trial/init", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.id_token}`,
            },
            body: JSON.stringify({}),
          });
          if (trialResponse.status === 409) {
            if (isMountedRef.current) {
              setErrorMessage(
                "Your free trial has ended. Contact customer service to discuss options."
              );
              setCallbackStatus("trial-expired");
            }
            return;
          }
        } catch {
          // Trial init is best-effort — don't block login flow
        }

        // Don't show the success state - keep the exchanging state visible
        // until redirect completes to avoid rapid visual transitions.
        // The success state would only flash briefly before redirect anyway.

        // Redirect to the original destination (with security validation).
        // validateReturnTo ensures relative paths only — no open redirects.
        const destination = validateReturnTo(pkceData.callbackUrl);

        // Use replace instead of href to prevent back button issues
        window.location.replace(destination);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[Fenrir] Auth callback error:", message);
        // Only update state if component is still mounted
        if (isMountedRef.current) {
          setErrorMessage(message);
          setCallbackStatus("error");
        }
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
            <p className="font-display text-gold tracking-wide text-base">
              Binding the oath...
            </p>
            <p className="text-muted-foreground font-body italic text-sm">
              Securing your passage through the Bifröst.
            </p>
          </>
        )}

        {/* Success state removed - we now keep exchanging state until redirect */}

        {callbackStatus === "error" && (
          <>
            <p className="font-heading text-base text-destructive uppercase tracking-wide">
              The Bifröst trembled
            </p>
            <p className="text-muted-foreground font-body text-sm max-w-xs">
              {errorMessage}
            </p>
            <a
              href="/ledger/sign-in"
              className="mt-2 text-base text-gold hover:text-primary hover:brightness-110 font-heading tracking-wide underline underline-offset-4"
            >
              Return to the gate
            </a>
          </>
        )}

        {callbackStatus === "trial-expired" && (
          <>
            <p className="font-heading text-base text-destructive uppercase tracking-wide">
              Trial Ended
            </p>
            <p className="text-muted-foreground font-body text-sm max-w-xs">
              {errorMessage}
            </p>
            <a
              href="/ledger"
              className="mt-2 text-base text-gold hover:text-primary hover:brightness-110 font-heading tracking-wide underline underline-offset-4"
            >
              Continue to the ledger
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
            <p className="font-display text-gold tracking-wide text-base">
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
