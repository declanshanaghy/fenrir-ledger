"use client";

/**
 * ImportWizard -- multi-step import modal with three import paths.
 *
 * Steps: method -> url-entry|csv-upload -> loading -> preview -> dedup -> error -> success
 *
 * Path A: Google Sheets URL ("Share a Rune Tablet")
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
  DialogDescription,
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
import type { FileFormat } from "@/components/sheets/CsvUpload";
import { PickerStep } from "@/components/sheets/PickerStep";
import { SafetyBanner } from "@/components/sheets/SafetyBanner";
import type { ImportMethod } from "@/components/sheets/MethodSelection";
import type { Card } from "@/lib/types";
import type { SheetImportErrorCode } from "@/lib/sheets/types";
import type { ImportStep } from "@/hooks/useSheetImport";
import { track } from "@/lib/analytics/track";

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
  RATE_LIMITED: "You've exceeded the maximum uploads per hour. Please try again later.",
  SUBSCRIPTION_REQUIRED: "Import requires a Karl subscription. Upgrade to unlock this feature.",
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

/** Map ImportStep to StepIndicator's 0-3 index via lookup. */
const STEP_INDEX_MAP: Partial<Record<ImportStep, number>> = {
  method: 0,
  "url-entry": 1,
  "csv-upload": 1,
  picker: 1,
  loading: 1,
  preview: 2,
  dedup: 2,
  error: 2,
  success: 3,
};

function getStepIndex(step: ImportStep): number {
  return STEP_INDEX_MAP[step] ?? 0;
}

/** Map import method to its destination step. */
const METHOD_TO_STEP: Record<ImportMethod, ImportStep> = {
  url: "url-entry",
  picker: "picker",
  csv: "csv-upload",
};

/** Loading messages keyed by import method. */
const LOADING_MESSAGES: Partial<Record<ImportMethod, string>> = {
  picker: "Reading the rune-stones from your archives...",
  csv: "Reading the inscriptions from your rune-stone...",
};

// ── Private step sub-components ───────────────────────────────────────────────

interface AriaLiveRegionProps {
  step: ImportStep;
  cardCount: number;
  dedupResult: DedupResult | null;
}

function AriaLiveRegion({ step, cardCount, dedupResult }: AriaLiveRegionProps) {
  return (
    <div aria-live="polite" className="sr-only">
      {step === "method" && "Step 1: Choose import method"}
      {step === "url-entry" && "Step 2: Enter Google Sheets URL"}
      {step === "csv-upload" && "Step 2: Upload CSV file"}
      {step === "picker" && "Step 2: Browsing Google Drive"}
      {step === "loading" && "Loading: extracting cards from your data"}
      {step === "preview" && `Preview: ${cardCount} cards ready to import`}
      {step === "dedup" &&
        `Duplicates found: ${dedupResult?.duplicates.length ?? 0} duplicate cards detected`}
      {step === "error" && "Error: import failed"}
      {step === "success" && "Success: cards imported"}
    </div>
  );
}

interface LoadingStepContentProps {
  importMethod: ImportMethod | null;
  onCancel: () => void;
}

function LoadingStepContent({ importMethod, onCancel }: LoadingStepContentProps) {
  const message =
    (importMethod && LOADING_MESSAGES[importMethod]) ??
    "Reading the runes from your spreadsheet...";
  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div
        className="h-12 w-12 rounded-full border-2 border-border border-t-gold animate-spin"
        role="status"
        aria-label="Loading"
      />
      <p className="font-body text-muted-foreground text-base italic text-center">{message}</p>
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex items-center justify-center rounded-sm font-heading tracking-wide text-base transition-colors border border-border text-muted-foreground hover:border-gold/50 hover:text-gold h-11 px-6 min-w-[44px]"
      >
        Cancel
      </button>
    </div>
  );
}

interface PreviewCardListProps {
  cards: Omit<Card, "householdId">[];
}

