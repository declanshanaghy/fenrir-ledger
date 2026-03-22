/**
 * DataSafetyBanner — shared trust/safety messaging component for marketing pages.
 *
 * Communicates the core trust message: Fenrir tracks card METADATA (names, issuers,
 * fees, deadlines) and NEVER collects, stores, or transmits card numbers, CVVs,
 * PINs, or passwords.
 *
 * Variants:
 *   - full:    Two-column include/exclude layout (Home, Features, About)
 *   - compact: Single horizontal trust line (Pricing, FAQ context)
 *   - inline:  Tight card with icon + chips (Features Smart Import, About Heimdall)
 *   - footer:  Minimal trust line for marketing footer
 *
 * Wireframe: ux/wireframes/marketing-site/data-safety-banner.html
 * Issue: #644
 */

import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DataSafetyBannerProps {
  /** Visual variant — determines layout and visual weight */
  variant?: "full" | "compact" | "inline" | "footer";
  /** Context-specific label for screen readers */
  ariaLabel?: string;
  /** For variant="inline": heading text override */
  headingOverride?: string;
  /** For variant="inline": lead paragraph text override */
  descriptionOverride?: string;
  /** For variant="compact": link text (default: "Learn more") */
  learnMoreText?: string;
  /** For variant="compact": link href (default: "/about#data-safety") */
  learnMoreHref?: string;
  /** For variant="full": show wolf-voice closing line (default: true) */
  showFooterLine?: boolean;
  /** CSS class passthrough for placement adjustments */
  className?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const INCLUDE_ITEMS = [
  'Card name & product (e.g., "Sapphire Preferred")',
  'Card issuer (e.g., "Chase", "Amex", "Capital One")',
  "Annual fee amount & renewal date",
  "Sign-up bonus details, spend threshold & deadline",
  "Card open date & credit limit",
  "Spending notes you add manually",
  "Custom alerts and reminders you set",
] as const;

const EXCLUDE_ITEMS = [
  "Credit card numbers (16-digit PAN)",
  "CVV / CVC security codes",
  "Card PINs",
  "Online banking passwords",
  "Social Security numbers",
  "Bank account numbers or routing numbers",
  "Actual transaction data or purchase history",
] as const;

const TRACKED_CHIPS = [
  { label: "Card name", ariaPrefix: "Tracked" },
  { label: "Issuer", ariaPrefix: "Tracked" },
  { label: "Annual fee", ariaPrefix: "Tracked" },
  { label: "Bonus deadline", ariaPrefix: "Tracked" },
] as const;

const NEVER_CHIPS = [
  { label: "Card number", ariaPrefix: "Never collected" },
  { label: "CVV", ariaPrefix: "Never collected" },
  { label: "PIN", ariaPrefix: "Never collected" },
  { label: "Password", ariaPrefix: "Never collected" },
] as const;

// ── Variant: Full ─────────────────────────────────────────────────────────────

function FullBanner({
  ariaLabel,
  showFooterLine,
  className,
}: {
  ariaLabel: string;
  showFooterLine: boolean;
  className?: string;
}) {
  return (
    <section
      className={[
        "border-2 border-amber-600/40 bg-amber-500/[0.08] p-6 max-[375px]:p-4",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="note"
      aria-label={ariaLabel}
      aria-labelledby="dsb-title"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <span
          className="w-8 h-8 border border-amber-600/30 flex items-center justify-center text-lg text-amber-600 dark:text-amber-400 shrink-0"
          aria-hidden="true"
        >
          ᛊ
        </span>
        <h3
          className="font-heading text-base font-extrabold uppercase tracking-[0.06em] text-foreground"
          id="dsb-title"
        >
          What Fenrir Tracks — and What It Never Touches
        </h3>
      </div>

      {/* Lead */}
      <p className="font-body text-sm max-[375px]:text-[13px] leading-[1.65] text-muted-foreground mb-5 max-w-[640px]">
        Fenrir is a <strong className="text-foreground">card metadata tracker</strong> — not
        a payment processor. I watch your card names, issuers, fees, and deadlines. I never
        see, store, or transmit credit card numbers, CVVs, PINs, or passwords. Not during
        import. Not in the ledger. Not ever.
      </p>

      {/* Two-column include/exclude grid */}
      <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-5">
        {/* Include column */}
        <div
          className="border border-border p-4"
          aria-label="What Fenrir Ledger tracks"
        >
          <div className="flex items-center gap-2 mb-2.5">
            <span
              className="font-mono text-sm text-primary"
              aria-hidden="true"
            >
              ✓
            </span>
            <h4 className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
              What Fenrir Tracks
            </h4>
          </div>
          <ul className="flex flex-col gap-0">
            {INCLUDE_ITEMS.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 py-[3px] text-[13px] leading-[1.7] text-muted-foreground"
              >
                <span
                  className="shrink-0 font-mono text-[11px] text-primary mt-[3px]"
                  aria-hidden="true"
                >
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Exclude column */}
        <div
          className="border border-border p-4"
          aria-label="What Fenrir Ledger never collects"
        >
          <div className="flex items-center gap-2 mb-2.5">
            <span
              className="font-mono text-sm text-amber-600 dark:text-amber-400"
              aria-hidden="true"
            >
              ✗
            </span>
            <h4 className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
              What Fenrir Never Touches
            </h4>
          </div>
          <ul className="flex flex-col gap-0">
            {EXCLUDE_ITEMS.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 py-[3px] text-[13px] leading-[1.7] text-amber-700 dark:text-amber-400/80"
              >
                <span
                  className="shrink-0 font-mono text-[11px] text-amber-600 dark:text-amber-400 mt-[3px]"
                  aria-hidden="true"
                >
                  ✗
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Footer line */}
      {showFooterLine && (
        <p className="mt-4 pt-3.5 border-t border-border font-body text-xs italic text-muted-foreground leading-[1.5]">
          <span aria-hidden="true">ᛟ</span> &nbsp; I was born to guard, not
          to harvest. The ledger holds your strategy — never your secrets.
        </p>
      )}
    </section>
  );
}

// ── Variant: Compact ──────────────────────────────────────────────────────────

function CompactBanner({
  ariaLabel,
  learnMoreText,
  learnMoreHref,
  className,
}: {
  ariaLabel: string;
  learnMoreText: string;
  learnMoreHref: string;
  className?: string;
}) {
  return (
    <div
      className={[
        "flex items-center gap-2.5 px-4 py-3 border border-border flex-wrap max-[480px]:flex-wrap",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="note"
      aria-label={ariaLabel}
    >
      <span
        className="text-base text-amber-600 dark:text-amber-400 shrink-0"
        aria-hidden="true"
      >
        ᛊ
      </span>
      <span className="font-body text-[13px] leading-[1.5] text-muted-foreground">
        Fenrir never collects credit card numbers, CVVs, PINs, or passwords —
        only card metadata.
      </span>
      <Link
        href={learnMoreHref}
        className="font-body text-xs underline text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap ml-auto max-[480px]:ml-0 px-1 min-h-[44px] flex items-center shrink-0"
        aria-label="Learn more about data safety"
      >
        {learnMoreText}
      </Link>
    </div>
  );
}

// ── Variant: Inline ───────────────────────────────────────────────────────────

function InlineBanner({
  ariaLabel,
  headingOverride,
  descriptionOverride,
  className,
}: {
  ariaLabel: string;
  headingOverride?: string;
  descriptionOverride?: string;
  className?: string;
}) {
  return (
    <div
      className={[
        "p-5 flex gap-4 items-start max-[480px]:flex-col",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="note"
      aria-label={ariaLabel}
    >
      {/* Icon */}
      <div
        className="shrink-0 w-10 h-10 max-[480px]:w-9 max-[480px]:h-9 border border-amber-600/30 flex items-center justify-center text-xl text-amber-600 dark:text-amber-400"
        aria-hidden="true"
      >
        ᛊ
      </div>

      {/* Content */}
      <div className="flex-1">
        <h4 className="font-heading text-[13px] font-bold uppercase tracking-[0.08em] text-foreground mb-1.5">
          {headingOverride ?? "Safe By Design"}
        </h4>
        <p className="font-body text-[13px] leading-[1.65] text-muted-foreground">
          {descriptionOverride ??
            "Smart Import reads card names, issuers, fees, and dates from your spreadsheet. It is architecturally incapable of collecting card numbers, CVVs, PINs, or passwords — those fields are not mapped, not stored, and not transmitted."}
        </p>

        {/* Chips */}
        <div
          className="flex flex-wrap gap-2 mt-2.5"
          aria-label="What Fenrir tracks vs. never touches"
        >
          {TRACKED_CHIPS.map((chip) => (
            <span
              key={chip.label}
              className="font-mono text-[11px] tracking-[0.12em] uppercase font-semibold border border-border px-2.5 py-[3px] text-foreground/70"
              aria-label={`${chip.ariaPrefix}: ${chip.label}`}
            >
              {chip.label} ✓
            </span>
          ))}
          {NEVER_CHIPS.map((chip) => (
            <span
              key={chip.label}
              className="font-mono text-[11px] tracking-[0.12em] uppercase font-semibold border border-amber-600/40 px-2.5 py-[3px] text-amber-700 dark:text-amber-400/80"
              aria-label={`${chip.ariaPrefix}: ${chip.label}`}
            >
              {chip.label} ✗
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Variant: Footer ───────────────────────────────────────────────────────────

function FooterBanner({
  ariaLabel,
  className,
}: {
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      className={[
        "flex items-center gap-2 py-2.5 border-t border-border text-xs",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="note"
      aria-label={ariaLabel}
    >
      <span
        className="text-[13px] text-amber-600 dark:text-amber-400 shrink-0"
        aria-hidden="true"
      >
        ᛊ
      </span>
      <span className="font-body text-muted-foreground">
        Fenrir Ledger never collects credit card numbers, CVVs, PINs, or
        passwords. Only card metadata is stored.
      </span>
    </div>
  );
}

// ── Exported Component ────────────────────────────────────────────────────────

export function DataSafetyBanner({
  variant = "full",
  ariaLabel = "Data safety guarantee",
  headingOverride,
  descriptionOverride,
  learnMoreText = "Learn more",
  learnMoreHref = "/about#data-safety",
  showFooterLine = true,
  className,
}: DataSafetyBannerProps) {
  switch (variant) {
    case "full":
      return (
        <FullBanner
          ariaLabel={ariaLabel}
          showFooterLine={showFooterLine}
          {...(className !== undefined ? { className } : {})}
        />
      );
    case "compact":
      return (
        <CompactBanner
          ariaLabel={ariaLabel}
          learnMoreText={learnMoreText}
          learnMoreHref={learnMoreHref}
          {...(className !== undefined ? { className } : {})}
        />
      );
    case "inline":
      return (
        <InlineBanner
          ariaLabel={ariaLabel}
          {...(headingOverride !== undefined ? { headingOverride } : {})}
          {...(descriptionOverride !== undefined ? { descriptionOverride } : {})}
          {...(className !== undefined ? { className } : {})}
        />
      );
    case "footer":
      return (
        <FooterBanner
          ariaLabel={ariaLabel}
          {...(className !== undefined ? { className } : {})}
        />
      );
    default:
      return null;
  }
}
