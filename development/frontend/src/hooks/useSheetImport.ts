"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Card } from "@/lib/types";
import type { SheetImportErrorCode } from "@/lib/sheets/types";
import { getSession } from "@/lib/auth/session";

export type ImportStep = "entry" | "loading" | "preview" | "dedup" | "error" | "success";

/** Overall import timeout in milliseconds. */
const IMPORT_TIMEOUT_MS = 90_000;

export interface UseSheetImportReturn {
  step: ImportStep;
  setStep: (step: ImportStep) => void;
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

  /** Clean up in-flight request on unmount. */
  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, []);

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

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, IMPORT_TIMEOUT_MS);

    // Build headers with auth token if signed in (ADR-008)
    const session = getSession();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (session?.id_token) {
      headers["Authorization"] = `Bearer ${session.id_token}`;
    }

    try {
      const response = await fetch("/api/sheets/import", {
        method: "POST",
        headers,
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
    setStep("entry");
    setErrorCode(null);
    setErrorMessage("");
  }, []);

  return {
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
  };
}
