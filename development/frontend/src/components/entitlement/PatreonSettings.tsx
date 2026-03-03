"use client";

/**
 * PatreonSettings — Fenrir Ledger
 *
 * Settings section for managing the Patreon subscription link.
 * Renders one of three states:
 *   1. Unlinked — "Link Patreon" button with feature preview
 *   2. Linked (Karl active) — membership info, feature status, unlink button
 *   3. Expired — warning, renew CTA, unlink button
 *
 * This component is meant to be placed inside a settings page.
 * It is wrapped in AuthGate externally — only rendered for authenticated users.
 *
 * Wireframe references:
 *   - designs/ux-design/wireframes/patreon-subscription/settings-patreon-unlinked.html
 *   - designs/ux-design/wireframes/patreon-subscription/settings-patreon-linked.html
 *   - designs/ux-design/wireframes/patreon-subscription/settings-patreon-expired.html
 *   - designs/ux-design/wireframes/patreon-subscription/unlink-confirmation.html
 *
 * @module entitlement/PatreonSettings
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useEntitlement } from "@/hooks/useEntitlement";
import { PREMIUM_FEATURES } from "@/lib/entitlement/types";
import type { PremiumFeature } from "@/lib/entitlement/types";
import { UnlinkConfirmDialog } from "./UnlinkConfirmDialog";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Ordered list of premium features for the settings display */
const FEATURE_LIST: PremiumFeature[] = [
  "cloud-sync",
  "multi-household",
  "advanced-analytics",
  "data-export",
  "extended-history",
  "cosmetic-perks",
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Feature list item showing lock/unlock status.
 */
function FeatureItem({
  feature,
  unlocked,
}: {
  feature: PremiumFeature;
  unlocked: boolean;
}) {
  const def = PREMIUM_FEATURES[feature];
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span
        className={`text-[11px] ${
          unlocked ? "text-realm-asgard" : "text-rune/50"
        }`}
        aria-hidden="true"
      >
        {unlocked ? "\u2713" : "\u{1F512}"}
      </span>
      <span className={unlocked ? "text-saga" : "text-rune"}>
        {def.name}
      </span>
    </div>
  );
}

/**
 * Loading skeleton for the Patreon settings section.
 */
