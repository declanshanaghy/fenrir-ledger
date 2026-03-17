"use client";

/**
 * SyncSettingsSection — settings page section for cloud sync management.
 *
 * Tier-gated:
 *   thrall — Karl upsell card with "Upgrade to Karl" CTA
 *   trial  — full sync controls + TRIAL badge + upgrade nudge
 *   karl   — full sync controls (synced / syncing / offline / error states)
 *
 * Placed in the right column of Settings, above RestoreTabGuides.
 *
 * Issue #1125
 */

import { useCloudSync } from "@/hooks/useCloudSync";
import { useEntitlement } from "@/hooks/useEntitlement";
import { useTrialStatus } from "@/hooks/useTrialStatus";

// ---------------------------------------------------------------------------
// Timestamp formatter
// ---------------------------------------------------------------------------

function formatTimestamp(date: Date): string {
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const time = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  return isToday ? `Today at ${time}` : `Yesterday at ${time}`;
}

// ---------------------------------------------------------------------------
// Thrall upsell view
// ---------------------------------------------------------------------------

function ThrallUpsellCard({
  onUpgrade,
}: {
  onUpgrade: () => void;
}) {
  return (
    <section
      className="relative border border-border p-5 flex flex-col gap-4"
      aria-label="Cloud Sync"
    >
      {/* Heading row */}
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-heading font-bold uppercase tracking-[0.08em] text-foreground">
          Cloud Sync
        </h2>
        <span
          className="border border-border px-1.5 py-0 text-[10px] font-heading font-bold tracking-[0.04em] text-muted-foreground"
          aria-label="Karl feature"
        >
          KARL
        </span>
      </div>

      {/* Upsell block */}
      <div className="border border-dashed border-border p-4 flex flex-col gap-3">
        <span className="text-lg font-bold" aria-hidden="true">☁</span>
        <p className="text-sm font-heading font-bold text-foreground">
          Back up your ledger to Yggdrasil
        </p>
        <p className="text-[13px] text-foreground/90 font-body leading-relaxed">
          Cloud Sync is a Karl feature. Upgrade to keep your cards safe across
          devices and restore them if you clear your browser.
        </p>
        <ul className="list-none p-0 flex flex-col gap-1 text-xs text-foreground/80 font-body sm:hidden">
          <li className="before:content-['—_']">Automatic cloud backup</li>
          <li className="before:content-['—_']">Restore on any device</li>
          <li className="before:content-['—_']">Household sync</li>
        </ul>
        <ul className="list-none p-0 flex-col gap-1 text-xs text-foreground/80 font-body hidden sm:flex">
          <li className="before:content-['—_']">Automatic cloud backup on every save</li>
          <li className="before:content-['—_']">Restore cards on any device</li>
          <li className="before:content-['—_']">Sync across your household</li>
          <li className="before:content-['—_']">Full sync history in Settings</li>
        </ul>
        <div>
          <button
            type="button"
            onClick={onUpgrade}
            className="min-h-[44px] px-5 py-2 border border-border text-sm font-heading font-bold
                       text-foreground hover:bg-muted/30 transition-colors
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                       w-full sm:w-auto justify-center inline-flex items-center"
            aria-label="Upgrade to Karl to unlock Cloud Sync"
          >
            Upgrade to Karl
          </button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Karl / Trial sync status view
// ---------------------------------------------------------------------------

function SyncStatusCard({ isTrial }: { isTrial: boolean }) {
  // skipLoginSync: true — the layout's SyncIndicator already handles the
  // login-transition sync. This instance is display-only + manual "Sync Now".
  // Without this flag, both hook instances would fire a push on page load,
  // causing the 2× push loop reported in Issue #1210.
  const { status, lastSyncedAt, cardCount, errorMessage, errorCode, errorTimestamp, retryIn, syncNow, dismissError } =
    useCloudSync({ skipLoginSync: true });

  const syncNowLabel =
    status === "syncing"
      ? "Sync in progress"
      : status === "offline"
      ? "Sync unavailable \u2014 offline"
      : "Sync cards to cloud now";

  const syncNowDisabled = status === "syncing" || status === "offline";

  return (
    <section
      className="relative border border-border p-5 flex flex-col gap-4 karl-bling-card"
      aria-label="Cloud Sync"
    >
      {/* Karl rune corners */}
      <span className="karl-rune-corner karl-rune-tl" aria-hidden="true">ᚠ</span>
      <span className="karl-rune-corner karl-rune-tr" aria-hidden="true">ᚱ</span>
      <span className="karl-rune-corner karl-rune-bl" aria-hidden="true">ᛁ</span>
      <span className="karl-rune-corner karl-rune-br" aria-hidden="true">ᚾ</span>

      {/* Heading row */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-heading font-bold uppercase tracking-[0.08em] text-foreground">
            Cloud Sync
          </h2>
          {isTrial && (
            <span
              className="border border-border px-1.5 py-0 text-[10px] font-heading font-bold tracking-[0.04em] text-muted-foreground"
              aria-label="Trial feature"
            >
              TRIAL
            </span>
          )}
        </div>
        {/* Mini status dot — decorative */}
        <span
          className={[
            "inline-flex h-2 w-2 rounded-full flex-shrink-0",
            status === "syncing" ? "bg-[hsl(var(--egg-accent))]" : "",
            status === "synced" ? "bg-emerald-500 dark:bg-emerald-400" : "",
            status === "offline" ? "bg-[hsl(var(--egg-border))] opacity-40" : "",
            status === "error" ? "bg-destructive" : "",
            status === "idle" ? "bg-[hsl(var(--egg-border))]" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-hidden="true"
          title={status}
        />
      </div>

      {/* Trial active message */}
      {isTrial && (
        <p className="text-[13px] text-foreground/90 font-body leading-relaxed">
          Cloud Sync is active during your trial. Your cards are backed up.
        </p>
      )}

      {/* Syncing state: progress bar */}
      {status === "syncing" && (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-body text-foreground/90">Syncing…</p>
          <div
            className="border border-border h-1 w-full overflow-hidden"
            role="progressbar"
            aria-label="Sync in progress"
            tabIndex={-1}
          >
            <div
              className="sync-progress-fill h-full w-2/5 border-r-2 border-border
                         animate-pulse motion-reduce:animate-none motion-reduce:w-1/2"
            />
          </div>
        </div>
      )}

      {/* Offline state */}
      {status === "offline" && (
        <p className="text-[13px] text-foreground/90 font-body leading-relaxed">
          You&apos;re offline. Sync will resume automatically when you reconnect.
        </p>
      )}

      {/* Error block */}
      {status === "error" && (
        <div
          className="border border-destructive/40 p-3 flex flex-col gap-1.5"
          role="alert"
        >
          <p className="text-xs font-heading font-bold text-destructive">
            {errorCode ? "Last sync failed" : "Sync failed"}
          </p>
          {errorMessage && (
            <p className="text-[11px] font-mono leading-relaxed text-foreground/80">
              {errorCode && `Error: ${errorMessage} (${errorCode})`}
              {!errorCode && errorMessage}
              {errorTimestamp && (
                <>
                  <br />
                  Failed at: {formatTimestamp(errorTimestamp)}
                </>
              )}
              {retryIn !== null && retryIn > 0 && (
                <>
                  <br />
                  Retrying in: {retryIn} second{retryIn !== 1 ? "s" : ""}
                </>
              )}
            </p>
          )}
          {!errorMessage && (
            <p className="text-[13px] text-foreground/80 font-body">
              Could not reach Yggdrasil. Your cards are safe locally.
            </p>
          )}
          <p className="text-xs text-muted-foreground font-body">
            Your cards are safe locally and will sync when the issue resolves.
          </p>
        </div>
      )}

      {/* Last synced timestamp */}
      {lastSyncedAt && status !== "syncing" && (
        <div className="flex items-baseline gap-2 text-xs font-body">
          <span className="font-semibold text-foreground">
            {status === "error" ? "Last successful sync:" : "Last synced:"}
          </span>
          <span className="text-foreground/80">{formatTimestamp(lastSyncedAt)}</span>
        </div>
      )}

      {/* Card count */}
      {cardCount !== null && status !== "syncing" && status !== "error" && (
        <div className="flex items-baseline gap-2 text-xs font-body">
          <span className="font-semibold text-foreground">Cards backed up:</span>
          <span className="text-foreground/80">{cardCount} cards</span>
        </div>
      )}

      <div className="border-t border-border" />

      {/* Actions */}
      {status === "error" ? (
        <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => void syncNow()}
            className="min-h-[44px] md:min-h-[36px] px-4 py-1.5 border border-border text-xs font-heading font-bold
                       text-foreground hover:bg-muted/30 transition-colors
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                       w-full sm:w-auto inline-flex items-center justify-center gap-2"
            aria-label="Retry cloud sync now"
          >
            Retry Now
          </button>
          <button
            type="button"
            onClick={dismissError}
            className="min-h-[44px] md:min-h-[36px] px-4 py-1.5 border border-dashed border-border text-xs font-heading
                       text-muted-foreground hover:bg-muted/20 transition-colors
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                       w-full sm:w-auto inline-flex items-center justify-center"
            aria-label="Dismiss sync error"
          >
            Dismiss Error
          </button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => void syncNow()}
            disabled={syncNowDisabled}
            className={[
              "min-h-[44px] md:min-h-[36px] px-4 py-1.5 border text-xs font-heading font-bold",
              "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "w-full sm:w-auto inline-flex items-center justify-center gap-2",
              syncNowDisabled
                ? "border-border text-muted-foreground/60 cursor-not-allowed opacity-40"
                : "border-gold/60 text-gold hover:bg-gold/10 cursor-pointer karl-bling-btn",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-label={syncNowLabel}
            aria-disabled={syncNowDisabled}
          >
            <span aria-hidden="true">☁</span>
            {status === "syncing" ? "Syncing…" : "Sync Now"}
          </button>
          <span className="text-xs text-muted-foreground/70 font-body text-center sm:text-left">
            {status === "syncing" ? "In progress…" : "Syncs automatically on every save"}
          </span>
        </div>
      )}

      {/* Trial upgrade nudge */}
      {isTrial && (
        <p className="text-[11px] text-muted-foreground/70 font-body border-t border-dashed border-border pt-2">
          Cloud Sync will remain active if you upgrade before your trial ends.
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Exported component
// ---------------------------------------------------------------------------

/**
 * SyncSettingsSection — renders Thrall upsell or Karl/trial sync status card.
 * Drop into the right column of the Settings page above RestoreTabGuides.
 */
export function SyncSettingsSection() {
  const { tier, subscribeStripe } = useEntitlement();
  const { status: trialStatus } = useTrialStatus();

  const isTrial = trialStatus === "active";
  const isKarl = tier === "karl";

  const handleUpgrade = () => {
    void subscribeStripe("/ledger/settings");
  };

  // Thrall (no trial): show upsell
  if (tier === "thrall" && !isTrial) {
    return <ThrallUpsellCard onUpgrade={handleUpgrade} />;
  }

  // Karl or trial: show sync status
  return <SyncStatusCard isTrial={isTrial && !isKarl} />;
}
