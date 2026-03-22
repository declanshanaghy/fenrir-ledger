/**
 * ws.ts integration tests — issue #963
 *
 * Validates that the WebSocket server correctly broadcasts job status updates
 * to connected clients so the monitor UI never stays stuck on "pending".
 *
 * AC tested:
 * - Client receives jobs-snapshot on connect
 * - watchAgentJobs callback triggers jobs-updated broadcast to all clients
 * - Status transitions (pending → running → succeeded/failed) propagate in real-time
 * - Multi-client broadcast: all connected clients receive the same update
 *
 * Implementation note — race condition:
 * The server sends jobs-snapshot via a microtask (after `await listAgentJobs()`).
 * That microtask resolves before the client's `open` event propagates through the
 * Promise chain. We must register message listeners synchronously on the raw WebSocket
 * object BEFORE awaiting the open event, otherwise we miss the first message.
 */

import { createServer } from "node:http";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebSocket } from "ws";

// ── vi.hoisted — lift state above the vi.mock hoist boundary ──────────────────

const capture = vi.hoisted(() => ({
  watchCb: null as ((...a: unknown[]) => void) | null,
}));

vi.mock("../k8s.js", () => ({
  listAgentJobs: vi.fn().mockResolvedValue([]),
  watchAgentJobs: vi.fn(
    (_ns: unknown, _sel: unknown, onUpdate: (...a: unknown[]) => void) => {
      capture.watchCb = onUpdate;
    }
  ),
  mapAgentJobToJob: vi.fn(),
  streamPodLogs: vi.fn(),
  findPodForSession: vi.fn().mockResolvedValue(null),
}));

import { attachWebSocketServer } from "../ws.js";

// ── Inline type (avoids importing from the mocked module) ─────────────────────
type JobStatus = "pending" | "running" | "succeeded" | "failed" | "purged";
type Job = {
  sessionId: string;
  name: string;
  issueNumber: number;
  agent: string;
  step: number;
  status: JobStatus;
  startedAt: string | null;
  completedAt: string | null;
  podName: string | null;
  fixture?: boolean;
};

