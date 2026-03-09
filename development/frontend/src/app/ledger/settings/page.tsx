"use client";

/**
 * Settings Page -- /settings route
 *
 * Central settings hub for the Fenrir Ledger. Contains:
 *   - Subscription management (Stripe) -- left column on desktop
 *   - Gated premium feature placeholders (Cloud Sync, Multi-Household, Data Export) -- right column
 *
 * Anonymous-first: accessible without a signed-in session. The settings
 * and gated sections handle their own auth/entitlement checks internally.
 *
 * Layout: two-column on desktop (md+), single-column stacked on mobile.
 * Mobile-first: 375px minimum, stacked sections with consistent spacing.
 */

import { SubscriptionGate } from "@/components/entitlement/SubscriptionGate";
import { StripeSettings } from "@/components/entitlement/StripeSettings";

// ---------------------------------------------------------------------------
// Gated feature placeholders
// ---------------------------------------------------------------------------

/**
 * Placeholder UI for the Cloud Sync premium feature.
 * Wrapped in SubscriptionGate -- Karl users see the placeholder content,
 * Thrall users see the Sealed Rune Modal.
 */
function CloudSyncSection() {
  return (
    <section
      className="border border-border p-5 flex flex-col gap-3"
      aria-label="Cloud Sync"
    >
      <h2 className="text-sm font-heading font-bold uppercase tracking-[0.08em] text-foreground">
        Cloud Sync
      </h2>
      <p className="text-base text-foreground/90 leading-relaxed font-body">
        Sync your card data across devices. Your ledger, always within reach.
      </p>
      <p className="text-[13px] italic text-muted-foreground/60 font-body">
        Coming soon to Karl supporters.
      </p>
    </section>
  );
}

/**
 * Placeholder UI for the Multi-Household premium feature.
 * Wrapped in SubscriptionGate -- Karl users see the placeholder content,
 * Thrall users see the Sealed Rune Modal.
 */
function MultiHouseholdSection() {
  return (
    <section
      className="border border-border p-5 flex flex-col gap-3"
      aria-label="Multi-Household"
    >
      <h2 className="text-sm font-heading font-bold uppercase tracking-[0.08em] text-foreground">
        Multi-Household
      </h2>
      <p className="text-base text-foreground/90 leading-relaxed font-body">
        Manage cards across multiple households from a single account.
      </p>
      <p className="text-[13px] italic text-muted-foreground/60 font-body">
        Coming soon to Karl supporters.
      </p>
    </section>
  );
}

/**
 * Placeholder UI for the Data Export premium feature.
 * Wrapped in SubscriptionGate -- Karl users see the placeholder content,
 * Thrall users see the Sealed Rune Modal.
 */
function DataExportSection() {
  return (
    <section
      className="border border-border p-5 flex flex-col gap-3"
      aria-label="Data Export"
    >
      <h2 className="text-sm font-heading font-bold uppercase tracking-[0.08em] text-foreground">
        Data Export
      </h2>
      <p className="text-base text-foreground/90 leading-relaxed font-body">
        Export your card data as CSV or JSON. Take your records anywhere.
      </p>
      <div>
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-2 min-h-[44px] md:min-h-[40px] px-4 py-2 text-base font-heading tracking-wide border border-border text-muted-foreground/60 rounded-sm cursor-not-allowed"
          aria-label="Export data (coming soon)"
        >
          <span aria-hidden="true" className="text-base">&#8615;</span>
          Export Data
        </button>
      </div>
      <p className="text-[13px] italic text-muted-foreground/60 font-body">
        Coming soon to Karl supporters.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Settings Page
// ---------------------------------------------------------------------------

/**
 * SettingsPage -- the /settings route.
 *
 * Two-column layout on desktop: subscription card on the left, tier benefit
 * cards on the right. Collapses to single-column on mobile (benefits stack
 * below the subscription card).
 */
export default function SettingsPage() {
  return (
    <div className="px-6 py-6 max-w-5xl">
      {/* Page heading */}
      <header className="mb-6 border-b border-border pb-4">
        <h1 className="font-display text-2xl text-gold tracking-wide mb-1">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-2 font-body italic">
          Forge your preferences. Shape the ledger to your will.
        </p>
      </header>

      {/* Two-column layout: subscription left, tier benefits right */}
      <div className="flex flex-col md:grid md:grid-cols-2 gap-6">
        {/* Left column: Subscription management */}
        <div className="flex flex-col gap-6">
          <StripeSettings />
        </div>

        {/* Right column: Tier benefit cards */}
        <div className="flex flex-col gap-6">
          <SubscriptionGate feature="cloud-sync">
            <CloudSyncSection />
          </SubscriptionGate>

          <SubscriptionGate feature="multi-household">
            <MultiHouseholdSection />
          </SubscriptionGate>

          <SubscriptionGate feature="data-export">
            <DataExportSection />
          </SubscriptionGate>
        </div>
      </div>
    </div>
  );
}
