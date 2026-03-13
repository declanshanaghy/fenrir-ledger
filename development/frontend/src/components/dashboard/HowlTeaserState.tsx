"use client";

/**
 * HowlTeaserState — Karl-tier teaser for Thrall users on The Howl tab.
 *
 * Renders hardcoded fake sample alerts (blurred, non-interactive) behind an
 * upsell overlay prompting upgrade to Karl.
 *
 * Important:
 *   - NO real user data is ever used. All alerts are hardcoded strings.
 *   - The teaser list has filter: blur(6px), pointer-events: none,
 *     user-select: none, and aria-hidden="true".
 *   - The overlay links to /pricing.
 *
 * Wireframe: ux/wireframes/app/howl-karl-tier.html
 * Issue: #398
 */

import Link from "next/link";
import { cn } from "@/lib/utils";

// ── Fake sample alert data (hardcoded, never from user store) ────────────────

interface SampleAlert {
  id: string;
  urgencyLabel: string;
  rune: string;
  issuer: string;
  cardName: string;
  amount: string;
  deadline: string;
}

const SAMPLE_ALERTS: SampleAlert[] = [
  {
    id: "sample-1",
    urgencyLabel: "ANNUAL FEE \u00B7 7 DAYS REMAINING",
    rune: "ᚦ",
    issuer: "CHASE SAPPHIRE",
    cardName: "Preferred Reserve",
    amount: "$95 annual fee due Mar 15",
    deadline: "Sk\u00F6ll\u2019s bite: 7 days",
  },
  {
    id: "sample-2",
    urgencyLabel: "PROMO EXPIRING \u00B7 14 DAYS REMAINING",
    rune: "ᚷ",
    issuer: "AMEX GOLD",
    cardName: "Spend $4,000 by Apr 1",
    amount: "$2,100 remaining to unlock 75,000 pts",
    deadline: "Welcome Mead deadline: Apr 1",
  },
  {
    id: "sample-3",
    urgencyLabel: "ANNUAL FEE \u00B7 30 DAYS REMAINING",
    rune: "ᚹ",
    issuer: "CAPITAL ONE",
    cardName: "Venture X Rewards",
    amount: "$395 annual fee due Apr 2",
    deadline: "The Norns have spoken: 30 days",
  },
];

// ── Sample alert card (fake, blurred) ────────────────────────────────────────

function SampleAlertCard({ alert }: { alert: SampleAlert }) {
  return (
    <div className="border border-border flex flex-col">
      {/* Urgency header */}
      <div className="flex items-center gap-1.5 px-3.5 py-1.5 border-b border-border">
        <span
          className="h-2 w-2 rounded-full shrink-0 bg-[hsl(var(--realm-muspel))]"
          aria-hidden="true"
        />
        <span className="text-xs font-heading uppercase tracking-wide text-muted-foreground">
          {alert.urgencyLabel}
        </span>
      </div>
      {/* Card identity */}
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-border">
        <span
          className="w-9 h-9 border-2 border-border rounded-full flex items-center justify-center text-sm shrink-0"
          style={{ fontFamily: "serif" }}
          aria-hidden="true"
        >
          {alert.rune}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-heading font-bold text-foreground truncate">
            {alert.issuer}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {alert.cardName}
          </p>
        </div>
      </div>
      {/* Body */}
      <div className="px-3.5 py-2.5 flex flex-col gap-1">
        <p className="text-sm font-semibold text-foreground">{alert.amount}</p>
        <p className="text-xs text-muted-foreground">{alert.deadline}</p>
      </div>
    </div>
  );
}

// ── Upsell overlay ───────────────────────────────────────────────────────────

function HowlUpsellOverlay() {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="false"
      aria-label="Unlock The Howl \u2014 Karl tier feature"
    >
      <div
        className={cn(
          "border-2 border-gold/40 bg-background",
          "max-w-[380px] w-[90%]",
          "flex flex-col items-center gap-4 p-8 text-center"
        )}
      >
        {/* Wolf icon */}
        <span
          className="w-14 h-14 border-2 border-gold/40 rounded-full flex items-center justify-center text-2xl"
          aria-hidden="true"
        >
          {"\uD83D\uDC3A"}
        </span>

        <h3 className="text-xl font-display font-bold text-foreground">
          Unlock The Howl
        </h3>

        <p className="text-sm text-muted-foreground max-w-[300px] leading-relaxed font-body">
          Proactive fee alerts and promo deadline warnings &mdash; the wolf
          watches your chains so you never miss a critical date.
        </p>

        {/* Feature list */}
        <ul
          className="flex flex-col gap-1.5 text-sm text-left w-full px-2"
          aria-label="Karl tier Howl features"
        >
          {[
            "Upcoming fee alerts with urgency ranking",
            "Welcome bonus deadline countdowns",
            "Ragnar\u00F6k alert when \u22655 urgent cards pile up",
            "Proactive notifications before you lose value",
          ].map((feat) => (
            <li key={feat} className="flex items-start gap-2">
              <span className="text-primary text-sm shrink-0 mt-0.5">{"\u2713"}</span>
              <span className="text-foreground/90 font-body">{feat}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <Link
          href="/pricing"
          className={cn(
            "w-full border-2 border-gold bg-gold text-primary-foreground",
            "py-2.5 px-7 text-sm font-heading font-bold uppercase tracking-wide",
            "hover:bg-primary hover:brightness-110 transition-colors",
            "text-center min-h-[44px] flex items-center justify-center"
          )}
        >
          Upgrade to Karl &mdash; $3.99/month
        </Link>

        {/* Secondary link */}
        <Link
          href="/pricing"
          className="text-xs text-muted-foreground underline hover:text-foreground transition-colors font-body"
        >
          See all Karl features &rarr;
        </Link>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

/**
 * HowlTeaserState — blurred fake alerts + upsell overlay for Thrall users.
 * Self-contained: no props, no data fetching, no real user data.
 */
export function HowlTeaserState() {
  return (
    <div className="relative flex-1 overflow-hidden" data-testid="howl-teaser-state">
      {/* Blurred fake sample alerts (behind overlay) */}
      <div
        className="flex flex-col gap-3 p-5"
        aria-hidden="true"
        role="presentation"
        style={{
          filter: "blur(6px)",
          pointerEvents: "none",
          userSelect: "none",
          opacity: 0.55,
        }}
      >
        {SAMPLE_ALERTS.map((alert) => (
          <SampleAlertCard key={alert.id} alert={alert} />
        ))}
      </div>

      {/* Upsell overlay (above blurred teaser) */}
      <HowlUpsellOverlay />
    </div>
  );
}
