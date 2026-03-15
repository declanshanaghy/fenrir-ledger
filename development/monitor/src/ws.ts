import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage, Server } from "node:http";
import type { ServerType } from "@hono/node-server";
import {
  streamPodLogs,
  findPodForSession,
  listAgentJobs,
  watchAgentJobs,
  mapAgentJobToJob,
} from "./k8s.js";
import type { Job } from "./k8s.js";
import { verifySessionToken, SESSION_COOKIE } from "./auth.js";
import { parseJsonlLine, detectVerdict } from "./report.js";

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
// Wire protocol — Server → Client
// ---------------------------------------------------------------------------

type ServerMessage =
  | { type: "jobs-snapshot"; ts: number; jobs: Job[] }
  | { type: "jobs-updated"; ts: number; jobs: Job[] }
  | { type: "log-line"; ts: number; sessionId: string; line: string }
  | { type: "verdict"; ts: number; sessionId: string; result: "PASS" | "FAIL" }
  | {
      type: "stream-end";
      ts: number;
      sessionId: string;
      reason: "completed" | "failed" | "cancelled";
    }
  | { type: "stream-error"; ts: number; sessionId: string; message: string }
  | { type: "pong" }
  | { type: "error"; message: string };

// ---------------------------------------------------------------------------
// Wire protocol — Client → Server
// ---------------------------------------------------------------------------

type ClientMessage =
  | { type: "subscribe"; sessionId: string }
  | { type: "unsubscribe"; sessionId: string }
  | { type: "ping" };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcast(clients: Set<WebSocket>, msg: ServerMessage): void {
  const payload = JSON.stringify(msg);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  }
}

// ---------------------------------------------------------------------------
// Per-session log stream handler
// ---------------------------------------------------------------------------

/** Start streaming logs for sessionId to ws. Returns a cancel function. */
async function startLogStream(
  ws: WebSocket,
  sessionId: string,
  namespace: string
): Promise<() => void> {
  try {
    const podName = await findPodForSession(sessionId, namespace);
    if (!podName) {
      send(ws, {
        type: "stream-error",
        ts: Date.now(),
        sessionId,
        message: `Pod for session ${sessionId} has been cleaned up (job TTL expired). Logs are no longer available from the cluster.`,
      });
      send(ws, {
        type: "stream-end",
        ts: Date.now(),
        sessionId,
        reason: "completed",
      });
      return () => {};
    }

    // Track JSONL events for verdict detection
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events: any[] = [];

    const cancel = await streamPodLogs(
      podName,
      namespace,
      (line) => {
        send(ws, { type: "log-line", ts: Date.now(), sessionId, line });
        const ev = parseJsonlLine(line);
        if (ev) events.push(ev);
      },
      () => {
        const verdict = detectVerdict(events);
        if (verdict) {
          send(ws, {
            type: "verdict",
            ts: Date.now(),
            sessionId,
            result: verdict.pass ? "PASS" : "FAIL",
          });
        }
        send(ws, {
          type: "stream-end",
          ts: Date.now(),
          sessionId,
          reason: "completed",
        });
      },
      (err) => {
        send(ws, {
          type: "stream-error",
          ts: Date.now(),
          sessionId,
          message: err.message,
        });
      }
    );

    return cancel;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    send(ws, { type: "stream-error", ts: Date.now(), sessionId, message });
    return () => {};
  }
}

// ---------------------------------------------------------------------------
// WebSocket server — single multiplexed /ws endpoint
// ---------------------------------------------------------------------------

export function attachWebSocketServer(
  server: ServerType,
  namespace = "fenrir-app",
  labelSelector = "app=odin-agent"
): WebSocketServer {
  // Per-server-instance state — no module-level singletons
  const connectedClients = new Set<WebSocket>();
  let cachedJobs: Job[] = [];

  // Start K8s job watch, push updates to all connected clients
  watchAgentJobs(
    namespace,
    labelSelector,
    (jobs) => {
      cachedJobs = jobs;
      broadcast(connectedClients, {
        type: "jobs-updated",
        ts: Date.now(),
        jobs,
      });
    },
    (err) => {
      console.error("[ws] K8s watch error:", err.message);
      // watchAgentJobs auto-reconnects internally
    }
  );

  const wss = new WebSocketServer({ server: server as Server, path: "/ws" });

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    // Validate session cookie before allowing the WS connection
    const cookieHeader = req.headers.cookie ?? "";
    const cookies = parseCookies(cookieHeader);
    const sessionToken = cookies[SESSION_COOKIE];
    if (!sessionToken || !verifySessionToken(sessionToken)) {
      send(ws, { type: "error", message: "Unauthorized" });
      ws.close(1008, "Unauthorized");
      return;
    }

    // Register this client for jobs-updated broadcasts
    connectedClients.add(ws);

    // Seed cache from listAgentJobs if watch hasn't populated it yet
    let jobs = cachedJobs;
    if (jobs.length === 0) {
      try {
        const agentJobs = await listAgentJobs(namespace, labelSelector);
        jobs = agentJobs.map(mapAgentJobToJob);
        cachedJobs = jobs;
      } catch {
        // proceed with empty list
      }
    }
    send(ws, { type: "jobs-snapshot", ts: Date.now(), jobs });

    // Per-connection subscription state: sessionId → cancel()
    const subscriptions = new Map<string, () => void>();

    ws.on("message", (data) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(String(data)) as ClientMessage;
      } catch {
        send(ws, { type: "error", message: "Invalid JSON" });
        return;
      }

      if (msg.type === "ping") {
        send(ws, { type: "pong" });
      } else if (msg.type === "subscribe") {
        const { sessionId } = msg;
        if (subscriptions.has(sessionId)) return; // already subscribed
        void startLogStream(ws, sessionId, namespace).then((cancel) => {
          subscriptions.set(sessionId, cancel);
        });
      } else if (msg.type === "unsubscribe") {
        const { sessionId } = msg;
        const cancel = subscriptions.get(sessionId);
        if (cancel) {
          cancel();
          subscriptions.delete(sessionId);
          send(ws, {
            type: "stream-end",
            ts: Date.now(),
            sessionId,
            reason: "cancelled",
          });
        }
      }
    });

    const cleanup = () => {
      connectedClients.delete(ws);
      for (const [, cancel] of subscriptions) {
        cancel();
      }
      subscriptions.clear();
    };

    ws.on("close", cleanup);
    ws.on("error", cleanup);
  });

  return wss;
}
