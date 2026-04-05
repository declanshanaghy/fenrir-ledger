"use client";

/**
 * AnonEmptyState — displayed on the dashboard when an anonymous user has zero cards.
 *
 * Three-tier CTA hierarchy per Luna wireframe for issue #2117:
 *   - TIER 1 PRIMARY:   "Start Your Free 30-Day Trial" (gold button, sign-up intent)
 *   - TIER 2 SECONDARY: "Login & Return to Hlidskjalf" (outlined button, returning users)
 *   - "or" divider with horizontal rules
 *   - TIER 3 TERTIARY:  "Add a card locally" (text link, no button chrome)
 *
 * Both auth buttons call the same buildSignInUrl(pathname) handler.
 * The distinction is copy-only — the auth flow handles new vs returning users.
 *
 * Gleipnir easter egg #1 (ingredient 6 of 6: spittle of a bird) is preserved
 * on the outer wrapper div, matching EmptyState.tsx.
 *
 * Issue #1748 (original), updated by issue #2117
 */

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { buildSignInUrl } from "@/lib/auth/sign-in-url";

export function AnonEmptyState() {
  const router = useRouter();
  const pathname = usePathname();

  function handleSignIn() {
    router.push(buildSignInUrl(pathname));
  }

  return (
    <div
      className="flex flex-col items-center justify-center py-24 text-center"
      // Easter egg #1 — Gleipnir Hunt, ingredient 6 of 6
      aria-description="the spittle of a bird"
    >
      {/* Atmospheric heading — same brand voice as EmptyState */}
      <h2 className="font-display text-3xl text-gold mb-3 tracking-wide">
        Before{" "}
        <a
          className="myth-link"
          href="https://en.wikipedia.org/wiki/Gleipnir"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Gleipnir on Wikipedia"
        >
          Gleipnir
        </a>{" "}
        was forged,{" "}
        <a
          className="myth-link"
          href="https://en.wikipedia.org/wiki/Fenrir"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Fenrir on Wikipedia"
        >
          Fenrir
        </a>{" "}
        roamed free.
      </h2>

      <p className="font-body text-muted-foreground mb-8 max-w-md italic leading-relaxed">
        Before your first card is added, no chain can be broken.
      </p>

      {/* CTA group — vertically stacked, max-width 340px, centered */}
      <div className="flex flex-col items-center w-full max-w-[340px] gap-3">

        {/* TIER 1 PRIMARY: Start free trial / Sign up */}
        <button
          type="button"
          id="anon-cta-signin"
          onClick={handleSignIn}
          aria-describedby="anon-cta-signin-footnote"
          className="inline-flex items-center justify-center w-full font-heading tracking-wide text-base font-semibold transition-colors bg-primary text-primary-foreground hover:bg-primary hover:brightness-110 active:scale-[0.97] active:brightness-90 h-12 px-6 rounded-sm"
          style={{ minHeight: 48 }}
        >
          Start Your Free 30-Day Trial
        </button>
        <p
          id="anon-cta-signin-footnote"
          className="text-xs text-muted-foreground italic -mt-1"
        >
          Sign in to sync cards, access all devices &amp; unlock Karl.
        </p>

        {/* TIER 2 SECONDARY: Returning user login */}
        <button
          type="button"
          id="anon-cta-login"
          onClick={handleSignIn}
          className="inline-flex items-center justify-center w-full font-heading tracking-wide text-sm transition-colors border border-border text-foreground hover:border-gold/60 hover:text-gold h-11 px-6 rounded-sm"
          style={{ minHeight: 44 }}
        >
          Login &amp; Return to Hlidskjalf
        </button>

        {/* Visual divider before tertiary option — aria-hidden, SR hears buttons sequentially */}
        <div
          aria-hidden="true"
          className="flex items-center gap-3 w-full my-1"
        >
          <span className="flex-1 border-t border-border/40" />
          <span className="text-xs text-muted-foreground/50 uppercase tracking-widest">
            or
          </span>
          <span className="flex-1 border-t border-border/40" />
        </div>

        {/* TIER 3 TERTIARY: Add a card locally — text link, no button chrome */}
        <Link
          href="/ledger/cards/new"
          id="anon-cta-local"
          aria-describedby="anon-cta-local-footnote"
          className="inline-flex items-center justify-center font-body text-xs text-muted-foreground underline underline-offset-2 hover:text-gold transition-colors px-4 py-2"
          style={{ minHeight: 44 }}
        >
          Add a card locally
        </Link>
        <p
          id="anon-cta-local-footnote"
          className="text-xs text-muted-foreground italic -mt-1"
        >
          No account needed — cards are stored on this device only.
        </p>

      </div>
    </div>
  );
}
