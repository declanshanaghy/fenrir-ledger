/**
 * Marketing Home Page — Fenrir Ledger
 *
 * Sections (from wireframe ux/wireframes/marketing-site/home-page.html):
 *   1. Hero — wolf icon + headline + tagline + description + CTA
 *   2. Pain Points (The Chains) — 3 cards (Fee-Serpent, Promo Tide, Unclaimed Plunder)
 *   3. Features (What the Wolf Watches) — 6-card grid
 *   4. Onboarding (Three Runes to Freedom) — 3 steps with connectors
 *   5. Final CTA — The wolf waits.
 *
 * Mythology references carry .myth-link (dotted gold underline) with Wikipedia hrefs.
 *
 * export const dynamic = "force-static" — fully static page, no server-side data.
 *
 * Wireframe: ux/wireframes/marketing-site/home-page.html
 */

import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Fenrir Ledger — Break Free from Credit Card Traps",
  description:
    "Track credit card fees, sign-up bonuses, and deadlines. Every reward has a deadline. Fenrir doesn't forget.",
};

// ── Section: Hero ─────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section
      aria-label="Hero"
      className="border-b border-border bg-card"
    >
      <div className="max-w-[1100px] mx-auto px-6 py-16 sm:py-24">
        <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-10 items-start">

          {/* Wolf icon placeholder */}
          <div className="flex justify-center sm:justify-start">
            <div
              className={[
                "flex items-center justify-center",
                "w-[120px] h-[120px] sm:w-[160px] sm:h-[160px]",
                "border-2 border-border rounded-lg",
                "text-4xl sm:text-5xl text-primary",
                "dark:shadow-[0_0_32px_rgba(91,158,201,0.2)]",
              ].join(" ")}
              aria-label="Fenrir wolf icon"
              role="img"
            >
              ᚠ
            </div>
          </div>

          {/* Hero content */}
          <div className="flex flex-col gap-4 text-center sm:text-left">
            <p className="font-mono text-xs tracking-[0.3em] text-primary uppercase">
              ᚠ · ᛟ · ᛏ
            </p>

            <h1 className="font-display text-4xl sm:text-5xl font-black leading-none tracking-wide text-foreground uppercase">
              Fenrir Ledger
            </h1>

            <p className="font-body text-lg sm:text-xl italic text-muted-foreground">
              Every reward has a deadline.{" "}
              <a
                href="https://en.wikipedia.org/wiki/Fenrir"
                target="_blank"
                rel="noopener noreferrer"
                className="myth-link"
                aria-label="Fenrir on Wikipedia"
              >
                Fenrir
              </a>{" "}
              doesn&apos;t forget.
            </p>

            <p className="font-body text-base text-muted-foreground leading-relaxed max-w-2xl">
              Credit card churning lives and dies by dates — fee anniversaries,
              promo windows, spend thresholds. Miss one and the issuer wins.
              Fenrir Ledger puts every deadline in front of you, named and counted,
              before the chain pulls tight.
            </p>

            <div className="mt-4 flex flex-col sm:flex-row gap-4 justify-center sm:justify-start">
              <Link
                href="/ledger"
                className={[
                  "inline-flex items-center justify-center px-8 py-4",
                  "font-heading text-sm font-bold tracking-widest uppercase",
                  "bg-primary text-primary-foreground",
                  "hover:bg-primary hover:brightness-110 transition-colors",
                  "rounded-sm",
                ].join(" ")}
                data-app-link
              >
                Break the Chain
              </Link>
            </div>

            {/* Norse epigraph */}
            <div className="mt-8 pt-6 border-t border-border">
              <blockquote className="font-body text-sm italic text-muted-foreground/80">
                &ldquo;Though it looks like silk ribbon, no chain is stronger.&rdquo;
                <cite className="block mt-2 font-mono text-xs not-italic text-muted-foreground/60">
                  — Prose{" "}
                  <a
                    href="https://en.wikipedia.org/wiki/Prose_Edda"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="myth-link"
                    aria-label="Prose Edda on Wikipedia"
                  >
                    Edda
                  </a>
                  ,{" "}
                  <a
                    href="https://en.wikipedia.org/wiki/Gylfaginning"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="myth-link"
                    aria-label="Gylfaginning on Wikipedia"
                  >
                    Gylfaginning
                  </a>
                </cite>
              </blockquote>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Section: Pain Points (The Chains) ────────────────────────────────────────

