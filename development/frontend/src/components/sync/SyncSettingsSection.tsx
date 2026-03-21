"use client";

/**
 * SyncSettingsSection — settings page section for cloud sync management.
 *
 * Tier-gated:
 *   thrall — Karl upsell card with "Upgrade to Karl" CTA
 *   trial  — Karl upsell card WITHOUT upgrade button (Subscription card has one)
 *   karl   — full sync controls (synced / syncing / offline / error states)
 *
 * Placed in the right column of Settings, above RestoreTabGuides.
 *
 * Issue #1125
 */

import type { CloudSyncStatus } from "@/hooks/useCloudSync";
import { useCloudSync } from "@/hooks/useCloudSync";
import { useEntitlement } from "@/hooks/useEntitlement";
import { useTrialStatus } from "@/hooks/useTrialStatus";

// ---------------------------------------------------------------------------
// Timestamp formatter
// ---------------------------------------------------------------------------

export function formatTimestamp(date: Date): string {
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
// Status dot class helper
// ---------------------------------------------------------------------------

const STATUS_DOT_BASE = "inline-flex h-2 w-2 rounded-full flex-shrink-0";

const STATUS_DOT_CLASSES: Record<CloudSyncStatus, string> = {
  syncing: `${STATUS_DOT_BASE} bg-[hsl(var(--egg-accent))]`,
  synced: `${STATUS_DOT_BASE} bg-emerald-500 dark:bg-emerald-400`,
  offline: `${STATUS_DOT_BASE} bg-[hsl(var(--egg-border))] opacity-40`,
  error: `${STATUS_DOT_BASE} bg-destructive`,
  idle: `${STATUS_DOT_BASE} bg-[hsl(var(--egg-border))]`,
};

export function getSyncStatusDotClass(status: CloudSyncStatus): string {
  return STATUS_DOT_CLASSES[status] ?? STATUS_DOT_BASE;
}

// ---------------------------------------------------------------------------
// Sub-components for SyncStatusCard
// ---------------------------------------------------------------------------

function SyncProgressBar() {
  return (
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
  );
}

function SyncOfflineMessage() {
  return (
    <p className="text-[13px] text-foreground/90 font-body leading-relaxed">
      You&apos;re offline. Sync will resume automatically when you reconnect.
    </p>
  );
}

interface SyncErrorDetailProps {
  errorCode: string | null;
  errorMessage: string;
  errorTimestamp: Date | null;
  retryIn: number | null;
}

function SyncErrorDetail({
  errorCode,
  errorMessage,
  errorTimestamp,
  retryIn,
}: SyncErrorDetailProps) {
  return (
    <p className="text-[11px] font-mono leading-relaxed text-foreground/80">
      {errorCode ? `Error: ${errorMessage} (${errorCode})` : errorMessage}
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
  );
}

interface SyncErrorBlockProps {
  errorCode: string | null;
  errorMessage: string | null;
  errorTimestamp: Date | null;
  retryIn: number | null;
}

function SyncErrorBlock({
  errorCode,
  errorMessage,
  errorTimestamp,
  retryIn,
}: SyncErrorBlockProps) {
  return (
    <div
      className="border border-destructive/40 p-3 flex flex-col gap-1.5"
      role="alert"
    >
      <p className="text-xs font-heading font-bold text-destructive">
        {errorCode ? "Last sync failed" : "Sync failed"}
      </p>
      {errorMessage ? (
        <SyncErrorDetail
          errorCode={errorCode}
          errorMessage={errorMessage}
          errorTimestamp={errorTimestamp}
          retryIn={retryIn}
        />
      ) : (
        <p className="text-[13px] text-foreground/80 font-body">
          Could not reach Yggdrasil. Your cards are safe locally.
        </p>
      )}
      <p className="text-xs text-muted-foreground font-body">
        Your cards are safe locally and will sync when the issue resolves.
      </p>
    </div>
  );
}

interface SyncLastSyncedProps {
  lastSyncedAt: Date;
  isError: boolean;
}

function SyncLastSynced({ lastSyncedAt, isError }: SyncLastSyncedProps) {
  return (
    <div className="flex items-baseline gap-2 text-xs font-body">
      <span className="font-semibold text-foreground">
        {isError ? "Last successful sync:" : "Last synced:"}
      </span>
      <span className="text-foreground/80">{formatTimestamp(lastSyncedAt)}</span>
    </div>
  );
}

interface SyncCardCountRowProps {
  cardCount: number;
}

function SyncCardCountRow({ cardCount }: SyncCardCountRowProps) {
  return (
    <div className="flex items-baseline gap-2 text-xs font-body">
      <span className="font-semibold text-foreground">Cards backed up:</span>
      <span className="text-foreground/80">{cardCount} cards</span>
    </div>
  );
}

interface SyncErrorActionsProps {
  onRetry: () => void;
  onDismiss: () => void;
}

function SyncErrorActions({ onRetry, onDismiss }: SyncErrorActionsProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
      <button
        type="button"
        onClick={onRetry}
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
        onClick={onDismiss}
        className="min-h-[44px] md:min-h-[36px] px-4 py-1.5 border border-dashed border-border text-xs font-heading
                   text-muted-foreground hover:bg-muted/20 transition-colors
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                   w-full sm:w-auto inline-flex items-center justify-center"
        aria-label="Dismiss sync error"
      >
        Dismiss Error
      </button>
    </div>
  );
}

