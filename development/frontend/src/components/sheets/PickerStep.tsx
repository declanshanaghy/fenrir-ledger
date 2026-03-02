"use client";

/**
 * PickerStep — Step 2B of the Import Wizard.
 *
 * Three internal states:
 *   1. consent   — user hasn't granted Drive access yet
 *   2. picker    — Google Picker is loading/open
 *   3. fetching  — spreadsheet content is being fetched via Sheets API
 *
 * Follows the interaction spec at designs/ux-design/interactions/import-workflow-v2.md (Step 2B).
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { SafetyBanner } from "@/components/sheets/SafetyBanner";
import { useDriveToken } from "@/hooks/useDriveToken";
import { openPicker, PickerError } from "@/lib/google/picker";
import { fetchSheetAsCSV, SheetsApiError } from "@/lib/google/sheets-api";

type PickerState = "consent" | "picker" | "fetching";

interface PickerStepProps {
  /** Called with CSV text when sheet content is ready for the import pipeline */
  onSubmitCsv: (csv: string) => void;
  /** Called when user wants to go back to method selection */
  onBack: () => void;
}

const PICKER_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY;

export function PickerStep({ onSubmitCsv, onBack }: PickerStepProps) {
  const {
    hasDriveAccess,
    driveToken,
    isRequesting,
    requestDriveAccess,
    driveError,
    clearDriveError,
  } = useDriveToken();

  const [state, setState] = useState<PickerState>(
    hasDriveAccess ? "picker" : "consent"
  );
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const pickerOpenedRef = useRef(false);

  // Transition to picker when access is granted
  useEffect(() => {
    if (hasDriveAccess && state === "consent") {
      setState("picker");
    }
  }, [hasDriveAccess, state]);

  // Auto-open the Picker once we have a token and are in "picker" state
  useEffect(() => {
    if (state !== "picker" || !driveToken || !PICKER_API_KEY || pickerOpenedRef.current) {
      return;
    }

    pickerOpenedRef.current = true;
    handleOpenPicker(driveToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, driveToken]);

  const handleOpenPicker = useCallback(
    async (token: string) => {
      if (!PICKER_API_KEY) {
        setError("Google Picker is not configured. Try using Share a Scroll or Upload CSV instead.");
        return;
      }

      setError(null);

      try {
        const result = await openPicker(token, PICKER_API_KEY);

        if (!result) {
          // User cancelled the Picker
          onBack();
          return;
        }

        // Sheet selected — fetch content
        setState("fetching");
        setIsFetching(true);

        try {
          const csv = await fetchSheetAsCSV(result.id, token);
          onSubmitCsv(csv);
        } catch (fetchErr) {
          setIsFetching(false);

          if (fetchErr instanceof SheetsApiError) {
            if (fetchErr.code === "TOKEN_EXPIRED") {
              // Re-request token and retry once
              const newToken = await requestDriveAccess();
              if (newToken) {
                try {
                  const csv = await fetchSheetAsCSV(result.id, newToken);
                  onSubmitCsv(csv);
                  return;
                } catch (retryErr) {
                  setError(
                    retryErr instanceof SheetsApiError
                      ? retryErr.message
                      : "Failed to fetch the spreadsheet. Please try again."
                  );
                }
              } else {
                setError("Your Google Drive access has expired. Please re-authorize.");
              }
            } else {
              setError(fetchErr.message);
            }
          } else {
            setError("Failed to fetch the spreadsheet. Please try again.");
          }

          // Allow retry
          setState("picker");
          pickerOpenedRef.current = false;
        }
      } catch (pickerErr) {
        if (pickerErr instanceof PickerError && pickerErr.code === "SCRIPT_LOAD_FAILED") {
          setError(
            "Unable to load Google Drive. Try using Share a Scroll or Upload CSV instead."
          );
        } else {
          setError("Something went wrong with Google Drive. Please try again.");
        }
        pickerOpenedRef.current = false;
      }
    },
    [onBack, onSubmitCsv, requestDriveAccess]
  );

  const handleAllowAccess = useCallback(async () => {
    clearDriveError();
    setError(null);
    const token = await requestDriveAccess();
    if (!token) {
      // User declined or error — driveError is set by the hook
      return;
    }
    // Token obtained — useEffect will transition to picker state
  }, [requestDriveAccess, clearDriveError]);

  const handleDecline = useCallback(() => {
    onBack();
  }, [onBack]);

  const handleRetry = useCallback(() => {
    setError(null);
    pickerOpenedRef.current = false;
    if (driveToken) {
      handleOpenPicker(driveToken);
    } else {
      setState("consent");
    }
  }, [driveToken, handleOpenPicker]);

  // ── Consent State ──────────────────────────────────────────────────────

  if (state === "consent") {
    return (
      <div className="flex flex-col gap-4" aria-live="polite">
        <SafetyBanner variant="compact" />

        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="text-gold text-3xl" aria-hidden="true">
            ᚨ
          </div>

          <h3 className="font-heading text-base text-foreground tracking-wide">
            Grant Archive Access
          </h3>

          <p className="font-body text-sm text-muted-foreground max-w-md leading-relaxed">
            To browse your Google Drive, Fenrir Ledger needs read access to the
            spreadsheets you select. We never access your entire Drive — only
            the files you choose.
          </p>

          {(driveError || error) && (
            <div role="alert" className="rounded-sm border border-red-500/40 bg-red-500/10 px-3 py-2 w-full max-w-md">
              <p className="text-xs font-body text-red-400">
                {driveError?.code === "CONSENT_DECLINED" || driveError?.code === "POPUP_CLOSED"
                  ? "Google Drive access was not granted. You can still import using a share URL or CSV file."
                  : error || driveError?.message || "An error occurred. Please try again."}
              </p>
            </div>
          )}

          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={handleDecline}
              className="inline-flex items-center justify-center rounded-sm font-heading tracking-wide text-sm transition-colors border border-border text-muted-foreground hover:border-gold/50 hover:text-gold h-11 px-6 min-w-[44px] min-h-[44px]"
            >
              No thanks
            </button>
            <button
              type="button"
              onClick={handleAllowAccess}
              disabled={isRequesting}
              className="inline-flex items-center justify-center rounded-sm font-heading tracking-wide text-sm transition-colors bg-primary text-primary-foreground hover:bg-gold-bright h-11 px-6 min-w-[44px] min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRequesting ? (
                <span className="flex items-center gap-2">
                  <span
                    className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  Requesting...
                </span>
              ) : (
                "Allow Access"
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="text-xs font-body text-muted-foreground hover:text-gold transition-colors mt-1 min-h-[44px] flex items-center"
          >
            &larr; Back to import methods
          </button>
        </div>
      </div>
    );
  }

  // ── Fetching State ─────────────────────────────────────────────────────

  if (state === "fetching" && isFetching) {
    return (
      <div className="flex flex-col items-center gap-6 py-8" aria-live="polite">
        <div
          className="h-12 w-12 rounded-full border-2 border-border border-t-gold animate-spin motion-reduce:animate-none"
          role="status"
          aria-label="Fetching spreadsheet"
        />
        <p className="font-body text-muted-foreground text-sm italic text-center">
          Fetching the sacred scrolls from your archives...
        </p>
      </div>
    );
  }

  // ── Picker State ───────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <SafetyBanner variant="compact" />

      <div className="flex flex-col items-center gap-4 py-4 text-center">
        {error ? (
          <>
            <div role="alert" className="rounded-sm border border-red-500/40 bg-red-500/10 px-3 py-2 w-full max-w-md">
              <p className="text-xs font-body text-red-400">{error}</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center justify-center rounded-sm font-heading tracking-wide text-sm transition-colors border border-border text-muted-foreground hover:border-gold/50 hover:text-gold h-11 px-6 min-w-[44px] min-h-[44px]"
              >
                Try another method
              </button>
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex items-center justify-center rounded-sm font-heading tracking-wide text-sm transition-colors bg-primary text-primary-foreground hover:bg-gold-bright h-11 px-6 min-w-[44px] min-h-[44px]"
              >
                Retry
              </button>
            </div>
          </>
        ) : (
          <>
            <div
              className="h-10 w-10 rounded-full border-2 border-border border-t-gold animate-spin motion-reduce:animate-none"
              role="status"
              aria-label="Loading Google Drive Picker"
            />
            <p className="font-body text-muted-foreground text-sm italic">
              Opening Google Drive...
            </p>
          </>
        )}

        <button
          type="button"
          onClick={onBack}
          className="text-xs font-body text-muted-foreground hover:text-gold transition-colors mt-1 min-h-[44px] flex items-center"
        >
          &larr; Back to import methods
        </button>
      </div>
    </div>
  );
}