function PatreonSettingsSkeleton() {
  return (
    <section
      className="border border-border p-5 flex flex-col gap-3"
      aria-busy="true"
      aria-label="Loading Patreon settings..."
    >
      <div className="skeleton h-4 w-24 rounded-sm" />
      <div className="skeleton h-4 w-64 rounded-sm" />
      <div className="skeleton h-10 w-40 rounded-sm" />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Patreon subscription settings section.
 *
 * Renders the appropriate state (unlinked, linked, expired) based on
 * the current entitlement status from useEntitlement.
 */
export function PatreonSettings() {
  const {
    tier,
    isActive,
    isLinked,
    isLoading,
    platform,
    linkPatreon,
    unlinkPatreon,
    hasFeature,
  } = useEntitlement();

  const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);

  const handleUnlinkConfirm = useCallback(async () => {
    setIsUnlinking(true);
    try {
      await unlinkPatreon();
      toast.success("Patreon unlinked.");
    } catch {
      toast.error("Could not unlink Patreon. Please try again.");
    } finally {
      setIsUnlinking(false);
      setUnlinkDialogOpen(false);
    }
  }, [unlinkPatreon]);

  // Loading state
  if (isLoading) {
    return <PatreonSettingsSkeleton />;
  }

  // Determine state
  const isExpired = isLinked && !isActive;
  const isKarlActive = isLinked && isActive && tier === "karl";
  const isLinkedThrall = isLinked && !isActive && tier === "thrall" && !isExpired;

  // Format linked date from cache (if available)
  const linkedDate = (() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("fenrir:entitlement");
      if (!raw) return null;
      const data = JSON.parse(raw) as { linkedAt?: number };
      if (data.linkedAt) {
        return new Date(data.linkedAt).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        });
      }
    } catch {
      // Ignore
    }
    return null;
  })();

  return (
    <>
      <section
        className="border border-border p-5 flex flex-col gap-4"
        aria-label="Patreon subscription"
      >
        {/* Section header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-heading font-bold uppercase tracking-[0.08em] text-saga">
            Patreon
          </h2>
          {isKarlActive && (
            <span
              className="inline-flex items-center px-2 py-0.5 border border-gold/30 text-[10px] font-mono font-bold uppercase tracking-wide text-gold h-5"
              aria-label="Karl Supporter tier"
            >
              KARL
            </span>
          )}
          {isExpired && (
            <span
              className="inline-flex items-center px-2 py-0.5 border border-dashed border-rune/40 text-[10px] font-mono font-bold uppercase tracking-wide text-rune/60 h-5"
              aria-label="Membership expired"
            >
              EXPIRED
            </span>
          )}
        </div>

        {/* ── State: Unlinked ──────────────────────────────────────── */}
        {!isLinked && (
          <>
            <p className="text-sm text-saga/90 leading-relaxed font-body">
              Link your Patreon account to unlock premium features.
            </p>

            {/* Feature preview list */}
            <div className="flex flex-col gap-1.5">
              {FEATURE_LIST.map((f) => (
                <FeatureItem key={f} feature={f} unlocked={false} />
              ))}
            </div>

            <div>
              <Button
                onClick={linkPatreon}
                className="inline-flex items-center gap-2.5 min-h-[44px] md:min-h-[40px] w-full md:w-auto font-heading font-bold bg-gold text-[#07070d] hover:bg-gold-bright border-2 border-gold"
                aria-label="Link your Patreon account"
              >
                <span className="w-5 h-5 flex items-center justify-center border border-[#07070d]/30 text-xs font-bold rounded-sm">
                  P
                </span>
                Link Patreon
              </Button>
            </div>
          </>
        )}

        {/* ── State: Linked Karl (active) ──────────────────────────── */}
        {isKarlActive && (
          <>
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-saga font-body">
                Linked to {platform === "patreon" ? "Patreon" : platform}
              </span>
              {linkedDate && (
                <span className="text-[13px] text-rune/70 font-body">
                  Member since {linkedDate}
                </span>
              )}
            </div>

            <div className="text-sm font-heading font-bold text-saga">
              Premium features: All unlocked
            </div>

            {/* Feature list with unlocked status */}
            <div className="flex flex-col gap-1.5">
              {FEATURE_LIST.map((f) => (
                <FeatureItem key={f} feature={f} unlocked={hasFeature(f)} />
              ))}
            </div>

            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => setUnlinkDialogOpen(true)}
                className="min-h-[44px] md:min-h-[40px] w-full md:w-auto font-heading text-[13px]"
                aria-label="Unlink your Patreon account"
              >
                Unlink Patreon
              </Button>
            </div>
          </>
        )}

        {/* ── State: Linked Thrall (no active pledge) ──────────────── */}
        {isLinkedThrall && (
          <>
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-saga font-body">
                Linked to {platform === "patreon" ? "Patreon" : platform}
              </span>
              <span className="text-sm font-bold text-rune mt-1 font-body">
                No active pledge found.
              </span>
            </div>

            <p className="text-sm text-saga/90 font-body">
              Pledge to unlock premium features:
            </p>

            <div className="flex flex-col gap-1.5">
              {FEATURE_LIST.map((f) => (
                <FeatureItem key={f} feature={f} unlocked={false} />
              ))}
            </div>

            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <Button
                onClick={linkPatreon}
                className="min-h-[44px] md:min-h-[40px] w-full md:w-auto font-heading font-bold bg-gold text-[#07070d] hover:bg-gold-bright border-2 border-gold"
                aria-label="Open Patreon campaign page in new tab"
              >
                Pledge on Patreon
              </Button>
              <Button
                variant="outline"
                onClick={() => setUnlinkDialogOpen(true)}
                className="min-h-[44px] md:min-h-[40px] w-full md:w-auto font-heading text-[13px]"
                aria-label="Unlink your Patreon account"
              >
                Unlink Patreon
              </Button>
            </div>
          </>
        )}

        {/* ── State: Expired ───────────────────────────────────────── */}
        {isExpired && (
          <>
            <div className="text-sm text-saga font-body">
              Linked to {platform === "patreon" ? "Patreon" : platform}
            </div>

            {/* Warning block */}
            <div
              className="border border-border border-l-4 border-l-realm-hati p-3 md:p-4 flex flex-col gap-2"
              role="status"
            >
              <p className="text-sm font-bold text-saga font-body">
                Your Karl membership has expired.
              </p>
              <p className="text-sm text-saga/90 leading-relaxed font-body">
                Premium features are locked until you renew your pledge on Patreon.
              </p>
              <p className="text-[13px] text-rune/70 leading-snug font-body">
                Your card data and settings are not affected.
              </p>
            </div>

            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <Button
                onClick={linkPatreon}
                className="min-h-[48px] md:min-h-[44px] w-full md:w-auto font-heading font-bold bg-gold text-[#07070d] hover:bg-gold-bright border-2 border-gold"
                aria-label="Open Patreon campaign page to renew membership"
              >
                Renew on Patreon
              </Button>
              <Button
                variant="outline"
                onClick={() => setUnlinkDialogOpen(true)}
                className="min-h-[44px] md:min-h-[40px] w-full md:w-auto font-heading text-[13px]"
                aria-label="Unlink your Patreon account"
              >
                Unlink Patreon
              </Button>
            </div>
          </>
        )}
      </section>

      {/* Unlink confirmation dialog */}
      <UnlinkConfirmDialog
        open={unlinkDialogOpen}
        onCancel={() => setUnlinkDialogOpen(false)}
        onConfirm={handleUnlinkConfirm}
        isUnlinking={isUnlinking}
      />
    </>
  );
}