interface SyncNormalActionsProps {
  status: CloudSyncStatus;
  disabled: boolean;
  onSyncNow: () => void;
}

function getSyncNowLabel(status: CloudSyncStatus): string {
  if (status === "syncing") return "Sync in progress";
  if (status === "offline") return "Sync unavailable \u2014 offline";
  return "Sync cards to cloud now";
}

function SyncNormalActions({
  status,
  disabled,
  onSyncNow,
}: SyncNormalActionsProps) {
  const label = getSyncNowLabel(status);
  const isSyncing = status === "syncing";

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
      <button
        type="button"
        onClick={onSyncNow}
        disabled={disabled}
        className={[
          "min-h-[44px] md:min-h-[36px] px-4 py-1.5 border text-xs font-heading font-bold",
          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "w-full sm:w-auto inline-flex items-center justify-center gap-2",
          disabled
            ? "border-border text-muted-foreground/60 cursor-not-allowed opacity-40"
            : "border-gold/60 text-gold hover:bg-gold/10 cursor-pointer karl-bling-btn",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label={label}
        aria-disabled={disabled}
      >
        <span aria-hidden="true">☁</span>
        {isSyncing ? "Syncing…" : "Sync Now"}
      </button>
      <span className="text-xs text-muted-foreground/70 font-body text-center sm:text-left">
        {isSyncing ? "In progress…" : "Syncs automatically on every save"}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thrall upsell view
// ---------------------------------------------------------------------------

function ThrallUpsellCard({
  onUpgrade,
  showUpgradeButton = true,
}: {
  onUpgrade: () => void;
  showUpgradeButton?: boolean;
}) {
  return (
    <section
      className="relative border border-border p-5 flex flex-col gap-4 karl-bling-card"
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
          Cloud Sync is a Karl feature. Your data is stored locally only.
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
        {showUpgradeButton && (
          <div>
            <button
              type="button"
              onClick={onUpgrade}
              className="min-h-[44px] px-5 py-2 text-sm font-heading font-bold
                         bg-gold text-primary-foreground border-2 border-gold hover:bg-primary hover:brightness-110 transition-colors
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                         w-full sm:w-auto justify-center inline-flex items-center karl-bling-btn"
              aria-label="Upgrade to Karl to unlock Cloud Sync"
            >
              Upgrade to Karl
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Karl / Trial sync status view
// ---------------------------------------------------------------------------

function SyncStatusCard({ isTrial }: { isTrial: boolean }) {
  const {
    status,
    lastSyncedAt,
    cardCount,
    errorMessage,
    errorCode,
    errorTimestamp,
    retryIn,
    syncNow,
    dismissError,
  } = useCloudSync();

  const isError = status === "error";
  const isSyncing = status === "syncing";
  const isOffline = status === "offline";
  const syncNowDisabled = isSyncing || isOffline;
  const showLastSynced = lastSyncedAt !== null && !isSyncing;
  const showCardCount = cardCount !== null && !isSyncing && !isError;

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
          className={getSyncStatusDotClass(status)}
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

      {isSyncing && <SyncProgressBar />}
      {isOffline && <SyncOfflineMessage />}
      {isError && (
        <SyncErrorBlock
          errorCode={errorCode}
          errorMessage={errorMessage}
          errorTimestamp={errorTimestamp}
          retryIn={retryIn}
        />
      )}

      {showLastSynced && (
        <SyncLastSynced lastSyncedAt={lastSyncedAt} isError={isError} />
      )}
      {showCardCount && <SyncCardCountRow cardCount={cardCount} />}

      <div className="border-t border-border" />

      {/* Actions */}
      {isError ? (
        <SyncErrorActions
          onRetry={() => void syncNow()}
          onDismiss={dismissError}
        />
      ) : (
        <SyncNormalActions
          status={status}
          disabled={syncNowDisabled}
          onSyncNow={() => void syncNow()}
        />
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
 * SyncSettingsSection — renders upsell (Thrall/trial) or Karl sync status card.
 * Trial users see upsell without upgrade button — Subscription card above has one.
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

  // Thrall or trial: show upsell (trial hides button — Subscription card has one)
  if (!isKarl) {
    return <ThrallUpsellCard onUpgrade={handleUpgrade} showUpgradeButton={!isTrial} />;
  }

  // Karl only: show sync status
  return <SyncStatusCard isTrial={false} />;
}
