/**
 * Shared card extraction logic.
 *
 * Takes raw CSV text, builds the extraction prompt, calls the LLM,
 * validates the response, and assigns UUIDs. Used by both the
 * Google Sheets pipeline and the direct CSV upload pipeline.
 */

import { buildExtractionPrompt, sanitizeCsvForPrompt } from "./prompt";
import { CardsArraySchema, ImportResponseSchema } from "./card-schema";
import { getLlmProvider } from "@/lib/llm/extract";
import type { SheetImportResponse } from "./types";
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

  // 4. Assign UUIDs and timestamps
  const now = new Date().toISOString();
  const cards = extractedCards.map((card) => ({
    ...card,
    id: crypto.randomUUID(),
    status: "active" as const,
    createdAt: now,
    updatedAt: now,
  }));

  const result: SheetImportResponse = { cards };
  if (sensitiveDataWarning) {
    (result as { cards: typeof cards; sensitiveDataWarning?: boolean }).sensitiveDataWarning = true;
  }

  log.debug("extractCardsFromCsv returning", { cardCount: cards.length, sensitiveDataWarning });
  return result;
}
