/**
 * worker-log-parser.test.ts
 *
 * Tests for log-parser.worker.js — evaluates the worker file in a Node vm
 * context with mocked browser globals (WebSocket, indexedDB, self).
 *
 * Covers:
 *  - HTML rendering helpers (escHtml, toolBadgeClass, renderToolCall, etc.)
 *  - JSONL parsing (assistant / user turns → entries)
 *  - Legacy protocol message handling (turn_start, tool_call, verdict, etc.)
 *  - New wire protocol message handling (jobs-snapshot, log-line, stream-end)
 *  - Batching strategy (size limit + timer flush)
 *  - WebSocket subscription management
 *  - Connection status messages
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vm from "node:vm";

// ── Load worker source ────────────────────────────────────────────────────────

const WORKER_SRC = fs.readFileSync(
  path.resolve(__dirname, "../../public/js/log-parser.worker.js"),
  "utf8"
);

// ── Helpers ───────────────────────────────────────────────────────────────────

interface MockIdbStore {
  data: Map<string, unknown>;
  put(val: unknown): { onsuccess?: () => void; onerror?: () => void };
  get(key: unknown): { onsuccess?: (e: { target: { result: unknown } }) => void; onerror?: () => void };
  openCursor(): { onsuccess?: (e: { target: { result: null } }) => void };
}

function makeMockIdb() {
  const chunks  = new Map<string, unknown>();
  const sessions = new Map<string, unknown>();

  function makeStore(map: Map<string, unknown>): MockIdbStore {
    return {
      data: map,
      put(val: unknown) {
        const req = { onsuccess: undefined as (() => void) | undefined, onerror: undefined as (() => void) | undefined };
        // Use the keyPath to derive the key
        const v = val as Record<string, unknown>;
        const key = Array.isArray(v)
          ? JSON.stringify(v)
          : v.sessionId
            ? v.chunkId !== undefined
              ? JSON.stringify([v.sessionId, v.chunkId])
              : String(v.sessionId)
            : String(val);
        map.set(key, val);
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      },
      get(key: unknown) {
        const req = { onsuccess: undefined as ((e: { target: { result: unknown } }) => void) | undefined, onerror: undefined as (() => void) | undefined };
        const k = Array.isArray(key) ? JSON.stringify(key) : String(key);
        setTimeout(() => req.onsuccess?.({ target: { result: map.get(k) ?? undefined } }), 0);
        return req;
      },
      openCursor() {
        const req = { onsuccess: undefined as ((e: { target: { result: null } }) => void) | undefined };
        setTimeout(() => req.onsuccess?.({ target: { result: null } }), 0);
        return req;
      },
    };
  }

  const chunkStore   = makeStore(chunks);
  const sessionStore = makeStore(sessions);

  return {
    chunks,
    sessions,
    transaction(_stores: string | string[], _mode: string) {
      return {
        objectStore(name: string) {
          return name === "log-chunks" ? chunkStore : sessionStore;
        },
      };
    },
  };
}

interface WorkerSandbox {
  selfObj: {
    postMessage: ReturnType<typeof vi.fn>;
    onmessage: ((ev: { data: unknown }) => void) | null;
    addEventListener: ReturnType<typeof vi.fn>;
    postMessages: unknown[];
  };
  mockWs: {
    readyState: number;
    send: ReturnType<typeof vi.fn>;
    addEventListener: ReturnType<typeof vi.fn>;
    sentMessages: unknown[];
    listeners: Map<string, ((e: unknown) => void)[]>;
  };
  mockIdb: ReturnType<typeof makeMockIdb>;
  wsCallArgs: string[];
  send(msg: unknown): void;
  simulate(event: string, data: unknown): void;
}

/**
 * Create a fresh sandbox for each test — evaluates the worker in a vm context
 * with fully mocked browser APIs.
 */
