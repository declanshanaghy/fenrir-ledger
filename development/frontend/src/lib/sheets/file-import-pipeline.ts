/**
 * Binary file import pipeline (XLS / XLSX).
 *
 * Receives a base64-encoded spreadsheet from the client,
 * sends it to the Anthropic API as a document content block,
 * and returns extracted card data via the shared LLM pipeline.
 *
 * No client-side dependencies are added — Claude reads the binary natively.
 */

import { extractCardsFromFile } from "./extract-cards";
import type { SheetImportResponse } from "./types";
import type { FileFormat } from "@/components/sheets/CsvUpload";
import { log } from "@/lib/logger";

/** Maximum base64 payload size: ~6.7 MB encoded (≈ 5 MB binary). */
const MAX_BASE64_LENGTH = 6_900_000;

/**
 * Run the binary file import pipeline: validate -> LLM (document block) -> validated cards.
 *
 * @param base64 - Base64-encoded file content (no data URL prefix)
 * @param filename - Original filename for MIME type detection
 * @param format - File format: "xls" or "xlsx"
 */
export async function importFromFile(
  base64: string,
  filename: string,
  format: FileFormat
): Promise<SheetImportResponse> {
  log.debug("importFromFile called", { filename, format, base64Length: base64.length });

  // 1. Validate base64 payload
  if (!base64 || base64.trim().length === 0) {
    log.debug("importFromFile returning", { errorCode: "INVALID_CSV", reason: "empty base64" });
    return {
      error: {
        code: "INVALID_CSV",
        message: "The uploaded file is empty.",
      },
    };
  }

  if (base64.length > MAX_BASE64_LENGTH) {
    log.debug("importFromFile returning", { errorCode: "INVALID_CSV", reason: "file too large", base64Length: base64.length });
    return {
      error: {
        code: "INVALID_CSV",
        message: "The uploaded file exceeds the 5 MB limit.",
      },
    };
  }

  // 2. Determine MIME type
  const mimeType = format === "xlsx"
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "application/vnd.ms-excel";

  // 3. Extract cards via LLM with document attachment
  const result = await extractCardsFromFile(base64, mimeType, filename, format);

  log.debug("importFromFile returning", {
    hasError: "error" in result,
    cardCount: "cards" in result ? result.cards.length : 0,
  });

  return result;
}
