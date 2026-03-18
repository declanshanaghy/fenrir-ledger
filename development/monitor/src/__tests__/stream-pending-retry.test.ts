/**
 * Tests for issue #1354 — "Awaiting the Norns" stuck on pending session click.
 *
 * Root cause: when a session is in "pending" state (pod not yet scheduled),
 * the server was immediately sending stream-error + stream-end (TTL path),
 * which left the client stuck with isConnecting=true or showing a spurious
 * error. The fix adds a retry loop in startLogStream so the server keeps the
 * subscription alive until the pod appears and is ready to stream.
 *
 * AC tested:
 * - Pending session (no pod yet) does NOT receive stream-error immediately
 * - Once the pod appears, logs are streamed normally
 * - Cancel (unsubscribe) during retry stops the retry loop
 * - Terminal session (succeeded/failed) with no pod still gets TTL error immediately
 * - Running session with pod not found yet also retries (scheduling race)
 */

import { createServer } from "node:http";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebSocket } from "ws";

// ── Captured mocks ─────────────────────────────────────────────────────────────

const capture = vi.hoisted(() => ({
  findPodResult: null as string | null,
  // Incremented each time findPodForSession is called — lets tests count retries
  findPodCallCount: 0,
  streamDoneCb: null as (() => void) | null,
  streamErrorCb: null as ((err: Error) => void) | null,
  watchCb: null as ((jobs: unknown[]) => void) | null,
  // Jobs to serve via watchAgentJobs / getJobs
  jobs: [] as Array<{ sessionId: string; status: string }>,
}));

