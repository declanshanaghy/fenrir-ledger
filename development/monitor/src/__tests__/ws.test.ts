import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { IncomingMessage, Server } from "node:http";
import { EventEmitter } from "node:events";

// ── Minimal WebSocket fakes ──────────────────────────────────────────────────

class FakeWs extends EventEmitter {
  readyState = 1; // OPEN
  sent: string[] = [];
  closeCode?: number;
  closeReason?: string;

  send(data: string) {
    this.sent.push(data);
  }

  close(code?: number, reason?: string) {
    this.closeCode = code;
    this.closeReason = reason;
    this.readyState = 3; // CLOSED
  }

  static readonly OPEN = 1;
}

class FakeWss extends EventEmitter {
  constructor(_opts: unknown) {
    super();
  }
}

// ── Mock dependencies ────────────────────────────────────────────────────────

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

// Mock auth so WS connections are always treated as authenticated
vi.mock("../auth.js", () => ({
  SESSION_COOKIE: "odin_session",
  verifySessionToken: vi.fn().mockReturnValue("test@example.com"),
}));

// ── Import after mocks ───────────────────────────────────────────────────────

const { attachWebSocketServer } = await import("../ws.js");
const { verifySessionToken: mockVerifySessionToken } = await import("../auth.js");

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Simulate a WebSocket connection and return the fake WS instance. */
function simulateConnection(
  wss: FakeWss,
  cookie = "odin_session=test-token"
): FakeWs {
  const fakeWs = new FakeWs();
  const fakeReq = {
    url: "/ws",
    headers: { cookie },
  } as unknown as IncomingMessage;
  wss.emit("connection", fakeWs, fakeReq);
  return fakeWs;
}

function parseSent(ws: FakeWs, index = 0) {
  return JSON.parse(ws.sent[index]) as Record<string, unknown>;
}

function findMessage(ws: FakeWs, type: string) {
  return ws.sent
    .map((s) => JSON.parse(s) as Record<string, unknown>)
    .find((m) => m.type === type);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("attachWebSocketServer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockVerifySessionToken).mockReturnValue("test@example.com");
    mockWatchAgentJobs.mockReturnValue(vi.fn());
    mockListAgentJobs.mockResolvedValue([]);
    mockMapAgentJobToJob.mockImplementation((j) => j);
  });

  it("returns a WebSocketServer instance", () => {
    const fakeServer = new EventEmitter() as unknown as Server;
    const wss = attachWebSocketServer(fakeServer as unknown);
    expect(wss).toBeInstanceOf(FakeWss);
  });

  it("starts the K8s job watch on creation", () => {
    const fakeServer = new EventEmitter() as unknown as Server;
    attachWebSocketServer(fakeServer as unknown);
    expect(mockWatchAgentJobs).toHaveBeenCalledTimes(1);
  });
});

describe("WebSocket connection handling", () => {
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects unauthenticated connections with error + close 1008", () => {
    vi.mocked(mockVerifySessionToken).mockReturnValue(null as unknown as string);
    const ws = simulateConnection(wss);
    const msg = parseSent(ws, 0);
    expect(msg.type).toBe("error");
    expect(msg.message).toMatch(/Unauthorized/i);
    expect(ws.closeCode).toBe(1008);
  });

  it("sends jobs-snapshot on connect", async () => {
    const ws = simulateConnection(wss);
    await new Promise((r) => setTimeout(r, 10));
    const snap = findMessage(ws, "jobs-snapshot");
    expect(snap).toBeDefined();
    expect(Array.isArray(snap!.jobs)).toBe(true);
    expect(typeof snap!.ts).toBe("number");
  });

  it("jobs-snapshot seeds from listAgentJobs when cache is empty", async () => {
    mockListAgentJobs.mockResolvedValue([{ name: "job-1", status: "active" }]);
    mockMapAgentJobToJob.mockReturnValue({ sessionId: "sess-1", name: "job-1", status: "running" });

    const ws = simulateConnection(wss);
    await new Promise((r) => setTimeout(r, 20));

    const snap = findMessage(ws, "jobs-snapshot");
    expect(snap).toBeDefined();
    expect((snap!.jobs as unknown[]).length).toBe(1);
  });
});

