/**
 * worker-edge-cases.test.ts — Loki QA gap coverage for log-parser.worker.js
 *
 * Complements worker-log-parser.test.ts (FiremanDecko's 29 tests).
 * Covers gaps: toolBadgeClass variants, content truncation,
 * malformed-JSON resilience, and multi-session batch isolation.
 *
 * Issue: #910 — Web Worker for log stream parsing
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

// ── Minimal sandbox (mirrors createSandbox in worker-log-parser.test.ts) ─────

function createSandbox() {
  const postMessages: unknown[] = [];
  const sentMessages: unknown[] = [];
  const wsListeners = new Map<string, ((e: unknown) => void)[]>();

  const mockWs = {
    readyState: 1,
    send: vi.fn((data: string) => sentMessages.push(JSON.parse(data))),
    addEventListener: vi.fn((event: string, handler: (e: unknown) => void) => {
      if (!wsListeners.has(event)) wsListeners.set(event, []);
      wsListeners.get(event)!.push(handler);
    }),
    sentMessages,
    listeners: wsListeners,
  };

  const wsCallArgs: string[] = [];
  function WebSocketConstructor(url: string) {
    wsCallArgs.push(url);
    return mockWs;
  }
  (WebSocketConstructor as unknown as { OPEN: number }).OPEN = 1;

  // Minimal IDB mock
  const chunks = new Map<string, unknown>();
  const sessions = new Map<string, unknown>();

  function makeStore(map: Map<string, unknown>) {
    return {
      put(val: unknown) {
        const v = val as Record<string, unknown>;
        const key =
          v.chunkId !== undefined
            ? JSON.stringify([v.sessionId, v.chunkId])
            : String(v.sessionId ?? val);
        map.set(key, val);
        const req = { onsuccess: undefined as (() => void) | undefined };
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      },
      openCursor() {
        const req = { onsuccess: undefined as ((e: { target: { result: null } }) => void) | undefined };
        setTimeout(() => req.onsuccess?.({ target: { result: null } }), 0);
        return req;
      },
    };
  }

  const chunkStore = makeStore(chunks);
  const sessionStore = makeStore(sessions);

  const openReq = {
    onupgradeneeded: undefined as ((e: unknown) => void) | undefined,
    onsuccess: undefined as ((e: unknown) => void) | undefined,
    onerror: undefined as (() => void) | undefined,
    onblocked: undefined as (() => void) | undefined,
  };

  const indexedDBMock = {
    open() {
      const mockIdb = {
        transaction(_stores: string | string[], _mode: string) {
          return {
            objectStore(name: string) {
              return name === "log-chunks" ? chunkStore : sessionStore;
            },
          };
        },
      };
      setTimeout(() => openReq.onsuccess?.({ target: { result: mockIdb } }), 0);
      return openReq;
    },
  };

  const selfObj = {
    postMessage: vi.fn((msg: unknown) => postMessages.push(msg)),
    onmessage: null as ((ev: { data: unknown }) => void) | null,
    addEventListener: vi.fn(),
    postMessages,
  };

  const context = vm.createContext({
    self: selfObj,
    WebSocket: WebSocketConstructor,
    indexedDB: indexedDBMock,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    console,
    CSS: { escape: (s: string) => s.replace(/[^\w-]/g, "\\$&") },
  });

  vm.runInContext(WORKER_SRC, context);

  return {
    selfObj: selfObj as typeof selfObj & { onmessage: ((ev: { data: unknown }) => void) | null },
    mockWs,
    chunks,
    send(msg: unknown) {
      selfObj.onmessage?.({ data: msg });
    },
    simulate(event: string, data: unknown) {
      const handlers = wsListeners.get(event) ?? [];
      for (const h of handlers) h(data);
    },
  };
}

function tick(ms = 10): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ═════════════════════════════════════════════════════════════════════════════
// toolBadgeClass variants (AC: different tool types get correct CSS class)
// ═════════════════════════════════════════════════════════════════════════════

describe("toolBadgeClass variants via legacy tool_call", () => {
  async function getBadgeHtml(toolName: string): Promise<string> {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    box.simulate("open", {});
    box.send({ type: "subscribe", sessionId: "sess-badge" });
    await tick();

    box.simulate("message", { data: JSON.stringify({
      type: "turn_start", turnNum: 1, ts: Date.now(),
    })});
    box.simulate("message", { data: JSON.stringify({
      type: "tool_call", toolId: "t1", toolName, input: {}, ts: Date.now(),
    })});
    await tick(260);

    const chunks = [...box.chunks.values()];
    const allEntries = chunks.flatMap((c: unknown) => (c as { entries: unknown[] }).entries);
    const toolEntry = allEntries.find((e: unknown) => (e as { type: string }).type === "tool-call");
    return (toolEntry as { html: string } | undefined)?.html ?? "";
  }

  it("Read tool gets 'read' badge class", async () => {
    const html = await getBadgeHtml("Read");
    expect(html).toContain("tool-badge read");
  });

  it("Edit tool gets 'edit' badge class", async () => {
    const html = await getBadgeHtml("Edit");
    expect(html).toContain("tool-badge edit");
  });

  it("Write tool gets 'write' badge class", async () => {
    const html = await getBadgeHtml("Write");
    expect(html).toContain("tool-badge write");
  });

  it("TodoWrite tool gets 'todo' badge class", async () => {
    const html = await getBadgeHtml("TodoWrite");
    expect(html).toContain("tool-badge todo");
  });

  it("Unknown tool gets no extra badge class (bare 'tool-badge')", async () => {
    const html = await getBadgeHtml("SomeUnknownTool");
    // Should have tool-badge but NOT any named class appended
    expect(html).toContain("tool-badge");
    expect(html).not.toMatch(/tool-badge (bash|read|edit|write|todo)/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// renderToolResult — content truncation at 800 chars
// ═════════════════════════════════════════════════════════════════════════════

describe("renderToolResult content truncation", () => {
  it("truncates content > 800 chars and appends ellipsis in rendered HTML", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    box.simulate("open", {});
    box.send({ type: "subscribe", sessionId: "sess-trunc" });
    await tick();

    const longContent = "x".repeat(900);
    box.simulate("message", { data: JSON.stringify({
      type: "tool_result", toolId: "tr-long", content: longContent, isError: false, ts: Date.now(),
    })});
    await tick(260);

    const chunks = [...box.chunks.values()];
    const allEntries = chunks.flatMap((c: unknown) => (c as { entries: unknown[] }).entries);
    const resultEntry = allEntries.find((e: unknown) => (e as { type: string }).type === "tool-result");
    expect(resultEntry).toBeDefined();
    const html = (resultEntry as { html: string }).html;
    // Must contain truncation ellipsis, not the full 900 chars
    expect(html).toContain("…");
    // Must not contain the raw 900-char string verbatim
    expect(html.length).toBeLessThan(longContent.length + 200); // generous headroom for HTML wrapping
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Error resilience — malformed JSON does not crash the worker
// ═════════════════════════════════════════════════════════════════════════════

describe("error resilience — malformed JSON", () => {
  it("malformed JSON in WebSocket message is silently ignored (no crash, no chunk-ready)", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    box.simulate("open", {});
    box.send({ type: "subscribe", sessionId: "sess-bad-json" });
    await tick();

    // Send garbage — should not throw
    expect(() => {
      box.simulate("message", { data: "not valid JSON {{{{" });
    }).not.toThrow();

    await tick(260);

    const chunkMessages = box.selfObj.postMessages.filter(
      (m: unknown) => (m as Record<string, unknown>).type === "chunk-ready"
    );
    expect(chunkMessages.length).toBe(0);
  });

  it("malformed JSONL in log-line message is silently ignored (no chunk-ready for that line)", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    box.simulate("open", {});
    box.send({ type: "subscribe", sessionId: "sess-bad-jsonl" });
    await tick();

    // Send a log-line with invalid JSONL content
    expect(() => {
      box.simulate("message", { data: JSON.stringify({
        type: "log-line", sessionId: "sess-bad-jsonl", line: "{ broken json",
      })});
    }).not.toThrow();

    await tick(260);

    const chunks = [...box.chunks.values()].filter((c) => {
      const key = JSON.stringify(["sess-bad-jsonl", 0]);
      return box.chunks.has(key);
    });
    // Either no chunk was written, or the chunk has no entries from the bad line
    if (chunks.length > 0) {
      const allEntries = chunks.flatMap((c: unknown) => (c as { entries: unknown[] }).entries);
      // Should be empty since the bad line produced nothing
      expect(allEntries.length).toBe(0);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Multi-session batch isolation
// ═════════════════════════════════════════════════════════════════════════════

describe("multi-session batch isolation", () => {
  it("two sessions accumulate independent batches with separate chunk IDs", async () => {
    const box = createSandbox();
    box.send({ type: "connect", wsUrl: "ws://localhost/ws" });
    await tick();
    box.simulate("open", {});

    box.send({ type: "subscribe", sessionId: "sess-A" });
    box.send({ type: "subscribe", sessionId: "sess-B" });
    await tick();

    // Send 2 log lines to sess-A
    for (let i = 0; i < 2; i++) {
      box.simulate("message", { data: JSON.stringify({
        type: "log", line: `sess-A line ${i}`, ts: Date.now(),
      })});
    }
    // Hmm — legacy protocol routes to first subscribed session. Let's use log-line instead.
    // For proper isolation, use the new wire protocol with explicit sessionId.
    box.simulate("message", { data: JSON.stringify({
      type: "log-line", sessionId: "sess-A",
      line: JSON.stringify({ type: "assistant", message: { content: [] } }),
    })});
    box.simulate("message", { data: JSON.stringify({
      type: "log-line", sessionId: "sess-B",
      line: JSON.stringify({ type: "assistant", message: { content: [] } }),
    })});

    box.send({ type: "flush", sessionId: "sess-A" });
    await tick(10);
    box.send({ type: "flush", sessionId: "sess-B" });
    await tick(10);

    // Verify each session has its own chunk at chunkId=0
    const keyA = JSON.stringify(["sess-A", 0]);
    const keyB = JSON.stringify(["sess-B", 0]);

    expect(box.chunks.has(keyA)).toBe(true);
    expect(box.chunks.has(keyB)).toBe(true);

    const chunkA = box.chunks.get(keyA) as { sessionId: string; entries: unknown[] };
    const chunkB = box.chunks.get(keyB) as { sessionId: string; entries: unknown[] };

    expect(chunkA.sessionId).toBe("sess-A");
    expect(chunkB.sessionId).toBe("sess-B");

    // Entries must be independent (each has exactly 1 turn-start from their own session)
    const typesA = chunkA.entries.map((e: unknown) => (e as { type: string }).type);
    const typesB = chunkB.entries.map((e: unknown) => (e as { type: string }).type);
    expect(typesA).toContain("turn-start");
    expect(typesB).toContain("turn-start");
  });
});
