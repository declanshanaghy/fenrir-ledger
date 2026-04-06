import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage, Server } from "node:http";
import type { ServerType } from "@hono/node-server";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  streamPodLogs,
  findPodForSession,
  listAgentJobs,
  watchAgentJobs,
  mapAgentJobToJob,
} from "./k8s.js";
import type { Job } from "./k8s.js";
import { parseJsonlLine, detectVerdict } from "./report.js";

// ── K8s error message sanitiser ─────────────────────────────────────────────

/**
 * Regex matching node-unreachable / kubelet-timeout patterns that appear in
 * 500-class K8s errors when a node is down or the kubelet is unresponsive.
 *
 * Matches messages containing any of:
 *   - "i/o timeout"
 *   - kubelet port 10250 connection failures ("dial tcp …:10250")
 *   - "node … not ready" / "node … unreachable"
 *   - "context deadline exceeded"
 */
export const NODE_UNREACHABLE_PATTERN =
  /i\/o timeout|dial tcp[^)]*:10250|node[^\n]*(?:not ready|unreachable)|context deadline exceeded/i;

/** Strip RFC-1918 / link-local IP addresses to avoid leaking internal topology. */
function stripInternalIPs(msg: string): string {
  return msg
    .replace(/\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "<node-ip>")
    .replace(/\b192\.168\.\d{1,3}\.\d{1,3}\b/g, "<node-ip>")
    .replace(/\b172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}\b/g, "<node-ip>")
    .replace(/\b169\.254\.\d{1,3}\.\d{1,3}\b/g, "<node-ip>");
}

/**
 * Map raw Kubernetes API errors to clean, user-friendly messages.
 *
 * The @kubernetes/client-node library often throws errors whose `.message`
 * contains raw HTTP details such as status lines, header dumps, and
 * "Body: undefined". This function strips all of that and returns a
 * single human-readable sentence safe to display in the monitor UI.
 */
export function friendlyK8sError(rawMessage: string, sessionId: string): string {
  // Detect node-unreachable / kubelet-timeout patterns before checking status code.
  // These typically arrive as 500 but deserve a more specific, actionable message.
  if (NODE_UNREACHABLE_PATTERN.test(rawMessage)) {
    return `Node unreachable — the Kubernetes node running session ${sessionId} is not responding (kubelet timeout). The cluster is retrying; logs will resume if the node recovers.`;
  }

  // Detect HTTP status code from messages like "HTTP status code 404" or "404 Not Found"
  const statusMatch = /\b(4\d\d|5\d\d)\b/.exec(rawMessage);
  const status = statusMatch ? parseInt(statusMatch[1]!, 10) : null;

  switch (status) {
    case 404:
      return `Logs unavailable — the pod for session ${sessionId} has been cleaned up (job TTL expired).`;
    case 403:
      return `Access denied to pod logs for session ${sessionId}. Contact your cluster administrator.`;
    case 401:
      return `Authentication error — check cluster credentials.`;
    case 500:
      return `Kubernetes API server error while fetching logs for session ${sessionId}. The cluster may be experiencing issues.`;
    case 503:
      return `Kubernetes API unavailable — the cluster may be temporarily unreachable.`;
    default:
      break;
  }

  // Strip raw HTTP artefacts: headers, status lines, "Body: undefined", etc.
  // Also redact internal IPs that may have slipped through.
  const stripped = stripInternalIPs(rawMessage)
    .replace(/HTTP response body:.*$/gim, "")
    .replace(/HTTP status code:?\s*\d+/gi, "")
    .replace(/\bBody:\s*undefined\b/gi, "")
    .replace(/\bContent-Type:[^\n]*/gi, "")
    .replace(/\bAuthorization:[^\n]*/gi, "")
    .replace(/\n{2,}/g, " ")
    .trim();

  if (stripped.length > 0 && stripped.length < 300) {
    return stripped;
  }

  return `An unexpected error occurred while streaming logs for session ${sessionId}.`;
}

// ── Fixture fallback for local dev (disabled in production) ─────────────────
const FIXTURES_ENABLED = process.env.NODE_ENV !== "production";
const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, "../fixtures");

function findFixture(sessionId: string): string | null {
  if (!FIXTURES_ENABLED) return null;
  if (!existsSync(FIXTURES_DIR)) return null;
  // Match agent-<sessionId>.jsonl
  const exact = resolve(FIXTURES_DIR, `agent-${sessionId}.jsonl`);
  if (existsSync(exact)) return exact;
  // Fuzzy: any file containing the sessionId
  try {
    const files = readdirSync(FIXTURES_DIR);
    const match = files.find((f) => f.includes(sessionId) && f.endsWith(".jsonl"));
    return match ? resolve(FIXTURES_DIR, match) : null;
  } catch {
    return null;
  }
}

