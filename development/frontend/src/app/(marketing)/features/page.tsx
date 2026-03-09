/**
 * Features Page — /features
 *
 * Showcases all 9 real-value features of Fenrir Ledger in an alternating
 * 2-column layout. Thrall (free) features first, Karl (paid) features after
 * a tier divider. Norse voice throughout.
 *
 * Features:
 *   Thrall (Free):
 *     01. Annual Fee Tracking
 *     02. Sign-Up Bonus Tracking
 *     03. Velocity Management
 *     04. The Howl
 *   Karl ($3.99/mo):
 *     05. Valhalla (Card Archive)
 *     06. Cloud Sync
 *     07. Multi-Household
 *     08. Smart Import
 *     09. Data Export
 *
 * Wireframe: ux/wireframes/marketing-site/features.html
 * export const dynamic = 'force-static' — no server data fetching.
 */

import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Features — Fenrir Ledger",
  description:
    "Every tool Fenrir Ledger uses to close the gap between what issuers promise and what you remember to claim. 9 real features. No easter eggs.",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeatureDetail {
  id: string;
  rune: string;
  eyebrow: string;
  title: string;
  benefit: string;
  description: string;
  details: string[];
  atmospheric: string;
  tier: "thrall" | "karl";
  reverse?: boolean;
}

// ── Data ──────────────────────────────────────────────────────────────────────

const THRALL_FEATURES: FeatureDetail[] = [
  {
    id: "annual-fee-tracking",
    rune: "ᛊ",
    eyebrow: "Feature 01 · Annual Fee Tracking",
    title: "Sköll Watches the Fee",
    benefit:
      "Know your annual fee date 60 days before it hits. Never get charged for a card you meant to cancel.",
    description:
      "Every credit card carries an annual fee anniversary — a date buried in your original application, quietly waiting to charge. Fenrir tracks every fee date and fires a 60-day advance warning so you can decide: keep it, downgrade it, or close it before the charge lands.",
    details: [
      "60-day advance reminder before each annual fee date",
      "Calculates exact fee date from card open date",
      'Marks cards as "fee approaching" in dashboard and The Howl',
      "Tracks whether fee has been offset by credits or bonuses",
    ],
    atmospheric: "Sköll chases the sun. He has never caught it — but he never stops.",
    tier: "thrall",
    reverse: false,
  },
  {
    id: "signup-bonus-tracking",
    rune: "ᚺ",
    eyebrow: "Feature 02 · Sign-Up Bonus Tracking",
    title: "Hati Watches the Deadline",
    benefit:
      "Track every minimum spend requirement. Never let a sign-up bonus expire because you lost track of the window.",
    description:
      "Sign-up bonuses live and die by spend thresholds and deadlines. Hati tracks both — the amount you need to hit and the date you need to hit it by. As the deadline approaches, Hati howls louder.",
    details: [
      "Tracks minimum spend amount and deadline per card",
      "Displays remaining spend needed to hit threshold",
      "Escalating urgency indicators as deadline approaches",
      "Marks bonus as earned once threshold is met",
    ],
    atmospheric: "Hati runs after the moon. The moon has no place to hide.",
    tier: "thrall",
    reverse: true,
  },
  {
    id: "velocity-management",
    rune: "ᚹ",
    eyebrow: "Feature 03 · Velocity Management",
    title: "The Issuer's Rules",
    benefit:
      "Know exactly where you stand against Chase 5/24, Citi 1/8, and other issuer-specific application limits.",
    description:
      "Every major issuer has application velocity rules — limits on how many cards you can open in a rolling window. Violate them and your application is denied. Fenrir tracks your open-date history against each issuer's known rules so you always know if you're eligible before you apply.",
    details: [
      "Chase 5/24: tracks cards opened in last 24 months",
      "Citi 1/8 and 2/65: tracks application windows",
      "American Express once-per-lifetime bonus tracking",
      "Issuer-specific rule summaries with plain-English explanations",
      "Shows current count and remaining slots per issuer",
    ],
    atmospheric: "Know the rules of the hall before you enter it.",
    tier: "thrall",
    reverse: false,
  },
  {
    id: "the-howl",
    rune: "ᛉ",
    eyebrow: "Feature 04 · The Howl",
    title: "Urgent Cards Dashboard",
    benefit:
      "A single view of everything that needs attention right now — no searching, no missing deadlines.",
    description:
      "The Howl is Fenrir's alert surface — a panel that surfaces only the cards that need action. Fee approaching. Promo expiring. Spend threshold at risk. It's not a full dashboard; it's triage. The Howl shows you what to do next.",
    details: [
      "Cards with annual fee within 60 days",
      "Cards with sign-up bonus deadline within 30 days",
      "Cards with incomplete spend threshold (behind pace)",
      "Sortable by urgency (days remaining)",
      "Accessible from dashboard and as collapsible side panel",
    ],
    atmospheric: "The wolf does not howl when everything is calm.",
    tier: "thrall",
    reverse: true,
  },
];

