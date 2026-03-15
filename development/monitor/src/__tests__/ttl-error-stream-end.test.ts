/**
 * Vitest tests for issue #974 — TTL-expired error sends stream-end to halt the loop.
 *
 * AC tested:
 * - When streamPodLogs error callback fires, server sends stream-error THEN stream-end
 * - Client receives both messages in order (error before end)
 * - After stream-end, no further messages are sent for the session
 * - A second subscribe attempt during the same connection is blocked (subscription guard)
 * - Pod-not-found path (findPodForSession returns null) sends stream-error + stream-end
 */

import { createServer } from "node:http";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebSocket } from "ws";

// ── Captured mocks ────────────────────────────────────────────────────────────

const capture = vi.hoisted(() => ({
  streamErrorCb: null as ((err: Error) => void) | null,
  streamDoneCb: null as (() => void) | null,
  findPodResult: null as string | null,
}));

vi.mock("../k8s.js", () => ({
  listAgentJobs: vi.fn().mockResolvedValue([]),
  watchAgentJobs: vi.fn(),
  mapAgentJobToJob: vi.fn(),
  findPodForSession: vi.fn(async () => capture.findPodResult),
  streamPodLogs: vi.fn(
    (
      _pod: unknown,
      _ns: unknown,
      _onLine: unknown,
      onDone: () => void,
      onError: (err: Error) => void
    ) => {
      capture.streamDoneCb = onDone;
      capture.streamErrorCb = onError;
      return Promise.resolve(() => { /* cancel */ });
    }
  ),
}));

import { attachWebSocketServer } from "../ws.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function connectAndCollect(port: number) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const queue: string[] = [];
  const waiters: Array<(s: string) => void> = [];

  ws.on("message", (data) => {
    const s = String(data);
    const waiter = waiters.shift();
    if (waiter) waiter(s);
    else queue.push(s);
  });

  const nextMsg = (ms = 4000) =>
    new Promise<string>((resolve, reject) => {
      const msg = queue.shift();
      if (msg) { resolve(msg); return; }
      const t = setTimeout(() => {
        const idx = waiters.indexOf(resolve);
        if (idx !== -1) waiters.splice(idx, 1);
        reject(new Error(`WS msg timeout after ${ms}ms`));
      }, ms);
      waiters.push((s) => { clearTimeout(t); resolve(s); });
    });

  const open = new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });

  return { ws, nextMsg, open };
}