/** Scan fixtures dir and return Job entries for each .jsonl file found. */
function listFixtureJobs(): Job[] {
  if (!FIXTURES_ENABLED) return [];
  if (!existsSync(FIXTURES_DIR)) return [];
  try {
    const files = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".jsonl"));
    return files.map((f) => {
      const sessionId = f.replace(/^agent-/, "").replace(/\.jsonl$/, "");
      const m = sessionId.match(/issue-(\d+)-step(\d+)-([a-z]+)/i);
      const stat = statSync(resolve(FIXTURES_DIR, f));
      return {
        sessionId,
        name: f.replace(/\.jsonl$/, ""),
        issueNumber: m ? parseInt(m[1] ?? "0", 10) : 0,
        agent: m ? (m[3] ?? "unknown").toLowerCase() : "unknown",
        step: m ? parseInt(m[2] ?? "0", 10) : 0,
        status: "succeeded" as const,
        startedAt: stat.mtime.toISOString(),
        completedAt: stat.mtime.toISOString(),
        podName: null,
        issueTitle: null,
        branchName: null,
        fixture: true,
      };
    });
  } catch {
    return [];
  }
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
  | { type: "fixture-start"; ts: number; sessionId: string }
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

function sortJobsByStartedAtDesc(jobs: Job[]): Job[] {
  return [...jobs].sort((a, b) => {
    const aTime = a.startedAt ? new Date(a.startedAt).getTime() : 0;
    const bTime = b.startedAt ? new Date(b.startedAt).getTime() : 0;
    return bTime - aTime;
  });
}

/** Merge fixture jobs with live K8s jobs. Live jobs take precedence by sessionId. */
function mergeWithFixtures(liveJobs: Job[]): Job[] {
  const fixtureJobs = listFixtureJobs();
  if (fixtureJobs.length === 0) return sortJobsByStartedAtDesc(liveJobs);
  const liveIds = new Set(liveJobs.map((j) => j.sessionId));
  const extras = fixtureJobs.filter((f) => !liveIds.has(f.sessionId));
  return sortJobsByStartedAtDesc([...liveJobs, ...extras]);
}

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

/**
 * How long to wait between retries when a pod is still scheduling.
 * Kept short enough that users see a quick transition once the pod starts,
 * but long enough to avoid hammering the K8s API.
 */
const PENDING_RETRY_INTERVAL_MS = 3_000;

/**
 * Start streaming logs for sessionId to ws.
 *
 * Returns a cancel function immediately — the actual stream setup runs
 * asynchronously in the background. This ensures `subscriptions.set` can
 * capture the cancel function before any async work begins, preventing
 * duplicate subscriptions for the same session.
 *
 * For pending sessions (pod not yet scheduled, or container still starting),
 * the function retries every PENDING_RETRY_INTERVAL_MS until the pod is ready
 * or the caller cancels. This fixes the "Awaiting the Norns" stuck state
 * (issue #1354): the subscription stays alive during the pending → running
 * transition, so the first log-line clears isConnecting without requiring
 * a manual re-selection.
 *
 * @param getJobs - Getter for the current live job list. Called on each
 *   retry attempt so the latest pod status is always used (not a stale
 *   snapshot captured at subscription time).
 */
