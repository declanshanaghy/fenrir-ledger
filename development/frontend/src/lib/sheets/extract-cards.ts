/**
 * Shared card extraction logic.
 *
 * Takes raw CSV text, builds the extraction prompt, calls the LLM,
 * validates the response, and assigns UUIDs. Used by both the
 * Google Sheets pipeline and the direct CSV upload pipeline.
 */

import { buildExtractionPrompt } from "./prompt";
import { CardsArraySchema, ImportResponseSchema } from "./card-schema";
import { getLlmProvider } from "@/lib/llm/extract";
import type { SheetImportResponse } from "./types";

/**
 * Extract card data from raw CSV text via LLM.
 *
 * @param csv - Raw CSV text (already truncated if needed)
 * @returns SheetImportResponse with cards array or error
 */
export async function extractCardsFromCsv(csv: string): Promise<SheetImportResponse> {
  // 1. Build structured prompt (system/user separated) and call LLM
  const prompt = buildExtractionPrompt(csv);
  let rawText: string;
  try {
    const provider = getLlmProvider();
    rawText = await provider.extractText(prompt);
  } catch {
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
  } else {
    // Fall back to plain array format (backwards compatibility)
    const arrayValidation = CardsArraySchema.safeParse(parsed);
    if (!arrayValidation.success) {
      return {
        error: {
          code: "PARSE_ERROR",
          message: "The AI returned data that doesn't match the expected card format.",
        },
      };
    }
    extractedCards = arrayValidation.data;
  }

  if (extractedCards.length === 0) {
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

  return result;
}