const CHAINS = [
  {
    rune: "ᚲ",
    title: "The Fee-Serpent",
    accentColor: "border-l-[#c94a0a]",
    description:
      "The annual fee is zero work for the issuer and easy to forget for you. It charges automatically, on a date you set and then lost. No warning. No negotiation. It was always going to land — the question is whether you were ready.",
  },
  {
    rune: "ᚺ",
    title: "The Promo Tide",
    accentColor: "border-l-[#f59e0b]",
    description:
      "Every sign-up offer has an expiration. Spend threshold by this date. Earn the bonus before the window closes. Miss it, and the points that were practically yours vanish — not stolen, just quietly allowed to expire. Hati runs. The moon doesn't wait.",
    mythLink: { text: "Hati", href: "https://en.wikipedia.org/wiki/Hati_Hr%C3%B3%C3%B0vitns%C3%B3ni" },
  },
  {
    rune: "ᚠ",
    title: "The Unclaimed Plunder",
    accentColor: "border-l-[#8a8578]",
    description:
      "Statement credits. Quarterly bonuses. Rewards that require activation. The issuers know most cardholders won't claim them — that's the business model. The wolf who tracks what's owed collects what others leave behind.",
  },
] as const;

function ChainsSection() {
  return (
    <section aria-label="The Chains They Forged for You" className="border-b border-border">
      <div className="max-w-[1100px] mx-auto px-6 py-14 sm:py-20">

        {/* Section heading */}
        <div className="text-center mb-10">
          <p className="font-mono text-xs tracking-[0.3em] text-primary uppercase mb-3">ᚺ</p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-wide text-foreground mb-4">
            The Chains They Forged for You
          </h2>
          <p className="font-body text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
            The traps aren&apos;t loud. They&apos;re quiet by design — dates buried in terms,
            thresholds easy to miss, windows that close without ceremony.
            Three of them catch most people.
          </p>
        </div>

        {/* 3-card grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {CHAINS.map(({ rune, title, accentColor, description }) => (
            <div
              key={title}
              className={[
                "border border-border border-l-4",
                accentColor,
                "bg-card p-8",
              ].join(" ")}
            >
              <div className="text-3xl text-primary mb-5" aria-hidden="true">{rune}</div>
              <h3 className="font-heading text-lg font-semibold text-foreground mb-3">{title}</h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">{description}</p>
            </div>
          ))}
        </div>

        {/* Closing line */}
        <p className="text-center mt-14 font-body text-lg italic font-semibold text-foreground">
          The issuers built these traps carefully.{" "}
          <a
            href="https://en.wikipedia.org/wiki/Fenrir"
            target="_blank"
            rel="noopener noreferrer"
            className="myth-link"
            aria-label="Fenrir on Wikipedia"
          >
            Fenrir
          </a>{" "}
          was built to dismantle them.
        </p>
      </div>
    </section>
  );
}

// ── Section: Features (What the Wolf Watches) ─────────────────────────────────

const FEATURES = [
  {
    rune: "ᚲ",
    title: "Sköll & Hati",
    description:
      "Two deadline trackers named for the wolves who chase the sun and moon across the sky. Sköll watches your annual fee dates; Hati watches your promo windows. Each one counts down.",
    skollHref: "https://en.wikipedia.org/wiki/Sk%C3%B6ll_and_Hati",
    hatiHref: "https://en.wikipedia.org/wiki/Hati_Hr%C3%B3%C3%B0vitns%C3%B3ni",
  },
  {
    rune: "ᚺ",
    title: "The Norns' Weave",
    description:
      "Past, present, and future — what you've spent, where your balances stand today, and what needs to happen before each deadline closes.",
    nornsHref: "https://en.wikipedia.org/wiki/Norns",
  },
  {
    rune: "ᛟ",
    title: "The Ledger of Fates",
    description:
      "Every card in your household, laid out cleanly. Annual fees, credit limits, reward balances, issuer details, fee schedules. The full picture.",
  },
  {
    rune: "ᛏ",
    title: "Valhalla",
    description:
      "Closed cards don't disappear. They're archived — every fee you avoided, every bonus you collected, every card you closed at exactly the right moment.",
    valhallaHref: "https://en.wikipedia.org/wiki/Valhalla",
  },
  {
    rune: "ᛉ",
    title: "The Howl",
    description:
      "Alerts before deadlines, not after. The Howl fires when a fee date is approaching, when a promo window is tightening, when a spend threshold needs attention.",
  },
  {
    rune: "ᛗ",
    title: "The Nine Realms",
    description:
      "Each card carries a status badge drawn from the Nine Realms — a single word that tells you exactly where it stands. Earning, warning, burning, or closed with honor.",
    nineRealmsHref: "https://en.wikipedia.org/wiki/Nine_Worlds",
  },
] as const;

