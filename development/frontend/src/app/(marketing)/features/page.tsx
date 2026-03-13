/**
 * Features Page — /features
 *
 * Showcases all 9 real-value features of Fenrir Ledger in an alternating
 * 2-column layout. Thrall (free) features first, Karl (paid) features after
 * a tier divider. Norse voice throughout.
 *
 * Features:
 *   Thrall (Free) — The Lone Wolf:
 *     01. Add Your Cards
 *     02. The Dashboard
 *     03. Card Notes
 *   Karl ($3.99/mo):
 *     04. Smart Import (The Rune-Reader)
 *     05. Annual Fee Tracking (Sköll)
 *     06. Sign-Up Bonus Tracking (Hati)
 *     07. The Howl
 *     08. Velocity Management
 *     09. Valhalla (Card Archive)
 *     10. Cloud Sync
 *     11. Multi-Household
 *     12. Data Export
 *
 * Wireframe: ux/wireframes/marketing-site/features.html
 * export const dynamic = 'force-static' — no server data fetching.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ThemedFeatureImage } from "@/components/shared/ThemedFeatureImage";

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
  /** Base filename for images in /images/features/ (e.g. "skoll" → skoll-dark.png, skoll-light.png) */
  image: string;
  /** Wikipedia URL for the Norse character */
  wikiUrl: string;
}

// ── Data ──────────────────────────────────────────────────────────────────────

const THRALL_FEATURES: FeatureDetail[] = [
  {
    id: "add-your-cards",
    rune: "ᚠ",
    eyebrow: "Feature 01 · Add Your Cards",
    title: "The Foundation of the Ledger",
    benefit:
      "Enter every card you carry — name, issuer, open date, fee date, bonus details. This is where your ledger begins.",
    description:
      "Fenrir starts with a simple truth: you need to record the cards you hold. Add Your Cards gives you a clean, structured form to enter every credit card in your wallet — one by one, with the details that matter. Card name, issuer, date opened, annual fee date, sign-up bonus amount and deadline. No spreadsheet required. No imports. Just you and the ledger.",
    details: [
      "Add cards with name, issuer, open date, and fee anniversary",
      "Record annual fee amount and sign-up bonus details",
      "Set minimum spend thresholds and bonus deadlines",
      "Edit or remove cards anytime",
    ],
    atmospheric: "Every saga begins with a single rune carved into stone.",
    tier: "thrall",
    reverse: false,
    image: "fenrir",
    wikiUrl: "https://en.wikipedia.org/wiki/Fenrir",
  },
  {
    id: "the-dashboard",
    rune: "ᚱ",
    eyebrow: "Feature 02 · The Dashboard",
    title: "All Your Cards at a Glance",
    benefit:
      "See every active card in one place — with status badges, sortable columns, and quick filters. No hunting. No guessing.",
    description:
      "The Dashboard is where your ledger comes alive. Every card you've added appears in a clean, scannable list with status indicators: approaching fee dates, active bonus windows, spend progress. Sort by issuer, fee date, or status. Filter by what needs attention. It's your command center — without the clutter.",
    details: [
      "All active cards displayed in a sortable list",
      "Status badges for fee approaching, bonus active, and spend progress",
      "Quick filters by issuer, status, or date range",
      "Responsive layout — works on mobile and desktop",
    ],
    atmospheric: "The ravens see all. From above, nothing is hidden.",
    tier: "thrall",
    reverse: true,
    image: "huginn-muninn",
    wikiUrl: "https://en.wikipedia.org/wiki/Huginn_and_Muninn",
  },
  {
    id: "card-notes",
    rune: "ᛗ",
    eyebrow: "Feature 03 · Card Notes",
    title: "The Memory of Mimir",
    benefit:
      "Add free-text notes to any card. Track perks, retention offers, product change history, and anything else you need to remember.",
    description:
      "Every card carries a story beyond its dates and fees. Card Notes lets you attach free-text notes to any card in your ledger — retention offers you negotiated, perks you discovered, product changes you're considering, or reminders for your next annual fee call. Your memory, your rules.",
    details: [
      "Add unlimited free-text notes to any card",
      "Track retention offers, perks, and product change history",
      "Notes persist across sessions and devices (with Cloud Sync)",
      "Searchable notes for quick reference",
    ],
    atmospheric: "Mimir's well holds the memory of all things. Drink, and remember.",
    tier: "thrall",
    reverse: false,
    image: "mimir",
    wikiUrl: "https://en.wikipedia.org/wiki/M%C3%ADmir",
  },
];

