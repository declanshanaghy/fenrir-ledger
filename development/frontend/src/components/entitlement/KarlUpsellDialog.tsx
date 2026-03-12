"use client";

/**
 * KarlUpsellDialog — Common Karl Tier Upsell Dialog
 *
 * Shared dialog used by ALL Karl-gated features:
 *   - Valhalla (#377): card archive/graveyard view
 *   - Howl (#398): Howl alert panel (priority alerts)
 *   - Velocity (#378): spending velocity analytics
 *   - Any future Karl feature uses the same dialog
 *
 * Layout:
 *   Desktop (≥ md): two-column grid — icon+copy left, features+CTA right
 *   Mobile (< md): single column, stacked vertically
 *
 * Flow:
 *   Authenticated user → POST /api/stripe/checkout → redirect to Stripe
 *   Anonymous user → redirect to sign-in with returnTo for checkout
 *
 * Dismiss behavior:
 *   "Not now" / ✕ / Escape / backdrop click → closes dialog, no permanent flag.
 *
 * Wireframe: ux/wireframes/stripe-direct/karl-upsell-dialog.html
 *            ux/wireframes/stripe-direct/karl-upsell-dialog-artwork.html (#560)
 * Interaction spec: ux/karl-upsell-interaction-spec.md
 * Issues: #377, #378, #398, #488, #559, #560
 *
 * @module entitlement/KarlUpsellDialog
 */

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ThemedFeatureImage } from "@/components/shared/ThemedFeatureImage";
import { useEntitlement } from "@/hooks/useEntitlement";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface KarlUpsellDialogProps {
  /** Rune glyph or icon character (e.g. "ᛏ" for Valhalla, "ᚲ" for Howl) */
  featureIcon: string;
  /** Plain feature name (e.g. "Valhalla") */
  featureName: string;
  /** Voice 2 atmospheric one-liner (e.g. "Hall of the Honored Dead") */
  featureTagline: string;
  /** Voice 1 functional description of what the user is missing */
  featureTeaser: string;
  /** List of benefit strings shown as a checklist in the right column */
  featureBenefits: readonly string[];
  /** Base filename for /images/features/ artwork (e.g. "valhalla" → valhalla-dark.png, valhalla-light.png). Same images as /features page. */
  featureImage: string;
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when the dialog is dismissed (X, "Not now", Escape, backdrop) */
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Common Karl tier upsell dialog. Accepts feature-specific props so the same
 * component can be reused by Valhalla, Howl, Velocity, and any future Karl feature.
 *
 * Two-column layout on desktop (icon+copy left, features+CTA right).
 * Collapses to single column on mobile (min 375px).
 *
 * The dialog triggers Stripe Checkout directly — no intermediate /pricing page.
 */
export function KarlUpsellDialog({
  featureIcon,
  featureName,
  featureTagline,
  featureTeaser,
  featureBenefits,
  featureImage,
  open,
  onDismiss,
}: KarlUpsellDialogProps) {
  const { subscribeStripe } = useEntitlement();
  const [isSubscribing, setIsSubscribing] = useState(false);

  const handleSubscribe = useCallback(async () => {
    setIsSubscribing(true);
    try {
      await subscribeStripe();
    } catch {
      setIsSubscribing(false);
    }
  }, [subscribeStripe]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss()}>
      <DialogContent
        className={cn(
          /* Mobile: full-width bottom-sheet */
          "w-[92vw] max-h-[90vh] overflow-y-auto",
          "border-2 border-gold/40 bg-background p-0 gap-0",
          /* Desktop: wider to accommodate two columns */
          "md:max-w-[680px]",
          /* Single-column mobile default, wider on desktop */
          "max-w-[460px]",
          /* Desktop: centered dialog — sm:bottom-auto resets mobile bottom-sheet anchor */
          "sm:top-[50%] sm:bottom-auto sm:translate-y-[-50%] sm:translate-x-[-50%] sm:left-[50%] sm:rounded-lg",
          /* Mobile: bottom-sheet */
          "top-auto bottom-0 translate-y-0 left-[50%] rounded-t-lg rounded-b-none",
        )}
        style={{ zIndex: 210 }}
      >
        {/* ── Header — static: tier name + price ─────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div>
            <span className="block font-mono text-[10px] tracking-[0.1em] uppercase font-bold text-muted-foreground">
              Karl Tier Feature
            </span>
            <span className="block font-mono text-[9px] tracking-[0.06em] text-muted-foreground/70 mt-0.5">
              KARL &middot; $3.99/month
            </span>
          </div>
          {/* Close button is provided by DialogContent's built-in X */}
        </div>

        {/* ── Two-column body ────────────────────────────────────────── */}
        <div className="flex flex-col md:grid md:grid-cols-2 md:gap-0">

          {/* ── Left column: image + icon + name + tagline + teaser ──── */}
          <div className="flex flex-col md:border-r md:border-border">
            {/* Feature image — same artwork as /features page */}
            <div className="w-full border-b border-border overflow-hidden">
              <ThemedFeatureImage
                image={featureImage}
                alt={`${featureName} feature artwork`}
                width={600}
                height={450}
                shimmer={false}
                hoverEffect={false}
                className="rounded-none border-0"
              />
            </div>
            {/* Feature hero — prop-driven */}
            <div className="flex flex-col items-center gap-2.5 px-5 pt-4 pb-5 border-b border-border md:border-b-0 md:flex-1 md:justify-center">
              {/* Feature icon with lock badge */}
              <div
                className="relative w-[56px] h-[56px] sm:w-[72px] sm:h-[72px] border border-dashed border-border flex items-center justify-center"
                aria-hidden="true"
              >
                <span
                  className="text-2xl sm:text-[32px] text-primary leading-none select-none"
                  style={{ fontFamily: "serif" }}
                >
                  {featureIcon}
                </span>
                {/* Lock badge */}
                <span
                  className="absolute -bottom-1.5 -right-1.5 w-4 h-4 sm:w-5 sm:h-5 border border-border bg-background flex items-center justify-center text-[8px] sm:text-[10px] rounded-sm"
                  aria-hidden="true"
                >
                  &#128274;
                </span>
              </div>

              {/* Feature name */}
              <DialogTitle className="font-display text-xl sm:text-[20px] font-bold text-center uppercase tracking-wide text-foreground">
                {featureName}
              </DialogTitle>

              {/* Feature tagline — Voice 2 atmospheric */}
              <p
                className="text-[11px] italic text-muted-foreground/80 text-center font-body"
                aria-hidden="true"
              >
                {featureTagline}
              </p>

              {/* Feature teaser — what user is missing (Voice 1) */}
              <div className="border border-dashed border-border p-3 sm:p-3.5 w-full mt-1">
                <strong className="block text-[11px] font-mono uppercase tracking-[0.06em] text-muted-foreground mb-1">
                  What you&apos;re missing
                </strong>
                <DialogDescription className="text-xs sm:text-[12px] text-foreground/90 leading-relaxed font-body">
                  {featureTeaser}
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* ── Right column: benefits + CTA ─────────────────────────── */}
          <div className="flex flex-col px-5 py-5 gap-4">

            {/* Feature benefits checklist */}
            <ul
              className="flex flex-col gap-2 text-sm"
              aria-label={`${featureName} features`}
            >
              {featureBenefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2">
                  <span className="text-primary text-sm shrink-0 mt-0.5">{"\u2713"}</span>
                  <span className="text-foreground/90 font-body text-xs sm:text-sm leading-relaxed">{benefit}</span>
                </li>
              ))}
            </ul>

            {/* Karl tier row — static: badge + copy + price */}
            <div className="flex items-center gap-2.5 border border-border px-3 py-2.5">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.1em] border border-gold text-gold px-1.5 py-0.5 shrink-0">
                Karl
              </span>
              <span className="text-xs sm:text-[12px] text-muted-foreground font-body flex-1">
                Unlock all premium features
              </span>
              <span className="text-[13px] font-bold text-foreground whitespace-nowrap">
                $3.99/mo
              </span>
            </div>

            {/* Subscribe CTA — direct to Stripe Checkout */}
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleSubscribe}
                disabled={isSubscribing}
                isLoading={isSubscribing}
                loadingText="Redirecting..."
                className="w-full min-h-[44px] sm:min-h-[48px] text-[14px] sm:text-[15px] font-heading font-bold tracking-wide bg-gold text-primary-foreground hover:bg-primary hover:brightness-110 border-2 border-gold"
              >
                Upgrade to Karl &mdash; $3.99/month
              </Button>
              <p className="text-[11px] text-center text-muted-foreground font-body">
                Billed monthly. Cancel anytime.
              </p>
            </div>

          </div>
        </div>

        {/* ── Footer — "Not now" dismiss ─────────────────────────────── */}
        <div className="border-t border-border px-5 py-3 flex justify-center">
          <button
            type="button"
            onClick={onDismiss}
            className="text-[12px] text-muted-foreground border border-border px-4 py-2 cursor-pointer font-body hover:text-foreground hover:border-foreground/30 transition-colors min-h-[44px] inline-flex items-center"
          >
            Not now
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Pre-configured feature props for each Karl-gated feature
// ---------------------------------------------------------------------------

