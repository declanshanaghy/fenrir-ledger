/**
 * Fenrir Ledger Backend — Entry Point
 *
 * Hono HTTP server with WebSocket support for real-time import progress.
 * This file is the entry point expected by .claude/scripts/backend-server.sh.
 *
 * Architecture:
 *   - HTTP routes: /health (liveness), /import (non-WS import)
 *   - WebSocket: attached to the same HTTP server for duplex import streaming
 *
 * @see designs/architecture/adr-backend-server.md
 * @see designs/architecture/backend-implementation-plan.md
 */

import { serve } from "@hono/node-server";
import type { Server } from "node:http";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { config } from "./config.js";
import health from "./routes/health.js";
import importRoute from "./routes/import.js";
import { attachWebSocketServer } from "./ws/server.js";

const app = new Hono();

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

// Start server and attach WebSocket
// The @hono/node-server serve() returns a ServerType union that includes http.Server.
// We cast to http.Server since we are not using HTTP/2 (no createSecureServer option).
const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`[fenrir-backend] Listening on http://localhost:${info.port}`);
  console.log(`[fenrir-backend] Environment: ${config.nodeEnv}`);
}) as unknown as Server;

attachWebSocketServer(server);
