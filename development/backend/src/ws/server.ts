/**
 * WebSocket server setup and connection lifecycle.
 *
 * Attaches a ws.WebSocketServer to an existing Node.js HTTP server
 * (the one returned by @hono/node-server's serve() function).
 * Routes incoming messages to the appropriate handler based on message type.
 */

import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import type { Server } from "node:http";
import { handleImportMessage } from "./handlers/import.js";
import type { ClientMessage } from "../types/messages.js";

/**
 * Attach a WebSocketServer to an existing Node.js HTTP server.
 *
 * The Hono Node adapter's serve() returns the underlying http.Server;
 * we wire the WebSocket upgrade handler to that same server so both
 * HTTP and WebSocket traffic share the same port.
 *
 * @param httpServer - The Node.js http.Server returned by @hono/node-server serve()
 */
export function attachWebSocketServer(httpServer: Server): void {
  const wss = new WebSocketServer({ server: httpServer });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
    console.log("[ws] Client connected");

    ws.on("message", (data) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(data.toString()) as ClientMessage;
      } catch {
        ws.send(
          JSON.stringify({
            type: "import_error",
            code: "INVALID_URL",
            message: "Invalid JSON message.",
          }),
        );
        return;
      }

      handleImportMessage(ws, msg);
    });

    ws.on("close", () => {
      console.log("[ws] Client disconnected");
    });

    ws.on("error", (err) => {
      console.error("[ws] Error:", err.message);
    });
  });

  console.log("[fenrir-backend] WebSocket server attached");
}