/**
 * Props for the Valhalla variant of KarlUpsellDialog.
 * Usage: <KarlUpsellDialog {...KARL_UPSELL_VALHALLA} open={...} onDismiss={...} />
 */
export const KARL_UPSELL_VALHALLA = {
  featureIcon: "ᛏ", // Tiwaz rune
  featureName: "Valhalla",
  featureTagline: "Hall of the Honored Dead",
  featureTeaser:
    "See every card you've closed \u2014 anniversary dates, total rewards extracted, annual fees avoided, and how long each chain held you.",
  featureBenefits: [
    "Full archive of closed and graduated cards",
    "Anniversary dates and tenure tracking",
    "Total rewards extracted per card",
    "Annual fees avoided over time",
  ] as const,
  featureImage: "valhalla",
} as const;

/**
 * Props for the Howl variant of KarlUpsellDialog (#398).
 * Usage: <KarlUpsellDialog {...KARL_UPSELL_HOWL} open={...} onDismiss={...} />
 */
export const KARL_UPSELL_HOWL = {
  featureIcon: "ᚲ", // Kenaz rune
  featureName: "The Howl",
  featureTagline: "The Wolf Cries Before the Chain Breaks",
  featureTeaser:
    "Get notified before fees strike. Howl surfaces your most urgent deadlines and lets you act in one tap \u2014 before it costs you.",
  featureBenefits: [
    "Upcoming fee alerts with urgency ranking",
    "Welcome bonus deadline countdowns",
    "Ragnar\u00F6k alert when \u22655 urgent cards pile up",
    "Proactive notifications before you lose value",
  ] as const,
  featureImage: "garmr",
} as const;

