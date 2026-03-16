"use client";

/**
 * SafetyBanner -- contextual privacy/security notices for the import flow.
 *
 * Variants:
 *  - full: Two-column include/exclude lists with shield icon (method selection)
 *  - compact: Always-visible include/exclude lists with shield icon (URL entry, CSV upload)
 *  - sensitive-data: Warning when LLM detects sensitive data in CSV (preview)
 *  - post-share: Reminder after URL-based import (success)
 */

interface SafetyBannerProps {
  /** Which visual variant to render. */
  variant: "full" | "compact" | "sensitive-data" | "post-share";
}

/** SVG shield icon used in the full variant. */
function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

/** SVG lock icon used in the post-share variant. */
function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

/** Compact variant — always-visible include/exclude detail lists. */
function CompactBanner() {
  return (
    <div
      role="note"
      aria-label="Data safety reminder"
      className="rounded-sm border border-border bg-card px-3 py-2"
    >
      <p className="text-sm font-body text-muted-foreground">
        <ShieldIcon className="inline h-3.5 w-3.5 text-gold mr-1.5 align-text-bottom" />
        Never share card numbers, CVVs, or SSNs. Only include card names, fees, and dates.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-body text-muted-foreground mt-3 pt-3 border-t border-border">
        <div>
          <p className="text-foreground font-heading text-sm mb-1.5 tracking-wide">
            Safe to include
          </p>
          <ul className="space-y-1 list-none">
            <li>Card names and issuers</li>
            <li>Open dates and annual fees</li>
            <li>Credit limits</li>
            <li>Sign-up bonus details</li>
          </ul>
        </div>
        <div>
          <p className="text-destructive font-heading text-sm mb-1.5 tracking-wide">
            Never include
          </p>
          <ul className="space-y-1 list-none">
            <li>Full card numbers</li>
            <li>CVV / security codes</li>
            <li>Social Security numbers</li>
            <li>Passwords or PINs</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export function SafetyBanner({ variant }: SafetyBannerProps) {
  if (variant === "full") {
    return (
      <div
        role="alert"
        className="rounded-sm border border-gold/40 bg-gold/5 p-4"
      >
        <div className="flex items-start gap-3 mb-3">
          <ShieldIcon className="h-5 w-5 text-gold shrink-0 mt-0.5" />
          <h3 className="font-heading text-base text-gold tracking-wide">
            Protect Your Secrets
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-body text-muted-foreground">
          <div>
            <p className="text-foreground font-heading text-sm mb-1.5 tracking-wide">
              Safe to include
            </p>
            <ul className="space-y-1 list-none">
              <li>Card names and issuers</li>
              <li>Open dates and annual fees</li>
              <li>Credit limits</li>
              <li>Sign-up bonus details</li>
            </ul>
          </div>
          <div>
            <p className="text-destructive font-heading text-sm mb-1.5 tracking-wide">
              Never include
            </p>
            <ul className="space-y-1 list-none">
              <li>Full card numbers</li>
              <li>CVV / security codes</li>
              <li>Social Security numbers</li>
              <li>Passwords or PINs</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "compact") {
    return <CompactBanner />;
  }

  if (variant === "sensitive-data") {
    return (
      <div
        role="alert"
        className="rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2.5"
      >
        <h4 className="font-heading text-sm text-destructive tracking-wide mb-1">
          Sensitive Data Detected
        </h4>
        <p className="text-sm font-body text-muted-foreground">
          The source data appears to contain card numbers, CVVs, or other sensitive
          information. These values have been stripped from the import, but consider
          removing them from your source file.
        </p>
      </div>
    );
  }

  // post-share
  return (
    <div
      role="note"
      className="rounded-sm border border-border bg-card px-3 py-2"
    >
      <p className="text-sm font-body text-muted-foreground">
        <LockIcon className="inline h-3.5 w-3.5 text-gold mr-1.5 align-text-bottom" />
        Consider revoking public access to your spreadsheet now that the import is complete.
      </p>
    </div>
  );
}