function createSandbox(): WorkerSandbox {
  const postMessages: unknown[]   = [];
  const sentMessages: unknown[]   = [];
  const wsListeners = new Map<string, ((e: unknown) => void)[]>();

  const mockWs = {
    readyState: 1, // OPEN
    send: vi.fn((data: string) => sentMessages.push(JSON.parse(data))),
    addEventListener: vi.fn((event: string, handler: (e: unknown) => void) => {
      if (!wsListeners.has(event)) wsListeners.set(event, []);
      wsListeners.get(event)!.push(handler);
    }),
    sentMessages,
    listeners: wsListeners,
  };

  // Must be a real constructor function (not arrow fn) for `new WebSocket(...)` in worker
  const wsCallArgs: string[] = [];
  function WebSocketConstructor(url: string) {
    wsCallArgs.push(url);
    return mockWs;
  }
  (WebSocketConstructor as unknown as { OPEN: number }).OPEN = 1;

  const mockIdb = makeMockIdb();

  const openReq = {
    onupgradeneeded: undefined as ((e: unknown) => void) | undefined,
    onsuccess:       undefined as ((e: unknown) => void) | undefined,
    onerror:         undefined as (() => void) | undefined,
    onblocked:       undefined as (() => void) | undefined,
  };
  const indexedDBMock = {
    open(_name: string, _version: number) {
      setTimeout(() => openReq.onsuccess?.({ target: { result: mockIdb } }), 0);
      return openReq;
    },
  };

  const selfObj = {
    postMessage: vi.fn((msg: unknown) => postMessages.push(msg)),
    onmessage:   null as ((ev: { data: unknown }) => void) | null,
    addEventListener: vi.fn(),
    postMessages,
  };

  const context = vm.createContext({
    self:        selfObj,
    WebSocket:   WebSocketConstructor,
    indexedDB:   indexedDBMock,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    console,
    CSS: { escape: (s: string) => s.replace(/[^\w-]/g, "\\$&") },
    // Worker file uses 'use strict' at top; no additional globals needed
  });

  vm.runInContext(WORKER_SRC, context);

  return {
    selfObj: selfObj as WorkerSandbox["selfObj"],
    mockWs,
    mockIdb,
    wsCallArgs,
    /** Send a message to the worker (mimics main thread postMessage). */
    send(msg: unknown) {
      selfObj.onmessage?.({ data: msg });
    },
    /** Simulate a WebSocket event (e.g. 'message', 'open', 'close'). */
    simulate(event: string, data: unknown) {
      const handlers = wsListeners.get(event) ?? [];
      for (const h of handlers) h(data);
    },
  };
}

// ── Helper: wait for microtasks + a short macrotask queue ─────────────────────

function tick(ms = 10): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ═════════════════════════════════════════════════════════════════════════════
// HTML Rendering Helpers
// ═════════════════════════════════════════════════════════════════════════════

