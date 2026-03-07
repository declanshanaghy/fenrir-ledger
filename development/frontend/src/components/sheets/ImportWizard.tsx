"use client";

/**
 * ImportWizard -- multi-step import modal with three import paths.
 *
 * Steps: method -> url-entry|csv-upload -> loading -> preview -> dedup -> error -> success
 *
 * Path A: Google Sheets URL ("Share a Scroll")
 * Path B: Google Drive Picker ("Browse the Archives") — disabled, coming soon
 * Path C: CSV file upload ("Deliver a Rune-Stone")
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
import { usePickerConfig } from "@/hooks/usePickerConfig";
import { findDuplicates } from "@/lib/sheets/dedup";
import type { DedupResult } from "@/lib/sheets/dedup";
import { ImportDedupStep } from "@/components/sheets/ImportDedupStep";
import { StepIndicator } from "@/components/sheets/StepIndicator";
import { MethodSelection } from "@/components/sheets/MethodSelection";
import { ShareUrlEntry } from "@/components/sheets/ShareUrlEntry";
import { CsvUpload } from "@/components/sheets/CsvUpload";
import { PickerStep } from "@/components/sheets/PickerStep";
import { SafetyBanner } from "@/components/sheets/SafetyBanner";
import type { ImportMethod } from "@/components/sheets/MethodSelection";
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
  INVALID_CSV: "The uploaded CSV file could not be processed.",
  SHEET_NOT_PUBLIC:
    "This spreadsheet isn't publicly accessible. Share it with 'Anyone with the link can view'.",
  NO_CARDS_FOUND: "No credit card data was found in the source.",
  PARSE_ERROR: "The card data couldn't be parsed correctly.",
  ANTHROPIC_ERROR: "Our card extraction service is temporarily unavailable.",
  FETCH_ERROR: "Couldn't reach the import service. Check your connection and try again.",
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

/** Map ImportStep to StepIndicator's 0-3 index. */
function getStepIndex(step: string): number {
  switch (step) {
    case "method":
      return 0;
    case "url-entry":
    case "csv-upload":
    case "picker":
      return 1;
    case "loading":
      return 1;
    case "preview":
    case "dedup":
      return 2;
    case "error":
      return 2;
    case "success":
      return 3;
    default:
      return 0;
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
    sensitiveDataWarning,
    errorCode,
    errorMessage,
    submit,
    submitCsv,
    submitFile,
    cancel,
    reset,
  } = useSheetImport();

  const { pickerApiKey } = usePickerConfig();

  const [dedupResult, setDedupResult] = useState<DedupResult | null>(null);
  const [importMethod, setImportMethod] = useState<ImportMethod | null>(null);
  /** Cards to import, stored when transitioning to success step. */
  const [pendingImport, setPendingImport] = useState<Omit<Card, "householdId">[] | null>(null);

  // URL validation: must contain Google Sheets domain
  const isValidUrl = url.includes("docs.google.com/spreadsheets");
  const showUrlError = url.length > 0 && !isValidUrl;

  // On success step: invoke onConfirmImport with pending cards, then auto-close after 1.5s
  useEffect(() => {
    if (step !== "success" || !pendingImport) return;

    // Commit the import to the parent
    onConfirmImport(pendingImport);
    setPendingImport(null);

    const timer = setTimeout(() => {
      onClose();
    }, 1500);
    return () => clearTimeout(timer);
  }, [step, pendingImport, onConfirmImport, onClose]);

  function handleSelectMethod(method: ImportMethod) {
    setImportMethod(method);
    if (method === "url") {
      setStep("url-entry");
    } else if (method === "picker") {
      setStep("picker");
    } else if (method === "csv") {
      setStep("csv-upload");
    }
  }

  function handleConfirm() {
    const result = findDuplicates(cards, existingCards);
    if (result.duplicates.length > 0) {
      setDedupResult(result);
      setStep("dedup");
    } else {
      setPendingImport(cards);
      setStep("success");
    }
  }

  function handleSkipDuplicates() {
    if (!dedupResult) return;
    setPendingImport(dedupResult.unique);
    setStep("success");
  }

  function handleImportAll() {
    setPendingImport(cards);
    setStep("success");
  }

  function handleBackToMethod() {
    setStep("method");
    setImportMethod(null);
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()} modal={step !== "picker"}>
      <DialogContent
        className="w-[92vw] max-w-[680px] max-h-[90vh] overflow-hidden flex flex-col border-border bg-background"
        aria-label="Import Wizard"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Step indicator */}
        <StepIndicator activeStep={getStepIndex(step)} />

        {/* aria-live region announces step changes to screen readers */}
        <div aria-live="polite" className="sr-only">
          {step === "method" && "Step 1: Choose import method"}
          {step === "url-entry" && "Step 2: Enter Google Sheets URL"}
          {step === "csv-upload" && "Step 2: Upload CSV file"}
          {step === "picker" && "Step 2: Browsing Google Drive"}
          {step === "loading" && "Loading: extracting cards from your data"}
          {step === "preview" && `Preview: ${cards.length} cards ready to import`}
          {step === "dedup" && `Duplicates found: ${dedupResult?.duplicates.length ?? 0} duplicate cards detected`}
          {step === "error" && "Error: import failed"}
          {step === "success" && "Success: cards imported"}
        </div>

        {/* ── Method selection step ──────────────────────────────── */}
        {step === "method" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-gold tracking-wide text-xl">
                Import Cards
              </DialogTitle>
            </DialogHeader>
            <MethodSelection onSelectMethod={handleSelectMethod} pickerApiKey={pickerApiKey} />
          </>
        )}

        {/* ── URL entry step ────────────────────────────────────── */}
        {step === "url-entry" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-gold tracking-wide text-xl">
                Share a Scroll
              </DialogTitle>
            </DialogHeader>
            <ShareUrlEntry
              url={url}
              setUrl={setUrl}
              onSubmit={submit}
              onBack={handleBackToMethod}
              isValid={isValidUrl}
              showError={showUrlError}
            />
          </>
        )}

        {/* ── CSV upload step ───────────────────────────────────── */}
        {step === "csv-upload" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-gold tracking-wide text-xl">
                Deliver a Rune-Stone
              </DialogTitle>
            </DialogHeader>
            <CsvUpload
              onSubmit={submitCsv}
              onSubmitFile={submitFile}
              onBack={handleBackToMethod}
            />
          </>
        )}

        {/* ── Picker step (Path B) ────────────────────────────── */}
        {step === "picker" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-gold tracking-wide text-xl">
                Browse the Archives
              </DialogTitle>
            </DialogHeader>
            <PickerStep
              onSubmitCsv={submitCsv}
              onBack={handleBackToMethod}
              pickerApiKey={pickerApiKey}
            />
          </>
        )}

        {/* ── Loading step ──────────────────────────────────────── */}
        {step === "loading" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-gold tracking-wide text-xl">
                Deciphering the runes...
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col items-center gap-6 py-8">
              {/* Loading spinner */}
              <div
                className="h-12 w-12 rounded-full border-2 border-border border-t-gold animate-spin"
                role="status"
                aria-label="Loading"
              />

              <p className="font-body text-muted-foreground text-base italic text-center">
                {importMethod === "picker"
                  ? "Deciphering the sacred scrolls from your archives..."
                  : importMethod === "csv"
                    ? "Reading the inscriptions from your rune-stone..."
                    : "Reading the runes from your spreadsheet..."}
              </p>

              <button
                type="button"
                onClick={cancel}
                className="inline-flex items-center justify-center rounded-sm font-heading tracking-wide text-base transition-colors border border-border text-muted-foreground hover:border-gold/50 hover:text-gold h-11 px-6 min-w-[44px]"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {/* ── Preview step ──────────────────────────────────────── */}
        {step === "preview" && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <DialogTitle className="font-display text-gold tracking-wide text-xl">
                  Preview Import
                </DialogTitle>
                <span className="inline-flex items-center justify-center rounded-full bg-gold/20 text-gold font-mono text-sm font-bold px-2 py-0.5 border border-gold/30">
                  {cards.length} card{cards.length !== 1 ? "s" : ""}
                </span>
              </div>
            </DialogHeader>

            <div className="flex flex-col gap-3 overflow-hidden flex-1">
              {/* Sensitive data warning */}
              {sensitiveDataWarning && (
                <SafetyBanner variant="sensitive-data" />
              )}

              {/* CSV/fetch warning banner */}
              {warning && (
                <div className="rounded-sm border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                  <p className="text-sm font-body text-amber-400">{warning}</p>
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
                        <span className="font-heading text-base text-foreground tracking-wide truncate">
                          {card.cardName}
                        </span>
                        <span className="font-body text-sm text-muted-foreground">
                          {issuer?.name ?? card.issuerId}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="font-mono text-sm text-muted-foreground">
                          {formatDate(card.openDate)}
                        </span>
                        <span className="font-mono text-sm text-gold">
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
                  className="inline-flex items-center justify-center rounded-sm font-heading tracking-wide text-base transition-colors border border-border text-muted-foreground hover:border-gold/50 hover:text-gold h-11 px-6 min-w-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="inline-flex items-center justify-center rounded-sm font-heading tracking-wide text-base transition-colors bg-primary text-primary-foreground hover:bg-gold-bright h-11 px-6 min-w-[44px]"
                >
                  Import {cards.length} card{cards.length !== 1 ? "s" : ""}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Dedup step ────────────────────────────────────────── */}
        {step === "dedup" && dedupResult && (
          <ImportDedupStep
            duplicates={dedupResult.duplicates}
            uniqueCount={dedupResult.unique.length}
            onSkipDuplicates={handleSkipDuplicates}
            onImportAll={handleImportAll}
            onCancel={onClose}
          />
        )}

        {/* ── Error step ────────────────────────────────────────── */}
        {step === "error" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-red-400 tracking-wide text-xl">
                Import Failed
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-2">
              <p className="font-body text-muted-foreground text-base">
                {errorCode ? ERROR_MESSAGES[errorCode] : errorMessage}
              </p>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center rounded-sm font-heading tracking-wide text-base transition-colors border border-border text-muted-foreground hover:border-gold/50 hover:text-gold h-11 px-6 min-w-[44px]"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center justify-center rounded-sm font-heading tracking-wide text-base transition-colors bg-primary text-primary-foreground hover:bg-gold-bright h-11 px-6 min-w-[44px]"
                >
                  Try Again
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Success step ──────────────────────────────────────── */}
        {step === "success" && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-gold tracking-wide text-xl">
                Cards imported!
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col items-center gap-4 py-6">
              <div className="text-4xl" aria-hidden="true">
                ᚠ
              </div>
              <p className="font-body text-muted-foreground text-base text-center">
                The runes have been inscribed in the ledger. Your cards have been
                added to the household.
              </p>

              {/* Post-share reminder for URL imports */}
              {importMethod === "url" && (
                <div className="w-full">
                  <SafetyBanner variant="post-share" />
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
