"use client";

/**
 * Settings Page — /settings route
 *
 * Central settings hub for the Fenrir Ledger. Contains:
 *   - Patreon subscription management (PatreonSettings)
 *   - Gated premium feature placeholders (Cloud Sync, Multi-Household, Data Export)
 *
 * Anonymous-first: accessible without a signed-in session. The PatreonSettings
 * and gated sections handle their own auth/entitlement checks internally.
 *
 * Layout: single-column, max-width constrained, consistent with Valhalla page.
 * Mobile-first: 375px minimum, stacked sections with consistent spacing.
 */

import { PatreonGate } from "@/components/entitlement/PatreonGate";
import { PatreonSettings } from "@/components/entitlement/PatreonSettings";
import { isPatreon } from "@/lib/feature-flags";

// ---------------------------------------------------------------------------
// Gated feature placeholders
// ---------------------------------------------------------------------------

/**
 * Placeholder UI for the Cloud Sync premium feature.
 * Wrapped in PatreonGate — Karl users see the placeholder content,
 * Thrall users see the Sealed Rune Modal.
 */
function CloudSyncSection() {
  return (
    <section
      className="border border-border p-5 flex flex-col gap-3"
      aria-label="Cloud Sync"
    >
      <h2 className="text-xs font-heading font-bold uppercase tracking-[0.08em] text-saga">
        Cloud Sync
      </h2>
      <p className="text-sm text-saga/90 leading-relaxed font-body">
        Sync your card data across devices. Your ledger, always within reach.
      </p>
      <p className="text-[13px] italic text-rune/60 font-body">
        Coming soon to Karl supporters.
      </p>
    </section>
  );
}

/**
 * Placeholder UI for the Multi-Household premium feature.
 * Wrapped in PatreonGate — Karl users see the placeholder content,
 * Thrall users see the Sealed Rune Modal.
 */
function MultiHouseholdSection() {
  return (
    <section
      className="border border-border p-5 flex flex-col gap-3"
      aria-label="Multi-Household"
    >
      <h2 className="text-xs font-heading font-bold uppercase tracking-[0.08em] text-saga">
        Multi-Household
      </h2>
      <p className="text-sm text-saga/90 leading-relaxed font-body">
        Manage cards across multiple households from a single account.
      </p>
      <p className="text-[13px] italic text-rune/60 font-body">
        Coming soon to Karl supporters.
      </p>
    </section>
  );
}

/**
 * Placeholder UI for the Data Export premium feature.
 * Wrapped in PatreonGate — Karl users see the placeholder content,
 * Thrall users see the Sealed Rune Modal.
 */
function DataExportSection() {
  return (
    <section
      className="border border-border p-5 flex flex-col gap-3"
      aria-label="Data Export"
    >
      <h2 className="text-xs font-heading font-bold uppercase tracking-[0.08em] text-saga">
        Data Export
      </h2>
      <p className="text-sm text-saga/90 leading-relaxed font-body">
        Export your card data as CSV or JSON. Take your records anywhere.
      </p>
      <div>
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-2 min-h-[44px] md:min-h-[40px] px-4 py-2 text-sm font-heading tracking-wide border border-border text-rune/60 rounded-sm cursor-not-allowed"
          aria-label="Export data (coming soon)"
        >
          <span aria-hidden="true" className="text-base">&#8615;</span>
          Export Data
        </button>
      </div>
      <p className="text-[13px] italic text-rune/60 font-body">
        Coming soon to Karl supporters.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Settings Page
// ---------------------------------------------------------------------------

/**
 * SettingsPage — the /settings route.
 *
 * Renders the Patreon subscription settings and gated premium feature
 * placeholders in a single-column layout.
 */
export default function SettingsPage() {
  return (
    <div className="px-6 py-6 max-w-2xl">
      {/* Page heading */}
      <header className="mb-6 border-b border-border pb-4">
        <h1 className="font-display text-xl text-gold tracking-wide mb-1">
          Settings
        </h1>
        <p className="text-xs text-muted-foreground mt-2 font-body italic">
          Forge your preferences. Shape the ledger to your will.
        </p>
      </header>

      {/* Settings sections */}
      <div className="flex flex-col gap-6">
        {/* Subscription management — only rendered when the active platform
            matches. When Patreon is disabled (stripe mode), the section is
            hidden entirely; Stripe subscription UI will replace it later. */}
        {isPatreon() ? (
          <PatreonSettings />
        ) : (
          <section
            className="border border-border p-5 flex flex-col gap-3"
            aria-label="Subscription Management"
          >
            <h2 className="text-xs font-heading font-bold uppercase tracking-[0.08em] text-saga">
              Subscription Management
            </h2>
            <p className="text-sm text-saga/90 leading-relaxed font-body">
              Subscription management coming soon.
            </p>
          </section>
        )}

        {/* Premium feature placeholders — each wrapped in PatreonGate */}
        <PatreonGate feature="cloud-sync">
          <CloudSyncSection />
        </PatreonGate>

        <PatreonGate feature="multi-household">
          <MultiHouseholdSection />
        </PatreonGate>

        <PatreonGate feature="data-export">
          <DataExportSection />
        </PatreonGate>
      </div>
    </div>
  );
}
