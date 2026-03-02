/**
 * WebSocket import handler.
 *
 * Orchestrates the full import pipeline over a WebSocket connection:
 * 1. Validate URL and extract sheet ID
 * 2. Fetch CSV from Google Sheets
 * 3. Call Anthropic Claude Haiku for extraction
 * 4. Validate extracted data with Zod
 * 5. Assign IDs and timestamps
 *
 * Emits import_phase events at each stage so the client can show progress.
 * Supports cancellation via import_cancel messages.
 */

import { WebSocket } from "ws";
import { z } from "zod";
import type { ClientMessage, ServerMessage, ImportErrorCode } from "../../types/messages.js";
import { extractSheetId, buildCsvExportUrl } from "../../lib/sheets/parse-url.js";
import { buildExtractionPrompt } from "../../lib/sheets/prompt.js";
import { fetchCsv, FetchCsvError } from "../../lib/sheets/fetch-csv.js";
import { getLlmProvider } from "../../lib/llm/index.js";
import { config, assertConfig } from "../../config.js";
import { CardSchema, CardsArraySchema } from "../../schemas/index.js";

/** Re-export for backward compatibility with existing consumers. */
export { CardSchema, CardsArraySchema };

/**
 * Per-connection cancellation state.
 * Maps WebSocket instances to a mutable cancelled flag.
 */
const cancellationFlags = new WeakMap<WebSocket, { cancelled: boolean }>();

/**
 * Send a typed ServerMessage over the WebSocket.
 *
 * @param ws - The WebSocket connection
 * @param msg - The server message to send
 */
function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

/**
 * Handle an incoming client message on the WebSocket.
 *
 * Routes to the appropriate action based on message type:
 * - import_start: begins the import pipeline
 * - import_cancel: sets the cancellation flag for in-progress imports
 *
 * @param ws - The WebSocket connection
 * @param msg - The parsed client message
 */
export function handleImportMessage(ws: WebSocket, msg: ClientMessage): void {
  console.info(`[fenrir-backend] WS message received: type=${msg.type}`);
  switch (msg.type) {
    case "import_start":
      console.info(`[fenrir-backend] Import pipeline starting for URL: ${msg.payload.url.substring(0, 60)}...`);
      void runImportPipeline(ws, msg.payload.url);
      break;
    case "import_cancel": {
      const flag = cancellationFlags.get(ws);
      if (flag) {
        flag.cancelled = true;
        console.info("[fenrir-backend] Import cancelled by client");
      }
      break;
    }
    default:
      console.error(`[fenrir-backend] Unknown WS message type:`, { type: (msg as { type: string }).type });
      send(ws, {
        type: "import_error",
        code: "INVALID_URL",
        message: `Unknown message type: ${(msg as { type: string }).type}`,
      });
  }
}

/**
 * Run the full import pipeline, emitting progress events over WebSocket.
 *
 * Checks the cancellation flag before each async step. If cancelled,
 * exits cleanly without sending further events.
 *
 * @param ws - The WebSocket connection
 * @param url - The Google Sheets URL to import from
 */
async function runImportPipeline(ws: WebSocket, url: string): Promise<void> {
  // Set up cancellation tracking for this connection
  const cancelFlag = { cancelled: false };
  cancellationFlags.set(ws, cancelFlag);

  try {
    const pipelineStart = Date.now();
    // Step 0: Validate config (ANTHROPIC_API_KEY required)
    try {
      assertConfig();
      console.info("[fenrir-backend] Config validated: API key present");
    } catch {
      console.error(`[fenrir-backend] Config validation failed: API key missing for provider=${config.llmProvider}`);
      send(ws, {
        type: "import_error",
        code: "ANTHROPIC_ERROR",
        message: "Server configuration error: missing API key.",
      });
      return;
    }

    // Step 1: Validate URL
    const sheetId = extractSheetId(url);
    if (!sheetId) {
      send(ws, {
        type: "import_error",
        code: "INVALID_URL",
        message: "URL does not appear to be a Google Sheets link.",
      });
      return;
    }

    if (cancelFlag.cancelled) return;

    // Step 2: Fetch CSV
    send(ws, { type: "import_phase", phase: "fetching_sheet" });

    let csv: string;
    try {
      const csvUrl = buildCsvExportUrl(sheetId);
      const result = await fetchCsv(csvUrl);
      csv = result.csv;
    } catch (err) {
      if (err instanceof FetchCsvError) {
        send(ws, {
          type: "import_error",
          code: err.code as ImportErrorCode,
          message: err.message,
        });
      } else {
        send(ws, {
          type: "import_error",
          code: "FETCH_ERROR",
          message: `Failed to fetch spreadsheet: ${err instanceof Error ? err.message : "Unknown error"}`,
        });
      }
      return;
    }

    if (cancelFlag.cancelled) return;

    // Step 3: Call LLM for extraction
    send(ws, { type: "import_phase", phase: "extracting" });

    let responseText: string;
    try {
      const prompt = buildExtractionPrompt(csv);
      responseText = await getLlmProvider().extractText(prompt);
    } catch (err) {
      send(ws, {
        type: "import_error",
        code: "ANTHROPIC_ERROR",
        message: `AI extraction failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
      return;
    }

    if (cancelFlag.cancelled) return;

    // Step 4: Validate with Zod
    send(ws, { type: "import_phase", phase: "validating" });

    try {
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = responseText.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr
          .replace(/^```(?:json)?\n?/, "")
          .replace(/\n?```$/, "");
      }

      const parsed = JSON.parse(jsonStr) as unknown;
      const validated = CardsArraySchema.parse(parsed);

      if (validated.length === 0) {
        send(ws, {
          type: "import_error",
          code: "NO_CARDS_FOUND",
          message: "No credit card data could be extracted from the spreadsheet.",
        });
        return;
      }

      // Step 5: Assign IDs and timestamps
      const now = new Date().toISOString();
      const cards = validated.map((card) => ({
        ...card,
        id: crypto.randomUUID(),
        status: "active" as const,
        createdAt: now,
        updatedAt: now,
      }));

      const totalElapsed = Date.now() - pipelineStart;
      console.info(`[fenrir-backend] Import pipeline complete: ${cards.length} cards extracted in ${totalElapsed}ms`);
      send(ws, { type: "import_phase", phase: "done" });
      send(ws, { type: "import_complete", cards });
    } catch (err) {
      if (err instanceof z.ZodError) {
        send(ws, {
          type: "import_error",
          code: "PARSE_ERROR",
          message: `Extracted data validation failed: ${err.errors.map((e) => e.message).join(", ")}`,
        });
      } else {
        send(ws, {
          type: "import_error",
          code: "PARSE_ERROR",
          message: "Failed to parse AI response as valid card data.",
        });
      }
    }
  } finally {
    // Clean up cancellation state
    cancellationFlags.delete(ws);
  }
}
