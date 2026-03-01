/**
 * HTTP POST /import endpoint.
 *
 * Provides the same import pipeline as the WebSocket handler, but as a
 * standard HTTP request-response for non-WebSocket clients. The Next.js
 * frontend proxies to this endpoint when WebSocket is not available.
 *
 * Returns { cards: [...] } on success or { error: { code, message } } on failure.
 */

import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { extractSheetId, buildCsvExportUrl } from "../lib/sheets/parse-url.js";
import { buildExtractionPrompt } from "../lib/sheets/prompt.js";
import { fetchCsv, FetchCsvError } from "../lib/sheets/fetch-csv.js";
import { extractCardsFromCsv } from "../lib/anthropic/extract.js";
import { config, assertConfig } from "../config.js";
import { CardsArraySchema } from "../ws/handlers/import.js";
import type { ImportErrorCode } from "../types/messages.js";

const importRoute = new Hono();

/**
 * Helper to return a structured error response.
 */
function errorJson(
  c: Context,
  code: ImportErrorCode,
  message: string,
  status: ContentfulStatusCode = 400,
): Response {
  return c.json({ error: { code, message } }, status);
}

importRoute.post("/import", async (c) => {
  // 1. Parse + validate body
  let url: string;
  try {
    const body = (await c.req.json()) as { url?: string };
    url = body?.url ?? "";
    if (!url || typeof url !== "string") {
      return errorJson(c, "INVALID_URL", "Request body must include a 'url' string.");
    }
  } catch {
    return errorJson(c, "INVALID_URL", "Invalid JSON body.");
  }

  // 2. Validate config
  try {
    assertConfig();
  } catch {
    return errorJson(c, "ANTHROPIC_ERROR", "Server configuration error: missing API key.", 500);
  }

  // 3. Extract sheet ID
  const sheetId = extractSheetId(url);
  if (!sheetId) {
    return errorJson(c, "INVALID_URL", "URL does not appear to be a Google Sheets link.");
  }

  // 4. Fetch CSV
  let csv: string;
  let warning: string | undefined;
  try {
    const csvUrl = buildCsvExportUrl(sheetId);
    const result = await fetchCsv(csvUrl);
    csv = result.csv;
    warning = result.warning;
  } catch (err) {
    if (err instanceof FetchCsvError) {
      return errorJson(c, err.code as ImportErrorCode, err.message);
    }
    return errorJson(
      c,
      "FETCH_ERROR",
      `Failed to fetch spreadsheet: ${err instanceof Error ? err.message : "Unknown error"}`,
    );
  }

  // 5. Call Anthropic
  let responseText: string;
  try {
    const prompt = buildExtractionPrompt(csv);
    responseText = await extractCardsFromCsv(config.anthropicApiKey, prompt);
  } catch (err) {
    return errorJson(
      c,
      "ANTHROPIC_ERROR",
      `AI extraction failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      500,
    );
  }

  // 6. Parse and validate response
  try {
    let jsonStr = responseText.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(jsonStr) as unknown;
    const validated = CardsArraySchema.parse(parsed);

    if (validated.length === 0) {
      return errorJson(c, "NO_CARDS_FOUND", "No credit card data could be extracted from the spreadsheet.");
    }

    // 7. Assign IDs and timestamps
    const now = new Date().toISOString();
    const cards = validated.map((card) => ({
      ...card,
      id: crypto.randomUUID(),
      status: "active" as const,
      createdAt: now,
      updatedAt: now,
    }));

    const result: { cards: typeof cards; warning?: string } = { cards };
    if (warning) result.warning = warning;

    return c.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorJson(
        c,
        "PARSE_ERROR",
        `Extracted data validation failed: ${err.errors.map((e) => e.message).join(", ")}`,
      );
    }
    return errorJson(c, "PARSE_ERROR", "Failed to parse AI response as valid card data.");
  }
});

export default importRoute;