function waitForType<T extends { type: string }>(
  nextMsg: () => Promise<string>,
  type: string,
  maxMessages = 10
): Promise<T> {
  const tryNext = async (remaining: number): Promise<T> => {
    if (remaining === 0) throw new Error(`Did not find type="${type}" in ${maxMessages} messages`);
    const raw = await nextMsg();
    const parsed = JSON.parse(raw) as T;
    if (parsed.type === type) return parsed;
    return tryNext(remaining - 1);
  };
  return tryNext(maxMessages);
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("WebSocket server — TTL error loop prevention (issue #974)", () => {
  let httpServer: ReturnType<typeof createServer>;
  let port: number;

  beforeEach(async () => {
    capture.streamErrorCb = null;
    capture.streamDoneCb = null;
    capture.findPodResult = "pod-issue-974-step1"; // pod exists by default
    httpServer = createServer();
    attachWebSocketServer(httpServer as Parameters<typeof attachWebSocketServer>[0]);
    await new Promise<void>((resolve) => {
      httpServer.listen(0, "127.0.0.1", () => resolve());
    });
    port = (httpServer.address() as { port: number }).port;
  }, 15_000);

  afterEach(async () => {
    httpServer.closeAllConnections?.();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  }, 15_000);

  // ── AC: stream-error followed immediately by stream-end ───────────────────

  it("sends stream-error then stream-end when streamPodLogs fires error callback", async () => {
    const { ws, nextMsg, open } = connectAndCollect(port);
    await open;
    await waitForType(nextMsg, "jobs-snapshot");

    ws.send(JSON.stringify({ type: "subscribe", sessionId: "issue-974-step1-loki" }));

    // Wait for streamPodLogs mock to register its callbacks
    await new Promise<void>((resolve) => {
      const poll = setInterval(() => {
        if (capture.streamErrorCb) { clearInterval(poll); resolve(); }
      }, 10);
    });

    // Trigger a 404-style error from streamPodLogs
    const httpError = Object.assign(new Error("HTTP status code 404 Not Found"), {});
    capture.streamErrorCb!(httpError);

    try {
      const errMsg = await waitForType<{ type: string; sessionId: string; message: string }>(
        nextMsg, "stream-error"
      );
      expect(errMsg.type).toBe("stream-error");
      expect(errMsg.sessionId).toBe("issue-974-step1-loki");
      expect(errMsg.message).toMatch(/cleaned up|TTL expired/i);

      const endMsg = await waitForType<{ type: string; sessionId: string; reason: string }>(
        nextMsg, "stream-end"
      );
      expect(endMsg.type).toBe("stream-end");
      expect(endMsg.sessionId).toBe("issue-974-step1-loki");
      expect(endMsg.reason).toBe("failed");
    } finally {
      ws.close();
    }
  });

  // ── AC: stream-error message carries friendly text, not raw HTTP ──────────

  it("stream-error message is human-readable (no raw HTTP artefacts)", async () => {
    const { ws, nextMsg, open } = connectAndCollect(port);
    await open;
    await waitForType(nextMsg, "jobs-snapshot");

    ws.send(JSON.stringify({ type: "subscribe", sessionId: "issue-974-step2-loki" }));

    await new Promise<void>((resolve) => {
      const poll = setInterval(() => {
        if (capture.streamErrorCb) { clearInterval(poll); resolve(); }
      }, 10);
    });

    capture.streamErrorCb!(new Error("HTTP status code 404 Body: undefined Content-Type: application/json"));

    try {
      const errMsg = await waitForType<{ type: string; message: string }>(nextMsg, "stream-error");
      expect(errMsg.message).not.toMatch(/HTTP status code/i);
      expect(errMsg.message).not.toMatch(/Body: undefined/i);
      expect(errMsg.message).not.toMatch(/Content-Type/i);
    } finally {
      ws.close();
    }
  });

  // ── AC: pod-not-found path sends stream-error + stream-end ────────────────

  it("sends stream-error + stream-end when findPodForSession returns null", async () => {
    capture.findPodResult = null; // simulate pod not found
    const { ws, nextMsg, open } = connectAndCollect(port);
    await open;
    await waitForType(nextMsg, "jobs-snapshot");

    ws.send(JSON.stringify({ type: "subscribe", sessionId: "issue-974-step3-loki" }));

    try {
      const errMsg = await waitForType<{ type: string; sessionId: string; message: string }>(
        nextMsg, "stream-error"
      );
      expect(errMsg.type).toBe("stream-error");
      expect(errMsg.sessionId).toBe("issue-974-step3-loki");
      expect(errMsg.message).toMatch(/cleaned up|TTL expired/i);

      const endMsg = await waitForType<{ type: string; sessionId: string }>(
        nextMsg, "stream-end"
      );
      expect(endMsg.type).toBe("stream-end");
      expect(endMsg.sessionId).toBe("issue-974-step3-loki");
    } finally {
      ws.close();
    }
  });

  // ── AC: second subscribe for same session is blocked during connection ─────

  it("blocks a duplicate subscribe for the same session during the same connection", async () => {
    const { ws, nextMsg, open } = connectAndCollect(port);
    await open;
    await waitForType(nextMsg, "jobs-snapshot");

    // First subscribe
    ws.send(JSON.stringify({ type: "subscribe", sessionId: "issue-974-step4-loki" }));

    await new Promise<void>((resolve) => {
      const poll = setInterval(() => {
        if (capture.streamErrorCb) { clearInterval(poll); resolve(); }
      }, 10);
    });

    capture.streamErrorCb!(new Error("HTTP status code 404"));
    await waitForType(nextMsg, "stream-error");
    await waitForType(nextMsg, "stream-end");

    // Reset captured callbacks to detect if a new stream is started
    capture.streamErrorCb = null;
    capture.streamDoneCb = null;

    // Second subscribe for the same session — should be a no-op
    ws.send(JSON.stringify({ type: "subscribe", sessionId: "issue-974-step4-loki" }));

    await new Promise<void>((resolve) => setTimeout(resolve, 200));

    // Callbacks should NOT have been populated again (subscription guard prevented it)
    expect(capture.streamErrorCb).toBeNull();
    expect(capture.streamDoneCb).toBeNull();

    ws.close();
  });
});
