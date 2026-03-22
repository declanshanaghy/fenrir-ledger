"use client";

/**
 * AnonEmptyState — displayed on the dashboard when an anonymous user has zero cards.
 *
 * Primary CTA:   Sign in / Start free 30-day trial (navigates via buildSignInUrl)
 * Secondary CTA: Add a card locally (navigates to /ledger/cards/new)
 *
 * Visual hierarchy matches the Luna wireframe (Section B) for issue #1748:
 *   - Primary button: prominent, bold, 2px border equivalent via ring styling
 *   - "or" divider: aria-hidden, purely visual
 *   - Secondary button: subordinate, lighter weight
 *   - Footnotes: associated via aria-describedby
 *
 * Gleipnir easter egg #1 (ingredient 6 of 6: spittle of a bird) is preserved
 * on the outer wrapper div, matching EmptyState.tsx.
 *
 * Issue #1748
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

      {/* CTA group — vertically stacked, max-width 320px, centered */}
      <div className="flex flex-col items-center w-full max-w-xs gap-3">

        {/* PRIMARY: Start free trial / Sign in */}
        <button
          type="button"
          id="anon-cta-signin"
          onClick={handleSignIn}
          aria-describedby="anon-cta-signin-footnote"
          className="inline-flex items-center justify-center w-full font-heading tracking-wide text-base transition-colors bg-primary text-primary-foreground hover:bg-primary hover:brightness-110 active:scale-[0.97] active:brightness-90 h-12 px-6 rounded-sm"
          style={{ minHeight: 48 }}
        >
          Start your free 30-day trial
        </button>
        <p
          id="anon-cta-signin-footnote"
          className="text-xs text-muted-foreground italic -mt-1"
        >
          Sign in to sync cards, access all devices &amp; unlock Karl.
        </p>

        {/* Visual divider — aria-hidden, SR hears the two buttons sequentially */}
        <span
          aria-hidden="true"
          className="text-xs text-muted-foreground/50 uppercase tracking-widest"
        >
          or
        </span>

        {/* SECONDARY: Add a card locally */}
        <Link
          href="/ledger/cards/new"
          id="anon-cta-local"
          aria-describedby="anon-cta-local-footnote"
          className="inline-flex items-center justify-center w-full font-heading tracking-wide text-sm transition-colors border border-border text-muted-foreground hover:border-gold/50 hover:text-gold h-11 px-6 rounded-sm"
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