const KARL_FEATURES: FeatureDetail[] = [
  {
    id: "valhalla",
    rune: "ᛏ",
    eyebrow: "Feature 05 · Valhalla",
    title: "Hall of the Honored Dead",
    benefit:
      "See every card you've closed — anniversary dates, total rewards extracted, annual fees avoided, and how long each chain held you.",
    description:
      "When you close a card, it doesn't disappear. Valhalla stores every closed card with its complete history: when you opened it, when you closed it, what bonuses it earned, and what fees it charged. It's the archive of every battle you've fought — and the evidence of what you've won.",
    details: [
      "Full archive of every closed card with complete metadata",
      "Historical annual fee data and dates",
      "Sign-up bonus earned vs. spent tracking",
      "Lifetime value summary per card",
    ],
    atmospheric: "The hall of the honored dead. Only Karl may enter.",
    tier: "karl",
    reverse: false,
  },
  {
    id: "cloud-sync",
    rune: "ᚲ",
    eyebrow: "Feature 06 · Cloud Sync",
    title: "Your Ledger Follows You",
    benefit:
      "Add a card on mobile. See it on desktop. Your data syncs across every device via your Google account — no manual export, no sync button.",
    description:
      "Cloud Sync stores your card data in Fenrir's servers, tied to your Google identity. Every change — new card, updated fee date, earned bonus — propagates instantly across all your signed-in devices. The ledger is always current.",
    details: [
      "Real-time sync across all devices signed into your Google account",
      "Data stored securely in Fenrir's cloud (Vercel KV)",
      "No manual export / import required between devices",
      "Offline changes sync on reconnect",
    ],
    atmospheric: "The wolf who roams far keeps his saga close.",
    tier: "karl",
    reverse: false,
  },
  {
    id: "multi-household",
    rune: "ᛟ",
    eyebrow: "Feature 07 · Multi-Household",
    title: "One Wolf, Many Dens",
    benefit:
      "Manage cards across multiple households under a single account. Your cards, your partner's cards, separate ledgers, one login.",
    description:
      "Serious churners often manage cards for multiple people — a partner, a spouse, a household that pools points. Multi-Household lets you create named household groups and assign cards to each one. Deadlines, bonuses, and velocity rules track per-household, not just per-person.",
    details: [
      'Create named households (e.g. "Self", "Partner", "Joint")',
      "Cards assigned to a household; dashboard filters by household",
      "Velocity rules tracked separately per household",
      "Combined Howl view across all households",
    ],
    atmospheric: "One wolf may guard many dens.",
    tier: "karl",
    reverse: true,
  },
  {
    id: "smart-import",
    rune: "ᛗ",
    eyebrow: "Feature 08 · Smart Import",
    title: "The Rune-Reader",
    benefit:
      "Drop in your existing spreadsheet. Fenrir extracts card names, dates, and fee amounts automatically — no reformatting required.",
    description:
      "If you've been tracking cards in a spreadsheet, moving to Fenrir shouldn't mean re-entering everything by hand. Smart Import reads your spreadsheet's structure — whatever columns you used — and maps each row to a Fenrir card record. It handles messy, inconsistent formatting and asks you to confirm before saving.",
    details: [
      "Accepts CSV, XLSX, and Google Sheets exports",
      "Identifies card name, issuer, fee date, open date, bonus fields",
      "Handles non-standard column names and partial data",
      "Preview step: review all mapped cards before importing",
      "Unrecognized fields flagged for manual review",
    ],
    atmospheric: "The runes reveal what the untrained eye cannot see.",
    tier: "karl",
    reverse: false,
  },
  {
    id: "data-export",
    rune: "ᛞ",
    eyebrow: "Feature 09 · Data Export",
    title: "Your Data, Your Terms",
    benefit:
      "Export everything Fenrir knows about your cards — as CSV or JSON — whenever you want, with no lock-in.",
    description:
      "Your card data belongs to you. Data Export lets you pull a complete snapshot of your ledger at any time: all active cards, all archived cards, all dates and amounts. Use it to back up, migrate, or run your own analysis.",
    details: [
      "Export all active cards as CSV or JSON",
      "Includes archived (Valhalla) cards in export",
      "Fields: card name, issuer, open date, fee date, bonus status, notes",
      "Instant download — no email required",
    ],
    atmospheric: "Carry the runes beyond these walls.",
    tier: "karl",
    reverse: true,
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: "thrall" | "karl" }) {
  if (tier === "thrall") {
    return (
      <span
        className={[
          "inline-block border border-dashed border-border",
          "px-2 py-0.5 ml-2",
          "font-mono text-[10px] tracking-[0.15em] uppercase text-muted-foreground",
        ].join(" ")}
      >
        Thrall — Free
      </span>
    );
  }
  return (
    <span
      className={[
        "inline-block border border-border",
        "px-2 py-0.5 ml-2",
        "font-mono text-[10px] tracking-[0.15em] uppercase text-primary",
      ].join(" ")}
    >
      Karl — $3.99/mo
    </span>
  );
}