function FeaturesSection() {
  return (
    <section aria-label="What the Wolf Watches" className="border-b border-border">
      <div className="max-w-[1100px] mx-auto px-6 py-14 sm:py-20">

        {/* Section heading */}
        <div className="text-center mb-10">
          <p className="font-mono text-xs tracking-[0.3em] text-primary uppercase mb-3">ᛊ</p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-wide text-foreground mb-4">
            What the Wolf Watches
          </h2>
          <p className="font-body text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Six tools that track every card in your household — deadlines, balances,
            open windows, and history. Nothing slips. Nothing closes unnoticed.
            Everything that&apos;s yours stays yours.
          </p>
        </div>

        {/* 6-card grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ rune, title, description }) => (
            <div
              key={title}
              className="border border-border bg-card p-7 min-h-[200px]"
            >
              <div className="text-3xl text-primary mb-5" aria-hidden="true">{rune}</div>
              <h3 className="font-heading text-base font-semibold text-foreground mb-3">{title}</h3>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Section: Onboarding (Three Runes to Freedom) ─────────────────────────────

const STEPS = [
  {
    rune: "ᛏ",
    number: "01",
    title: "Forge Your Chains",
    description:
      "Add your cards. Name the issuer, the annual fee date, the sign-up offer deadline, the spend threshold. Takes two minutes per card.",
  },
  {
    rune: "ᚺ",
    number: "02",
    title: "Watch the Norns Weave",
    description:
      "The dashboard shows every active card, every approaching deadline, every open reward window. Sköll and Hati count the days.",
    nornsHref: "https://en.wikipedia.org/wiki/Norns",
    skollHatiHref: "https://en.wikipedia.org/wiki/Sk%C3%B6ll_and_Hati",
  },
  {
    rune: "ᛊ",
    number: "03",
    title: "Break Free",
    description:
      "Close before the fee hits. Claim before the window closes. Collect what you earned and mark the card closed. It moves to Valhalla — honored, recorded, done.",
    valhallaHref: "https://en.wikipedia.org/wiki/Valhalla",
  },
] as const;

function OnboardingSection() {
  return (
    <section
      aria-label="Three Runes to Freedom"
      className="border-b border-border bg-card"
    >
      <div className="max-w-[1100px] mx-auto px-6 py-14 sm:py-20">

        {/* Section heading */}
        <div className="text-center mb-12">
          <p className="font-mono text-xs tracking-[0.3em] text-primary uppercase mb-3">ᛞ</p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-wide text-foreground mb-4">
            Three Runes to Freedom
          </h2>
          <p className="font-body text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
            No spreadsheets. No calendar reminders that drift out of sync.
            Three steps to get every card tracked and every deadline visible.
          </p>
        </div>

        {/* Steps with connectors */}
        <div className="flex flex-col sm:flex-row items-start justify-between gap-0 sm:gap-5">
          {STEPS.map(({ rune, number, title, description }, i) => (
            <div key={number} className="flex flex-col sm:flex-row items-center flex-1">
              {/* Step content */}
              <div className="flex flex-col items-center text-center flex-1 px-4">
                {/* Circle */}
                <div
                  className={[
                    "flex items-center justify-center",
                    "w-20 h-20 rounded-full border-2 border-border",
                    "text-3xl text-primary mb-4",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  {rune}
                </div>
                <p className="font-mono text-xs tracking-widest text-muted-foreground mb-2">{number}</p>
                <h3 className="font-heading text-lg font-semibold text-foreground mb-2">{title}</h3>
                <p className="font-body text-sm text-muted-foreground leading-relaxed max-w-[260px]">
                  {description}
                </p>
              </div>

              {/* Connector — between steps */}
              {i < STEPS.length - 1 && (
                <div
                  className="hidden sm:block w-[60px] h-px bg-border shrink-0 mt-10"
                  aria-hidden="true"
                />
              )}
              {i < STEPS.length - 1 && (
                <div
                  className="sm:hidden w-px h-10 bg-border my-4"
                  aria-hidden="true"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Section: Final CTA ────────────────────────────────────────────────────────

function FinalCtaSection() {
  return (
    <section
      aria-label="Call to action"
      className="bg-card border-b border-border"
    >
      <div className="max-w-[1100px] mx-auto px-6 py-20 sm:py-28 text-center">
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-6">
          The wolf waits. The chain weakens.
        </h2>
        <p className="font-body text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
          Every day you delay is another fee that might land, another bonus that might expire.
          Start tracking before the next deadline passes.
        </p>
        <Link
          href="/ledger"
          className={[
            "inline-flex items-center justify-center px-10 py-4",
            "font-heading text-sm font-bold tracking-widest uppercase",
            "bg-primary text-primary-foreground",
            "hover:bg-primary hover:brightness-110 transition-colors",
            "rounded-sm",
          ].join(" ")}
          data-app-link
        >
          Open the Ledger
        </Link>
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MarketingHomePage() {
  return (
    <>
      <HeroSection />
      <ChainsSection />
      <FeaturesSection />
      <OnboardingSection />
      <FinalCtaSection />
    </>
  );
}
