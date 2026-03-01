"use client";

import { useState, useCallback, useRef } from "react";
import type { Card } from "@/lib/types";
import type { SheetImportErrorCode } from "@/lib/sheets/types";

export type ImportStep = "entry" | "loading" | "preview" | "error" | "success";

export interface UseSheetImportReturn {
  step: ImportStep;
  url: string;
  setUrl: (url: string) => void;
  cards: Omit<Card, "householdId">[];
  warning: string | undefined;
  errorCode: SheetImportErrorCode | null;
  errorMessage: string;
  submit: () => void;
  cancel: () => void;
  reset: () => void;
}

export function useSheetImport(): UseSheetImportReturn {
  const [step, setStep] = useState<ImportStep>("entry");
  const [url, setUrl] = useState("");
  const [cards, setCards] = useState<Omit<Card, "householdId">[]>([]);
  const [warning, setWarning] = useState<string | undefined>(undefined);
  const [errorCode, setErrorCode] = useState<SheetImportErrorCode | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const submit = useCallback(async () => {
    // Validate URL contains Google Sheets domain
    if (!url.includes("docs.google.com/spreadsheets")) {
      setErrorCode("INVALID_URL");
      setErrorMessage("Enter a valid Google Sheets URL");
      return;
    }

    setStep("loading");

    const controller = new AbortController();
    abortRef.current = controller;

    // 20-second timeout guard
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 20_000);

    try {
      const response = await fetch("/api/sheets/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = (await response.json()) as
        | { cards: Omit<Card, "householdId">[]; warning?: string }
        | { error: { code: SheetImportErrorCode; message: string } };

      if ("error" in data) {
        setErrorCode(data.error.code);
        setErrorMessage(data.error.message);
        setStep("error");
      } else {
        setCards(data.cards);
        setWarning(data.warning);
        setStep("preview");
      }
    } catch (err) {
      clearTimeout(timeoutId);

      if ((err as { name?: string }).name === "AbortError") {
        // User cancelled or timeout — go back to entry
        setStep("entry");
      } else {
        setErrorCode("FETCH_ERROR");
        setErrorMessage("Couldn't reach the spreadsheet. Check the URL and try again.");
        setStep("error");
      }
    } finally {
      abortRef.current = null;
    }
  }, [url]);

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setStep("entry");
  }, []);

  const reset = useCallback(() => {
    // Go back to entry with URL pre-filled
    setStep("entry");
    setErrorCode(null);
    setErrorMessage("");
  }, []);

  return {
    step,
    url,
    setUrl,
    cards,
    warning,
    errorCode,
    errorMessage,
    submit,
    cancel,
    reset,
  };
}
