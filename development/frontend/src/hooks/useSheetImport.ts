"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Card } from "@/lib/types";
import type { SheetImportErrorCode } from "@/lib/sheets/types";
import { ensureFreshToken } from "@/lib/auth/refresh-session";

export type ImportStep =
  | "method"
  | "url-entry"
  | "csv-upload"
  | "picker"
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

  /**
   * Build auth headers with a fresh token (DEF-003).
   * Silently refreshes the id_token if it's expired or close to expiry.
   */
  async function buildHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const token = await ensureFreshToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Shared response handler for both URL and CSV import paths (DEF-002 fix).
   *
   * Handles two error response shapes:
   *   - requireAuth: { error: "missing_token", error_description: "..." }
   *   - import pipeline: { error: { code: "...", message: "..." } }
   */
  const handleResponse = useCallback(
    async (response: Response) => {
      // DEF-002: Handle HTTP-level auth errors before parsing body
      if (response.status === 401) {
        setErrorCode("FETCH_ERROR");
        setErrorMessage(
          "Your session has expired. Please sign in again to import."
        );
        setStep("error");
        return;
      }

      if (response.status === 403 && !response.headers.get("content-type")?.includes("application/json")) {
        setErrorCode("FETCH_ERROR");
        setErrorMessage("Access denied. Please sign in again.");
        setStep("error");
        return;
      }

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        setErrorCode("FETCH_ERROR");
        setErrorMessage("Received an invalid response from the server.");
        setStep("error");
        return;
      }

      // Check for the import pipeline error shape: { error: { code, message } }
      if (
        data &&
        typeof data === "object" &&
        "error" in data
      ) {
        const err = (data as Record<string, unknown>).error;

        if (err && typeof err === "object" && "code" in err && "message" in err) {
          // Standard SheetImportError shape
          const importErr = err as { code: SheetImportErrorCode; message: string };
          setErrorCode(importErr.code);
          setErrorMessage(importErr.message);
        } else {
          // Auth error shape: { error: "string", error_description: "string" }
          const desc = (data as Record<string, unknown>).error_description;
          setErrorCode("FETCH_ERROR");
          setErrorMessage(
            typeof desc === "string"
              ? desc
              : "An authentication error occurred. Please sign in again."
          );
        }

        setStep("error");
        return;
      }

      // Success path
      const success = data as {
        cards: Omit<Card, "householdId">[];
        warning?: string;
        sensitiveDataWarning?: boolean;
      };
      setCards(success.cards);
      setWarning(success.warning);
      setSensitiveDataWarning(success.sensitiveDataWarning ?? false);
      setStep("preview");
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
      const headers = await buildHeaders();
      const response = await fetch("/api/sheets/import", {
        method: "POST",
        headers,
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
        const headers = await buildHeaders();
        const response = await fetch("/api/sheets/import", {
          method: "POST",
          headers,
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