describe("K8s watch → jobs-updated broadcast", () => {
  let wss: FakeWss;
  let capturedOnUpdate: ((jobs: unknown[]) => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockVerifySessionToken).mockReturnValue("test@example.com");
    mockListAgentJobs.mockResolvedValue([]);
    mockMapAgentJobToJob.mockImplementation((j) => j);
    mockWatchAgentJobs.mockImplementation((_ns, _label, onUpdate) => {
      capturedOnUpdate = onUpdate as (jobs: unknown[]) => void;
      return vi.fn();
    });
    const fakeServer = new EventEmitter() as unknown as Server;
    wss = attachWebSocketServer(fakeServer as unknown) as unknown as FakeWss;
  });

  afterEach(() => vi.restoreAllMocks());

  it("broadcasts jobs-updated to all connected clients when watch fires", async () => {
    const ws1 = simulateConnection(wss);
    const ws2 = simulateConnection(wss);
    await new Promise((r) => setTimeout(r, 10));

    const updatedJobs = [{ sessionId: "s1", name: "job-1", status: "running" }];
    capturedOnUpdate!(updatedJobs);

    const msg1 = findMessage(ws1, "jobs-updated");
    const msg2 = findMessage(ws2, "jobs-updated");
    expect(msg1).toBeDefined();
    expect(msg2).toBeDefined();
    expect((msg1!.jobs as unknown[]).length).toBe(1);
  });

  it("does not send jobs-updated to closed clients", async () => {
    const ws = simulateConnection(wss);
    await new Promise((r) => setTimeout(r, 10));

    // Force the socket closed
    ws.readyState = 3;
    capturedOnUpdate!([{ sessionId: "s1", name: "job-1", status: "succeeded" }]);

    // Should not have thrown — and the only jobs-updated would be absent
    // (ws.sent had only jobs-snapshot since readyState was 3 when broadcast fired)
    const updatedMsgs = ws.sent
      .map((s) => JSON.parse(s) as Record<string, unknown>)
      .filter((m) => m.type === "jobs-updated");
    expect(updatedMsgs.length).toBe(0);
  });
});

describe("ping/pong keepalive", () => {
  let wss: FakeWss;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockVerifySessionToken).mockReturnValue("test@example.com");
    mockWatchAgentJobs.mockReturnValue(vi.fn());
    mockListAgentJobs.mockResolvedValue([]);
    const fakeServer = new EventEmitter() as unknown as Server;
    wss = attachWebSocketServer(fakeServer as unknown) as unknown as FakeWss;
  });

  afterEach(() => vi.restoreAllMocks());

  it("responds with pong when client sends ping", async () => {
    const ws = simulateConnection(wss);
    await new Promise((r) => setTimeout(r, 10));

    ws.emit("message", JSON.stringify({ type: "ping" }));

    const pong = findMessage(ws, "pong");
    expect(pong).toBeDefined();
  });
});

