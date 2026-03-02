/**
 * Fenrir Ledger Backend -- Entry Point
 *
 * Hono HTTP server with WebSocket support for real-time import progress.
 * This file is the entry point expected by .claude/scripts/backend-server.sh.
 *
 * Architecture:
 *   - HTTP routes: /health (liveness), /import (non-WS import)
 *   - WebSocket: attached to the same HTTP server for duplex import streaming
 *   - OpenAPI: /openapi.json (spec), /docs (Swagger UI)
 *
 * @see designs/architecture/adr-backend-server.md
 * @see designs/architecture/backend-implementation-plan.md
 */

import { serve } from "@hono/node-server";
import type { Server } from "node:http";
import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { config } from "./config.js";
import health from "./routes/health.js";
import importRoute from "./routes/import.js";
import { attachWebSocketServer } from "./ws/server.js";

const app = new OpenAPIHono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

// Routes
app.route("/", health);
app.route("/", importRoute);

// OpenAPI 3.1.0 specification endpoint
//
// The info object includes a custom `x-websocket-messages` extension for
// machine-readable WebSocket message documentation, alongside the human-readable
// prose in the description field.  Because @hono/zod-openapi types do not include
// arbitrary `x-` extensions, we spread the extension in via a type assertion.
const websocketExtension = {
  "x-websocket-messages": {
    endpoint: "ws://localhost:9753/",
    client_messages: {
      import_start: { type: "import_start", payload: { url: "string" } },
      import_cancel: { type: "import_cancel" },
    },
    server_messages: {
      import_phase: {
        type: "import_phase",
        phase: "fetching_sheet | extracting | validating | done",
      },
      import_progress: {
        type: "import_progress",
        rowsExtracted: "number",
        totalRows: "number",
      },
      import_complete: {
        type: "import_complete",
        cards: "ImportedCard[]",
      },
      import_error: {
        type: "import_error",
        code: "ImportErrorCode",
        message: "string",
      },
    },
  },
};

app.doc31("/openapi.json", {
  openapi: "3.1.0",
  info: {
    title: "Fenrir Ledger API",
    version: "1.0.0",
    description:
      "Backend API for the Fenrir Ledger credit card churn tracker.\n\n" +
      "## WebSocket API\n\n" +
      "In addition to the HTTP endpoints documented here, the server provides a " +
      "WebSocket interface on the same port for real-time import streaming.\n\n" +
      "### Connection\n" +
      "Connect to `ws://localhost:9753` (or the configured port).\n\n" +
      "### Client Messages\n" +
      "- **`import_start`** `{ type: \"import_start\", payload: { url: string } }` -- " +
      "Begin importing cards from the given Google Sheets URL.\n" +
      "- **`import_cancel`** `{ type: \"import_cancel\" }` -- " +
      "Cancel an in-progress import.\n\n" +
      "### Server Messages\n" +
      "- **`import_phase`** `{ type: \"import_phase\", phase: \"fetching_sheet\" | \"extracting\" | \"validating\" | \"done\" }` -- " +
      "Pipeline progress update.\n" +
      "- **`import_progress`** `{ type: \"import_progress\", rowsExtracted: number, totalRows: number }` -- " +
      "Row-level progress (when available).\n" +
      "- **`import_complete`** `{ type: \"import_complete\", cards: ImportedCard[] }` -- " +
      "Import finished successfully with extracted card data.\n" +
      "- **`import_error`** `{ type: \"import_error\", code: ImportErrorCode, message: string }` -- " +
      "Import failed. Error codes: INVALID_URL, SHEET_NOT_PUBLIC, FETCH_ERROR, ANTHROPIC_ERROR, PARSE_ERROR, NO_CARDS_FOUND.",
    ...websocketExtension,
  } as typeof websocketExtension & { title: string; version: string; description: string },
  servers: [
    {
      url: "http://localhost:9753",
      description: "Local development",
    },
  ],
});

// Swagger UI at /docs
app.get("/docs", swaggerUI({ url: "/openapi.json" }));

// Start server and attach WebSocket
// The @hono/node-server serve() returns a ServerType union that includes http.Server.
// We cast to http.Server since we are not using HTTP/2 (no createSecureServer option).
const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`[fenrir-backend] Listening on http://localhost:${info.port}`);
  console.log(`[fenrir-backend] Environment: ${config.nodeEnv}`);
  console.log(`[fenrir-backend] OpenAPI spec: http://localhost:${info.port}/openapi.json`);
  console.log(`[fenrir-backend] Swagger UI:   http://localhost:${info.port}/docs`);
}) as unknown as Server;

attachWebSocketServer(server);