/** Find the test job by sessionId — fixture jobs may sort before it in the list. */
function findTestJob(jobs: Job[]): Job | undefined {
  return jobs.find((j) => j.sessionId === "issue-963-step1-loki");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Open a WebSocket AND register a message collector simultaneously.
 * IMPORTANT: listeners must be registered before the WS opens to avoid
 * missing the first message (jobs-snapshot is sent in a microtask that fires
 * before the client open event propagates through Promise chains).
 */
function connectAndCollect(
  port: number
): { ws: WebSocket; nextMsg: () => Promise<string>; open: Promise<void> } {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const queue: string[] = [];
  const waiters: Array<(s: string) => void> = [];

  ws.on("message", (data) => {
    const s = String(data);
    const waiter = waiters.shift();
    if (waiter) {
      waiter(s);
    } else {
      queue.push(s);
    }
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
  maxMessages = 5
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

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    sessionId: "issue-963-step1-loki",
    name: "agent-issue-963-step1-loki",
    issueNumber: 963,
    agent: "loki",
    step: 1,
    status: "pending",
    startedAt: "2026-03-15T10:00:00Z",
    completedAt: null,
    podName: null,
    ...overrides,
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("WebSocket server — job status broadcasts (issue #963)", () => {
  let httpServer: ReturnType<typeof createServer>;
  let port: number;

  beforeEach(async () => {
    capture.watchCb = null;
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

  // ── Connection handshake ─────────────────────────────────────────────────

  it("sends jobs-snapshot to a newly connected client", async () => {
    const { ws, nextMsg, open } = connectAndCollect(port);
    await open;
    try {
      const msg = await waitForType<{ type: string; jobs: unknown[]; ts: number }>(nextMsg, "jobs-snapshot");
      expect(msg.type).toBe("jobs-snapshot");
      expect(Array.isArray(msg.jobs)).toBe(true);
      expect(typeof msg.ts).toBe("number");
    } finally {
      ws.close();
    }
  });

  // ── AC: pending while scheduling ─────────────────────────────────────────

  it("broadcasts pending status when job is scheduling", async () => {
    const { ws, nextMsg, open } = connectAndCollect(port);
    await open;
    await waitForType(nextMsg, "jobs-snapshot");
    try {
      capture.watchCb!([makeJob({ status: "pending" })]);
      const msg = await waitForType<{ type: string; jobs: Job[] }>(nextMsg, "jobs-updated");
      expect(findTestJob(msg.jobs)?.status).toBe("pending");
    } finally {
      ws.close();
    }
  });

  // ── AC: running when pod becomes active ──────────────────────────────────

  it("broadcasts running status when pod starts executing", async () => {
    const { ws, nextMsg, open } = connectAndCollect(port);
    await open;
    await waitForType(nextMsg, "jobs-snapshot");
    try {
      capture.watchCb!([makeJob({ status: "running" })]);
      const msg = await waitForType<{ type: string; jobs: Job[] }>(nextMsg, "jobs-updated");
      expect(findTestJob(msg.jobs)?.status).toBe("running");
    } finally {
      ws.close();
    }
  });

  // ── AC: succeeded on completion ───────────────────────────────────────────

  it("broadcasts succeeded status when job completes", async () => {
    const { ws, nextMsg, open } = connectAndCollect(port);
    await open;
    await waitForType(nextMsg, "jobs-snapshot");
    try {
      capture.watchCb!([makeJob({ status: "succeeded", completedAt: "2026-03-15T11:00:00Z" })]);
      const msg = await waitForType<{ type: string; jobs: Job[] }>(nextMsg, "jobs-updated");
      const job = findTestJob(msg.jobs);
      expect(job?.status).toBe("succeeded");
      expect(job?.completedAt).toBe("2026-03-15T11:00:00Z");
    } finally {
      ws.close();
    }
  });

  // ── AC: failed on error ───────────────────────────────────────────────────

  it("broadcasts failed status when job fails", async () => {
    const { ws, nextMsg, open } = connectAndCollect(port);
    await open;
    await waitForType(nextMsg, "jobs-snapshot");
    try {
      capture.watchCb!([makeJob({ status: "failed" })]);
      const msg = await waitForType<{ type: string; jobs: Job[] }>(nextMsg, "jobs-updated");
      expect(findTestJob(msg.jobs)?.status).toBe("failed");
    } finally {
      ws.close();
    }
  });

  // ── AC: full lifecycle (pending → running → succeeded) ────────────────────

  it("propagates status lifecycle: pending → running → succeeded", async () => {
    const { ws, nextMsg, open } = connectAndCollect(port);
    await open;
    await waitForType(nextMsg, "jobs-snapshot");
    try {
      capture.watchCb!([makeJob({ status: "pending" })]);
      const s1 = await waitForType<{ type: string; jobs: Job[] }>(nextMsg, "jobs-updated");
      expect(findTestJob(s1.jobs)?.status).toBe("pending");

      capture.watchCb!([makeJob({ status: "running" })]);
      const s2 = await waitForType<{ type: string; jobs: Job[] }>(nextMsg, "jobs-updated");
      expect(findTestJob(s2.jobs)?.status).toBe("running");

      capture.watchCb!([makeJob({ status: "succeeded", completedAt: "2026-03-15T11:00:00Z" })]);
      const s3 = await waitForType<{ type: string; jobs: Job[] }>(nextMsg, "jobs-updated");
      expect(findTestJob(s3.jobs)?.status).toBe("succeeded");
    } finally {
      ws.close();
    }
  });

  // ── Ping / pong ───────────────────────────────────────────────────────────

  it("responds to ping with pong", async () => {
    const { ws, nextMsg, open } = connectAndCollect(port);
    await open;
    await waitForType(nextMsg, "jobs-snapshot");
    try {
      ws.send(JSON.stringify({ type: "ping" }));
      const msg = await waitForType<{ type: string }>(nextMsg, "pong");
      expect(msg.type).toBe("pong");
    } finally {
      ws.close();
    }
  });

  // ── Multi-client broadcast ────────────────────────────────────────────────

  it("broadcasts jobs-updated to all connected clients simultaneously", async () => {
    const c1 = connectAndCollect(port);
    const c2 = connectAndCollect(port);
    await Promise.all([c1.open, c2.open]);
    await Promise.all([
      waitForType(c1.nextMsg, "jobs-snapshot"),
      waitForType(c2.nextMsg, "jobs-snapshot"),
    ]);
    try {
      capture.watchCb!([makeJob({ status: "running" })]);
      const [m1, m2] = await Promise.all([
        waitForType<{ type: string; jobs: Job[] }>(c1.nextMsg, "jobs-updated"),
        waitForType<{ type: string; jobs: Job[] }>(c2.nextMsg, "jobs-updated"),
      ]);
      expect(findTestJob(m1.jobs)?.status).toBe("running");
      expect(findTestJob(m2.jobs)?.status).toBe("running");
    } finally {
      c1.ws.close();
      c2.ws.close();
    }
  });
});
