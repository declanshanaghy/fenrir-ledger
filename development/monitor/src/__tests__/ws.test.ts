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
