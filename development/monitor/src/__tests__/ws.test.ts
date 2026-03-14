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

vi.mock("../k8s.js", () => ({
  findPodForSession: mockFindPodForSession,
  streamPodLogs: mockStreamPodLogs,
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

/**
 * Simulate a WebSocket connection with the given URL path and return
 * the fake WebSocket instance used for assertions.
 */
function simulateConnection(
  wss: FakeWss,
  urlPath: string,
  cookie = "odin_session=test-token"
): FakeWs {
  const fakeWs = new FakeWs();
  const fakeReq = {
    url: urlPath,
    headers: { cookie },
  } as unknown as IncomingMessage;
  wss.emit("connection", fakeWs, fakeReq);
  return fakeWs;
}

function parseSent(ws: FakeWs, index = 0) {
  return JSON.parse(ws.sent[index]) as Record<string, unknown>;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("attachWebSocketServer", () => {
  let fakeServer: Server;
  let wss: FakeWss;

  beforeEach(() => {
    vi.clearAllMocks();
    fakeServer = new EventEmitter() as unknown as Server;
    wss = attachWebSocketServer(fakeServer as unknown) as unknown as FakeWss;
  });

  it("returns a WebSocketServer instance", () => {
    expect(wss).toBeInstanceOf(FakeWss);
  });
});

describe("WebSocket connection handling", () => {
  let fakeServer: Server;
  let wss: FakeWss;

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply after clearAllMocks wipes implementations
    vi.mocked(mockVerifySessionToken).mockReturnValue("test@example.com");
    fakeServer = new EventEmitter() as unknown as Server;
    wss = attachWebSocketServer(fakeServer as unknown) as unknown as FakeWss;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("missing sessionId", () => {
    it("sends error message when URL has no sessionId segment", () => {
      const ws = simulateConnection(wss, "/ws/logs");
      const msg = parseSent(ws, 0);
      expect(msg.type).toBe("error");
      expect(msg.message).toMatch(/Missing sessionId/i);
    });

    it("closes connection with code 1008 when sessionId is absent", () => {
      const ws = simulateConnection(wss, "/ws/logs");
      expect(ws.closeCode).toBe(1008);
    });

    it("sends error for root path with no session", () => {
      const ws = simulateConnection(wss, "/");
      const msg = parseSent(ws, 0);
      expect(msg.type).toBe("error");
    });
  });

  describe("valid sessionId — pod not found", () => {
    it("sends connected message immediately on valid sessionId", async () => {
      mockFindPodForSession.mockResolvedValue(null);

      const ws = simulateConnection(wss, "/ws/logs/abc123");
      // First message is the synchronous 'connected' acknowledgement
      const msg = parseSent(ws, 0);
      expect(msg.type).toBe("connected");
      expect(msg.sessionId).toBe("abc123");
    });

    it("sends error + closes when pod is not found", async () => {
      mockFindPodForSession.mockResolvedValue(null);

      const ws = simulateConnection(wss, "/ws/logs/missing-session");
      // Await micro-task queue so async startStream resolves
      await new Promise((r) => setTimeout(r, 10));

      const errorMsg = ws.sent.find((s) => {
        const p = JSON.parse(s) as Record<string, unknown>;
        return p.type === "error";
      });
      expect(errorMsg).toBeDefined();
      const parsed = JSON.parse(errorMsg!) as Record<string, unknown>;
      expect(parsed.message).toMatch(/missing-session/);
      expect(ws.closeCode).toBe(1011);
    });
  });

  describe("valid sessionId — successful log stream", () => {
    it("calls streamPodLogs with pod name when pod is found", async () => {
      const cancelMock = vi.fn();
      mockFindPodForSession.mockResolvedValue("pod-abc");
      mockStreamPodLogs.mockResolvedValue(cancelMock);

      simulateConnection(wss, "/ws/logs/session-xyz");
      await new Promise((r) => setTimeout(r, 10));

      expect(mockStreamPodLogs).toHaveBeenCalledWith(
        "pod-abc",
        undefined,
        expect.any(Function), // onLine
        expect.any(Function), // onEnd
        expect.any(Function)  // onError
      );
    });

    it("cancels stream when WebSocket closes", async () => {
      const cancelMock = vi.fn();
      mockFindPodForSession.mockResolvedValue("pod-abc");
      mockStreamPodLogs.mockResolvedValue(cancelMock);

      const ws = simulateConnection(wss, "/ws/logs/session-xyz");
      await new Promise((r) => setTimeout(r, 10));

      ws.emit("close");
      expect(cancelMock).toHaveBeenCalledTimes(1);
    });

    it("cancels stream on WebSocket error", async () => {
      const cancelMock = vi.fn();
      mockFindPodForSession.mockResolvedValue("pod-abc");
      mockStreamPodLogs.mockResolvedValue(cancelMock);

      const ws = simulateConnection(wss, "/ws/logs/session-xyz");
      await new Promise((r) => setTimeout(r, 10));

      ws.emit("error", new Error("socket error"));
      expect(cancelMock).toHaveBeenCalledTimes(1);
    });

    it("sends log lines received from the stream", async () => {
      let capturedOnLine: ((line: string) => void) | undefined;
      mockFindPodForSession.mockResolvedValue("pod-abc");
      mockStreamPodLogs.mockImplementation(
        async (_pod, _ns, onLine) => {
          capturedOnLine = onLine as (line: string) => void;
          return vi.fn();
        }
      );

      const ws = simulateConnection(wss, "/ws/logs/session-live");
      await new Promise((r) => setTimeout(r, 10));

      capturedOnLine!("hello world log line");
      const logMsg = ws.sent.find((s) => {
        const p = JSON.parse(s) as Record<string, unknown>;
        return p.type === "log";
      });
      expect(logMsg).toBeDefined();
      const parsed = JSON.parse(logMsg!) as Record<string, unknown>;
      expect(parsed.line).toBe("hello world log line");
      expect(typeof parsed.ts).toBe("number");
    });

    it("sends end message when stream completes", async () => {
      let capturedOnEnd: (() => void) | undefined;
      mockFindPodForSession.mockResolvedValue("pod-abc");
      mockStreamPodLogs.mockImplementation(
        async (_pod, _ns, _onLine, onEnd) => {
          capturedOnEnd = onEnd as () => void;
          return vi.fn();
        }
      );

      const ws = simulateConnection(wss, "/ws/logs/session-end");
      await new Promise((r) => setTimeout(r, 10));

      capturedOnEnd!();
      const endMsg = ws.sent.find((s) => JSON.parse(s).type === "end");
      expect(endMsg).toBeDefined();
    });

    it("sends error message when stream errors", async () => {
      let capturedOnError: ((err: Error) => void) | undefined;
      mockFindPodForSession.mockResolvedValue("pod-abc");
      mockStreamPodLogs.mockImplementation(
        async (_pod, _ns, _onLine, _onEnd, onError) => {
          capturedOnError = onError as (err: Error) => void;
          return vi.fn();
        }
      );

      const ws = simulateConnection(wss, "/ws/logs/session-err");
      await new Promise((r) => setTimeout(r, 10));

      capturedOnError!(new Error("stream failed"));
      const errMsg = ws.sent.find((s) => JSON.parse(s).type === "error");
      expect(errMsg).toBeDefined();
      const parsed = JSON.parse(errMsg!) as Record<string, unknown>;
      expect(parsed.message).toBe("stream failed");
    });
  });

  describe("message not sent to closed socket", () => {
    it("does not throw when sending to a closed WebSocket", async () => {
      let capturedOnLine: ((line: string) => void) | undefined;
      mockFindPodForSession.mockResolvedValue("pod-abc");
      mockStreamPodLogs.mockImplementation(
        async (_pod, _ns, onLine) => {
          capturedOnLine = onLine as (line: string) => void;
          return vi.fn();
        }
      );

      const ws = simulateConnection(wss, "/ws/logs/session-closed");
      await new Promise((r) => setTimeout(r, 10));

      // Force close the socket
      ws.readyState = 3; // CLOSED
      // This should not throw
      expect(() => capturedOnLine!("line after close")).not.toThrow();
      // The line should NOT have been sent
      const logSent = ws.sent.some((s) => {
        const p = JSON.parse(s) as Record<string, unknown>;
        return p.type === "log";
      });
      expect(logSent).toBe(false);
    });
  });
});

// ── Structured JSONL event dispatch ─────────────────────────────────────────

describe("structured JSONL event dispatch", () => {
  let fakeServer: ReturnType<typeof EventEmitter>;
  let wss: FakeWss;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockVerifySessionToken).mockReturnValue("test@example.com");
    fakeServer = new EventEmitter();
    wss = attachWebSocketServer(fakeServer as unknown) as unknown as FakeWss;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits turn_start when an assistant JSONL event arrives", async () => {
    let capturedOnLine: ((line: string) => void) | undefined;
    mockFindPodForSession.mockResolvedValue("pod-abc");
    mockStreamPodLogs.mockImplementation(async (_pod, _ns, onLine) => {
      capturedOnLine = onLine as (line: string) => void;
      return vi.fn();
    });

    const ws = simulateConnection(wss, "/ws/logs/sess-turns");
    await new Promise((r) => setTimeout(r, 10));

    const assistantEvent = JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "text", text: "Hello" }] },
    });
    capturedOnLine!(assistantEvent);

    const turnMsg = ws.sent.find((s) => {
      const p = JSON.parse(s) as Record<string, unknown>;
      return p.type === "turn_start";
    });
    expect(turnMsg).toBeDefined();
    const parsed = JSON.parse(turnMsg!) as Record<string, unknown>;
    expect(parsed.turnNum).toBe(1);
  });

  it("emits tool_call when assistant event contains tool_use block", async () => {
    let capturedOnLine: ((line: string) => void) | undefined;
    mockFindPodForSession.mockResolvedValue("pod-abc");
    mockStreamPodLogs.mockImplementation(async (_pod, _ns, onLine) => {
      capturedOnLine = onLine as (line: string) => void;
      return vi.fn();
    });

    const ws = simulateConnection(wss, "/ws/logs/sess-tools");
    await new Promise((r) => setTimeout(r, 10));

    const assistantEvent = JSON.stringify({
      type: "assistant",
      message: {
        content: [
          { type: "tool_use", id: "tid-1", name: "Bash", input: { command: "ls" } },
        ],
      },
    });
    capturedOnLine!(assistantEvent);

    const toolMsg = ws.sent.find((s) => {
      const p = JSON.parse(s) as Record<string, unknown>;
      return p.type === "tool_call";
    });
    expect(toolMsg).toBeDefined();
    const parsed = JSON.parse(toolMsg!) as Record<string, unknown>;
    expect(parsed.toolName).toBe("Bash");
    expect(parsed.toolId).toBe("tid-1");
    expect((parsed.input as Record<string, unknown>).command).toBe("ls");
  });

  it("emits tool_result when user event contains tool_result block", async () => {
    let capturedOnLine: ((line: string) => void) | undefined;
    mockFindPodForSession.mockResolvedValue("pod-abc");
    mockStreamPodLogs.mockImplementation(async (_pod, _ns, onLine) => {
      capturedOnLine = onLine as (line: string) => void;
      return vi.fn();
    });

    const ws = simulateConnection(wss, "/ws/logs/sess-results");
    await new Promise((r) => setTimeout(r, 10));

    const userEvent = JSON.stringify({
      type: "user",
      message: {
        content: [
          {
            type: "tool_result",
            tool_use_id: "tid-1",
            content: "/workspace",
            is_error: false,
          },
        ],
      },
    });
    capturedOnLine!(userEvent);

    const resultMsg = ws.sent.find((s) => {
      const p = JSON.parse(s) as Record<string, unknown>;
      return p.type === "tool_result";
    });
    expect(resultMsg).toBeDefined();
    const parsed = JSON.parse(resultMsg!) as Record<string, unknown>;
    expect(parsed.toolId).toBe("tid-1");
    expect(parsed.content).toBe("/workspace");
    expect(parsed.isError).toBe(false);
  });

  it("still sends raw log message for every line", async () => {
    let capturedOnLine: ((line: string) => void) | undefined;
    mockFindPodForSession.mockResolvedValue("pod-abc");
    mockStreamPodLogs.mockImplementation(async (_pod, _ns, onLine) => {
      capturedOnLine = onLine as (line: string) => void;
      return vi.fn();
    });

    const ws = simulateConnection(wss, "/ws/logs/sess-raw");
    await new Promise((r) => setTimeout(r, 10));

    capturedOnLine!("plain text line");

    const logMsg = ws.sent.find((s) => {
      const p = JSON.parse(s) as Record<string, unknown>;
      return p.type === "log" && p.line === "plain text line";
    });
    expect(logMsg).toBeDefined();
  });

  it("emits verdict message when stream ends and verdict text is present", async () => {
    let capturedOnLine: ((line: string) => void) | undefined;
    let capturedOnEnd: (() => void) | undefined;
    mockFindPodForSession.mockResolvedValue("pod-abc");
    mockStreamPodLogs.mockImplementation(async (_pod, _ns, onLine, onEnd) => {
      capturedOnLine = onLine as (line: string) => void;
      capturedOnEnd = onEnd as () => void;
      return vi.fn();
    });

    const ws = simulateConnection(wss, "/ws/logs/sess-verdict");
    await new Promise((r) => setTimeout(r, 10));

    // Send an assistant event with a PASS verdict
    capturedOnLine!(
      JSON.stringify({
        type: "assistant",
        message: {
          content: [{ type: "text", text: "**Verdict:** PASS — all tests green" }],
        },
      })
    );

    // End the stream
    capturedOnEnd!();

    const verdictMsg = ws.sent.find((s) => {
      const p = JSON.parse(s) as Record<string, unknown>;
      return p.type === "verdict";
    });
    expect(verdictMsg).toBeDefined();
    const parsed = JSON.parse(verdictMsg!) as Record<string, unknown>;
    expect(parsed.pass).toBe(true);
  });

  it("emits report message when stream ends and events are present", async () => {
    let capturedOnLine: ((line: string) => void) | undefined;
    let capturedOnEnd: (() => void) | undefined;
    mockFindPodForSession.mockResolvedValue("pod-abc");
    mockStreamPodLogs.mockImplementation(async (_pod, _ns, onLine, onEnd) => {
      capturedOnLine = onLine as (line: string) => void;
      capturedOnEnd = onEnd as () => void;
      return vi.fn();
    });

    const ws = simulateConnection(wss, "/ws/logs/sess-report");
    await new Promise((r) => setTimeout(r, 10));

    capturedOnLine!(
      JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "text", text: "doing work" }] },
      })
    );

    capturedOnEnd!();

    const reportMsg = ws.sent.find((s) => {
      const p = JSON.parse(s) as Record<string, unknown>;
      return p.type === "report";
    });
    expect(reportMsg).toBeDefined();
    const parsed = JSON.parse(reportMsg!) as Record<string, unknown>;
    expect(typeof parsed.html).toBe("string");
    expect(parsed.html as string).toContain("<!DOCTYPE html>");
  });

  it("does not emit report when stream ends with no JSONL events", async () => {
    let capturedOnEnd: (() => void) | undefined;
    mockFindPodForSession.mockResolvedValue("pod-abc");
    mockStreamPodLogs.mockImplementation(async (_pod, _ns, _onLine, onEnd) => {
      capturedOnEnd = onEnd as () => void;
      return vi.fn();
    });

    const ws = simulateConnection(wss, "/ws/logs/sess-empty");
    await new Promise((r) => setTimeout(r, 10));

    capturedOnEnd!();

    const reportMsg = ws.sent.find((s) => {
      const p = JSON.parse(s) as Record<string, unknown>;
      return p.type === "report";
    });
    expect(reportMsg).toBeUndefined();
  });

  it("emits end message after stream completes", async () => {
    let capturedOnEnd: (() => void) | undefined;
    mockFindPodForSession.mockResolvedValue("pod-abc");
    mockStreamPodLogs.mockImplementation(async (_pod, _ns, _onLine, onEnd) => {
      capturedOnEnd = onEnd as () => void;
      return vi.fn();
    });

    const ws = simulateConnection(wss, "/ws/logs/sess-end2");
    await new Promise((r) => setTimeout(r, 10));

    capturedOnEnd!();

    const endMsg = ws.sent.find((s) => JSON.parse(s).type === "end");
    expect(endMsg).toBeDefined();
  });
});
