/**
 * Fetch CSV data from a Google Sheets export URL.
 *
 * Ported from development/backend/src/lib/sheets/fetch-csv.ts
 */

import { CSV_TRUNCATION_LIMIT } from "./prompt";
import { log } from "@/lib/logger";

export interface FetchCsvResult {
  csv: string;
  warning?: string;
}

export type FetchCsvErrorCode = "SHEET_NOT_PUBLIC" | "FETCH_ERROR" | "NO_CARDS_FOUND";

export class FetchCsvError extends Error {
  constructor(
    public readonly code: FetchCsvErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "FetchCsvError";
  }
}

/**
 * Fetches CSV from a Google Sheets export URL.
 *
 * @param csvUrl - The full CSV export URL (from buildCsvExportUrl)
 * @returns The CSV text and optional truncation warning
 * @throws {FetchCsvError} With structured code on failure
 */
export async function fetchCsv(csvUrl: string): Promise<FetchCsvResult> {
  log.debug("fetchCsv called", { csvUrl });

  const response = await fetch(csvUrl, { redirect: "follow" });

  if (response.status === 403 || response.status === 404) {
    log.debug("fetchCsv throwing", { code: "SHEET_NOT_PUBLIC", status: response.status });
    throw new FetchCsvError(
      "SHEET_NOT_PUBLIC",
      "The spreadsheet is not publicly accessible. Make sure it's shared as 'Anyone with the link can view'.",
    );
  }

  if (!response.ok) {
    log.debug("fetchCsv throwing", { code: "FETCH_ERROR", status: response.status });
    throw new FetchCsvError(
      "FETCH_ERROR",
      `Failed to fetch spreadsheet (HTTP ${response.status}).`,
    );
  }

  let csv = await response.text();

  if (!csv.trim()) {
    log.debug("fetchCsv throwing", { code: "NO_CARDS_FOUND", reason: "empty" });
    throw new FetchCsvError(
      "NO_CARDS_FOUND",
      "The spreadsheet appears to be empty.",
    );
  }

  if (csv.length > CSV_TRUNCATION_LIMIT) {
    csv = csv.slice(0, CSV_TRUNCATION_LIMIT);
    const result: FetchCsvResult = {
      csv,
      warning: `CSV was truncated at ${CSV_TRUNCATION_LIMIT.toLocaleString()} characters. Some rows may be missing.`,
    };
    log.debug("fetchCsv returning", { csvLength: csv.length, truncated: true });
    return result;
  }

  log.debug("fetchCsv returning", { csvLength: csv.length, truncated: false });
  return { csv };
}