function PreviewCardList({ cards }: PreviewCardListProps) {
  return (
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
              <span className="font-mono text-sm text-gold">{formatFee(card.annualFee)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface PreviewStepContentProps {
  cards: Omit<Card, "householdId">[];
  sensitiveDataWarning: boolean;
  warning: string | undefined;
  onCancel: () => void;
  onConfirm: () => void;
}

function PreviewStepContent({
  cards,
  sensitiveDataWarning,
  warning,
  onCancel,
  onConfirm,
}: PreviewStepContentProps) {
  const cardLabel = `${cards.length} card${cards.length !== 1 ? "s" : ""}`;
  return (
    <div className="flex flex-col gap-3 overflow-hidden flex-1">
      {sensitiveDataWarning && <SafetyBanner variant="sensitive-data" />}
      {warning && (
        <div className="rounded-sm border border-primary/40 bg-primary/10 px-3 py-2">
          <p className="text-sm font-body text-primary">{warning}</p>
        </div>
      )}
      <PreviewCardList cards={cards} />
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center rounded-sm font-heading tracking-wide text-base transition-colors border border-border text-muted-foreground hover:border-gold/50 hover:text-gold h-11 px-6 min-w-[44px]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex items-center justify-center rounded-sm font-heading tracking-wide text-base transition-colors bg-primary text-primary-foreground hover:bg-primary hover:brightness-110 h-11 px-6 min-w-[44px]"
        >
          Import {cardLabel}
        </button>
      </div>
    </div>
  );
}

interface ErrorStepContentProps {
  errorCode: SheetImportErrorCode | null;
  errorMessage: string;
  onClose: () => void;
  onReset: () => void;
}

function ErrorStepContent({ errorCode, errorMessage, onClose, onReset }: ErrorStepContentProps) {
  const message = errorCode ? ERROR_MESSAGES[errorCode] : errorMessage;
  return (
    <div className="flex flex-col gap-4 py-2">
      <p className="font-body text-muted-foreground text-base">{message}</p>
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
          onClick={onReset}
          className="inline-flex items-center justify-center rounded-sm font-heading tracking-wide text-base transition-colors bg-primary text-primary-foreground hover:bg-primary hover:brightness-110 h-11 px-6 min-w-[44px]"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

interface SuccessStepContentProps {
  importMethod: ImportMethod | null;
  onClose: () => void;
}

function SuccessStepContent({ importMethod, onClose }: SuccessStepContentProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className="text-4xl" aria-hidden="true">
        ᚠ
      </div>
      <p className="font-body text-muted-foreground text-base text-center">
        The runes have been inscribed in the ledger. Your cards have been added to the household.
      </p>
      {importMethod === "url" && (
        <div className="w-full">
          <SafetyBanner variant="post-share" />
        </div>
      )}
      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center justify-center w-full rounded-sm font-heading tracking-wide text-base transition-colors bg-primary text-primary-foreground hover:bg-primary hover:brightness-110 h-11 px-6 min-w-[44px]"
      >
        Continue
      </button>
    </div>
  );
}

// ── Step content router ───────────────────────────────────────────────────────

interface ImportWizardStepContentProps {
  step: ImportStep;
  importMethod: ImportMethod | null;
  url: string;
  setUrl: (url: string) => void;
  cards: Omit<Card, "householdId">[];
  warning: string | undefined;
  sensitiveDataWarning: boolean;
  errorCode: SheetImportErrorCode | null;
  errorMessage: string;
  dedupResult: DedupResult | null;
  isValidUrl: boolean;
  showUrlError: boolean;
  pickerApiKey: string | null;
  onSubmit: () => void;
  onSubmitCsv: (csv: string) => void;
  onSubmitFile: (base64: string, filename: string, format: FileFormat) => void;
  onCancel: () => void;
  onReset: () => void;
  onClose: () => void;
  onConfirm: () => void;
  onSelectMethod: (method: ImportMethod) => void;
  onBack: () => void;
  onSkipDuplicates: () => void;
  onImportAll: () => void;
}

function ImportWizardStepContent(props: ImportWizardStepContentProps) {
  const { step } = props;

  switch (step) {
    case "method":
      return (
        <>
          <DialogHeader>
            <DialogTitle className="font-display text-gold tracking-wide text-xl">
              Import Cards
            </DialogTitle>
            <DialogDescription className="sr-only">
              Choose a method to import your credit cards into Fenrir Ledger
            </DialogDescription>
          </DialogHeader>
          <MethodSelection onSelectMethod={props.onSelectMethod} pickerApiKey={props.pickerApiKey} />
        </>
      );

    case "url-entry":
      return (
        <>
          <DialogHeader>
            <DialogTitle className="font-display text-gold tracking-wide text-xl">
              Share a Rune Tablet
            </DialogTitle>
            <DialogDescription className="sr-only">
              Enter a Google Sheets URL to import your card data
            </DialogDescription>
          </DialogHeader>
          <ShareUrlEntry
            url={props.url}
            setUrl={props.setUrl}
            onSubmit={props.onSubmit}
            onBack={props.onBack}
            isValid={props.isValidUrl}
            showError={props.showUrlError}
          />
        </>
      );

    case "csv-upload":
      return (
        <>
          <DialogHeader>
            <DialogTitle className="font-display text-gold tracking-wide text-xl">
              Deliver a Rune-Stone
            </DialogTitle>
            <DialogDescription className="sr-only">
              Upload a CSV or Excel file containing your credit card data
            </DialogDescription>
          </DialogHeader>
          <CsvUpload
            onSubmit={props.onSubmitCsv}
            onSubmitFile={props.onSubmitFile}
            onBack={props.onBack}
          />
        </>
      );

    case "picker":
      return (
        <>
          <DialogHeader>
            <DialogTitle className="font-display text-gold tracking-wide text-xl">
              Browse the Archives
            </DialogTitle>
            <DialogDescription className="sr-only">
              Browse and select a spreadsheet from your Google Drive
            </DialogDescription>
          </DialogHeader>
          <PickerStep
            onSubmitCsv={props.onSubmitCsv}
            onBack={props.onBack}
            pickerApiKey={props.pickerApiKey}
          />
        </>
      );

    case "loading":
      return (
        <>
          <DialogHeader>
            <DialogTitle className="font-display text-gold tracking-wide text-xl">
              Deciphering the runes...
            </DialogTitle>
            <DialogDescription className="sr-only">
              Processing your data and extracting card information
            </DialogDescription>
          </DialogHeader>
          <LoadingStepContent importMethod={props.importMethod} onCancel={props.onCancel} />
        </>
      );

    case "preview":
      return (
        <>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <DialogTitle className="font-display text-gold tracking-wide text-xl">
                Preview Import
              </DialogTitle>
              <span className="inline-flex items-center justify-center rounded-full bg-gold/20 text-gold font-mono text-sm font-bold px-2 py-0.5 border border-gold/30">
                {props.cards.length} card{props.cards.length !== 1 ? "s" : ""}
              </span>
            </div>
            <DialogDescription className="sr-only">
              Review the cards found before importing them to your ledger
            </DialogDescription>
          </DialogHeader>
          <PreviewStepContent
            cards={props.cards}
            sensitiveDataWarning={props.sensitiveDataWarning}
            warning={props.warning}
            onCancel={props.onClose}
            onConfirm={props.onConfirm}
          />
        </>
      );

    case "dedup":
      return props.dedupResult ? (
        <ImportDedupStep
          duplicates={props.dedupResult.duplicates}
          uniqueCount={props.dedupResult.unique.length}
          onSkipDuplicates={props.onSkipDuplicates}
          onImportAll={props.onImportAll}
          onCancel={props.onClose}
        />
      ) : null;

    case "error":
      return (
        <>
          <DialogHeader>
            <DialogTitle className="font-display text-destructive tracking-wide text-xl">
              Import Failed
            </DialogTitle>
            <DialogDescription className="sr-only">
              An error occurred while importing your cards
            </DialogDescription>
          </DialogHeader>
          <ErrorStepContent
            errorCode={props.errorCode}
            errorMessage={props.errorMessage}
            onClose={props.onClose}
            onReset={props.onReset}
          />
        </>
      );

    case "success":
      return (
        <>
          <DialogHeader>
            <DialogTitle className="font-display text-gold tracking-wide text-xl">
              Cards imported!
            </DialogTitle>
            <DialogDescription className="sr-only">
              Your cards have been successfully imported to Fenrir Ledger
            </DialogDescription>
          </DialogHeader>
          <SuccessStepContent importMethod={props.importMethod} onClose={props.onClose} />
        </>
      );

    default:
      return null;
  }
}

// ── Main component ────────────────────────────────────────────────────────────

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

    // Track import completion — method is guaranteed to be set before success step.
    if (importMethod) {
      track("sheet-import", { method: importMethod });
    }

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
    setStep(METHOD_TO_STEP[method]);
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
        className="w-[92vw] max-w-[680px] max-h-[90vh] overflow-y-auto flex flex-col border-border bg-background max-sm:w-screen max-sm:max-w-none max-sm:max-h-none"
        aria-label="Import Wizard"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Step indicator */}
        <StepIndicator activeStep={getStepIndex(step)} />

        {/* aria-live region announces step changes to screen readers */}
        <AriaLiveRegion step={step} cardCount={cards.length} dedupResult={dedupResult} />

        {/* Step content router */}
        <ImportWizardStepContent
          step={step}
          importMethod={importMethod}
          url={url}
          setUrl={setUrl}
          cards={cards}
          warning={warning}
          sensitiveDataWarning={sensitiveDataWarning}
          errorCode={errorCode}
          errorMessage={errorMessage}
          dedupResult={dedupResult}
          isValidUrl={isValidUrl}
          showUrlError={showUrlError}
          pickerApiKey={pickerApiKey}
          onSubmit={submit}
          onSubmitCsv={submitCsv}
          onSubmitFile={submitFile}
          onCancel={cancel}
          onReset={reset}
          onClose={onClose}
          onConfirm={handleConfirm}
          onSelectMethod={handleSelectMethod}
          onBack={handleBackToMethod}
          onSkipDuplicates={handleSkipDuplicates}
          onImportAll={handleImportAll}
        />
      </DialogContent>
    </Dialog>
  );
}