const KARL_FEATURES: FeatureDetail[] = [
  {
    id: "smart-import",
    rune: "ᛗ",
    eyebrow: "Feature 04 · Smart Import",
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
    image: "mimir",
    wikiUrl: "https://en.wikipedia.org/wiki/M%C3%ADmir",
  },
  {
    id: "annual-fee-tracking",
    rune: "ᛊ",
    eyebrow: "Feature 05 · Annual Fee Tracking",
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
    tier: "karl",
    reverse: true,
    image: "skoll",
    wikiUrl: "https://en.wikipedia.org/wiki/Sk%C3%B6ll",
  },
  {
    id: "signup-bonus-tracking",
    rune: "ᚺ",
    eyebrow: "Feature 06 · Sign-Up Bonus Tracking",
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
    tier: "karl",
    reverse: false,
    image: "hati",
    wikiUrl: "https://en.wikipedia.org/wiki/Hati_Hr%C3%B3%C3%B0vitnisson",
  },
  {
    id: "the-howl",
    rune: "ᛉ",
    eyebrow: "Feature 07 · The Howl",
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
    tier: "karl",
    reverse: true,
    image: "garmr",
    wikiUrl: "https://en.wikipedia.org/wiki/Garmr",
  },
  {
    id: "velocity-management",
    rune: "ᚹ",
    eyebrow: "Feature 08 · Velocity Management",
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
    tier: "karl",
    reverse: false,
    image: "norns",
    wikiUrl: "https://en.wikipedia.org/wiki/Norns",
  },
  {
    id: "valhalla",
    rune: "ᛏ",
    eyebrow: "Feature 09 · Valhalla",
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
    reverse: true,
    image: "valhalla",
    wikiUrl: "https://en.wikipedia.org/wiki/Valhalla",
  },
  {
    id: "cloud-sync",
    rune: "ᚲ",
    eyebrow: "Feature 10 · Cloud Sync",
    title: "Your Ledger Follows You",
    benefit:
      "Add a card on mobile. See it on desktop. Your data syncs across every device via your Google account — no manual export, no sync button.",
    description:
      "Cloud Sync stores your card data in Fenrir's servers, tied to your Google identity. Every change — new card, updated fee date, earned bonus — propagates instantly across all your signed-in devices. The ledger is always current.",
    details: [
      "Real-time sync across all devices signed into your Google account",
      "Data stored securely in Fenrir's cloud",
      "No manual export / import required between devices",
      "Offline changes sync on reconnect",
    ],
    atmospheric: "The wolf who roams far keeps his saga close.",
    tier: "karl",
    reverse: false,
    image: "huginn-muninn",
    wikiUrl: "https://en.wikipedia.org/wiki/Huginn_and_Muninn",
  },
  {
    id: "multi-household",
    rune: "ᛟ",
    eyebrow: "Feature 11 · Multi-Household",
    title: "Many Wolves, One Den",
    benefit:
      "Manage cards across an entire household, with many accounts. Your cards, your partner's cards, all one ledger, separate logins.",
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
    image: "fenrir",
    wikiUrl: "https://en.wikipedia.org/wiki/Fenrir",
  },
  {
    id: "data-export",
    rune: "ᛞ",
    eyebrow: "Feature 12 · Data Export",
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
    reverse: false,
    image: "tyr",
    wikiUrl: "https://en.wikipedia.org/wiki/T%C3%BDr",
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

/**
 * FeatureImage — wraps shared ThemedFeatureImage for the features page context.
 * Hover effects (shimmer + scale + glow) are enabled since this is a browse context.
 */
function FeatureImage({ feature }: { feature: FeatureDetail }) {
  return (
    <ThemedFeatureImage
      image={feature.image}
      alt={`${feature.title} — ${feature.eyebrow}`}
    />
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
        <a
          href={feature.wikiUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-primary/40 underline-offset-4 hover:decoration-primary transition-colors"
        >
          {feature.title}
        </a>
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

  const visual = <FeatureImage feature={feature} />;

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
          ᛏ · The Lone Wolf
        </p>
        <h2 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-wide text-foreground mb-3">
          One Device, One Wolf
        </h2>
        <p className="font-body text-base text-muted-foreground max-w-xl leading-relaxed mb-4">
          Your ledger lives on this device, no account needed. Start tracking immediately
          — no sign-up, no email, no Google. Up to 5 cards, forever free.
        </p>
        <ul className="flex flex-col sm:flex-row flex-wrap gap-x-6 gap-y-2" aria-label="Lone Wolf benefits">
          {[
            "One device, one wolf — your ledger, your device",
            "No sign-up required — start tracking immediately",
            "Up to 5 cards — track your most important cards, forever free",
            "Privacy-first — data stays on your device, never touches a server",
          ].map((point) => (
            <li
              key={point}
              className="flex items-start gap-2 font-body text-sm text-muted-foreground"
            >
              <span className="shrink-0 font-mono text-[10px] text-primary mt-0.5" aria-hidden="true">ᚢ</span>
              {point}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function UpgradeHook() {
  return (
    <div className="border-y border-border bg-muted/30">
      <div className="max-w-[1100px] mx-auto px-6 py-10 text-center">
        <blockquote className="font-body text-base sm:text-lg italic text-foreground/80 max-w-2xl mx-auto leading-relaxed">
          Outgrowing one device? Karl syncs everywhere, imports your spreadsheet,
          and tracks the rules the issuers don&apos;t want you to know.
        </blockquote>
      </div>
    </div>
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
      <UpgradeHook />
      <TierDivider />
      {KARL_FEATURES.map((feature) => (
        <FeatureSection key={feature.id} feature={feature} />
      ))}
      <FinalCta />
    </>
  );
}
