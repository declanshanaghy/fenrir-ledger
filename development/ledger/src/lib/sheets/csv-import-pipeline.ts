/**
 * CSV import pipeline.
 *
 * Orchestrates: validate CSV -> prompt -> LLM -> validate -> assign IDs -> return.
 * Called by the /api/sheets/import route handler for direct CSV uploads.
 */

import { extractCardsFromCsv } from "./extract-cards";
import { CSV_TRUNCATION_LIMIT } from "./prompt";
import { sanitizeCsvUnicode } from "./unicode-sanitize";
import type { SheetImportResponse } from "./types";
import { log } from "@/lib/logger";

/** Minimum CSV length to be considered valid (header + at least one row). */
const MIN_CSV_LENGTH = 10;

/**
 * Run the CSV import pipeline: validate -> LLM -> validated cards.
 *
 * @param csv - Raw CSV text uploaded by the user
 * @returns SheetImportResponse with cards array or error
 */
export async function importFromCsv(csv: string): Promise<SheetImportResponse> {
  log.debug("importFromCsv called", { csvLength: csv.length });

  // 0. Sanitize Unicode — strip control/invisible chars and NFC-normalize (MEDIUM-003, #1892)
  const sanitized = typeof csv === "string" ? sanitizeCsvUnicode(csv) : csv;

  // 1. Validate CSV content
  if (!sanitized || typeof sanitized !== "string" || sanitized.trim().length < MIN_CSV_LENGTH) {
    log.debug("importFromCsv returning", { errorCode: "INVALID_CSV", reason: "empty or too short" });
    return {
      error: {
        code: "INVALID_CSV",
        message: "The uploaded CSV is empty or too short to contain card data.",
      },
    };
  }

  // 2. Truncate if too long
  const truncated = sanitized.length > CSV_TRUNCATION_LIMIT
    ? sanitized.slice(0, CSV_TRUNCATION_LIMIT)
    : sanitized;

  const truncationWarning = sanitized.length > CSV_TRUNCATION_LIMIT
    ? `CSV was truncated from ${sanitized.length.toLocaleString()} to ${CSV_TRUNCATION_LIMIT.toLocaleString()} characters. Some rows may have been dropped.`
    : undefined;

  if (truncationWarning) {
    log.info("importFromCsv: CSV truncated", { originalLength: sanitized.length, truncatedLength: CSV_TRUNCATION_LIMIT });
  }

  // 3. Extract cards using shared LLM pipeline
  const result = await extractCardsFromCsv(truncated);

  // Merge truncation warning if present
  if ("error" in result) {
    log.debug("importFromCsv returning", { errorCode: result.error.code });
    return result;
  }

  if (truncationWarning) {
    const merged = {
      ...result,
      warning: result.warning
        ? `${result.warning} ${truncationWarning}`
        : truncationWarning,
    };
    log.debug("importFromCsv returning", { cardCount: merged.cards.length, hasWarning: true });
    return merged;
  }

  log.debug("importFromCsv returning", { cardCount: result.cards.length, hasWarning: !!result.warning });
  return result;
}
