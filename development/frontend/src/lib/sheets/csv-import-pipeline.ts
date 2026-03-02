/**
 * CSV import pipeline.
 *
 * Orchestrates: validate CSV -> prompt -> LLM -> validate -> assign IDs -> return.
 * Called by the /api/sheets/import route handler for direct CSV uploads.
 */

import { extractCardsFromCsv } from "./extract-cards";
import { CSV_TRUNCATION_LIMIT } from "./prompt";
import type { SheetImportResponse } from "./types";

/** Minimum CSV length to be considered valid (header + at least one row). */
const MIN_CSV_LENGTH = 10;

/**
 * Run the CSV import pipeline: validate -> LLM -> validated cards.
 *
 * @param csv - Raw CSV text uploaded by the user
 * @returns SheetImportResponse with cards array or error
 */
export async function importFromCsv(csv: string): Promise<SheetImportResponse> {
  // 1. Validate CSV content
  if (!csv || typeof csv !== "string" || csv.trim().length < MIN_CSV_LENGTH) {
    return {
      error: {
        code: "INVALID_CSV",
        message: "The uploaded CSV is empty or too short to contain card data.",
      },
    };
  }

  // 2. Truncate if too long
  const truncated = csv.length > CSV_TRUNCATION_LIMIT
    ? csv.slice(0, CSV_TRUNCATION_LIMIT)
    : csv;

  const truncationWarning = csv.length > CSV_TRUNCATION_LIMIT
    ? `CSV was truncated from ${csv.length.toLocaleString()} to ${CSV_TRUNCATION_LIMIT.toLocaleString()} characters. Some rows may have been dropped.`
    : undefined;

  // 3. Extract cards using shared LLM pipeline
  const result = await extractCardsFromCsv(truncated);

  // Merge truncation warning if present
  if ("error" in result) {
    return result;
  }

  if (truncationWarning) {
    return {
      ...result,
      warning: result.warning
        ? `${result.warning} ${truncationWarning}`
        : truncationWarning,
    };
  }

  return result;
}
