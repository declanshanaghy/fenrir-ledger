"use client";

/**
 * ShareUrlEntry -- URL input step for Google Sheets import.
 *
 * Renders a compact safety banner, back button, URL input, and Import button.
 * Same input styling as the original ImportWizard entry step.
 */

import { SafetyBanner } from "./SafetyBanner";

interface ShareUrlEntryProps {
  /** Current URL value. */
  url: string;
  /** Update URL value. */
  setUrl: (url: string) => void;
  /** Submit the URL for import. */
  onSubmit: () => void;
  /** Navigate back to method selection. */
  onBack: () => void;
  /** Whether the current URL passes basic validation. */
  isValid: boolean;
  /** Whether to show the validation error. */
  showError: boolean;
}

export function ShareUrlEntry({
  url,
  setUrl,
  onSubmit,
  onBack,
  isValid,
  showError,
}: ShareUrlEntryProps) {
  return (
    <div className="flex flex-col gap-4">
      <SafetyBanner variant="compact" />

      <div className="flex flex-col gap-1">
        <input
          id="sheets-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste your Google Sheets URL..."
          className="h-11 w-full rounded-sm border border-border bg-background px-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50"
          onKeyDown={(e) => {
            if (e.key === "Enter" && isValid) onSubmit();
          }}
          autoFocus
        />
        {showError && (
          <p className="text-xs text-red-400 font-body">
            Enter a valid Google Sheets URL
          </p>
        )}
      </div>

      <p className="text-xs font-body text-muted-foreground">
        The spreadsheet must be shared publicly (&ldquo;Anyone with the link can view&rdquo;).
      </p>

      <div className="flex justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center justify-center rounded-sm font-heading tracking-wide text-sm transition-colors border border-border text-muted-foreground hover:border-gold/50 hover:text-gold h-11 px-6 min-w-[44px]"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!isValid}
          className="inline-flex items-center justify-center rounded-sm font-heading tracking-wide text-sm transition-colors bg-primary text-primary-foreground hover:bg-gold-bright disabled:opacity-40 disabled:cursor-not-allowed h-11 px-6 min-w-[44px]"
        >
          Begin Import
        </button>
      </div>
    </div>
  );
}
