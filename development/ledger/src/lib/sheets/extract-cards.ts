/**
 * Shared card extraction logic.
 *
 * Takes raw CSV/TSV text or binary spreadsheet content, builds the extraction
 * prompt, calls the LLM, validates the response, and assigns UUIDs.
 * Used by the Google Sheets pipeline, CSV upload pipeline, and file upload pipeline.
 */

import { buildExtractionPrompt, sanitizeCsvForPrompt } from "./prompt";
import { CardsArraySchema, ImportResponseSchema } from "./card-schema";
import { getLlmProvider } from "@/lib/llm/extract";
import type { SheetImportResponse } from "./types";
import type { FileFormat } from "@/components/sheets/CsvUpload";
import { log } from "@/lib/logger";

/**
 * Extract card data from raw CSV text via LLM.
 *
 * @param csv - Raw CSV text (already truncated if needed)
 * @returns SheetImportResponse with cards array or error
 */
export async function extractCardsFromCsv(csv: string): Promise<SheetImportResponse> {
  log.debug("extractCardsFromCsv called", { csvLength: csv.length });

  // 1. Sanitize CSV to strip injection patterns, then build structured prompt
  const sanitizedCsv = sanitizeCsvForPrompt(csv);
  log.debug("extractCardsFromCsv sanitized CSV", { originalLength: csv.length, sanitizedLength: sanitizedCsv.length });
  const prompt = buildExtractionPrompt(sanitizedCsv);
  let rawText: string;
  try {
    const provider = getLlmProvider();
    log.debug("extractCardsFromCsv calling LLM", { provider: provider.name, model: provider.model });
    rawText = await provider.extractText(prompt);
    log.debug("extractCardsFromCsv LLM response received", { rawTextLength: rawText.length });
  } catch {
    log.debug("extractCardsFromCsv returning", { errorCode: "ANTHROPIC_ERROR" });
    return {
      error: {
        code: "ANTHROPIC_ERROR",
        message: "The AI extraction service encountered an error. Please try again.",
      },
    };
  }

  // 2. Parse and validate JSON
  let parsed: unknown;
  try {
    // Strip markdown code fences if the LLM wrapped the response
    const cleaned = rawText.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    log.debug("extractCardsFromCsv returning", { errorCode: "PARSE_ERROR", reason: "invalid JSON" });
    return {
      error: {
        code: "PARSE_ERROR",
        message: "The AI returned invalid JSON. Please try again.",
      },
    };
  }

  // 3. Try the new wrapped format first, then fall back to plain array
  let extractedCards: ReturnType<typeof CardsArraySchema.parse>;
  let sensitiveDataWarning = false;

  const wrappedValidation = ImportResponseSchema.safeParse(parsed);
  if (wrappedValidation.success) {
    extractedCards = wrappedValidation.data.cards;
    sensitiveDataWarning = wrappedValidation.data.sensitiveDataWarning;
    log.debug("extractCardsFromCsv parsed wrapped format", { cardCount: extractedCards.length, sensitiveDataWarning });
  } else {
    // Fall back to plain array format (backwards compatibility)
    const arrayValidation = CardsArraySchema.safeParse(parsed);
    if (!arrayValidation.success) {
      log.debug("extractCardsFromCsv returning", { errorCode: "PARSE_ERROR", reason: "schema mismatch" });
      return {
        error: {
          code: "PARSE_ERROR",
          message: "The AI returned data that doesn't match the expected card format.",
        },
      };
    }
    extractedCards = arrayValidation.data;
    log.debug("extractCardsFromCsv parsed array format", { cardCount: extractedCards.length });
  }

  if (extractedCards.length === 0) {
    log.debug("extractCardsFromCsv returning", { errorCode: "NO_CARDS_FOUND" });
    return {
      error: {
        code: "NO_CARDS_FOUND",
        message: "No credit cards could be extracted from the data.",
      },
    };
  }

  // 4. Assign UUIDs and timestamps; auto-close cards with closedAt
  const now = new Date().toISOString();
  const cards = extractedCards.map((card) => {
    const hasClosed = card.closedAt !== undefined && card.closedAt !== "";
    const base = {
      ...card,
      id: crypto.randomUUID(),
      status: hasClosed ? ("closed" as const) : ("active" as const),
      createdAt: now,
      updatedAt: now,
    };
    // Only set closedAt when present to satisfy exactOptionalPropertyTypes
    if (hasClosed) {
      return { ...base, closedAt: card.closedAt };
    }
    // Remove the empty-string closedAt from the spread so it stays undefined
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { closedAt: _removed, ...rest } = base;
    return rest;
  });

  const result: SheetImportResponse = { cards };
  if (sensitiveDataWarning) {
    (result as { cards: typeof cards; sensitiveDataWarning?: boolean }).sensitiveDataWarning = true;
  }

  log.debug("extractCardsFromCsv returning", { cardCount: cards.length, sensitiveDataWarning });
  return result;
}

/**
 * Sanitize CSV text to prevent prototype pollution and ReDoS attacks.
 *
 * Strips potentially malicious patterns that could be exploited by downstream
 * JSON parsing or object construction (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9).
 *
 * @param csv - Raw CSV text from SheetJS
 * @returns Sanitized CSV text
 */
