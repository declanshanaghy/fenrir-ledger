"use client";

/**
 * ImportWizard — multi-step Google Sheets import modal.
 *
 * Steps: entry → loading → preview → error → success
 *
 * Uses shadcn Dialog with the project's standard modal sizing:
 * w-[92vw] max-w-[680px] max-h-[90vh] (team norm for mobile-friendly modals).
 *
 * Accessibility: focus trap from Radix built-in, aria-live="polite" on step
 * container, 44px minimum touch targets on all interactive elements.
 */

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KNOWN_ISSUERS } from "@/lib/constants";
import { useSheetImport } from "@/hooks/useSheetImport";
import { findDuplicates } from "@/lib/sheets/dedup";
import type { DedupResult } from "@/lib/sheets/dedup";
import { ImportDedupStep } from "@/components/sheets/ImportDedupStep";
import type { Card } from "@/lib/types";
import type { SheetImportErrorCode } from "@/lib/sheets/types";

interface ImportWizardProps {
  open: boolean;
  onClose: () => void;
  onConfirmImport: (cards: Omit<Card, "householdId">[]) => void;
  existingCards: Card[];
}

/** Human-readable error messages keyed by error code */
const ERROR_MESSAGES: Record<SheetImportErrorCode, string> = {
  INVALID_URL: "The URL doesn't look like a Google Sheets link.",
  SHEET_NOT_PUBLIC:
    "This spreadsheet isn't publicly accessible. Share it with 'Anyone with the link can view'.",
  NO_CARDS_FOUND: "No credit card data was found in the spreadsheet.",
  PARSE_ERROR: "The card data couldn't be parsed correctly.",
  ANTHROPIC_ERROR: "Our card extraction service is temporarily unavailable.",
  FETCH_ERROR: "Couldn't reach the spreadsheet. Check the URL and try again.",
};

/** Format cents as a dollar amount string */
function formatFee(cents: number): string {
  if (cents === 0) return "No annual fee";
  return `$${(cents / 100).toFixed(0)}/yr`;
}

