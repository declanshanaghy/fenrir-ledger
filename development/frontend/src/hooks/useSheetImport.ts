"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Card } from "@/lib/types";
import type { SheetImportErrorCode } from "@/lib/sheets/types";
import { getSession } from "@/lib/auth/session";

export type ImportStep =
  | "method"
  | "url-entry"
  | "csv-upload"
  | "loading"
  | "preview"
  | "dedup"
  | "error"
  | "success";

/** Overall import timeout in milliseconds. */
const IMPORT_TIMEOUT_MS = 90_000;

export interface UseSheetImportReturn {
  step: ImportStep;
  setStep: (step: ImportStep) => void;
  url: string;
  setUrl: (url: string) => void;
  cards: Omit<Card, "householdId">[];
  warning: string | undefined;
  sensitiveDataWarning: boolean;
  errorCode: SheetImportErrorCode | null;
  errorMessage: string;
  submit: () => void;
  submitCsv: (csv: string) => void;
  cancel: () => void;
  reset: () => void;
}

export function useSheetImport(): UseSheetImportReturn {
  const [step, setStep] = useState<ImportStep>("method");
  const [url, setUrl] = useState("");
  const [cards, setCards] = useState<Omit<Card, "householdId">[]>([]);
  const [warning, setWarning] = useState<string | undefined>(undefined);
  const [sensitiveDataWarning, setSensitiveDataWarning] = useState(false);
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

  /** Build auth headers for the import API call. */
  function buildHeaders(): Record<string, string> {
    const session = getSession();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (session?.id_token) {
      headers["Authorization"] = `Bearer ${session.id_token}`;
    }
    return headers;
  }

  /** Shared response handler for both URL and CSV import paths. */
  const handleResponse = useCallback(
    async (response: Response) => {
      const data = (await response.json()) as
        | { cards: Omit<Card, "householdId">[]; warning?: string; sensitiveDataWarning?: boolean }
        | { error: { code: SheetImportErrorCode; message: string } };

      if ("error" in data) {
        setErrorCode(data.error.code);
        setErrorMessage(data.error.message);
        setStep("error");
      } else {
        setCards(data.cards);
        setWarning(data.warning);
        setSensitiveDataWarning(data.sensitiveDataWarning ?? false);
        setStep("preview");
      }
    },
    []
  );

  /** Handle fetch errors shared between both import paths. */
  const handleFetchError = useCallback((err: unknown) => {
    if ((err as { name?: string }).name === "AbortError") {
      setStep("method");
    } else {
      setErrorCode("FETCH_ERROR");
      setErrorMessage("Couldn't reach the import service. Please try again.");
      setStep("error");
    }
  }, []);

  /** Submit a Google Sheets URL for import. */
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

    try {
      const response = await fetch("/api/sheets/import", {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({ url }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      await handleResponse(response);
    } catch (err) {
      clearTimeout(timeoutId);
      handleFetchError(err);
    } finally {
      abortRef.current = null;
    }
  }, [url, handleResponse, handleFetchError]);

  /** Submit raw CSV text for import. */
  const submitCsv = useCallback(
    async (csv: string) => {
      setStep("loading");

      const controller = new AbortController();
      abortRef.current = controller;

      const timeoutId = setTimeout(() => {
        controller.abort();
      }, IMPORT_TIMEOUT_MS);

      try {
        const response = await fetch("/api/sheets/import", {
          method: "POST",
          headers: buildHeaders(),
          body: JSON.stringify({ csv }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        await handleResponse(response);
      } catch (err) {
        clearTimeout(timeoutId);
        handleFetchError(err);
      } finally {
        abortRef.current = null;
      }
    },
    [handleResponse, handleFetchError]
  );

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setStep("method");
  }, []);

  const reset = useCallback(() => {
    setStep("method");
    setErrorCode(null);
    setErrorMessage("");
    setSensitiveDataWarning(false);
  }, []);

  return {
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
    cancel,
    reset,
  };
}
