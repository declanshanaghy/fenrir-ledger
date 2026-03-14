import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage, Server } from "node:http";
import type { ServerType } from "@hono/node-server";
import { streamPodLogs, findPodForSession } from "./k8s.js";
import { verifySessionToken, SESSION_COOKIE } from "./auth.js";
import {
  parseJsonlLine,
  detectVerdict,
  generateReportHtml,
  type JsonEvent,
} from "./report.js";

/** Parse a single cookie header value into a map. */
function parseCookies(cookieHeader: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const val = decodeURIComponent(part.slice(eq + 1).trim());
    result[key] = val;
  }
  return result;
}

// ---------------------------------------------------------------------------
// WS message types
// ---------------------------------------------------------------------------

type WsMessage =
  | { type: "log"; line: string; ts: number }
  | { type: "error"; message: string }
  | { type: "end" }
  | { type: "connected"; sessionId: string }
  // Structured parsed events
  | { type: "turn_start"; turnNum: number; ts: number }
  | {
      type: "tool_call";
      turnNum: number;
      toolId: string;
      toolName: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      input: Record<string, any>;
      ts: number;
    }
  | {
      type: "tool_result";
      toolId: string;
      content: string;
      isError: boolean;
      ts: number;
    }
  | { type: "heckle"; style: "mayo" | "comeback" | "entrance"; name: string; text: string; ts: number }
  | { type: "verdict"; pass: boolean; summary: string; ts: number }
  | { type: "report"; html: string; ts: number };

function send(ws: WebSocket, msg: WsMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// ---------------------------------------------------------------------------
// JSONL event dispatcher
// ---------------------------------------------------------------------------

/** State machine that processes JSONL events and dispatches WS messages. */
class LogStreamDispatcher {
  private ws: WebSocket;
  private sessionId: string;
  private events: JsonEvent[] = [];
  private turnNum = 0;
  /** Pending tool_use blocks in the current assistant turn (id → toolName+input). */
  private pendingToolUses = new Map<string, { name: string; input: Record<string, unknown> }>();

  constructor(ws: WebSocket, sessionId: string) {
    this.ws = ws;
    this.sessionId = sessionId;
  }

  /** Process one raw log line. */
  processLine(rawLine: string): void {
    // Always forward the raw line for the plain-text terminal view
    send(this.ws, { type: "log", line: rawLine, ts: Date.now() });

    const ev = parseJsonlLine(rawLine);
    if (!ev) return;

    this.events.push(ev);

    if (ev.type === "assistant" && ev.message?.content) {
      this.handleAssistantEvent(ev);
    } else if (ev.type === "user" && ev.message?.content) {
      this.handleUserEvent(ev);
    }
  }

  private handleAssistantEvent(ev: JsonEvent): void {
    this.turnNum++;
    send(this.ws, { type: "turn_start", turnNum: this.turnNum, ts: Date.now() });
    this.pendingToolUses.clear();

    for (const block of ev.message!.content ?? []) {
      if (block.type === "tool_use" && block.id && block.name) {
        this.pendingToolUses.set(block.id, {
          name: block.name,
          input: block.input ?? {},
        });
        send(this.ws, {
          type: "tool_call",
          turnNum: this.turnNum,
          toolId: block.id,
          toolName: block.name,
          input: block.input ?? {},
          ts: Date.now(),
        });
      }
    }
  }

  private handleUserEvent(ev: JsonEvent): void {
    for (const block of ev.message!.content ?? []) {
      if (block.type === "tool_result" && block.tool_use_id) {
        const raw = block.content;
        const content =
          typeof raw === "string"
            ? raw
            : Array.isArray(raw)
              ? (raw as Array<{ type: string; text?: string }>)
                  .filter((b) => b.type === "text")
                  .map((b) => b.text ?? "")
                  .join("")
              : "";

        send(this.ws, {
          type: "tool_result",
          toolId: block.tool_use_id,
          content: content.slice(0, 4000),
          isError: block.is_error ?? false,
          ts: Date.now(),
        });
      }
    }
  }

  /** Called when the pod log stream ends — emit verdict + report. */
  onStreamEnd(): void {
    const verdict = detectVerdict(this.events);
    if (verdict) {
      send(this.ws, {
        type: "verdict",
        pass: verdict.pass,
        summary: verdict.text.slice(0, 500),
        ts: Date.now(),
      });
    }

    if (this.events.length > 0) {
      const html = generateReportHtml(this.events, this.sessionId);
      send(this.ws, { type: "report", html, ts: Date.now() });
    }
  }
}

// ---------------------------------------------------------------------------
// WebSocket server
// ---------------------------------------------------------------------------

export function attachWebSocketServer(server: ServerType): WebSocketServer {
  const wss = new WebSocketServer({ server: server as Server, path: "/ws/logs" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    // Validate session cookie before allowing the WS connection
    const cookieHeader = req.headers.cookie ?? "";
    const cookies = parseCookies(cookieHeader);
    const sessionToken = cookies[SESSION_COOKIE];
    if (!sessionToken || !verifySessionToken(sessionToken)) {
      send(ws, { type: "error", message: "Unauthorized" });
      ws.close(1008, "Unauthorized");
      return;
    }

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

    const dispatcher = new LogStreamDispatcher(ws, sessionId);
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
          (line) => dispatcher.processLine(line),
          () => {
            dispatcher.onStreamEnd();
            send(ws, { type: "end" });
          },
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
