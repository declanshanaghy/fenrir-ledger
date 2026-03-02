/**
 * Serverless import pipeline for Google Sheets URLs.
 *
 * Orchestrates: parse URL -> fetch CSV -> shared LLM extraction -> return.
 * Called by the /api/sheets/import route handler.
 */

import { extractSheetId, buildCsvExportUrl } from "./parse-url";
import { fetchCsv, FetchCsvError } from "./fetch-csv";
import { extractCardsFromCsv } from "./extract-cards";
import type { SheetImportResponse } from "./types";

/**
 * Run the full import pipeline: URL -> CSV -> LLM -> validated cards.
 *
 * @param url - A Google Sheets URL
 * @returns SheetImportResponse with cards array or error
 */
export async function importFromSheet(url: string): Promise<SheetImportResponse> {
  // 1. Parse the sheet URL
  const sheetId = extractSheetId(url);
  if (!sheetId) {
    return {
      error: {
        code: "INVALID_URL",
        message: "Could not extract a Google Sheets ID from the provided URL.",
      },
    };
  }

  const csvUrl = buildCsvExportUrl(sheetId);

  // 2. Fetch CSV
  let csv: string;
  let csvWarning: string | undefined;
  try {
    const result = await fetchCsv(csvUrl);
    csv = result.csv;
    csvWarning = result.warning;
  } catch (err) {
    if (err instanceof FetchCsvError) {
      return { error: { code: err.code, message: err.message } };
    }
    return {
      error: {
        code: "FETCH_ERROR",
        message: "Failed to fetch the spreadsheet. Please try again.",
      },
    };
  }

  // 3. Extract cards using shared LLM pipeline
  const result = await extractCardsFromCsv(csv);

  // Merge CSV fetch warning if present
  if ("error" in result) {
    return result;
  }

  if (csvWarning) {
    return {
      ...result,
      warning: result.warning
        ? `${result.warning} ${csvWarning}`
        : csvWarning,
    };
  }

  return result;
}
