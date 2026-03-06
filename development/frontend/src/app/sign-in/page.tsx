"use client";

/**
 * Sign-In Page — /sign-in
 *
 * Anonymous-first: this page is a voluntary upgrade destination, NOT a gate.
 * Users arrive here by clicking "Sign in to sync" in the upsell banner or
 * avatar prompt. They may leave via "Continue without signing in".
 *
 * If the user already has a valid session, redirect to / immediately.
 *
 * Two variants based on existing local card count:
 *   Variant A (no cards): generic sync benefits messaging.
 *   Variant B (has cards): subheading references the card count; prepares
 *              the user for the migration prompt that fires post-OAuth.
 *
 * Flow:
 *  1. User taps "Sign in to Google".
 *  2. Generate code_verifier, code_challenge (S256), and state.
 *  3. Store { verifier, state, callbackUrl: "/" } in sessionStorage.
 *  4. Redirect to accounts.google.com/o/oauth2/v2/auth with PKCE params.
 *  5. /auth/callback handles the return, writes session, navigates to /.
 *
 * "Continue without signing in" navigates to /.
 * Does NOT set the dismiss flag for the upsell banner.
 *
 * See ux/wireframes/sign-in.html for the full wireframe spec.
 * See ADR-005 for the PKCE auth implementation.
 * See ADR-006 for the anonymous-first model.
 */

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { generateCodeVerifier, generateCodeChallenge, generateState } from "@/lib/auth/pkce";
import { isSessionValid } from "@/lib/auth/session";
import { getAnonHouseholdId } from "@/lib/auth/household";
import { getCards } from "@/lib/storage";

/** sessionStorage key for PKCE transient state */
const PKCE_SESSION_KEY = "fenrir:pkce";

// ── Sign-in content ───────────────────────────────────────────────────────────

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [alreadyAuthed, setAlreadyAuthed] = useState(false);
  const [cardCount, setCardCount] = useState(0);

  useEffect(() => {
    // If there's already a valid session, redirect to dashboard immediately.
    if (isSessionValid()) {
      setAlreadyAuthed(true);
      router.replace("/");
      return;
    }

    // Count local cards to determine which variant to show.
    const anonId = getAnonHouseholdId();
    if (anonId) {
      const cards = getCards(anonId);
      setCardCount(cards.length);
    }
  }, [router]);

  async function handleSignIn() {
    setIsRedirecting(true);

    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    const state = generateState();

    // Persist PKCE transient values in sessionStorage (survives the redirect).
    // callbackUrl: use returnTo query param if present, otherwise "/" (dashboard).
    const returnTo = searchParams.get("returnTo") ?? "/";
    sessionStorage.setItem(
      PKCE_SESSION_KEY,
      JSON.stringify({ verifier, state, callbackUrl: returnTo })
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
      // offline access → Google issues a refresh token on first consent and
      // remembers the grant. Subsequent sign-ins skip the consent screen entirely.
      access_type: "offline",
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  // Already signed in — transitioning to dashboard
  if (alreadyAuthed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground font-body italic text-sm">
          Crossing the Bifröst...
        </p>
      </div>
    );
  }

  // Determine which content variant to show
  const hasLocalCards = cardCount > 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">

      {/* TopBar stub — identical to dashboard anonymous state */}
      {/* Note: the full AppShell TopBar wraps this page via layout.tsx,
          so we do not render a standalone TopBar here. The layout handles it. */}

      {/* Content: center the sign-in card */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <main
          className={[
            "w-full max-w-[400px]",
            "border border-border bg-background/60 backdrop-blur-sm",
            "p-8 flex flex-col gap-5",
            "rounded-sm",
          ].join(" ")}
          aria-labelledby="signin-heading"
        >
          {/* Atmospheric eyebrow (Voice 2) — sets emotional frame */}
          <p
            className="text-xs text-gold/60 uppercase tracking-[0.12em] italic font-heading"
            aria-hidden="true"
          >
            {hasLocalCards ? "Your ledger awaits a name" : "An invitation, not a demand"}
          </p>

          {/* Page heading (Voice 2) */}
          <h1
            id="signin-heading"
            className="font-display text-2xl text-gold tracking-wide"
          >
            {hasLocalCards ? "Your chains are already here." : "Name the wolf."}
          </h1>

          {/* Atmospheric subheading (Voice 2) */}
          <p className="text-sm text-muted-foreground italic font-body leading-relaxed">
            {hasLocalCards
              ? `Sign in and we'll offer to add your ${cardCount} local card${cardCount === 1 ? "" : "s"} to your cloud account.`
              : "Your chains are already here. Sign in to carry them everywhere."}
          </p>

          {/* Feature list (Voice 1 — plain English) */}
          <div
            className="flex flex-col gap-3"
            aria-label="What signing in gives you"
          >
            {hasLocalCards ? (
              <>
                <FeatureItem>Keep your existing cards — or start a fresh cloud account</FeatureItem>
                <FeatureItem>Back up all your cards and deadlines to the cloud</FeatureItem>
                <FeatureItem>Access your ledger from any device</FeatureItem>
              </>
            ) : (
              <>
                <FeatureItem>Back up your cards and deadlines to the cloud</FeatureItem>
                <FeatureItem>Access your ledger from any device</FeatureItem>
                <FeatureItem>Your local data is always preserved — signing in adds to it</FeatureItem>
              </>
            )}
          </div>

          {/* Primary CTA (Voice 1) */}
          <button
            type="button"
            onClick={handleSignIn}
            disabled={isRedirecting}
            className={[
              "w-full flex items-center justify-center gap-3",
              "border border-border rounded-sm px-4 py-3",
              "bg-primary text-primary-foreground",
              "font-heading text-sm tracking-wide",
              "transition-colors",
              isRedirecting
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-gold-bright",
            ].join(" ")}
            style={{ minHeight: 46 }}
          >
            <GoogleGlyph />
            {isRedirecting ? "Crossing the Bifröst..." : "Sign in to Google"}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3" aria-hidden="true">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground font-body">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Secondary CTA (Voice 1) — NON-NEGOTIABLE prominence.
              Full-width outlined button, same visual weight as primary.
              This is a first-class exit path, not an afterthought. */}
          <button
            type="button"
            onClick={() => router.push("/")}
            className={[
              "w-full px-4 py-3",
              "border border-border rounded-sm",
              "text-sm font-heading tracking-wide text-foreground",
              "hover:border-gold/40 hover:text-gold transition-colors",
              "bg-transparent",
            ].join(" ")}
            style={{ minHeight: 46 }}
          >
            Continue without signing in
          </button>

          {/* Atmospheric footnote (Voice 2) */}
          <p className="text-xs text-muted-foreground italic text-center font-body leading-relaxed">
            {hasLocalCards
              ? "Your local chains are safe either way. The ledger was already written before you named yourself."
              : "The ledger is already written. Signing in only shares it further."}
          </p>

        </main>
      </div>
    </div>
  );
}

// ── Feature item helper ────────────────────────────────────────────────────────

function FeatureItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-xs text-foreground font-body leading-relaxed">
      <div
        className="w-4 h-4 rounded-full border border-gold/40 flex items-center justify-center text-gold shrink-0 mt-0.5"
        aria-hidden="true"
      >
        <span className="text-[8px]">✓</span>
      </div>
      <span>{children}</span>
    </div>
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

// ── Page export ───────────────────────────────────────────────────────────────

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
