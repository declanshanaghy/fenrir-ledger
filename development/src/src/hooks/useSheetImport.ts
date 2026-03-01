"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Card } from "@/lib/types";
import type { SheetImportErrorCode } from "@/lib/sheets/types";

export type ImportStep = "entry" | "loading" | "preview" | "dedup" | "error" | "success";

/** Phases reported by the WebSocket backend during import. */
export type ImportPhase =
  | "connecting"
  | "fetching_sheet"
  | "extracting"
  | "validating"
  | null;

/**
 * Messages the backend sends over the WebSocket connection.
 * Mirrors the contract from the backend orchestration spec.
 */
interface ServerMessage {
  type: "import_phase" | "import_progress" | "import_complete" | "import_error";
  phase?: "fetching_sheet" | "extracting" | "validating" | "done";
  rowsExtracted?: number;
  totalRows?: number;
  cards?: Array<Omit<Card, "householdId">>;
  code?: string;
  message?: string;
}

/** Derive the HTTP base URL from the WS env var (ws:// -> http://, wss:// -> https://). */
const WS_BACKEND_HTTP_URL =
  process.env.NEXT_PUBLIC_BACKEND_WS_URL?.replace(/^ws(s?)/, "http$1") ??
  "http://localhost:9753";

/** WebSocket URL for the backend. */
const WS_BACKEND_WS_URL =
  process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? "ws://localhost:9753";

/** Health check timeout in milliseconds. */
const HEALTH_CHECK_TIMEOUT_MS = 2_000;

/** Overall import timeout in milliseconds. */
const IMPORT_TIMEOUT_MS = 20_000;

export interface UseSheetImportReturn {
  step: ImportStep;
  setStep: (step: ImportStep) => void;
  url: string;
  setUrl: (url: string) => void;
  cards: Omit<Card, "householdId">[];
  warning: string | undefined;
  errorCode: SheetImportErrorCode | null;
  errorMessage: string;
  importPhase: ImportPhase;
  submit: () => void;
  cancel: () => void;
  reset: () => void;
}

/**
 * Probe the backend health endpoint with a timeout.
 * Returns true if the backend responds 200 within the timeout.
 */
