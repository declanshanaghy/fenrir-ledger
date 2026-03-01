import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { extractSheetId, buildCsvExportUrl } from "@/lib/sheets/parse-url";
import { buildExtractionPrompt, CSV_TRUNCATION_LIMIT } from "@/lib/sheets/prompt";
import type { SheetImportError, SheetImportSuccess } from "@/lib/sheets/types";

export const maxDuration = 60;

const CardSchema = z.object({
  issuerId: z.string(),
  cardName: z.string(),
  openDate: z.string(),
  creditLimit: z.number().int().min(0),
  annualFee: z.number().int().min(0),
  annualFeeDate: z.string(),
  promoPeriodMonths: z.number().int().min(0),
  signUpBonus: z
    .object({
      type: z.enum(["points", "miles", "cashback"]),
      amount: z.number(),
      spendRequirement: z.number().int().min(0),
      deadline: z.string(),
      met: z.boolean(),
    })
    .nullable(),
  notes: z.string(),
});

const CardsArraySchema = z.array(CardSchema);

function errorResponse(
  code: SheetImportError["code"],
  message: string,
  status: number = 400,
): NextResponse {
  return NextResponse.json(
    { error: { code, message } satisfies SheetImportError },
    { status },
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Parse + validate body
  let url: string;
  try {
    const body = await request.json();
    url = body?.url;
    if (!url || typeof url !== "string") {
      return errorResponse(
        "INVALID_URL",
        "Request body must include a 'url' string.",
      );
    }
  } catch {
    return errorResponse("INVALID_URL", "Invalid JSON body.");
  }

  // 2. Extract sheet ID
  const sheetId = extractSheetId(url);
  if (!sheetId) {
    return errorResponse(
      "INVALID_URL",
      "URL does not appear to be a Google Sheets link.",
    );
  }

  // 3. Fetch CSV
  let csv: string;
  let warning: string | undefined;
  try {
    const csvUrl = buildCsvExportUrl(sheetId);
    const csvResponse = await fetch(csvUrl, { redirect: "follow" });

    if (csvResponse.status === 403 || csvResponse.status === 404) {
      return errorResponse(
        "SHEET_NOT_PUBLIC",
        "The spreadsheet is not publicly accessible. Make sure it's shared as 'Anyone with the link can view'.",
      );
    }

    if (!csvResponse.ok) {
      return errorResponse(
        "FETCH_ERROR",
        `Failed to fetch spreadsheet (HTTP ${csvResponse.status}).`,
      );
    }

    csv = await csvResponse.text();

    if (!csv.trim()) {
      return errorResponse(
        "NO_CARDS_FOUND",
        "The spreadsheet appears to be empty.",
      );
    }

    // Truncate if needed
    if (csv.length > CSV_TRUNCATION_LIMIT) {
      csv = csv.slice(0, CSV_TRUNCATION_LIMIT);
      warning = `CSV was truncated at ${CSV_TRUNCATION_LIMIT.toLocaleString()} characters. Some rows may be missing.`;
    }
  } catch (err) {
    return errorResponse(
      "FETCH_ERROR",
      `Failed to fetch spreadsheet: ${err instanceof Error ? err.message : "Unknown error"}`,
    );
  }

  // 4. Anthropic API call
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return errorResponse(
      "ANTHROPIC_ERROR",
      "Server configuration error: missing API key.",
      500,
    );
  }

  const client = new Anthropic({ apiKey });
  const prompt = buildExtractionPrompt(csv);

  let responseText: string = "";

  // Single retry on transient errors
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });

      const textBlock = message.content.find((b) => b.type === "text");
      responseText = textBlock?.text ?? "";
      break;
    } catch (err) {
      if (attempt === 1) {
        return errorResponse(
          "ANTHROPIC_ERROR",
          `AI extraction failed: ${err instanceof Error ? err.message : "Unknown error"}`,
          500,
        );
      }
      // First attempt failed — retry
    }
  }

  // 5. Parse and validate response
  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = responseText.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(jsonStr);
    const validated = CardsArraySchema.parse(parsed);

    if (validated.length === 0) {
      return errorResponse(
        "NO_CARDS_FOUND",
        "No credit card data could be extracted from the spreadsheet.",
      );
    }

    // 6. Assign fresh IDs and timestamps
    const now = new Date().toISOString();
    const cards = validated.map((card) => ({
      ...card,
      id: crypto.randomUUID(),
      status: "active" as const,
      createdAt: now,
      updatedAt: now,
    }));

    const result: SheetImportSuccess = { cards };
    if (warning) result.warning = warning;

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(
        "PARSE_ERROR",
        `Extracted data validation failed: ${err.errors.map((e) => e.message).join(", ")}`,
      );
    }
    return errorResponse(
      "PARSE_ERROR",
      "Failed to parse AI response as valid card data.",
    );
  }
}