function FeatureVisualPlaceholder({ feature }: { feature: FeatureDetail }) {
  return (
    <div
      className={[
        "border border-border bg-card",
        "min-h-[280px] flex flex-col items-center justify-center gap-3",
        "p-8 text-center",
      ].join(" ")}
      aria-hidden="true"
    >
      <span className="text-5xl text-primary leading-none">{feature.rune}</span>
      <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground mt-2">
        {feature.title}
      </span>
    </div>
  );
}

function FeatureSection({ feature }: { feature: FeatureDetail }) {
  const content = (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline flex-wrap gap-1">
        <span className="text-4xl text-primary leading-none" aria-hidden="true">
          {feature.rune}
        </span>
        <TierBadge tier={feature.tier} />
      </div>
      <p className="font-mono text-[11px] tracking-[0.25em] uppercase text-muted-foreground">
        {feature.eyebrow}
      </p>
      <h2 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-wide text-foreground leading-tight">
        {feature.title}
      </h2>
      <p className="font-body text-base italic font-semibold text-foreground/90 leading-relaxed">
        {feature.benefit}
      </p>
      <p className="font-body text-sm text-muted-foreground leading-[1.8]">
        {feature.description}
      </p>
      <ul className="flex flex-col gap-2.5 mt-1" aria-label="Feature details">
        {feature.details.map((detail) => (
          <li
            key={detail}
            className="relative pl-5 font-body text-sm text-muted-foreground leading-relaxed"
          >
            <span
              className="absolute left-0 top-0.5 font-mono text-[10px] text-primary"
              aria-hidden="true"
            >
              ᚢ
            </span>
            {detail}
          </li>
        ))}
      </ul>
      <blockquote className="mt-2 pl-4 border-l-2 border-border font-body text-sm italic text-muted-foreground/80 leading-relaxed">
        &ldquo;{feature.atmospheric}&rdquo;
      </blockquote>
    </div>
  );

  const visual = <FeatureVisualPlaceholder feature={feature} />;

  return (
    <section
      id={feature.id}
      aria-label={feature.title}
      className="border-b border-border"
    >
      <div className="max-w-[1100px] mx-auto px-6 py-16 sm:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-14 items-center">
          {feature.reverse ? (
            <>
              <div className="order-2 md:order-1">{visual}</div>
              <div className="order-1 md:order-2">{content}</div>
            </>
          ) : (
            <>
              <div>{content}</div>
              <div>{visual}</div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Page sections ─────────────────────────────────────────────────────────────

function PageHero() {
  return (
    <section
      aria-label="Features hero"
      className="border-b border-border bg-card"
    >
      <div className="max-w-[1100px] mx-auto px-6 py-16 sm:py-24 text-center">
        <p className="font-mono text-xs tracking-[0.3em] text-primary uppercase mb-4">
          ᛊ · ᚲ · ᛟ
        </p>
        <h1 className="font-display text-4xl sm:text-5xl font-black uppercase tracking-wide text-foreground mb-5 leading-none">
          The Wolf&apos;s Arsenal
        </h1>
        <p className="font-body text-lg sm:text-xl italic text-muted-foreground max-w-xl mx-auto mb-4 leading-relaxed">
          Every tool in Fenrir Ledger was built to solve a real problem.
          No dashboards for the sake of dashboards. No features for demo decks.
        </p>
        <p className="font-body text-base text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          Credit card churning is a game of dates. The issuers know this — they built
          their business on the gap between what they promise and what you remember to claim.
          Fenrir closes that gap. Here&apos;s how.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/ledger"
            className={[
              "inline-flex items-center justify-center px-8 py-4",
              "font-heading text-sm font-bold tracking-widest uppercase",
              "bg-primary text-primary-foreground",
              "hover:brightness-110 transition-all",
              "rounded-sm",
            ].join(" ")}
            data-app-link
          >
            Open the Ledger
          </Link>
          <Link
            href="/pricing"
            className={[
              "inline-flex items-center justify-center px-6 py-3",
              "font-heading text-xs font-bold tracking-widest uppercase",
              "border border-border text-foreground",
              "hover:bg-card transition-colors",
              "rounded-sm",
            ].join(" ")}
          >
            View Pricing
          </Link>
        </div>
      </div>
    </section>
  );
}

function ThrallSectionHeading() {
  return (
    <section aria-label="Thrall features heading" className="border-b border-border bg-muted/30">
      <div className="max-w-[1100px] mx-auto px-6 py-12">
        <p className="font-mono text-[11px] tracking-[0.3em] text-primary uppercase mb-3">
          ᛏ · Free for All
        </p>
        <h2 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-wide text-foreground mb-3">
          What Every Thrall Commands
        </h2>
        <p className="font-body text-base text-muted-foreground max-w-xl leading-relaxed">
          No payment required. These are the core tools — available the moment
          you sign in with your Google account.
        </p>
      </div>
    </section>
  );
}

function TierDivider() {
  return (
    <div className="border-y border-border bg-muted/40" role="separator" aria-label="Karl tier upgrade">
      <div className="max-w-[1100px] mx-auto px-6 py-10 text-center">
        <p className="font-mono text-[11px] tracking-[0.25em] text-primary uppercase mb-2">
          ᛟ · Karl Tier · $3.99 / month
        </p>
        <h2 className="font-display text-xl sm:text-2xl font-bold uppercase tracking-wide text-foreground mb-2">
          Upgrade Your Arsenal
        </h2>
        <p className="font-body text-sm text-muted-foreground max-w-md mx-auto leading-relaxed mb-4">
          The following features require a Karl subscription. They&apos;re built for
          churners who manage multiple devices, multiple households, or want
          to move their data freely.
        </p>
        <Link
          href="/pricing"
          className="font-body text-xs tracking-[0.1em] uppercase underline text-muted-foreground hover:text-foreground transition-colors"
        >
          See full pricing →
        </Link>
      </div>
    </div>
  );
}

function FinalCta() {
  return (
    <section aria-label="Call to action" className="bg-card border-b border-border">
      <div className="max-w-[1100px] mx-auto px-6 py-20 sm:py-28 text-center">
        <p className="font-mono text-xs tracking-[0.3em] text-primary uppercase mb-6" aria-hidden="true">
          ᛟ
        </p>
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-5">
          The tools are here. The deadlines are not waiting.
        </h2>
        <p className="font-body text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
          Start with a free Thrall account — no card required, no time limit.
          Upgrade to Karl when you&apos;re ready for the full arsenal.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/ledger"
            className={[
              "inline-flex items-center justify-center px-10 py-4",
              "font-heading text-sm font-bold tracking-widest uppercase",
              "bg-primary text-primary-foreground",
              "hover:brightness-110 transition-all",
              "rounded-sm",
            ].join(" ")}
            data-app-link
          >
            Open the Ledger
          </Link>
          <Link
            href="/pricing"
            className={[
              "inline-flex items-center justify-center px-6 py-3",
              "font-heading text-xs font-bold tracking-widest uppercase",
              "border border-border text-foreground",
              "hover:bg-muted transition-colors",
              "rounded-sm",
            ].join(" ")}
          >
            View Pricing
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FeaturesPage() {
  return (
    <>
      <PageHero />
      <ThrallSectionHeading />
      {THRALL_FEATURES.map((feature) => (
        <FeatureSection key={feature.id} feature={feature} />
      ))}
      <TierDivider />
      {KARL_FEATURES.map((feature) => (
        <FeatureSection key={feature.id} feature={feature} />
      ))}
      <FinalCta />
    </>
  );
}