function startLogStream(
  ws: WebSocket,
  sessionId: string,
  namespace: string,
  getJobs: () => Job[]
): () => void {
  let cancelled = false;
  let cancelInner: (() => void) | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const cancel = (): void => {
    cancelled = true;
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    cancelInner?.();
  };

  const scheduleRetry = (): void => {
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void attempt();
    }, PENDING_RETRY_INTERVAL_MS);
  };

  const attempt = async (): Promise<void> => {
    if (cancelled) return;

    try {
      const podName = await findPodForSession(sessionId, namespace);
      if (cancelled) return;

      if (!podName) {
        // Retry only when the job is explicitly pending or running — the pod is
        // still being scheduled. For terminal / purged jobs (or jobs not in the
        // list, which means the pod was already cleaned up), fall through to the
        // TTL-expired error path immediately.
        const job = getJobs().find((j) => j.sessionId === sessionId);
        const isPendingOrRunning =
          job?.status === "pending" || job?.status === "running";

        if (isPendingOrRunning) {
          // Pod not scheduled yet — retry after delay.
          // "Awaiting the Norns" remains visible on the client (isConnecting stays true).
          scheduleRetry();
          return;
        }

        // Terminal job (or unknown session) with no pod → TTL expired or cleaned up.
        // Try fixture fallback for local dev first.
        const fixture = findFixture(sessionId);
        if (fixture) {
          console.log(`[ws] Streaming fixture for ${sessionId}: ${fixture}`);
          send(ws, { type: "fixture-start", ts: Date.now(), sessionId });
          const lines = readFileSync(fixture, "utf-8").split("\n").filter((l) => l.trim());
          const events: unknown[] = [];
          let fixturePaused = false;
          let fixtureSpeed = 1;
          let lineIndex = 0;
          let timer: ReturnType<typeof setTimeout> | null = null;

          const baseDelay = 200;

          const streamNext = (): void => {
            if (cancelled) return;
            if (fixturePaused) return;
            if (lineIndex >= lines.length) {
              const verdict = detectVerdict(events as Parameters<typeof detectVerdict>[0]);
              if (verdict) {
                send(ws, { type: "verdict", ts: Date.now(), sessionId, result: verdict.pass ? "PASS" : "FAIL" });
              }
              send(ws, { type: "stream-end", ts: Date.now(), sessionId, reason: "completed" });
              return;
            }
            const line = lines[lineIndex++]!;
            send(ws, { type: "log-line", ts: Date.now(), sessionId, line });
            const ev = parseJsonlLine(line);
            if (ev) events.push(ev);
            const delay = ev ? baseDelay / fixtureSpeed : 0;
            timer = setTimeout(streamNext, delay);
          };

          const onSpeedMessage = (data: unknown): void => {
            try {
              const msg = JSON.parse(String(data)) as { type: string; speed?: number; sessionId?: string };
              if (msg.type === "set-speed" && msg.sessionId === sessionId) {
                if (msg.speed === 0) {
                  fixturePaused = true;
                  if (timer) { clearTimeout(timer); timer = null; }
                } else {
                  fixtureSpeed = msg.speed ?? 1;
                  fixturePaused = false;
                  if (!timer) streamNext();
                }
              }
            } catch { /* ignore */ }
          };
          ws.on("message", onSpeedMessage);

          cancelInner = () => {
            if (timer) clearTimeout(timer);
            ws.off("message", onSpeedMessage);
          };

          streamNext();
          return;
        }

        send(ws, {
          type: "stream-error",
          ts: Date.now(),
          sessionId,
          message: `Pod for session ${sessionId} has been cleaned up (job TTL expired). Logs are no longer available from the cluster.`,
        });
        send(ws, { type: "stream-end", ts: Date.now(), sessionId, reason: "completed" });
        return;
      }

      // Pod found — attempt to open the log stream.
      const job = getJobs().find((j) => j.sessionId === sessionId);
      const isCompleted = job?.status === "succeeded" || job?.status === "failed";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: any[] = [];

      let innerCancel: (() => void) | null = null;
      try {
        innerCancel = await streamPodLogs(
          podName,
          namespace,
          (rawLine) => {
            if (cancelled) return;
            const line = rawLine.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s*/, "");
            send(ws, { type: "log-line", ts: Date.now(), sessionId, line });
            const ev = parseJsonlLine(line);
            if (ev) events.push(ev);
          },
          () => {
            if (cancelled) return;
            const verdict = detectVerdict(events);
            if (verdict) {
              send(ws, { type: "verdict", ts: Date.now(), sessionId, result: verdict.pass ? "PASS" : "FAIL" });
            }
            send(ws, { type: "stream-end", ts: Date.now(), sessionId, reason: "completed" });
          },
          (err) => {
            if (cancelled) return;
            const friendly = friendlyK8sError(err.message, sessionId);
            send(ws, { type: "stream-error", ts: Date.now(), sessionId, message: friendly });
            send(ws, { type: "stream-end", ts: Date.now(), sessionId, reason: "failed" });
          },
          { follow: !isCompleted }
        );
      } catch (streamErr) {
        if (cancelled) return;
        const raw = streamErr instanceof Error ? streamErr.message : String(streamErr);
        if (raw.includes("204")) {
          send(ws, { type: "stream-end", ts: Date.now(), sessionId, reason: "completed" });
          return;
        }
        // Container may not be running yet (e.g. ContainerCreating, init containers).
        // If the job is still active, retry — the container will start soon.
        const currentJob = getJobs().find((j) => j.sessionId === sessionId);
        if (currentJob?.status === "pending" || currentJob?.status === "running") {
          scheduleRetry();
          return;
        }
        throw streamErr;
      }

      if (cancelled) {
        innerCancel?.();
      } else {
        cancelInner = innerCancel;
      }
    } catch (err) {
      if (cancelled) return;
      const raw = err instanceof Error ? err.message : String(err);
      if (raw.includes("204")) {
        send(ws, { type: "stream-end", ts: Date.now(), sessionId, reason: "completed" });
        return;
      }
      const friendly = friendlyK8sError(raw, sessionId);
      send(ws, { type: "stream-error", ts: Date.now(), sessionId, message: friendly });
      send(ws, { type: "stream-end", ts: Date.now(), sessionId, reason: "completed" });
    }
  };

  void attempt();
  return cancel;
}