/**
 * Props for the Velocity variant of KarlUpsellDialog (#378).
 * Usage: <KarlUpsellDialog {...KARL_UPSELL_VELOCITY} open={...} onDismiss={...} />
 */
export const KARL_UPSELL_VELOCITY = {
  featureIcon: "ᛊ", // Sowilo rune
  featureName: "Velocity",
  featureTagline: "How Fast Does Your Plunder Flow?",
  featureTeaser:
    "Track your spend rate against welcome bonus targets to make sure you hit every threshold before the deadline.",
  featureBenefits: [
    "Real-time spend tracking against bonus targets",
    "Daily spend pace recommendations",
    "Deadline countdown with progress bars",
    "Alerts when you fall behind target pace",
  ] as const,
  featureImage: "norns",
} as const;

/**
 * Props for the Import variant of KarlUpsellDialog (#559).
 * Usage: <KarlUpsellDialog {...KARL_UPSELL_IMPORT} open={...} onDismiss={...} />
 */
export const KARL_UPSELL_IMPORT = {
  featureIcon: "ᛚ", // Laguz rune (flow, water — data flowing in)
  featureName: "Import",
  featureTagline: "The Runes Inscribed Afar Shall Be Read Here",
  featureTeaser:
    "Import cards from Google Sheets, CSV, or Excel files \u2014 your history flows into Fenrir with one click.",
  featureBenefits: [
    "Import from Google Sheets URLs",
    "Browse your Google Drive with Picker",
    "Upload CSV and Excel files",
    "Automatic deduplication of existing cards",
  ] as const,
  featureImage: "mimir",
} as const;