describe("subscribe / unsubscribe lifecycle", () => {
  let wss: FakeWss;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockVerifySessionToken).mockReturnValue("test@example.com");
    mockWatchAgentJobs.mockReturnValue(vi.fn());
    mockListAgentJobs.mockResolvedValue([]);
    const fakeServer = new EventEmitter() as unknown as Server;
    wss = attachWebSocketServer(fakeServer as unknown) as unknown as FakeWss;
  });

  afterEach(() => vi.restoreAllMocks());

  it("subscribe triggers log stream when pod is found", async () => {
    const cancelMock = vi.fn();
    mockFindPodForSession.mockResolvedValue("pod-abc");
    mockStreamPodLogs.mockResolvedValue(cancelMock);

    const ws = simulateConnection(wss);
    await new Promise((r) => setTimeout(r, 10));

    ws.emit("message", JSON.stringify({ type: "subscribe", sessionId: "sess-1" }));
    await new Promise((r) => setTimeout(r, 20));

    expect(mockFindPodForSession).toHaveBeenCalledWith("sess-1", expect.any(String));
    expect(mockStreamPodLogs).toHaveBeenCalledWith(
      "pod-abc",
      expect.any(String),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function)
    );
  });

  it("subscribe sends stream-error when no pod found", async () => {
    mockFindPodForSession.mockResolvedValue(null);

    const ws = simulateConnection(wss);
    await new Promise((r) => setTimeout(r, 10));

    ws.emit("message", JSON.stringify({ type: "subscribe", sessionId: "no-pod" }));
    await new Promise((r) => setTimeout(r, 20));

    const errMsg = findMessage(ws, "stream-error");
    expect(errMsg).toBeDefined();
    expect(errMsg!.sessionId).toBe("no-pod");
    expect(String(errMsg!.message)).toMatch(/no pod found/i);
  });

  it("duplicate subscribe for same sessionId is ignored", async () => {
    const cancelMock = vi.fn();
    mockFindPodForSession.mockResolvedValue("pod-abc");
    mockStreamPodLogs.mockResolvedValue(cancelMock);

    const ws = simulateConnection(wss);
    await new Promise((r) => setTimeout(r, 10));

    ws.emit("message", JSON.stringify({ type: "subscribe", sessionId: "sess-dup" }));
    await new Promise((r) => setTimeout(r, 20));
    ws.emit("message", JSON.stringify({ type: "subscribe", sessionId: "sess-dup" }));
    await new Promise((r) => setTimeout(r, 20));

    // streamPodLogs should only be called once
    expect(mockStreamPodLogs).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe cancels the stream and sends stream-end with reason=cancelled", async () => {
    const cancelMock = vi.fn();
    mockFindPodForSession.mockResolvedValue("pod-abc");
    mockStreamPodLogs.mockResolvedValue(cancelMock);

    const ws = simulateConnection(wss);
    await new Promise((r) => setTimeout(r, 10));

    ws.emit("message", JSON.stringify({ type: "subscribe", sessionId: "sess-cancel" }));
    await new Promise((r) => setTimeout(r, 20));

    ws.emit("message", JSON.stringify({ type: "unsubscribe", sessionId: "sess-cancel" }));

    expect(cancelMock).toHaveBeenCalledTimes(1);
    const endMsg = findMessage(ws, "stream-end");
    expect(endMsg).toBeDefined();
    expect(endMsg!.sessionId).toBe("sess-cancel");
    expect(endMsg!.reason).toBe("cancelled");
  });

  it("WS close cancels all active subscriptions", async () => {
    const cancelMock = vi.fn();
    mockFindPodForSession.mockResolvedValue("pod-abc");
    mockStreamPodLogs.mockResolvedValue(cancelMock);

    const ws = simulateConnection(wss);
    await new Promise((r) => setTimeout(r, 10));

    ws.emit("message", JSON.stringify({ type: "subscribe", sessionId: "sess-a" }));
    ws.emit("message", JSON.stringify({ type: "subscribe", sessionId: "sess-b" }));
    await new Promise((r) => setTimeout(r, 30));

    ws.emit("close");

    // Both subscriptions should be cancelled
    expect(cancelMock).toHaveBeenCalledTimes(2);
  });

  it("sends log-line messages from the stream to the subscriber", async () => {
    let capturedOnLine: ((line: string) => void) | undefined;
    mockFindPodForSession.mockResolvedValue("pod-abc");
    mockStreamPodLogs.mockImplementation(async (_pod, _ns, onLine) => {
      capturedOnLine = onLine as (line: string) => void;
      return vi.fn();
    });

    const ws = simulateConnection(wss);
    await new Promise((r) => setTimeout(r, 10));

    ws.emit("message", JSON.stringify({ type: "subscribe", sessionId: "sess-logs" }));
    await new Promise((r) => setTimeout(r, 20));

    capturedOnLine!("hello from pod");

    const logMsg = findMessage(ws, "log-line");
    expect(logMsg).toBeDefined();
    expect(logMsg!.sessionId).toBe("sess-logs");
    expect(logMsg!.line).toBe("hello from pod");
    expect(typeof logMsg!.ts).toBe("number");
  });

  it("sends stream-end with reason=completed when pod stream ends naturally", async () => {
    let capturedOnEnd: (() => void) | undefined;
    mockFindPodForSession.mockResolvedValue("pod-abc");
    mockStreamPodLogs.mockImplementation(async (_pod, _ns, _onLine, onEnd) => {
      capturedOnEnd = onEnd as () => void;
      return vi.fn();
    });

    const ws = simulateConnection(wss);
    await new Promise((r) => setTimeout(r, 10));

    ws.emit("message", JSON.stringify({ type: "subscribe", sessionId: "sess-end" }));
    await new Promise((r) => setTimeout(r, 20));

    capturedOnEnd!();

    const endMsg = findMessage(ws, "stream-end");
    expect(endMsg).toBeDefined();
    expect(endMsg!.sessionId).toBe("sess-end");
    expect(endMsg!.reason).toBe("completed");
  });

  it("sends stream-error when pod stream emits an error", async () => {
    let capturedOnError: ((err: Error) => void) | undefined;
    mockFindPodForSession.mockResolvedValue("pod-abc");
    mockStreamPodLogs.mockImplementation(async (_pod, _ns, _onLine, _onEnd, onError) => {
      capturedOnError = onError as (err: Error) => void;
      return vi.fn();
    });

    const ws = simulateConnection(wss);
    await new Promise((r) => setTimeout(r, 10));

    ws.emit("message", JSON.stringify({ type: "subscribe", sessionId: "sess-err" }));
    await new Promise((r) => setTimeout(r, 20));

    capturedOnError!(new Error("pod exploded"));

    const errMsg = findMessage(ws, "stream-error");
    expect(errMsg).toBeDefined();
    expect(errMsg!.sessionId).toBe("sess-err");
    expect(errMsg!.message).toBe("pod exploded");
  });

  it("sends verdict PASS when agent outputs PASS verdict before stream ends", async () => {
    let capturedOnLine: ((line: string) => void) | undefined;
    let capturedOnEnd: (() => void) | undefined;
    mockFindPodForSession.mockResolvedValue("pod-abc");
    mockStreamPodLogs.mockImplementation(async (_pod, _ns, onLine, onEnd) => {
      capturedOnLine = onLine as (line: string) => void;
      capturedOnEnd = onEnd as () => void;
      return vi.fn();
    });

    const ws = simulateConnection(wss);
    await new Promise((r) => setTimeout(r, 10));

    ws.emit("message", JSON.stringify({ type: "subscribe", sessionId: "sess-verdict" }));
    await new Promise((r) => setTimeout(r, 20));

    // Feed a PASS verdict line (JSONL assistant event with verdict text)
    capturedOnLine!(
      JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "text", text: "**Verdict:** PASS — all tests green" }] },
      })
    );
    capturedOnEnd!();

    const verdictMsg = findMessage(ws, "verdict");
    expect(verdictMsg).toBeDefined();
    expect(verdictMsg!.sessionId).toBe("sess-verdict");
    expect(verdictMsg!.result).toBe("PASS");
  });

  it("sends verdict FAIL when agent outputs FAIL verdict", async () => {
    let capturedOnLine: ((line: string) => void) | undefined;
    let capturedOnEnd: (() => void) | undefined;
    mockFindPodForSession.mockResolvedValue("pod-abc");
    mockStreamPodLogs.mockImplementation(async (_pod, _ns, onLine, onEnd) => {
      capturedOnLine = onLine as (line: string) => void;
      capturedOnEnd = onEnd as () => void;
      return vi.fn();
    });

    const ws = simulateConnection(wss);
    await new Promise((r) => setTimeout(r, 10));

    ws.emit("message", JSON.stringify({ type: "subscribe", sessionId: "sess-fail" }));
    await new Promise((r) => setTimeout(r, 20));

    capturedOnLine!(
      JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "text", text: "**Verdict:** FAIL — tests failed" }] },
      })
    );
    capturedOnEnd!();

    const verdictMsg = findMessage(ws, "verdict");
    expect(verdictMsg).toBeDefined();
    expect(verdictMsg!.result).toBe("FAIL");
  });

  it("does not send verdict when stream ends with no JSONL events", async () => {
    let capturedOnEnd: (() => void) | undefined;
    mockFindPodForSession.mockResolvedValue("pod-abc");
    mockStreamPodLogs.mockImplementation(async (_pod, _ns, _onLine, onEnd) => {
      capturedOnEnd = onEnd as () => void;
      return vi.fn();
    });

    const ws = simulateConnection(wss);
    await new Promise((r) => setTimeout(r, 10));

    ws.emit("message", JSON.stringify({ type: "subscribe", sessionId: "sess-no-verdict" }));
    await new Promise((r) => setTimeout(r, 20));

    capturedOnEnd!();

    const verdictMsg = findMessage(ws, "verdict");
    expect(verdictMsg).toBeUndefined();
  });

  it("does not throw when sending log-line to a closed WebSocket", async () => {
    let capturedOnLine: ((line: string) => void) | undefined;
    mockFindPodForSession.mockResolvedValue("pod-abc");
    mockStreamPodLogs.mockImplementation(async (_pod, _ns, onLine) => {
      capturedOnLine = onLine as (line: string) => void;
      return vi.fn();
    });

    const ws = simulateConnection(wss);
    await new Promise((r) => setTimeout(r, 10));

    ws.emit("message", JSON.stringify({ type: "subscribe", sessionId: "sess-closed" }));
    await new Promise((r) => setTimeout(r, 20));

    ws.readyState = 3; // CLOSED
    expect(() => capturedOnLine!("line after close")).not.toThrow();
  });

  it("sends error message for invalid JSON from client", async () => {
    const ws = simulateConnection(wss);
    await new Promise((r) => setTimeout(r, 10));

    ws.emit("message", "not valid json");

    const errMsg = findMessage(ws, "error");
    expect(errMsg).toBeDefined();
    expect(String(errMsg!.message)).toMatch(/Invalid JSON/i);
  });
});

describe("client deregistered on disconnect", () => {
  let wss: FakeWss;
  let capturedOnUpdate: ((jobs: unknown[]) => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockVerifySessionToken).mockReturnValue("test@example.com");
    mockListAgentJobs.mockResolvedValue([]);
    mockWatchAgentJobs.mockImplementation((_ns, _label, onUpdate) => {
      capturedOnUpdate = onUpdate as (jobs: unknown[]) => void;
      return vi.fn();
    });
    const fakeServer = new EventEmitter() as unknown as Server;
    wss = attachWebSocketServer(fakeServer as unknown) as unknown as FakeWss;
  });

  afterEach(() => vi.restoreAllMocks());

  it("closed client no longer receives jobs-updated after disconnect", async () => {
    const ws = simulateConnection(wss);
    await new Promise((r) => setTimeout(r, 10));

    // Disconnect
    ws.emit("close");

    // Now trigger an update — the closed client should not be in the set
    const sentBefore = ws.sent.length;
    capturedOnUpdate!([{ sessionId: "s1" }]);
    expect(ws.sent.length).toBe(sentBefore); // no new messages
  });
});