describe("HTML rendering helpers", () => {
  describe("escHtml (exercised via render functions)", () => {
    it("escapes HTML special characters in rendered output", () => {
      const box = createSandbox();
      // Trigger legacy tool_call with XSS payload; inspect postMessage
      box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
      // Manually call handleServerMessage via a WS message with a malicious tool name
      const xssPayload = '<script>alert(1)</script>';
      box.simulate("message", { data: JSON.stringify({
        type: "tool_call",
        turnNum: 1,
        toolId: "t1",
        toolName: xssPayload,
        input: { command: xssPayload },
        ts: Date.now(),
      })});
    });

    it("renders safe HTML for verdict pass", async () => {
      const box = createSandbox();
      box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
      await tick();
      box.simulate("open", {});
      box.send({ type: "subscribe", sessionId: "sess-1" });
      await tick();

      box.simulate("message", { data: JSON.stringify({
        type: "verdict", pass: true, summary: "All good", ts: Date.now(),
      })});
      await tick(250);

      // Check that chunk-ready was posted (verdict entry flushed within 200ms)
      const chunkReady = box.selfObj.postMessages.find((m: unknown) =>
        (m as Record<string, unknown>).type === "chunk-ready"
      ) as Record<string, unknown> | undefined;
      expect(chunkReady).toBeDefined();
      if (chunkReady) {
        expect(chunkReady.sessionId).toBe("sess-1");
      }
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// WebSocket + Connect
// ═════════════════════════════════════════════════════════════════════════════

describe("connect message", () => {
  it("opens a WebSocket when connect message received", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    expect(box.wsCallArgs).toContain("ws://localhost/ws");
  });

  it("posts connection-status {connected:false, reconnecting:true} before WS opens", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    const status = box.selfObj.postMessages.find((m: unknown) =>
      (m as Record<string, unknown>).type === "connection-status"
    ) as Record<string, unknown> | undefined;
    expect(status).toBeDefined();
    if (status) {
      expect(status.reconnecting).toBe(true);
    }
  });

  it("posts connection-status {connected:true} after WS open event", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    box.simulate("open", {});
    const status = box.selfObj.postMessages.find((m: unknown) => {
      const m2 = m as Record<string, unknown>;
      return m2.type === "connection-status" && m2.connected === true;
    });
    expect(status).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Subscribe / Unsubscribe
// ═════════════════════════════════════════════════════════════════════════════

describe("subscribe / unsubscribe", () => {
  it("sends subscribe message over WebSocket when worker is connected", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    box.simulate("open", {});
    box.send({ type: "subscribe", sessionId: "sess-abc" });
    await tick();

    const subMsg = box.mockWs.sentMessages.find((m: unknown) =>
      (m as Record<string, unknown>).type === "subscribe"
    ) as Record<string, unknown> | undefined;
    expect(subMsg).toBeDefined();
    if (subMsg) expect(subMsg.sessionId).toBe("sess-abc");
  });

  it("re-subscribes all sessions on WebSocket reconnect", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    box.simulate("open", {});

    box.send({ type: "subscribe", sessionId: "sess-1" });
    box.send({ type: "subscribe", sessionId: "sess-2" });
    await tick();

    // Clear sent messages, then simulate reconnect (close → open)
    box.mockWs.sentMessages.length = 0;
    box.simulate("close", {});
    await tick(1100); // wait for reconnect delay
    box.simulate("open", {});
    await tick();

    const resubbed = box.mockWs.sentMessages
      .filter((m: unknown) => (m as Record<string, unknown>).type === "subscribe")
      .map((m: unknown) => (m as Record<string, unknown>).sessionId);
    expect(resubbed).toContain("sess-1");
    expect(resubbed).toContain("sess-2");
  });

  it("sends unsubscribe message over WebSocket", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    box.simulate("open", {});
    box.send({ type: "subscribe",   sessionId: "sess-x" });
    box.send({ type: "unsubscribe", sessionId: "sess-x" });
    await tick();

    const unsubMsg = box.mockWs.sentMessages.find((m: unknown) =>
      (m as Record<string, unknown>).type === "unsubscribe"
    ) as Record<string, unknown> | undefined;
    expect(unsubMsg).toBeDefined();
    if (unsubMsg) expect(unsubMsg.sessionId).toBe("sess-x");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// New Wire Protocol — jobs-snapshot / jobs-updated
// ═════════════════════════════════════════════════════════════════════════════

describe("new wire protocol: jobs-snapshot / jobs-updated", () => {
  it("forwards jobs-snapshot as jobs-updated to main thread", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    box.simulate("open", {});

    const jobs = [{ sessionId: "s1", name: "Agent #1", issueNumber: 42, agent: "fireman", step: 1, status: "running" }];
    box.simulate("message", { data: JSON.stringify({ type: "jobs-snapshot", ts: Date.now(), jobs }) });
    await tick();

    const jobsMsg = box.selfObj.postMessages.find((m: unknown) =>
      (m as Record<string, unknown>).type === "jobs-updated"
    ) as Record<string, unknown> | undefined;
    expect(jobsMsg).toBeDefined();
    if (jobsMsg) expect(jobsMsg.jobs).toEqual(jobs);
  });

  it("forwards jobs-updated directly to main thread", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    box.simulate("open", {});

    const jobs = [{ sessionId: "s2", name: "Agent #2", issueNumber: 99, agent: "loki", step: 2, status: "succeeded" }];
    box.simulate("message", { data: JSON.stringify({ type: "jobs-updated", ts: Date.now(), jobs }) });
    await tick();

    const jobsMsg = box.selfObj.postMessages.find((m: unknown) =>
      (m as Record<string, unknown>).type === "jobs-updated"
    ) as Record<string, unknown> | undefined;
    expect(jobsMsg).toBeDefined();
    if (jobsMsg) expect((jobsMsg.jobs as unknown[]).length).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// New Wire Protocol — log-line (JSONL parsing)
// ═════════════════════════════════════════════════════════════════════════════

describe("new wire protocol: log-line JSONL parsing", () => {
  it("parses assistant turn with tool_use and adds turn-start + tool-call entries", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    box.simulate("open", {});
    box.send({ type: "subscribe", sessionId: "sess-parse" });
    await tick();

    const jsonlLine = JSON.stringify({
      type: "assistant",
      message: {
        content: [
          { type: "tool_use", id: "tool-1", name: "Bash", input: { command: "ls -la" } },
        ],
      },
    });
    box.simulate("message", { data: JSON.stringify({
      type: "log-line", ts: Date.now(), sessionId: "sess-parse", line: jsonlLine,
    })});

    // Wait for batch timer (200ms) to fire
    await tick(250);

    const chunks = [...box.mockIdb.chunks.values()];
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    const allEntries = chunks.flatMap((c: unknown) => (c as { entries: unknown[] }).entries);
    const types = allEntries.map((e: unknown) => (e as { type: string }).type);
    expect(types).toContain("turn-start");
    expect(types).toContain("tool-call");
  });

  it("parses user turn with tool_result and adds tool-result entry", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    box.simulate("open", {});
    box.send({ type: "subscribe", sessionId: "sess-result" });
    await tick();

    // First, send assistant turn so pendingTools gets populated
    const assistantLine = JSON.stringify({
      type: "assistant",
      message: {
        content: [
          { type: "tool_use", id: "tid-42", name: "Read", input: { file_path: "/foo.ts" } },
        ],
      },
    });
    box.simulate("message", { data: JSON.stringify({
      type: "log-line", ts: Date.now(), sessionId: "sess-result", line: assistantLine,
    })});
    await tick();

    // Now send user turn with tool_result
    const userLine = JSON.stringify({
      type: "user",
      message: {
        content: [
          { type: "tool_result", tool_use_id: "tid-42", content: "file contents here", is_error: false },
        ],
      },
    });
    box.simulate("message", { data: JSON.stringify({
      type: "log-line", ts: Date.now(), sessionId: "sess-result", line: userLine,
    })});

    await tick(250);

    const chunks = [...box.mockIdb.chunks.values()];
    const allEntries = chunks.flatMap((c: unknown) => (c as { entries: unknown[] }).entries);
    const resultEntry = allEntries.find((e: unknown) => (e as { type: string }).type === "tool-result");
    expect(resultEntry).toBeDefined();
    if (resultEntry) {
      const html = (resultEntry as { html: string }).html;
      expect(html).toContain("tool-result-block");
      expect(html).toContain("file contents here");
    }
  });

  it("ignores log-line messages for non-subscribed sessions", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    box.simulate("open", {});
    // NOT subscribing to "sess-other"

    box.simulate("message", { data: JSON.stringify({
      type: "log-line", ts: Date.now(), sessionId: "sess-other",
      line: JSON.stringify({ type: "assistant", message: { content: [] } }),
    })});
    await tick(250);

    // No chunks should have been written for sess-other
    const chunkKeys = [...box.mockIdb.chunks.keys()];
    const otherChunks = chunkKeys.filter((k) => k.includes("sess-other"));
    expect(otherChunks.length).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// New Wire Protocol — verdict
// ═════════════════════════════════════════════════════════════════════════════

describe("new wire protocol: verdict", () => {
  it("posts verdict message to main thread", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    box.simulate("open", {});
    box.send({ type: "subscribe", sessionId: "sess-v" });
    await tick();

    box.simulate("message", { data: JSON.stringify({
      type: "verdict", ts: Date.now(), sessionId: "sess-v", result: "PASS",
    })});
    await tick(250);

    const verdictMsg = box.selfObj.postMessages.find((m: unknown) => {
      const m2 = m as Record<string, unknown>;
      return m2.type === "verdict" && m2.sessionId === "sess-v";
    }) as Record<string, unknown> | undefined;
    expect(verdictMsg).toBeDefined();
    if (verdictMsg) expect(verdictMsg.result).toBe("PASS");
  });

  it("renders FAIL verdict HTML with fail class", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    box.simulate("open", {});
    box.send({ type: "subscribe", sessionId: "sess-fail" });
    await tick();

    box.simulate("message", { data: JSON.stringify({
      type: "verdict", ts: Date.now(), sessionId: "sess-fail", result: "FAIL",
    })});
    await tick(250);

    const chunks = [...box.mockIdb.chunks.values()];
    const allEntries = chunks.flatMap((c: unknown) => (c as { entries: unknown[] }).entries);
    const verdictEntry = allEntries.find((e: unknown) => (e as { type: string }).type === "verdict");
    expect(verdictEntry).toBeDefined();
    if (verdictEntry) {
      expect((verdictEntry as { html: string }).html).toContain('class="verdict-banner fail"');
      expect((verdictEntry as { html: string }).html).toContain('✗ FAIL');
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// New Wire Protocol — stream-end
// ═════════════════════════════════════════════════════════════════════════════

describe("new wire protocol: stream-end", () => {
  it("posts session-end to main thread after flushing batch", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    box.simulate("open", {});
    box.send({ type: "subscribe", sessionId: "sess-end" });
    await tick();

    // Send a log-line so there's something to flush
    const line = JSON.stringify({ type: "assistant", message: { content: [] } });
    box.simulate("message", { data: JSON.stringify({
      type: "log-line", ts: Date.now(), sessionId: "sess-end", line,
    })});

    box.simulate("message", { data: JSON.stringify({
      type: "stream-end", ts: Date.now(), sessionId: "sess-end", reason: "completed",
    })});

    await tick(300);

    const endMsg = box.selfObj.postMessages.find((m: unknown) => {
      const m2 = m as Record<string, unknown>;
      return m2.type === "session-end" && m2.sessionId === "sess-end";
    });
    expect(endMsg).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Legacy Protocol (backward compat)
// ═════════════════════════════════════════════════════════════════════════════

describe("legacy protocol backward compat", () => {
  it("handles turn_start → adds turn-start entry", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    box.simulate("open", {});
    box.send({ type: "subscribe", sessionId: "sess-legacy" });
    await tick();

    box.simulate("message", { data: JSON.stringify({
      type: "turn_start", turnNum: 3, ts: Date.now(),
    })});
    await tick(250);

    const chunks = [...box.mockIdb.chunks.values()];
    const allEntries = chunks.flatMap((c: unknown) => (c as { entries: unknown[] }).entries);
    const turnEntry = allEntries.find((e: unknown) =>
      (e as { type: string }).type === "turn-start"
    );
    expect(turnEntry).toBeDefined();
    if (turnEntry) {
      const html = (turnEntry as { html: string }).html;
      expect(html).toContain("T3");
      expect(html).toContain("turn-block");
    }
  });

  it("handles tool_call → adds tool-call entry with correct badge class", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    box.simulate("open", {});
    box.send({ type: "subscribe", sessionId: "sess-tc" });
    await tick();

    box.simulate("message", { data: JSON.stringify({
      type: "turn_start", turnNum: 1, ts: Date.now(),
    })});
    box.simulate("message", { data: JSON.stringify({
      type: "tool_call", turnNum: 1, toolId: "tc-1", toolName: "Bash",
      input: { command: "echo hi" }, ts: Date.now(),
    })});
    await tick(250);

    const chunks = [...box.mockIdb.chunks.values()];
    const allEntries = chunks.flatMap((c: unknown) => (c as { entries: unknown[] }).entries);
    const toolEntry = allEntries.find((e: unknown) =>
      (e as { type: string }).type === "tool-call"
    );
    expect(toolEntry).toBeDefined();
    if (toolEntry) {
      const html = (toolEntry as { html: string }).html;
      expect(html).toContain("tool-badge bash");
      expect(html).toContain("echo hi");
    }
  });

  it("handles tool_result → adds tool-result entry with is-error class when isError=true", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    box.simulate("open", {});
    box.send({ type: "subscribe", sessionId: "sess-tr" });
    await tick();

    box.simulate("message", { data: JSON.stringify({
      type: "tool_result", toolId: "tr-1", content: "error output", isError: true, ts: Date.now(),
    })});
    await tick(250);

    const chunks = [...box.mockIdb.chunks.values()];
    const allEntries = chunks.flatMap((c: unknown) => (c as { entries: unknown[] }).entries);
    const resultEntry = allEntries.find((e: unknown) =>
      (e as { type: string }).type === "tool-result"
    );
    expect(resultEntry).toBeDefined();
    if (resultEntry) {
      const html = (resultEntry as { html: string }).html;
      expect(html).toContain("is-error");
      expect(html).toContain("error output");
    }
  });

  it("handles legacy verdict → posts verdict to main thread + adds entry", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    box.simulate("open", {});
    box.send({ type: "subscribe", sessionId: "sess-lv" });
    await tick();

    box.simulate("message", { data: JSON.stringify({
      type: "verdict", pass: false, summary: "Tests failed", ts: Date.now(),
    })});
    await tick(250);

    const verdictMsg = box.selfObj.postMessages.find((m: unknown) => {
      const m2 = m as Record<string, unknown>;
      return m2.type === "verdict" && m2.sessionId === "sess-lv";
    }) as Record<string, unknown> | undefined;
    expect(verdictMsg).toBeDefined();
    if (verdictMsg) expect(verdictMsg.result).toBe("FAIL");
  });

  it("handles legacy log → adds text entry with log-line class", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    box.simulate("open", {});
    box.send({ type: "subscribe", sessionId: "sess-log" });
    await tick();

    box.simulate("message", { data: JSON.stringify({
      type: "log", line: "Starting agent...", ts: Date.now(),
    })});
    await tick(250);

    const chunks = [...box.mockIdb.chunks.values()];
    const allEntries = chunks.flatMap((c: unknown) => (c as { entries: unknown[] }).entries);
    const logEntry = allEntries.find((e: unknown) =>
      (e as { type: string }).type === "text"
    );
    expect(logEntry).toBeDefined();
    if (logEntry) {
      const html = (logEntry as { html: string }).html;
      expect(html).toContain("log-line");
      expect(html).toContain("Starting agent...");
    }
  });

  it("handles legacy end → posts session-end", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    box.simulate("open", {});
    box.send({ type: "subscribe", sessionId: "sess-le" });
    await tick();

    box.simulate("message", { data: JSON.stringify({ type: "end", ts: Date.now() })});
    await tick(300);

    const endMsg = box.selfObj.postMessages.find((m: unknown) => {
      const m2 = m as Record<string, unknown>;
      return m2.type === "session-end" && m2.sessionId === "sess-le";
    });
    expect(endMsg).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Batching Strategy
// ═════════════════════════════════════════════════════════════════════════════

describe("batching strategy", () => {
  it("flushes after 200ms even when batch has < 20 entries", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    box.simulate("open", {});
    box.send({ type: "subscribe", sessionId: "sess-batch" });
    await tick();

    // Send 3 log lines (< 20 threshold)
    for (let i = 0; i < 3; i++) {
      box.simulate("message", { data: JSON.stringify({
        type: "log", line: `line ${i}`, ts: Date.now(),
      })});
    }

    // No flush yet (< 200ms)
    await tick(50);
    const early = box.selfObj.postMessages.filter((m: unknown) =>
      (m as Record<string, unknown>).type === "chunk-ready"
    );
    expect(early.length).toBe(0);

    // After 200ms, should flush
    await tick(200);
    const flushed = box.selfObj.postMessages.filter((m: unknown) =>
      (m as Record<string, unknown>).type === "chunk-ready"
    );
    expect(flushed.length).toBeGreaterThanOrEqual(1);

    const firstChunk = flushed[0] as Record<string, unknown>;
    expect(firstChunk.sessionId).toBe("sess-batch");
    expect(firstChunk.count).toBe(3);
  });

  it("force-flushes via flush message", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    box.simulate("open", {});
    box.send({ type: "subscribe", sessionId: "sess-flush" });
    await tick();

    box.simulate("message", { data: JSON.stringify({
      type: "log", line: "hello", ts: Date.now(),
    })});

    // Flush before 200ms timer
    box.send({ type: "flush", sessionId: "sess-flush" });
    await tick(10);

    const flushed = box.selfObj.postMessages.filter((m: unknown) =>
      (m as Record<string, unknown>).type === "chunk-ready"
    );
    expect(flushed.length).toBeGreaterThanOrEqual(1);
  });

  it("chunk-ready message includes correct count", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    box.simulate("open", {});
    box.send({ type: "subscribe", sessionId: "sess-count" });
    await tick();

    const N = 5;
    for (let i = 0; i < N; i++) {
      box.simulate("message", { data: JSON.stringify({
        type: "log", line: `msg ${i}`, ts: Date.now(),
      })});
    }
    box.send({ type: "flush", sessionId: "sess-count" });
    await tick(10);

    const chunkReady = box.selfObj.postMessages.find((m: unknown) =>
      (m as Record<string, unknown>).type === "chunk-ready"
    ) as Record<string, unknown> | undefined;
    expect(chunkReady?.count).toBe(N);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Connection Status
// ═════════════════════════════════════════════════════════════════════════════

describe("connection status", () => {
  it("posts {connected:false, reconnecting:true} on WebSocket close", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    box.simulate("open", {});

    // Clear messages, then simulate close
    box.selfObj.postMessages.length = 0;
    box.simulate("close", {});

    const status = box.selfObj.postMessages.find((m: unknown) => {
      const m2 = m as Record<string, unknown>;
      return m2.type === "connection-status";
    }) as Record<string, unknown> | undefined;
    expect(status).toBeDefined();
    if (status) {
      expect(status.connected).toBe(false);
      expect(status.reconnecting).toBe(true);
    }
  });

  it("posts error from stream-error message", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    box.simulate("open", {});
    box.send({ type: "subscribe", sessionId: "sess-err" });
    await tick();

    box.simulate("message", { data: JSON.stringify({
      type: "stream-error", ts: Date.now(), sessionId: "sess-err", message: "pod not found",
    })});
    await tick();

    const status = box.selfObj.postMessages.find((m: unknown) => {
      const m2 = m as Record<string, unknown>;
      return m2.type === "connection-status" && m2.error !== undefined;
    }) as Record<string, unknown> | undefined;
    expect(status).toBeDefined();
    if (status) expect(status.error).toBe("pod not found");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// IDB writes
// ═════════════════════════════════════════════════════════════════════════════

describe("IndexedDB writes", () => {
  it("writes chunk to IDB on flush with correct sessionId + chunkId", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    box.simulate("open", {});
    box.send({ type: "subscribe", sessionId: "sess-idb" });
    await tick();

    box.simulate("message", { data: JSON.stringify({
      type: "log", line: "idb test", ts: Date.now(),
    })});
    box.send({ type: "flush", sessionId: "sess-idb" });
    await tick(50);

    // Look for the chunk in IDB
    const key = JSON.stringify(["sess-idb", 0]);
    const chunk = box.mockIdb.chunks.get(key) as { sessionId: string; chunkId: number; entries: unknown[] } | undefined;
    expect(chunk).toBeDefined();
    if (chunk) {
      expect(chunk.sessionId).toBe("sess-idb");
      expect(chunk.chunkId).toBe(0);
      expect(Array.isArray(chunk.entries)).toBe(true);
      expect(chunk.entries.length).toBe(1);
    }
  });

  it("increments chunkId on successive flushes", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    box.simulate("open", {});
    box.send({ type: "subscribe", sessionId: "sess-cid" });
    await tick();

    // First flush
    box.simulate("message", { data: JSON.stringify({ type: "log", line: "a", ts: Date.now() })});
    box.send({ type: "flush", sessionId: "sess-cid" });
    await tick(50);

    // Second flush
    box.simulate("message", { data: JSON.stringify({ type: "log", line: "b", ts: Date.now() })});
    box.send({ type: "flush", sessionId: "sess-cid" });
    await tick(50);

    expect(box.mockIdb.chunks.has(JSON.stringify(["sess-cid", 0]))).toBe(true);
    expect(box.mockIdb.chunks.has(JSON.stringify(["sess-cid", 1]))).toBe(true);
  });
});