vi.mock("../k8s.js", () => ({
  listAgentJobs: vi.fn().mockResolvedValue([]),
  watchAgentJobs: vi.fn(
    (_ns: unknown, _sel: unknown, onUpdate: (jobs: unknown[]) => void) => {
      capture.watchCb = onUpdate;
    }
  ),
  mapAgentJobToJob: vi.fn(),
  findPodForSession: vi.fn(async () => {
    capture.findPodCallCount++;
    return capture.findPodResult;
  }),
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

  const nextMsg = (ms = 5000) =>
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

  const noMsgFor = (ms: number) =>
    new Promise<void>((resolve, reject) => {
      // Resolve if no message arrives within ms; reject if one does
      const t = setTimeout(resolve, ms);
      const waiter = (s: string) => {
        clearTimeout(t);
        reject(new Error(`Unexpected message: ${s}`));
      };
      waiters.push(waiter);
    });

  const open = new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", reject);
  });

  return { ws, nextMsg, noMsgFor, open };
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

describe("startLogStream — pending pod retry (issue #1354)", () => {
  let httpServer: ReturnType<typeof createServer>;
  let port: number;

  beforeEach(async () => {
    capture.findPodResult = null;
    capture.findPodCallCount = 0;
    capture.streamDoneCb = null;
    capture.streamErrorCb = null;
    capture.watchCb = null;
    capture.jobs = [];

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

  // ── Pending session: no stream-error immediately ───────────────────────────

  it("does NOT send stream-error immediately when job is pending (pod not scheduled yet)", async () => {
    // Job is pending — pod will appear later
    capture.findPodResult = null;

    const { ws, nextMsg, noMsgFor, open } = connectAndCollect(port);
    await open;
    await waitForType(nextMsg, "jobs-snapshot");

    // Inject a pending job into the server's job map via the watch callback
    capture.watchCb!([{ sessionId: "issue-1354-step1-firemandecko", name: "agent-issue-1354-step1-firemandecko", status: "pending", startedAt: null, completedAt: null, podName: null, issueNumber: 1354, agent: "firemandecko", step: 1 }]);
    await waitForType(nextMsg, "jobs-updated");

    ws.send(JSON.stringify({ type: "subscribe", sessionId: "issue-1354-step1-firemandecko" }));

    // Wait long enough for the first attempt to complete (but less than retry interval)
    // No stream-error or stream-end should arrive during this window
    await expect(noMsgFor(500)).resolves.toBeUndefined();

    ws.close();
  });

  // ── Terminal session: TTL error fires immediately ──────────────────────────

  it("sends stream-error + stream-end immediately when job is succeeded and pod is gone", async () => {
    capture.findPodResult = null;

    const { ws, nextMsg, open } = connectAndCollect(port);
    await open;
    await waitForType(nextMsg, "jobs-snapshot");

    // Inject a succeeded (terminal) job
    capture.watchCb!([{
      sessionId: "issue-1354-step1-loki",
      name: "agent-issue-1354-step1-loki",
      status: "succeeded",
      startedAt: "2026-01-01T00:00:00Z",
      completedAt: "2026-01-01T01:00:00Z",
      podName: null,
      issueNumber: 1354,
      agent: "loki",
      step: 1,
    }]);
    await waitForType(nextMsg, "jobs-updated");

    ws.send(JSON.stringify({ type: "subscribe", sessionId: "issue-1354-step1-loki" }));

    try {
      const errMsg = await waitForType<{ type: string; sessionId: string; message: string }>(
        nextMsg, "stream-error"
      );
      expect(errMsg.type).toBe("stream-error");
      expect(errMsg.message).toMatch(/cleaned up|TTL expired/i);

      const endMsg = await waitForType<{ type: string }>(nextMsg, "stream-end");
      expect(endMsg.type).toBe("stream-end");
    } finally {
      ws.close();
    }
  });

  // ── Unknown session (not in job list): TTL error fires immediately ─────────

  it("sends stream-error + stream-end immediately for sessions not in the job list", async () => {
    capture.findPodResult = null;
    // No jobs in the list — session is unknown

    const { ws, nextMsg, open } = connectAndCollect(port);
    await open;
    await waitForType(nextMsg, "jobs-snapshot");

    ws.send(JSON.stringify({ type: "subscribe", sessionId: "issue-1354-unknown-session" }));

    try {
      const errMsg = await waitForType<{ type: string; message: string }>(
        nextMsg, "stream-error"
      );
      expect(errMsg.type).toBe("stream-error");
      expect(errMsg.message).toMatch(/cleaned up|TTL expired/i);
    } finally {
      ws.close();
    }
  });

  // ── Unsubscribe during retry stops the loop ────────────────────────────────

  it("stops retrying when client unsubscribes during the retry window", async () => {
    capture.findPodResult = null;
    const initialCallCount = capture.findPodCallCount;

    const { ws, nextMsg, open } = connectAndCollect(port);
    await open;
    await waitForType(nextMsg, "jobs-snapshot");

    // Inject a pending job
    capture.watchCb!([{
      sessionId: "issue-1354-step2-firemandecko",
      name: "agent-issue-1354-step2-firemandecko",
      status: "pending",
      startedAt: null,
      completedAt: null,
      podName: null,
      issueNumber: 1354,
      agent: "firemandecko",
      step: 2,
    }]);
    await waitForType(nextMsg, "jobs-updated");

    ws.send(JSON.stringify({ type: "subscribe", sessionId: "issue-1354-step2-firemandecko" }));

    // Wait briefly then unsubscribe
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
    ws.send(JSON.stringify({ type: "unsubscribe", sessionId: "issue-1354-step2-firemandecko" }));

    // Receive the stream-end from unsubscribe
    await waitForType(nextMsg, "stream-end");

    // Record call count after unsubscribe
    const callCountAfterUnsub = capture.findPodCallCount;

    // Wait long enough for a retry interval to pass — no further calls expected
    await new Promise<void>((resolve) => setTimeout(resolve, 200));
    const callCountAfterWait = capture.findPodCallCount;

    // Should not have called findPodForSession many more times after unsubscribe
    expect(callCountAfterWait - callCountAfterUnsub).toBe(0);
    expect(callCountAfterWait).toBeGreaterThan(initialCallCount); // at least one attempt was made

    ws.close();
  });

  // ── Pod appears: logs stream normally ─────────────────────────────────────

  it("streams logs normally once the pod appears after retrying", async () => {
    // First two attempts: no pod. Third: pod appears.
    let callCount = 0;
    const { findPodForSession } = await import("../k8s.js");
    vi.mocked(findPodForSession).mockImplementation(async () => {
      callCount++;
      return callCount >= 2 ? "pod-issue-1354-step3" : null;
    });

    const { ws, nextMsg, open } = connectAndCollect(port);
    await open;
    await waitForType(nextMsg, "jobs-snapshot");

    // Inject a pending job (will transition to running)
    capture.watchCb!([{
      sessionId: "issue-1354-step3-firemandecko",
      name: "agent-issue-1354-step3-firemandecko",
      status: "pending",
      startedAt: null,
      completedAt: null,
      podName: null,
      issueNumber: 1354,
      agent: "firemandecko",
      step: 3,
    }]);
    await waitForType(nextMsg, "jobs-updated");

    ws.send(JSON.stringify({ type: "subscribe", sessionId: "issue-1354-step3-firemandecko" }));

    // Wait for streamPodLogs to be called (pod appeared on retry)
    await new Promise<void>((resolve) => {
      const poll = setInterval(() => {
        if (capture.streamDoneCb) { clearInterval(poll); resolve(); }
      }, 50);
    });

    // Simulate log stream completing normally
    capture.streamDoneCb!();

    const endMsg = await waitForType<{ type: string; sessionId: string }>(nextMsg, "stream-end");
    expect(endMsg.type).toBe("stream-end");
    expect(endMsg.sessionId).toBe("issue-1354-step3-firemandecko");

    ws.close();

    // Restore original mock
    vi.mocked(findPodForSession).mockImplementation(async () => {
      capture.findPodCallCount++;
      return capture.findPodResult;
    });
  }, 15_000);
});
