/**
 * Fetch CSV data from a Google Sheets export URL.
 *
 * Handles error cases:
 * - 403/404 -> sheet is not publicly accessible
 * - Empty body -> sheet is empty
 * - Large CSV -> truncated at CSV_TRUNCATION_LIMIT chars
 */

import { CSV_TRUNCATION_LIMIT } from "./prompt.js";

/** Result of fetching CSV from Google Sheets. */
export interface FetchCsvResult {
  /** The CSV text content. */
  csv: string;
  /** Warning message if the CSV was truncated. */
  warning?: string;
}

/** Error codes specific to the CSV fetch step. */
export type FetchCsvErrorCode = "SHEET_NOT_PUBLIC" | "FETCH_ERROR" | "NO_CARDS_FOUND";

/** Error thrown when CSV fetch fails with a structured code. */
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
  const response = await fetch(csvUrl, { redirect: "follow" });

  if (response.status === 403 || response.status === 404) {
    throw new FetchCsvError(
      "SHEET_NOT_PUBLIC",
      "The spreadsheet is not publicly accessible. Make sure it's shared as 'Anyone with the link can view'.",
    );
  }

  if (!response.ok) {
    throw new FetchCsvError(
      "FETCH_ERROR",
      `Failed to fetch spreadsheet (HTTP ${response.status}).`,
    );
  }

  let csv = await response.text();

  if (!csv.trim()) {
    throw new FetchCsvError(
      "NO_CARDS_FOUND",
      "The spreadsheet appears to be empty.",
    );
  }

  let warning: string | undefined;
  if (csv.length > CSV_TRUNCATION_LIMIT) {
    csv = csv.slice(0, CSV_TRUNCATION_LIMIT);
    warning = `CSV was truncated at ${CSV_TRUNCATION_LIMIT.toLocaleString()} characters. Some rows may be missing.`;
  }

  return { csv, warning };
}
