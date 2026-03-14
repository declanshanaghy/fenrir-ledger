import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage, Server } from "node:http";
import type { ServerType } from "@hono/node-server";
import { streamPodLogs, findPodForSession } from "./k8s.js";

type WsMessage =
  | { type: "log"; line: string; ts: number }
  | { type: "error"; message: string }
  | { type: "end" }
  | { type: "connected"; sessionId: string };

function send(ws: WebSocket, msg: WsMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function attachWebSocketServer(server: ServerType): WebSocketServer {
  const wss = new WebSocketServer({ server: server as Server, path: "/ws/logs" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    // Extract sessionId from URL: /ws/logs/:sessionId
    const url = req.url ?? "";
    const match = /^\/ws\/logs\/([^/?#]+)/.exec(url);
    const sessionId = match?.[1];

    if (!sessionId) {
      send(ws, { type: "error", message: "Missing sessionId in URL" });
      ws.close(1008, "Missing sessionId");
      return;
    }

    send(ws, { type: "connected", sessionId });

    let cancelStream: (() => void) | null = null;

    const startStream = async (): Promise<void> => {
      try {
        const podName = await findPodForSession(sessionId);
        if (!podName) {
          send(ws, {
            type: "error",
            message: `No pod found for session ${sessionId}`,
          });
          ws.close(1011, "Pod not found");
          return;
        }

        cancelStream = await streamPodLogs(
          podName,
          undefined,
          (line) => send(ws, { type: "log", line, ts: Date.now() }),
          () => send(ws, { type: "end" }),
          (err) => send(ws, { type: "error", message: err.message })
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error starting stream";
        send(ws, { type: "error", message });
      }
    };

    ws.on("close", () => {
      cancelStream?.();
    });

    ws.on("error", () => {
      cancelStream?.();
    });

    void startStream();
  });

  return wss;
}
