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
import { log } from "@/lib/logger";

/**
 * Run the full import pipeline: URL -> CSV -> LLM -> validated cards.
 *
 * @param url - A Google Sheets URL
 * @returns SheetImportResponse with cards array or error
 */
export async function importFromSheet(url: string): Promise<SheetImportResponse> {
  log.debug("importFromSheet called", { url });

  // 1. Parse the sheet URL
  const sheetId = extractSheetId(url);
  if (!sheetId) {
    const result: SheetImportResponse = {
      error: {
        code: "INVALID_URL",
        message: "Could not extract a Google Sheets ID from the provided URL.",
      },
    };
    log.debug("importFromSheet returning", { errorCode: "INVALID_URL" });
    return result;
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
      log.error("importFromSheet: FetchCsvError", err);
      return { error: { code: err.code, message: err.message } };
    }
    log.error("importFromSheet: unexpected fetch error", err);
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
    log.debug("importFromSheet returning", { errorCode: result.error.code });
    return result;
  }

  if (csvWarning) {
    const merged = {
      ...result,
      warning: result.warning
        ? `${result.warning} ${csvWarning}`
        : csvWarning,
    };
    log.debug("importFromSheet returning", { cardCount: merged.cards.length, hasWarning: true });
    return merged;
  }

  log.debug("importFromSheet returning", { cardCount: result.cards.length, hasWarning: !!result.warning });
  return result;
}
