/**
 * Serverless import pipeline.
 *
 * Orchestrates: parse URL -> fetch CSV -> prompt -> LLM -> validate -> assign IDs -> return.
 * Called by the /api/sheets/import route handler.
 */

import { extractSheetId, buildCsvExportUrl } from "./parse-url";
import { buildExtractionPrompt } from "./prompt";
import { fetchCsv, FetchCsvError } from "./fetch-csv";
import { CardsArraySchema } from "./card-schema";
import { getLlmProvider } from "@/lib/llm/extract";
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

  // 3. Build prompt and call LLM
  const prompt = buildExtractionPrompt(csv);
  let rawText: string;
  try {
    const provider = getLlmProvider();
    rawText = provider.extractText
      ? await provider.extractText(prompt)
      : "";
  } catch {
    return {
      error: {
        code: "ANTHROPIC_ERROR",
        message: "The AI extraction service encountered an error. Please try again.",
      },
    };
  }

  // 4. Parse and validate JSON
  let parsed: unknown;
  try {
    // Strip markdown code fences if the LLM wrapped the response
    const cleaned = rawText.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      error: {
        code: "PARSE_ERROR",
        message: "The AI returned invalid JSON. Please try again.",
      },
    };
  }

  const validation = CardsArraySchema.safeParse(parsed);
  if (!validation.success) {
    return {
      error: {
        code: "PARSE_ERROR",
        message: "The AI returned data that doesn't match the expected card format.",
      },
    };
  }

  const extractedCards = validation.data;

  if (extractedCards.length === 0) {
    return {
      error: {
        code: "NO_CARDS_FOUND",
        message: "No credit cards could be extracted from the spreadsheet.",
      },
    };
  }

  // 5. Assign UUIDs and timestamps
  const now = new Date().toISOString();
  const cards = extractedCards.map((card) => ({
    ...card,
    id: crypto.randomUUID(),
    status: "active" as const,
    createdAt: now,
    updatedAt: now,
  }));

  return csvWarning
    ? { cards, warning: csvWarning }
    : { cards };
}
