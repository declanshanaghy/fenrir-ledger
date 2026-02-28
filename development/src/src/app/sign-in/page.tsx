"use client";

/**
 * Sign-In Page — /sign-in
 *
 * Presents a "Sign in with Google" button that initiates the Authorization
 * Code + PKCE flow. No credentials are collected here — the browser
 * redirects to Google's consent screen.
 *
 * Flow:
 *  1. Generate code_verifier, code_challenge (S256), and state.
 *  2. Store { verifier, state, callbackUrl } in sessionStorage.
 *  3. Redirect to accounts.google.com/o/oauth2/v2/auth with PKCE params.
 *
 * The /auth/callback page handles the return redirect from Google.
 *
 * Copy: Norse atmospheric — Voice 2 from product/copywriting.md.
 */

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { generateCodeVerifier, generateCodeChallenge, generateState } from "@/lib/auth/pkce";
import { isSessionValid } from "@/lib/auth/session";

/** sessionStorage key for PKCE transient state */
const PKCE_SESSION_KEY = "fenrir:pkce";

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [alreadyAuthed, setAlreadyAuthed] = useState(false);

  // If there's already a valid session, bounce to callbackUrl immediately.
  useEffect(() => {
    if (isSessionValid()) {
      setAlreadyAuthed(true);
      window.location.href = callbackUrl;
    }
  }, [callbackUrl]);

  async function handleSignIn() {
    setIsRedirecting(true);

    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    const state = generateState();

    // Persist PKCE transient values in sessionStorage (survives the redirect).
    sessionStorage.setItem(
      PKCE_SESSION_KEY,
      JSON.stringify({ verifier, state, callbackUrl })
    );

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error("[Fenrir] NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set");
      setIsRedirecting(false);
      return;
    }

    const redirectUri = `${window.location.origin}/auth/callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  if (alreadyAuthed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground font-body italic text-sm">
          Crossing the Bifröst...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">

        {/* Brand */}
        <div className="text-center">
          <h1 className="font-display text-3xl text-gold tracking-widest uppercase mb-2">
            Fenrir Ledger
          </h1>
          <p className="font-body text-muted-foreground text-sm italic">
            Break free. Harvest every reward. Let no chain hold.
          </p>
        </div>

        {/* Divider — runic */}
        <div className="flex items-center gap-3 w-full">
          <div className="flex-1 h-px bg-border" />
          <span className="text-gold/40 text-xs font-mono tracking-widest">ᚠ ᛖ ᚾ ᚱ ᛁ ᚱ</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Sign-in card */}
        <div className="w-full border border-border bg-background/60 backdrop-blur-sm p-8 flex flex-col items-center gap-6 rounded-sm">
          <p className="font-body text-foreground text-sm text-center leading-relaxed">
            The wolf is named. Prove yourself to the hall.
          </p>

          <button
            type="button"
            onClick={handleSignIn}
            disabled={isRedirecting}
            className={[
              "w-full flex items-center justify-center gap-3",
              "border border-border rounded-sm px-4 py-3",
              "bg-secondary text-foreground",
              "font-heading text-sm tracking-wide",
              "transition-colors",
              isRedirecting
                ? "opacity-50 cursor-not-allowed"
                : "hover:border-gold/50 hover:text-gold",
            ].join(" ")}
          >
            {/* Google G mark */}
            <GoogleGlyph />
            {isRedirecting ? "Crossing the Bifröst..." : "Sign in with Google"}
          </button>
        </div>

        {/* Footer note */}
        <p className="text-xs text-muted-foreground font-body text-center">
          Your session is stored locally. No data leaves this device.
        </p>

      </div>
    </div>
  );
}

// useSearchParams requires Suspense in Next.js 15 App Router static export.
export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <p className="text-muted-foreground font-body italic text-sm">
            Crossing the Bifröst...
          </p>
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}

// ── Google G glyph (inline SVG — no external dependency) ─────────────────────

function GoogleGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}