/** Format ISO date string to short locale date */
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function ImportWizard({ open, onClose, onConfirmImport, existingCards }: ImportWizardProps) {
  const {
    step,
    setStep,
    url,
    setUrl,
    cards,
    warning,
    errorCode,
    errorMessage,
    submit,
    cancel,
    reset,
  } = useSheetImport();

  const [dedupResult, setDedupResult] = useState<DedupResult | null>(null);

  // URL validation: must contain Google Sheets domain
  const isValidUrl = url.includes("docs.google.com/spreadsheets");
  const showUrlError = url.length > 0 && !isValidUrl;

  // Auto-close after 1.5s on success
  useEffect(() => {
    if (step !== "success") return;
    const timer = setTimeout(() => {
      onClose();
    }, 1500);
    return () => clearTimeout(timer);
  }, [step, onClose]);

  function handleConfirm() {
    const result = findDuplicates(cards, existingCards);
    if (result.duplicates.length > 0) {
      setDedupResult(result);
      setStep("dedup");
    } else {
      onConfirmImport(cards);
    }
  }

  function handleSkipDuplicates() {
    if (!dedupResult) return;
    onConfirmImport(dedupResult.unique);
  }

  function handleImportAll() {
    onConfirmImport(cards);
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className="w-[92vw] max-w-[680px] max-h-[90vh] overflow-hidden flex flex-col border-border bg-background"
        aria-label="Google Sheets Import Wizard"
      >
        {/* aria-live region announces step changes to screen readers */}
        <div aria-live="polite" className="sr-only">
          {step === "entry" && "Step 1: Enter Google Sheets URL"}
          {step === "loading" && "Loading: fetching cards from spreadsheet"}
          {step === "preview" && `Preview: ${cards.length} cards ready to import`}
          {step === "dedup" && `Duplicates found: ${dedupResult?.duplicates.length ?? 0} duplicate cards detected`}
          {step === "error" && "Error: import failed"}
          {step === "success" && "Success: cards imported"}
        </div>

        {/* ── Entry step ─────────────────────────────────────────────── */}
        {step === "entry" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-gold tracking-wide text-lg">
                Import from Google Sheets
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-2">
              <p className="font-body text-muted-foreground text-sm">
                Paste the URL of a publicly shared Google Sheets document containing
                your credit cards.
              </p>

              <div className="flex flex-col gap-1">
                <input
                  id="sheets-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste your Google Sheets URL..."
                  className="h-11 w-full rounded-sm border border-border bg-background px-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/50"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && isValidUrl) submit();
                  }}
                  autoFocus
                />
                {showUrlError && (
                  <p className="text-xs text-red-400 font-body">
                    Enter a valid Google Sheets URL
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={submit}
                  disabled={!isValidUrl}
                  className="inline-flex items-center justify-center rounded-sm font-heading tracking-wide text-sm transition-colors bg-primary text-primary-foreground hover:bg-gold-bright disabled:opacity-40 disabled:cursor-not-allowed h-11 px-6 min-w-[44px]"
                >
                  Import
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Loading step ───────────────────────────────────────────── */}
        {step === "loading" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-gold tracking-wide text-lg">
                Fetching cards...
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col items-center gap-6 py-8">
              {/* Loading spinner */}
              <div
                className="h-12 w-12 rounded-full border-2 border-border border-t-gold animate-spin"
                role="status"
                aria-label="Loading"
              />

              <p className="font-body text-muted-foreground text-sm italic text-center">
                Reading the runes from your spreadsheet...
              </p>

              <button
                type="button"
                onClick={cancel}
                className="inline-flex items-center justify-center rounded-sm font-heading tracking-wide text-sm transition-colors border border-border text-muted-foreground hover:border-gold/50 hover:text-gold h-11 px-6 min-w-[44px]"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {/* ── Preview step ───────────────────────────────────────────── */}
        {step === "preview" && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <DialogTitle className="font-display text-gold tracking-wide text-lg">
                  Preview Import
                </DialogTitle>
                <span className="inline-flex items-center justify-center rounded-full bg-gold/20 text-gold font-mono text-xs font-bold px-2 py-0.5 border border-gold/30">
                  {cards.length} card{cards.length !== 1 ? "s" : ""}
                </span>
              </div>
            </DialogHeader>

            <div className="flex flex-col gap-3 overflow-hidden flex-1">
              {/* Warning banner */}
              {warning && (
                <div className="rounded-sm border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                  <p className="text-xs font-body text-amber-400">{warning}</p>
                </div>
              )}

              {/* Scrollable card list */}
              <div className="overflow-y-auto flex-1 min-h-0 max-h-[45vh] flex flex-col gap-1.5 pr-1">
                {cards.map((card) => {
                  const issuer = KNOWN_ISSUERS.find((i) => i.id === card.issuerId);
                  return (
                    <div
                      key={card.id}
                      className="flex items-center justify-between rounded-sm border border-border bg-card px-4 py-3 gap-4"
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-heading text-sm text-foreground tracking-wide truncate">
                          {card.cardName}
                        </span>
                        <span className="font-body text-xs text-muted-foreground">
                          {issuer?.name ?? card.issuerId}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatDate(card.openDate)}
                        </span>
                        <span className="font-mono text-xs text-gold">
                          {formatFee(card.annualFee)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center rounded-sm font-heading tracking-wide text-sm transition-colors border border-border text-muted-foreground hover:border-gold/50 hover:text-gold h-11 px-6 min-w-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="inline-flex items-center justify-center rounded-sm font-heading tracking-wide text-sm transition-colors bg-primary text-primary-foreground hover:bg-gold-bright h-11 px-6 min-w-[44px]"
                >
                  Import {cards.length} card{cards.length !== 1 ? "s" : ""}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Dedup step ─────────────────────────────────────────────── */}
        {step === "dedup" && dedupResult && (
          <ImportDedupStep
            duplicates={dedupResult.duplicates}
            uniqueCount={dedupResult.unique.length}
            onSkipDuplicates={handleSkipDuplicates}
            onImportAll={handleImportAll}
            onCancel={onClose}
          />
        )}

        {/* ── Error step ─────────────────────────────────────────────── */}
        {step === "error" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-red-400 tracking-wide text-lg">
                Import Failed
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-2">
              <p className="font-body text-muted-foreground text-sm">
                {errorCode ? ERROR_MESSAGES[errorCode] : errorMessage}
              </p>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center rounded-sm font-heading tracking-wide text-sm transition-colors border border-border text-muted-foreground hover:border-gold/50 hover:text-gold h-11 px-6 min-w-[44px]"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center justify-center rounded-sm font-heading tracking-wide text-sm transition-colors bg-primary text-primary-foreground hover:bg-gold-bright h-11 px-6 min-w-[44px]"
                >
                  Try Again
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Success step ───────────────────────────────────────────── */}
        {step === "success" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-gold tracking-wide text-lg">
                Cards imported!
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col items-center gap-4 py-6">
              <div className="text-4xl" aria-hidden="true">
                ᚠ
              </div>
              <p className="font-body text-muted-foreground text-sm text-center">
                The runes have been inscribed in the ledger. Your cards have been
                added to the household.
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
