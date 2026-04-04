"use client";

/**
 * SyncIndicator — silent background sync indicator, fixed bottom-right.
 *
 * Visual: a small dot that shows cloud sync state for Karl/trial users,
 * or remains dim-idle for Thrall users. Four cloud states:
 *   syncing — gold dot + ping ring (motion-reduce: no ring, color only)
 *   synced  — green/success solid dot (transitions to idle after SYNCED_DISPLAY_MS)
 *   offline — dim/muted dot (40% opacity)
 *   error   — red/destructive solid dot
 *   idle    — dim iron dot (Thrall always stays here)
 *
 * Tooltip: per-state copy, floats above the dot on hover.
 *   Thrall/idle: "The sound of a cat's footfall" (Gleipnir Fragment 1)
 *   Karl cloud states: cloud-specific copy
 *
 * Click: fires useGleipnirFragment1() on ALL states — easter egg is never suppressed.
 *
 * Accessibility:
 *   - aria-label updates per state
 *   - visually-hidden sr-only live region announces state changes
 *   - ping ring hidden with motion-reduce:animate-none
 *
 * Issue #1125 — cloud sync states + Karl gating
 */

import { useCallback, useEffect, useState } from "react";
import {
  GleipnirCatFootfall,
  useGleipnirFragment1,
} from "@/components/cards/GleipnirCatFootfall";
import { useCloudSync } from "@/hooks/useCloudSync";
import type { CloudSyncStatus } from "@/hooks/useCloudSync";
import { useIsKarlOrTrial } from "@/hooks/useIsKarlOrTrial";

// ---------------------------------------------------------------------------
// Per-state config
// ---------------------------------------------------------------------------

interface StateConfig {
  ariaLabel: string;
  tooltip: string;
  dotClass: string;
  showPing: boolean;
}

function getStateConfig(
  status: CloudSyncStatus,
  isKarlOrTrial: boolean,
  lastSyncedAt: Date | null
): StateConfig {
  if (!isKarlOrTrial || status === "idle") {
    return {
      ariaLabel: "Background sync",
      tooltip: "The sound of a cat\u2019s footfall",
      dotClass: "bg-[hsl(var(--egg-border))]",
      showPing: false,
    };
  }

  switch (status) {
    case "needs-upload":
      return {
        ariaLabel: "Upload pending",
        tooltip: "Changes pending upload\u2026",
        dotClass: "bg-[hsl(var(--egg-accent))] opacity-70",
        showPing: false,
      };
    case "needs-download":
      return {
        ariaLabel: "Download pending",
        tooltip: "New changes available\u2026",
        dotClass: "bg-[hsl(var(--egg-accent))] opacity-70",
        showPing: false,
      };
    case "syncing":
      return {
        ariaLabel: "Syncing to cloud",
        tooltip: "Syncing to Yggdrasil\u2026",
        dotClass: "bg-[hsl(var(--egg-accent))]",
        showPing: true,
      };
    case "synced": {
      const relTime = lastSyncedAt ? formatRelativeTime(lastSyncedAt) : "just now";
      return {
        ariaLabel: "Cloud sync complete",
        tooltip: `Backed up \u00B7 ${relTime}`,
        dotClass: "bg-emerald-500 dark:bg-emerald-400",
        showPing: false,
      };
    }
    case "offline":
      return {
        ariaLabel: "Cloud sync offline",
        tooltip: "Offline \u2014 sync paused",
        dotClass: "bg-[hsl(var(--egg-border))] opacity-40",
        showPing: false,
      };
    case "error":
      return {
        ariaLabel: "Cloud sync failed",
        tooltip: "Sync failed \u2014 see Settings",
        dotClass: "bg-destructive",
        showPing: false,
      };
  }
}

/** Format a Date as a short relative string: "just now", "2 min ago", etc. */
function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SyncIndicator() {
  const isKarlOrTrial = useIsKarlOrTrial();
  const { status, lastSyncedAt } = useCloudSync();
  const { open, trigger, dismiss } = useGleipnirFragment1();

  // Also react to local fenrir:sync events (existing behavior for localStorage writes)
  const [localSyncing, setLocalSyncing] = useState(false);

  const handleLocalSync = useCallback(() => {
    if (isKarlOrTrial) return; // Karl users see cloud state instead
    setLocalSyncing(true);
    setTimeout(() => setLocalSyncing(false), 1500);
  }, [isKarlOrTrial]);

  useEffect(() => {
    window.addEventListener("fenrir:sync", handleLocalSync);
    return () => window.removeEventListener("fenrir:sync", handleLocalSync);
  }, [handleLocalSync]);

  // Effective status: for non-Karl users, use localSyncing for idle pulse
  const effectiveStatus =
    !isKarlOrTrial
      ? (localSyncing ? "syncing" : "idle")
      : status;

  const config = getStateConfig(effectiveStatus, isKarlOrTrial, lastSyncedAt);

  // Screen-reader live region text (only announce non-idle transitions)
  const srText = effectiveStatus !== "idle" ? config.ariaLabel : "";

  return (
    <>
      {/* Indicator + tooltip wrapper */}
      <div className="fixed bottom-4 right-4 z-50 group">

        {/* Tooltip — floats above the dot, fades in on hover */}
        <div
          className="absolute bottom-full right-0 mb-3
                     opacity-0 group-hover:opacity-100
                     transition-opacity duration-300
                     pointer-events-none max-w-[200px]"
          aria-hidden="true"
        >
          <span className="font-mono text-xs tracking-wide text-[hsl(var(--egg-accent))] whitespace-nowrap">
            {config.tooltip}
          </span>
        </div>

        {/* Clickable indicator — Gleipnir egg fires on ALL states */}
        <button
          type="button"
          onClick={trigger}
          className="relative flex items-center justify-center w-5 h-5 cursor-default"
          aria-label={config.ariaLabel}
        >
          {/* Ping ring — only for syncing state; hidden in reduced-motion */}
          {config.showPing && (
            <span
              className="sync-ping-ring absolute inline-flex h-full w-full rounded-full
                         bg-[hsl(var(--egg-accent))] opacity-40 animate-ping
                         motion-reduce:hidden"
            />
          )}

          {/* Core dot — color reflects current state */}
          <span
            className={`sync-dot relative inline-flex h-2 w-2 rounded-full transition-colors duration-700 motion-reduce:transition-none ${config.dotClass}`}
          />
        </button>

        {/* SR live region — announces cloud state changes to screen readers */}
        <span
          className="sr-only"
          aria-live="polite"
          aria-atomic="true"
        >
          {srText}
        </span>

      </div>

      {/* Easter egg modal — sibling not child, avoids stacking context issues */}
      <GleipnirCatFootfall open={open} onClose={dismiss} />
    </>
  );
}