// ── Heartbeat ───────────────────────────────────────────────────────────────
// GKE Cloud Load Balancer / nginx proxies close idle WebSocket connections
// after ~30 s of inactivity.  Sending a WebSocket ping frame every 20 s keeps
// the connection alive; browsers automatically respond with a pong frame at
// the protocol level, so no client-side changes are required.
//
// Dead-connection detection: if no pong arrives before the next ping interval
// the connection is terminated to free server resources.
export const HEARTBEAT_INTERVAL_MS = 20_000;

// ---------------------------------------------------------------------------
// Per-namespace watcher context — shared across all connections for that ns
// ---------------------------------------------------------------------------

interface NamespaceContext {
  cachedJobs: Job[];
  clients: Set<WebSocket>;
  cancelWatch: () => void;
}

// ---------------------------------------------------------------------------
// WebSocket server — single multiplexed /ws endpoint
// ---------------------------------------------------------------------------

export function attachWebSocketServer(
  server: ServerType,
  labelSelector = "app.kubernetes.io/component=agent-sandbox",
  allowedNamespaces: string[] = ["fenrir-agents"],
  defaultNamespace = "fenrir-agents"
): WebSocketServer {
  // Per-namespace watcher contexts — lazy initialised on first connection
  const nsContexts = new Map<string, NamespaceContext>();

  function getOrCreateContext(namespace: string): NamespaceContext {
    const existing = nsContexts.get(namespace);
    if (existing) return existing;

    const ctx: NamespaceContext = {
      cachedJobs: [],
      clients: new Set(),
      cancelWatch: watchAgentJobs(
        namespace,
        labelSelector,
        (jobs) => {
          ctx.cachedJobs = jobs;
          broadcast(ctx.clients, {
            type: "jobs-updated",
            ts: Date.now(),
            jobs: mergeWithFixtures(jobs),
          });
        },
        (err) => {
          console.error(`[ws] K8s watch error (ns=${namespace}):`, err.message);
          // watchAgentJobs auto-reconnects internally
        }
      ),
    };
    nsContexts.set(namespace, ctx);
    return ctx;
  }

  function releaseContext(namespace: string, ws: WebSocket): void {
    const ctx = nsContexts.get(namespace);
    if (!ctx) return;
    ctx.clients.delete(ws);
    if (ctx.clients.size === 0) {
      ctx.cancelWatch();
      nsContexts.delete(namespace);
    }
  }

  const wss = new WebSocketServer({ server: server as Server, path: "/ws" });

  // Auth is handled by oauth2-proxy sidecar — no in-app session check needed.

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    // Extract namespace from query param (e.g. /ws?namespace=say-so-agents)
    const rawUrl = req.url ?? "";
    const qIdx = rawUrl.indexOf("?");
    const nsParam = qIdx >= 0
      ? new URLSearchParams(rawUrl.slice(qIdx + 1)).get("namespace") ?? ""
      : "";
    const namespace = allowedNamespaces.includes(nsParam) ? nsParam : defaultNamespace;

    // Get or start the watcher for this namespace, register this client
    const ctx = getOrCreateContext(namespace);
    ctx.clients.add(ws);

    // ── Per-connection heartbeat ───────────────────────────────────────────
    // Ping every 20 s so GKE's 30 s idle timeout never fires.
    // Mark the connection alive when we receive a pong; terminate if the
    // previous ping went unanswered (zombie connection).
    let isAlive = true;
    ws.on("pong", () => { isAlive = true; });
    const heartbeat = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        clearInterval(heartbeat);
        return;
      }
      if (!isAlive) {
        ws.terminate();
        return;
      }
      isAlive = false;
      ws.ping();
    }, HEARTBEAT_INTERVAL_MS);

    // Seed cache from listAgentJobs if watch hasn't populated it yet
    let jobs = ctx.cachedJobs;
    if (jobs.length === 0) {
      try {
        const agentJobs = await listAgentJobs(namespace, labelSelector);
        jobs = agentJobs.map(mapAgentJobToJob);
        ctx.cachedJobs = jobs;
      } catch {
        // proceed with empty list
      }
    }
    send(ws, { type: "jobs-snapshot", ts: Date.now(), jobs: mergeWithFixtures(jobs) });

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
        // startLogStream returns a cancel function immediately — async work runs
        // in the background. Setting subscriptions synchronously prevents duplicate
        // subscribe messages from spawning parallel streams for the same session.
        const cancel = startLogStream(ws, sessionId, namespace, () => ctx.cachedJobs);
        subscriptions.set(sessionId, cancel);
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
      clearInterval(heartbeat);
      releaseContext(namespace, ws);
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
