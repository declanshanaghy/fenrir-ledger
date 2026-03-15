/**
 * ws-loki-917.test.ts — Loki QA gap tests for the multiplexed WS server
 * Issue #917: Replace job list polling with WebSocket push
 *
 * Covers edge-cases NOT tested by FiremanDecko's ws.test.ts:
 *   AC-L1  Second client receives cached jobs-snapshot without re-calling listAgentJobs
 *   AC-L2  ws.on('error') event triggers the same cleanup as ws.on('close')
 *   AC-L3  Log-lines for session A do NOT appear in a stream for session B
 *   AC-L4  startLogStream exception (findPodForSession throws) sends stream-error to client
 *   AC-L5  Connection without SESSION_COOKIE key in cookie header is rejected
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { IncomingMessage, Server } from "node:http";
import { EventEmitter } from "node:events";

// ── Minimal WebSocket fakes ───────────────────────────────────────────────────

class FakeWs extends EventEmitter {
  readyState = 1; // OPEN
  sent: string[] = [];
  closeCode?: number;

  send(data: string) {
    this.sent.push(data);
  }

  close(code?: number, _reason?: string) {
    this.closeCode = code;
    this.readyState = 3;
  }

  static readonly OPEN = 1;
}

class FakeWss extends EventEmitter {
  constructor(_opts: unknown) {
    super();
  }
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockFindPodForSession = vi.fn<(...args: unknown[]) => Promise<string | null>>();
const mockStreamPodLogs = vi.fn<(...args: unknown[]) => Promise<() => void>>();
const mockListAgentJobs = vi.fn<(...args: unknown[]) => Promise<unknown[]>>();
const mockWatchAgentJobs = vi.fn<(...args: unknown[]) => () => void>();
const mockMapAgentJobToJob = vi.fn<(...args: unknown[]) => unknown>();

vi.mock("../k8s.js", () => ({
  findPodForSession: mockFindPodForSession,
  streamPodLogs: mockStreamPodLogs,
  listAgentJobs: mockListAgentJobs,
  watchAgentJobs: mockWatchAgentJobs,
  mapAgentJobToJob: mockMapAgentJobToJob,
}));

vi.mock("ws", () => ({
  WebSocketServer: FakeWss,
  WebSocket: { OPEN: 1 },
}));

vi.mock("../auth.js", () => ({
  SESSION_COOKIE: "odin_session",
  verifySessionToken: vi.fn().mockReturnValue("test@example.com"),
}));

const { attachWebSocketServer } = await import("../ws.js");
const { verifySessionToken: mockVerifySessionToken } = await import("../auth.js");

// ── Helpers ───────────────────────────────────────────────────────────────────

function simulateConnection(
  wss: FakeWss,
  cookie = "odin_session=test-token"
): FakeWs {
  const ws = new FakeWs();
  const req = {
    url: "/ws",
    headers: { cookie },
  } as unknown as IncomingMessage;
  wss.emit("connection", ws, req);
  return ws;
}

function findMessage(ws: FakeWs, type: string) {
  return ws.sent
    .map((s) => JSON.parse(s) as Record<string, unknown>)
    .find((m) => m.type === type);
}

// ── Test setup ────────────────────────────────────────────────────────────────

describe("WS server gap tests — issue #917", () => {
  let wss: FakeWss;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockVerifySessionToken).mockReturnValue("test@example.com");
    mockWatchAgentJobs.mockReturnValue(vi.fn());
    mockListAgentJobs.mockResolvedValue([]);
    mockMapAgentJobToJob.mockImplementation((j) => j);

    const fakeServer = new EventEmitter() as unknown as Server;
    wss = attachWebSocketServer(fakeServer as unknown) as unknown as FakeWss;
  });

  afterEach(() => vi.restoreAllMocks());

  it("AC-L1: second client gets jobs-snapshot from cache without calling listAgentJobs again", async () => {
    // First client connects and populates cache via listAgentJobs
    const cachedJob = { sessionId: "s1", name: "job-1", status: "running" };
    mockListAgentJobs.mockResolvedValueOnce([cachedJob]);
    mockMapAgentJobToJob.mockReturnValueOnce(cachedJob);

    const ws1 = simulateConnection(wss);
    await new Promise((r) => setTimeout(r, 30));

    const snap1 = findMessage(ws1, "jobs-snapshot");
    expect(snap1).toBeDefined();
    expect((snap1!.jobs as unknown[]).length).toBe(1);

    // Second client — listAgentJobs should NOT be called again (cache is warm)
    const ws2 = simulateConnection(wss);
    await new Promise((r) => setTimeout(r, 20));

    const snap2 = findMessage(ws2, "jobs-snapshot");
    expect(snap2).toBeDefined();
    expect((snap2!.jobs as unknown[]).length).toBe(1);
    // listAgentJobs was called exactly once (for ws1), not twice
    expect(mockListAgentJobs).toHaveBeenCalledTimes(1);
  });

  it("AC-L2: ws.on('error') removes the client from broadcast set", async () => {
    let capturedOnUpdate: ((jobs: unknown[]) => void) | undefined;
    mockWatchAgentJobs.mockImplementation((_ns, _label, onUpdate) => {
      capturedOnUpdate = onUpdate as (jobs: unknown[]) => void;
      return vi.fn();
    });

    const fakeServer = new EventEmitter() as unknown as Server;
    const wss2 = attachWebSocketServer(fakeServer as unknown) as unknown as FakeWss;

    const ws = simulateConnection(wss2);
    await new Promise((r) => setTimeout(r, 10));

    // Trigger the error event (not close) — should also deregister the client
    ws.emit("error", new Error("socket reset"));

    const sentBefore = ws.sent.length;
    capturedOnUpdate!([{ sessionId: "s1" }]);

    // No new messages since client was cleaned up
    expect(ws.sent.length).toBe(sentBefore);
  });

  it("AC-L3: log-lines for session A do not appear in session B's stream", async () => {
    let onLineA: ((line: string) => void) | undefined;
    let onLineB: ((line: string) => void) | undefined;

    mockFindPodForSession.mockImplementation(async (sessionId) => {
      return `pod-${sessionId as string}`;
    });
    mockStreamPodLogs.mockImplementation(async (_pod, _ns, onLine) => {
      const sid = (_pod as string).replace("pod-", "");
      if (sid === "sess-a") onLineA = onLine as (line: string) => void;
      if (sid === "sess-b") onLineB = onLine as (line: string) => void;
      return vi.fn();
    });

    const ws = simulateConnection(wss);
    await new Promise((r) => setTimeout(r, 10));

    ws.emit("message", JSON.stringify({ type: "subscribe", sessionId: "sess-a" }));
    ws.emit("message", JSON.stringify({ type: "subscribe", sessionId: "sess-b" }));
    await new Promise((r) => setTimeout(r, 30));

    // Inject a log line for sess-a only
    onLineA!("log from a");

    const logMsgs = ws.sent
      .map((s) => JSON.parse(s) as Record<string, unknown>)
      .filter((m) => m.type === "log-line");

    expect(logMsgs).toHaveLength(1);
    expect(logMsgs[0].sessionId).toBe("sess-a");
    expect(logMsgs[0].line).toBe("log from a");
  });

  it("AC-L4: findPodForSession throwing sends stream-error to client", async () => {
    mockFindPodForSession.mockRejectedValue(new Error("k8s API unreachable"));

    const ws = simulateConnection(wss);
    await new Promise((r) => setTimeout(r, 10));

    ws.emit("message", JSON.stringify({ type: "subscribe", sessionId: "sess-throw" }));
    await new Promise((r) => setTimeout(r, 30));

    const errMsg = findMessage(ws, "stream-error");
    expect(errMsg).toBeDefined();
    expect(errMsg!.sessionId).toBe("sess-throw");
    expect(String(errMsg!.message)).toMatch(/k8s API unreachable/i);
  });

  it("AC-L5: connection with no matching session cookie key is rejected with 1008", async () => {
    // Cookie header present but doesn't contain 'odin_session' key
    const ws = simulateConnection(wss, "other_cookie=some-value");

    const errMsg = findMessage(ws, "error");
    expect(errMsg).toBeDefined();
    expect(String(errMsg!.message)).toMatch(/Unauthorized/i);
    expect(ws.closeCode).toBe(1008);
  });
});