async function checkBackendHealth(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

  try {
    const res = await fetch(`${WS_BACKEND_HTTP_URL}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    clearTimeout(timeout);
    return false;
  }
}

export function useSheetImport(): UseSheetImportReturn {
  const [step, setStep] = useState<ImportStep>("entry");
  const [url, setUrl] = useState("");
  const [cards, setCards] = useState<Omit<Card, "householdId">[]>([]);
  const [warning, setWarning] = useState<string | undefined>(undefined);
  const [errorCode, setErrorCode] = useState<SheetImportErrorCode | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [importPhase, setImportPhase] = useState<ImportPhase>(null);

  const abortRef = useRef<AbortController | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const wsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Close the WebSocket connection and clear the timeout guard. */
  const closeWebSocket = useCallback(() => {
    if (wsTimeoutRef.current !== null) {
      clearTimeout(wsTimeoutRef.current);
      wsTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setImportPhase(null);
  }, []);

  /** Clean up WebSocket on unmount. */
  useEffect(() => {
    return () => {
      closeWebSocket();
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, [closeWebSocket]);

  /**
   * Attempt import via WebSocket.
   * Returns true if the WS connection was successfully opened and messaging started.
   * Returns false if WebSocket fails to open (triggers HTTP fallback).
   */
  const submitViaWebSocket = useCallback(
    (sheetUrl: string): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        setImportPhase("connecting");

        let resolved = false;
        const ws = new WebSocket(WS_BACKEND_WS_URL);
        wsRef.current = ws;

        // Timeout guard for the entire WS import flow
        wsTimeoutRef.current = setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close();
          }
          wsRef.current = null;
          wsTimeoutRef.current = null;
          setImportPhase(null);
          // If we never resolved, treat as failure to trigger HTTP fallback
          if (!resolved) {
            resolved = true;
            resolve(false);
          } else {
            // WS was already open and messaging — this is a timeout during import
            setErrorCode("FETCH_ERROR");
            setErrorMessage("Import timed out. Please try again.");
            setStep("error");
          }
        }, IMPORT_TIMEOUT_MS);

        ws.onopen = () => {
          resolved = true;
          resolve(true);
          ws.send(JSON.stringify({ type: "import_start", payload: { url: sheetUrl } }));
        };

        ws.onmessage = (event: MessageEvent) => {
          try {
            const msg = JSON.parse(event.data as string) as ServerMessage;

            switch (msg.type) {
              case "import_phase": {
                if (msg.phase === "done") {
                  // Done phase is a precursor to import_complete; keep current phase
                  break;
                }
                setImportPhase(msg.phase ?? null);
                break;
              }
              case "import_complete": {
                const importedCards = msg.cards ?? [];
                setCards(importedCards);
                setWarning(undefined);
                setStep("preview");
                closeWebSocket();
                break;
              }
              case "import_error": {
                const code = (msg.code ?? "FETCH_ERROR") as SheetImportErrorCode;
                setErrorCode(code);
                setErrorMessage(msg.message ?? "An unknown error occurred during import.");
                setStep("error");
                closeWebSocket();
                break;
              }
              // import_progress — could be used for a progress bar in future; ignored for now
              default:
                break;
            }
          } catch {
            // Malformed JSON — ignore
          }
        };

        ws.onerror = () => {
          // If we haven't resolved yet, this means the connection failed to open
          if (!resolved) {
            resolved = true;
            closeWebSocket();
            resolve(false);
          }
        };

        ws.onclose = () => {
          // If WS closed unexpectedly after opening but before import_complete/error,
          // and the step is still "loading", treat as an error
          wsRef.current = null;
          if (wsTimeoutRef.current !== null) {
            clearTimeout(wsTimeoutRef.current);
            wsTimeoutRef.current = null;
          }
        };
      });
    },
    [closeWebSocket],
  );

  /** Fallback: import via HTTP POST to /api/sheets/import (existing behavior). */
  const submitViaHttp = useCallback(
    async (sheetUrl: string) => {
      const controller = new AbortController();
      abortRef.current = controller;

      const timeoutId = setTimeout(() => {
        controller.abort();
      }, IMPORT_TIMEOUT_MS);

      try {
        const response = await fetch("/api/sheets/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: sheetUrl }),
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
    },
    [],
  );

  const submit = useCallback(async () => {
    // Validate URL contains Google Sheets domain
    if (!url.includes("docs.google.com/spreadsheets")) {
      setErrorCode("INVALID_URL");
      setErrorMessage("Enter a valid Google Sheets URL");
      return;
    }

    setStep("loading");
    setImportPhase("connecting");

    // Probe backend health to decide WS vs HTTP
    const backendHealthy = await checkBackendHealth();

    if (backendHealthy) {
      const wsOpened = await submitViaWebSocket(url);
      if (!wsOpened) {
        // WS failed to open despite health check — fall back to HTTP
        setImportPhase(null);
        await submitViaHttp(url);
      }
    } else {
      // Backend unreachable — use HTTP fallback silently
      setImportPhase(null);
      await submitViaHttp(url);
    }
  }, [url, submitViaWebSocket, submitViaHttp]);

  const cancel = useCallback(() => {
    // Send cancel message over WebSocket if connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "import_cancel" }));
    }
    closeWebSocket();

    // Also abort any in-flight HTTP request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setStep("entry");
  }, [closeWebSocket]);

  const reset = useCallback(() => {
    closeWebSocket();
    setStep("entry");
    setErrorCode(null);
    setErrorMessage("");
    setImportPhase(null);
  }, [closeWebSocket]);

  return {
    step,
    setStep,
    url,
    setUrl,
    cards,
    warning,
    errorCode,
    errorMessage,
    importPhase,
    submit,
    cancel,
    reset,
  };
}
