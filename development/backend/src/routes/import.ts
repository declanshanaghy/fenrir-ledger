/**
 * HTTP POST /import endpoint.
 *
 * Provides the same import pipeline as the WebSocket handler, but as a
 * standard HTTP request-response for non-WebSocket clients. The Next.js
 * frontend proxies to this endpoint when WebSocket is not available.
 *
 * Returns { cards: [...] } on success or { error: { code, message } } on failure.
 */

import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { extractSheetId, buildCsvExportUrl } from "../lib/sheets/parse-url.js";
import { buildExtractionPrompt } from "../lib/sheets/prompt.js";
import { fetchCsv, FetchCsvError } from "../lib/sheets/fetch-csv.js";
import { extractCardsFromCsv } from "../lib/anthropic/extract.js";
import { config, assertConfig } from "../config.js";
import { CardsArraySchema, ImportedCardSchema } from "../schemas/index.js";
import { ErrorResponseSchema } from "../schemas/error.js";
import type { ImportErrorCode } from "../types/messages.js";

const importApp = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(", ");
      return c.json(
        { error: { code: "INVALID_URL" as const, message: messages } },
        400,
      );
    }
  },
});

/**
 * Request body schema for the import endpoint.
 */
const ImportRequestSchema = z.object({
  url: z.string().url().openapi({
    description: "Public Google Sheets URL to import credit card data from",
    example: "https://docs.google.com/spreadsheets/d/1abc.../edit",
  }),
});

/**
 * Success response schema — array of imported cards with optional warning.
 */
const ImportSuccessSchema = z.object({
  cards: z.array(ImportedCardSchema),
  warning: z.string().optional(),
});

const importRoute = createRoute({
  method: "post",
  path: "/import",
  tags: ["Import"],
  summary: "Import credit cards from a Google Sheet",
  description:
    "Fetches a public Google Sheets spreadsheet, extracts credit card data using AI, " +
    "validates the result, and returns an array of card objects. " +
    "This is the HTTP equivalent of the WebSocket import pipeline.\n\n" +
    "### Error codes\n" +
    "- `INVALID_URL` — The request body is missing, malformed, or not a Google Sheets URL\n" +
    "- `SHEET_NOT_PUBLIC` — The spreadsheet is not publicly accessible\n" +
    "- `FETCH_ERROR` — Failed to fetch the spreadsheet CSV export\n" +
    "- `ANTHROPIC_ERROR` — AI extraction failed or server misconfigured\n" +
    "- `PARSE_ERROR` — AI response could not be parsed as valid card data\n" +
    "- `NO_CARDS_FOUND` — Extraction succeeded but no card data was found",
  request: {
    body: {
      content: {
        "application/json": {
          schema: ImportRequestSchema,
        },
      },
      required: true,
      description: "JSON object containing the Google Sheets URL to import",
    },
  },
  responses: {
    200: {
      description: "Import successful — returns extracted card data",
      content: {
        "application/json": {
          schema: ImportSuccessSchema,
        },
      },
    },
    400: {
      description: "Client error — invalid URL, sheet not public, fetch failed, parse error, or no cards found",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Server error — missing API key or AI extraction failure",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

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

importApp.openapi(importRoute, async (c) => {
  // 1. Parse + validate body
  // The OpenAPI middleware validates the schema, but we still need manual extraction
  // because the route handler receives the validated body through c.req.valid().
  let url: string;
  try {
    const body = c.req.valid("json");
    url = body.url;
  } catch {
    // Fallback for edge cases where validation middleware did not run
    try {
      const body = (await c.req.json()) as { url?: string };
      url = body?.url ?? "";
      if (!url || typeof url !== "string") {
        return errorJson(c, "INVALID_URL", "Request body must include a 'url' string.") as never;
      }
    } catch {
      return errorJson(c, "INVALID_URL", "Invalid JSON body.") as never;
    }
  }

  // 2. Validate config
  try {
    assertConfig();
  } catch {
    return errorJson(c, "ANTHROPIC_ERROR", "Server configuration error: missing API key.", 500) as never;
  }

  // 3. Extract sheet ID
  const sheetId = extractSheetId(url);
  if (!sheetId) {
    return errorJson(c, "INVALID_URL", "URL does not appear to be a Google Sheets link.") as never;
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
      return errorJson(c, err.code as ImportErrorCode, err.message) as never;
    }
    return errorJson(
      c,
      "FETCH_ERROR",
      `Failed to fetch spreadsheet: ${err instanceof Error ? err.message : "Unknown error"}`,
    ) as never;
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
    ) as never;
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
      return errorJson(c, "NO_CARDS_FOUND", "No credit card data could be extracted from the spreadsheet.") as never;
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

    return c.json(result, 200);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorJson(
        c,
        "PARSE_ERROR",
        `Extracted data validation failed: ${err.errors.map((e) => e.message).join(", ")}`,
      ) as never;
    }
    return errorJson(c, "PARSE_ERROR", "Failed to parse AI response as valid card data.") as never;
  }
});

export default importApp;