function sanitizeSheetsCsvForSecurity(csv: string): string {
  let sanitized = csv;

  // Remove __proto__, constructor, prototype patterns that could pollute Object.prototype
  // These patterns are rarely legitimate in financial data
  sanitized = sanitized.replace(/__proto__/gi, "_proto_");
  sanitized = sanitized.replace(/constructor\s*:/gi, "constructor_");
  sanitized = sanitized.replace(/prototype\s*:/gi, "prototype_");

  // Limit repetition to prevent ReDoS on regex backtracking (e.g., (x+x+)+y)
  // Replace sequences of 50+ identical characters with a truncated version
  // This is safe for credit card data (longest legitimate value is ~50 chars)
  sanitized = sanitized.replace(/(.)\1{49,}/g, (match) => match.substring(0, 50));

  log.debug("sanitizeSheetsCsvForSecurity", { originalLength: csv.length, sanitizedLength: sanitized.length });
  return sanitized;
}

/**
 * Extract card data from an XLSX file via ExcelJS + LLM.
 *
 * Converts all visible sheets to CSV (merged with newlines), then
 * passes the combined text through the standard CSV extraction pipeline.
 *
 * Note: Legacy .xls (BIFF binary) format is not supported. Users should
 * re-save their file as .xlsx before uploading.
 *
 * @param base64 - Raw base64-encoded file content (no data URL prefix)
 * @param mimeType - MIME type of the file (unused, format drives parsing)
 * @param filename - Original filename (for logging)
 * @param format - File format: "xls" or "xlsx"
 */
export async function extractCardsFromFile(
  base64: string,
  mimeType: string,
  filename: string,
  format: FileFormat
): Promise<SheetImportResponse> {
  log.debug("extractCardsFromFile called", { filename, format, mimeType, base64Length: base64.length });

  // Legacy .xls (BIFF binary format) is not supported by exceljs.
  // Guide users to re-save their file as .xlsx before uploading.
  if (format === "xls") {
    log.debug("extractCardsFromFile returning", { errorCode: "INVALID_CSV", reason: "xls not supported" });
    return {
      error: {
        code: "INVALID_CSV",
        message:
          "Legacy .xls files are not supported. Please save your spreadsheet as .xlsx (Excel Workbook) and try again.",
      },
    };
  }

  let csvText: string;
  try {
    // Dynamically import ExcelJS to avoid bundling on client (CVE fix: replaces xlsx 0.18.5)
    const { Workbook } = await import("exceljs");

    // Decode base64 to binary buffer and load workbook.
    // Cast via unknown: ExcelJS declares its own Buffer interface (extends ArrayBuffer)
    // which TypeScript treats as distinct from Node.js Buffer, but ExcelJS accepts both at runtime.
    const binary = Buffer.from(base64, "base64");
    const workbook = new Workbook();
    await workbook.xlsx.load(binary as unknown as ArrayBuffer);

    // Convert all visible sheets to CSV and concatenate
    const sheetCsvParts: string[] = [];
    for (const worksheet of workbook.worksheets) {
      // Skip hidden sheets
      if (worksheet.state === "hidden" || worksheet.state === "veryHidden") continue;

      const sheetCsv = worksheetToCsv(worksheet);
      if (sheetCsv.trim().length > 0) {
        sheetCsvParts.push(`# Sheet: ${worksheet.name}\n${sheetCsv}`);
      }
    }

    if (sheetCsvParts.length === 0) {
      log.debug("extractCardsFromFile returning", { errorCode: "INVALID_CSV", reason: "no visible sheets with data" });
      return {
        error: {
          code: "INVALID_CSV",
          message: "The spreadsheet appears to be empty or has no visible sheets with data.",
        },
      };
    }

    csvText = sheetCsvParts.join("\n\n");

    // Sanitize CSV to prevent prototype pollution and ReDoS (GHSA-4r6h, GHSA-5pgg)
    csvText = sanitizeSheetsCsvForSecurity(csvText);

    log.debug("extractCardsFromFile converted to CSV", { csvLength: csvText.length, sheetCount: sheetCsvParts.length });
  } catch (err) {
    log.error("extractCardsFromFile: ExcelJS parsing failed", err);
    return {
      error: {
        code: "INVALID_CSV",
        message: `Could not parse the ${format.toUpperCase()} file. Ensure it is a valid Excel spreadsheet.`,
      },
    };
  }

  // Delegate to the standard CSV extraction pipeline
  return extractCardsFromCsv(csvText);
}

/**
 * Convert an ExcelJS Worksheet to a CSV string.
 *
 * Handles all ExcelJS cell value types:
 * - Primitives (null, string, number, boolean) → direct conversion
 * - Date → ISO string
 * - Formula / shared formula → resolved result value
 * - Rich text → concatenated plain text
 * - Hyperlink → display text
 * - Error → empty string
 */
function worksheetToCsv(worksheet: import("exceljs").Worksheet): string {
  const rows: string[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      cells.push(cellValueToString(cell.value));
    });
    rows.push(cells.join(","));
  });
  return rows.join("\n");
}

/**
 * Convert a single ExcelJS CellValue to a CSV-safe string.
 */
function cellValueToString(value: import("exceljs").CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return quoteCsvField(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    // Formula or shared formula — use the resolved result
    if ("formula" in value || "sharedFormula" in value) {
      const formulaValue = value as import("exceljs").CellFormulaValue | import("exceljs").CellSharedFormulaValue;
      return formulaValue.result !== undefined ? cellValueToString(formulaValue.result) : "";
    }
    // Rich text — join all text runs
    if ("richText" in value) {
      const text = value.richText.map((r) => r.text).join("");
      return quoteCsvField(text);
    }
    // Hyperlink — use display text
    if ("text" in value) {
      return quoteCsvField(String((value as import("exceljs").CellHyperlinkValue).text));
    }
    // Error value — leave empty
    if ("error" in value) return "";
  }
  return "";
}

/**
 * Quote a CSV field if it contains a comma, newline, or double-quote.
 */
function quoteCsvField(value: string): string {
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
