/**
 * loki-885.test.ts — Loki QA gap-fill tests for Issue #885
 *
 * Covers acceptance criteria NOT already validated by FiremanDecko's tests:
 *   AC1  Live JSONL streaming: multi-turn incrementing, raw log always emitted
 *   AC2  Report generation: stat boxes, no-verdict path, token counts, tool badges
 *   AC3  Verdict detection: last-wins semantics, FAIL from Bash body extraction
 *   AC4  Metadata extraction: timestamp fields, missing usage tokens (no crash)
 *   AC5  WS auth: no cookie → reject, invalid token → reject
 *   AC6  Dispatcher: tool result truncated at 4000 chars, FAIL verdict on stream end
 *   AC7  HTML generation: tool result/text truncation, multiple tools per turn
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { IncomingMessage, Server } from "node:http";
import { EventEmitter } from "node:events";

// ── Shared fakes ─────────────────────────────────────────────────────────────

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

function parseSent(ws: FakeWs, index = 0) {
  return JSON.parse(ws.sent[index]) as Record<string, unknown>;
}

function getSent(ws: FakeWs, type: string) {
  return ws.sent.find((s) => {
    try {
      return (JSON.parse(s) as Record<string, unknown>).type === type;
    } catch {
      return false;
    }
  });
}

function getAllSent(ws: FakeWs, type: string) {
  return ws.sent.filter((s) => {
    try {
      return (JSON.parse(s) as Record<string, unknown>).type === type;
    } catch {
      return false;
    }
  });
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

const mockVerifyFn = vi.fn<(token: string) => string | null>();

vi.mock("../auth.js", () => ({
  SESSION_COOKIE: "odin_session",
  verifySessionToken: mockVerifyFn,
}));

const { attachWebSocketServer } = await import("../ws.js");

// ── report.ts imports (no mocking needed — pure logic) ───────────────────────

import {
  detectVerdict,
  extractMeta,
  generateReportHtml,
  type JsonEvent,
} from "../report.js";

// ─────────────────────────────────────────────────────────────────────────────
// AC3 — Verdict detection: last-wins + FAIL extraction
// ─────────────────────────────────────────────────────────────────────────────

describe("detectVerdict — last-wins semantics (AC3)", () => {
  it("returns the LAST verdict when multiple PASS verdicts appear", () => {
    const events: JsonEvent[] = [
      {
        type: "assistant",
        message: { content: [{ type: "text", text: "**Verdict:** PASS — first check" }] },
      },
      {
        type: "assistant",
        message: { content: [{ type: "text", text: "**Verdict:** PASS — final confirmation" }] },
      },
    ];
    const verdict = detectVerdict(events);
    expect(verdict?.pass).toBe(true);
    expect(verdict?.text).toContain("final confirmation");
  });

  it("returns FAIL when a PASS is followed by a FAIL verdict", () => {
    const events: JsonEvent[] = [
      {
        type: "assistant",
        message: { content: [{ type: "text", text: "**Verdict:** PASS — looked ok" }] },
      },
      {
        type: "assistant",
        message: { content: [{ type: "text", text: "**Verdict:** FAIL — found regression" }] },
      },
    ];
    const verdict = detectVerdict(events);
    expect(verdict?.pass).toBe(false);
    expect(verdict?.text).toContain("found regression");
  });

  it("returns PASS when a FAIL is followed by a PASS verdict", () => {
    const events: JsonEvent[] = [
      {
        type: "assistant",
        message: { content: [{ type: "text", text: "**Verdict:** FAIL — initial failure" }] },
      },
      {
        type: "assistant",
        message: { content: [{ type: "text", text: "**Verdict:** PASS — fixed and re-verified" }] },
      },
    ];
    const verdict = detectVerdict(events);
    expect(verdict?.pass).toBe(true);
  });

  it("returns null for empty events", () => {
    expect(detectVerdict([])).toBeNull();
  });

  it("PASS verdict detected case-insensitively", () => {
    const events: JsonEvent[] = [
      {
        type: "assistant",
        message: { content: [{ type: "text", text: "loki qa verdict: pass" }] },
      },
    ];
    expect(detectVerdict(events)?.pass).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC4 — Metadata extraction: timestamps + missing usage no-crash
// ─────────────────────────────────────────────────────────────────────────────

describe("extractMeta — timestamps and edge cases (AC4)", () => {
  it("extracts startTime from system event timestamp", () => {
    const events: JsonEvent[] = [
      {
        type: "system",
        subtype: "init",
        timestamp: "2026-03-14T10:00:00.000Z",
      },
    ];
    const meta = extractMeta(events, "sess-ts");
    expect(meta.startTime).toBe(new Date("2026-03-14T10:00:00.000Z").getTime());
  });

  it("extracts endTime from the last assistant event timestamp", () => {
    const events: JsonEvent[] = [
      {
        type: "assistant",
        message: { content: [], usage: { input_tokens: 10, output_tokens: 5 } },
        timestamp: "2026-03-14T10:05:00.000Z",
      },
      {
        type: "assistant",
        message: { content: [], usage: { input_tokens: 20, output_tokens: 10 } },
        timestamp: "2026-03-14T10:10:00.000Z",
      },
    ];
    const meta = extractMeta(events, "sess-end");
    expect(meta.endTime).toBe(new Date("2026-03-14T10:10:00.000Z").getTime());
  });

  it("does not crash when assistant event has no usage field", () => {
    const events: JsonEvent[] = [
      { type: "assistant", message: { content: [] } },
    ];
    const meta = extractMeta(events, "sess-nousage");
    expect(meta.totalInputTokens).toBe(0);
    expect(meta.totalOutputTokens).toBe(0);
  });

  it("does not crash when usage tokens are undefined", () => {
    const events: JsonEvent[] = [
      {
        type: "assistant",
        message: { content: [], usage: {} },
      },
    ];
    const meta = extractMeta(events, "sess-undef");
    expect(meta.totalInputTokens).toBe(0);
    expect(meta.totalOutputTokens).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC2 — Report generation: stats, no-verdict, token counts, badge classes
// ─────────────────────────────────────────────────────────────────────────────

describe("generateReportHtml — stats and content (AC2)", () => {
  it("shows correct turn count in stats", () => {
    const events: JsonEvent[] = [
      { type: "assistant", message: { content: [{ type: "text", text: "turn 1" }] } },
      { type: "assistant", message: { content: [{ type: "text", text: "turn 2" }] } },
      { type: "assistant", message: { content: [{ type: "text", text: "turn 3" }] } },
    ];
    const html = generateReportHtml(events, "sess-stats");
    // 3 turns
    expect(html).toContain('<span class="val">3</span>');
  });

  it("shows tool count in stats", () => {
    const events: JsonEvent[] = [
      {
        type: "assistant",
        message: {
          content: [
            { type: "tool_use", id: "t1", name: "Bash", input: { command: "ls" } },
            { type: "tool_use", id: "t2", name: "Read", input: { file_path: "/foo" } },
          ],
        },
      },
    ];
    const html = generateReportHtml(events, "sess-tools");
    // 2 tool calls
    expect(html).toContain('<span class="val">2</span>');
  });

  it("does not include verdict section when no verdict is detected", () => {
    const events: JsonEvent[] = [
      { type: "assistant", message: { content: [{ type: "text", text: "just working" }] } },
    ];
    const html = generateReportHtml(events, "sess-noverd");
    expect(html).not.toContain("verdict pass");
    expect(html).not.toContain("verdict fail");
    expect(html).not.toContain("✓ PASS");
    expect(html).not.toContain("✗ FAIL");
  });

  it("includes input token count in meta section", () => {
    const events: JsonEvent[] = [
      {
        type: "assistant",
        message: { content: [], usage: { input_tokens: 1234, output_tokens: 567 } },
      },
    ];
    const html = generateReportHtml(events, "sess-tokens");
    expect(html).toContain("1,234");
    expect(html).toContain("567");
  });

  it("includes model in meta when system init event present", () => {
    const events: JsonEvent[] = [
      { type: "system", subtype: "init", model: "claude-sonnet-4-6" },
    ];
    const html = generateReportHtml(events, "sess-model");
    expect(html).toContain("claude-sonnet-4-6");
  });

  it("renders Read tool badge", () => {
    const events: JsonEvent[] = [
      {
        type: "assistant",
        message: {
          content: [
            { type: "tool_use", id: "t1", name: "Read", input: { file_path: "/src/foo.ts" } },
          ],
        },
      },
    ];
    const html = generateReportHtml(events, "sess-read");
    expect(html).toContain('tool-badge read');
    expect(html).toContain("/src/foo.ts");
  });

  it("renders Edit tool badge", () => {
    const events: JsonEvent[] = [
      {
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              id: "t1",
              name: "Edit",
              input: { file_path: "/src/bar.ts", old_string: "x", new_string: "y" },
            },
          ],
        },
      },
    ];
    const html = generateReportHtml(events, "sess-edit");
    expect(html).toContain('tool-badge edit');
  });

  it("truncates tool result at 300 chars with ellipsis", () => {
    const longResult = "A".repeat(400);
    const events: JsonEvent[] = [
      {
        type: "assistant",
        message: {
          content: [
            { type: "tool_use", id: "t1", name: "Bash", input: { command: "echo" } },
          ],
        },
      },
      {
        type: "user",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "t1",
              content: longResult,
              is_error: false,
            },
          ],
        },
      },
    ];
    const html = generateReportHtml(events, "sess-truncate");
    // The raw 400-char string should not appear verbatim
    expect(html).not.toContain("A".repeat(400));
    // Ellipsis should be present
    expect(html).toContain("…");
  });

  it("truncates turn text at 2000 chars", () => {
    const longText = "B".repeat(2500);
    const events: JsonEvent[] = [
      {
        type: "assistant",
        message: { content: [{ type: "text", text: longText }] },
      },
    ];
    const html = generateReportHtml(events, "sess-longtext");
    expect(html).not.toContain("B".repeat(2500));
    expect(html).toContain("\n…");
  });

  it("shows plural 'tools' label for multiple tool calls in turn header", () => {
    const events: JsonEvent[] = [
      {
        type: "assistant",
        message: {
          content: [
            { type: "tool_use", id: "t1", name: "Bash", input: { command: "ls" } },
            { type: "tool_use", id: "t2", name: "Read", input: { file_path: "/f" } },
          ],
        },
      },
    ];
    const html = generateReportHtml(events, "sess-plural");
    expect(html).toContain("2 tools");
  });

  it("shows singular 'tool' label for exactly one tool call", () => {
    const events: JsonEvent[] = [
      {
        type: "assistant",
        message: {
          content: [
            { type: "tool_use", id: "t1", name: "Bash", input: { command: "ls" } },
          ],
        },
      },
    ];
    const html = generateReportHtml(events, "sess-singular");
    expect(html).toContain("1 tool");
    expect(html).not.toContain("1 tools");
  });

  it("renders aria-label on report container", () => {
    const html = generateReportHtml([], "my-session-id");
    expect(html).toContain('aria-label="Agent report for session my-session-id"');
  });

  it("renders aria-label on turns container", () => {
    const html = generateReportHtml([], "sess-aria");
    expect(html).toContain('aria-label="Agent turns"');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC5 — WS authentication rejection
// ─────────────────────────────────────────────────────────────────────────────

describe("WebSocket auth rejection (AC5)", () => {
  let wss: FakeWss;

  beforeEach(() => {
    vi.clearAllMocks();
    // By default auth returns null (unauthenticated)
    mockVerifyFn.mockReturnValue(null);
    const fakeServer = new EventEmitter() as unknown as Server;
    wss = attachWebSocketServer(fakeServer as unknown) as unknown as FakeWss;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function connect(urlPath: string, cookie = ""): FakeWs {
    const fakeWs = new FakeWs();
    const fakeReq = {
      url: urlPath,
      headers: { cookie },
    } as unknown as IncomingMessage;
    wss.emit("connection", fakeWs, fakeReq);
    return fakeWs;
  }

  it("rejects connection with no cookie header", () => {
    const ws = connect("/ws/logs/sess-noauth", "");
    const msg = parseSent(ws, 0);
    expect(msg.type).toBe("error");
    expect(msg.message).toMatch(/Unauthorized/i);
  });

  it("closes socket with code 1008 on missing cookie", () => {
    const ws = connect("/ws/logs/sess-noauth2", "");
    expect(ws.closeCode).toBe(1008);
  });

  it("rejects connection when token verification fails", () => {
    mockVerifyFn.mockReturnValue(null);
    const ws = connect("/ws/logs/sess-badtoken", "odin_session=invalid-token");
    const msg = parseSent(ws, 0);
    expect(msg.type).toBe("error");
    expect(msg.message).toMatch(/Unauthorized/i);
  });

  it("closes socket with code 1008 on invalid token", () => {
    mockVerifyFn.mockReturnValue(null);
    const ws = connect("/ws/logs/sess-badtoken2", "odin_session=bad");
    expect(ws.closeCode).toBe(1008);
  });

  it("accepts connection when token verifies successfully", async () => {
    mockVerifyFn.mockReturnValue("odin@fenrir-ledger.dev");
    mockFindPodForSession.mockResolvedValue(null);

    const ws = connect("/ws/logs/sess-authed", "odin_session=valid-token");
    const msg = parseSent(ws, 0);
    // Should get 'connected', not 'error'
    expect(msg.type).toBe("connected");
    expect(msg.sessionId).toBe("sess-authed");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC1 / AC6 — LogStreamDispatcher: multi-turn counting, tool result truncation
// ─────────────────────────────────────────────────────────────────────────────

describe("LogStreamDispatcher — multi-turn and truncation (AC1/AC6)", () => {
  let wss: FakeWss;

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyFn.mockReturnValue("odin@fenrir-ledger.dev");
    const fakeServer = new EventEmitter() as unknown as Server;
    wss = attachWebSocketServer(fakeServer as unknown) as unknown as FakeWss;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function connectAuthed(urlPath: string): FakeWs {
    const fakeWs = new FakeWs();
    const fakeReq = {
      url: urlPath,
      headers: { cookie: "odin_session=valid-token" },
    } as unknown as IncomingMessage;
    wss.emit("connection", fakeWs, fakeReq);
    return fakeWs;
  }

  it("increments turnNum for each sequential assistant event", async () => {
    let capturedOnLine: ((line: string) => void) | undefined;
    mockFindPodForSession.mockResolvedValue("pod-multi");
    mockStreamPodLogs.mockImplementation(async (_pod, _ns, onLine) => {
      capturedOnLine = onLine as (line: string) => void;
      return vi.fn();
    });

    const ws = connectAuthed("/ws/logs/sess-multiturn");
    await new Promise((r) => setTimeout(r, 10));

    // Send 3 assistant events
    for (let i = 0; i < 3; i++) {
      capturedOnLine!(
        JSON.stringify({
          type: "assistant",
          message: { content: [{ type: "text", text: `turn ${i + 1}` }] },
        })
      );
    }

    const turnMsgs = getAllSent(ws, "turn_start");
    expect(turnMsgs).toHaveLength(3);
    expect((JSON.parse(turnMsgs[0]) as Record<string, unknown>).turnNum).toBe(1);
    expect((JSON.parse(turnMsgs[1]) as Record<string, unknown>).turnNum).toBe(2);
    expect((JSON.parse(turnMsgs[2]) as Record<string, unknown>).turnNum).toBe(3);
  });

  it("truncates tool result content at 4000 chars", async () => {
    let capturedOnLine: ((line: string) => void) | undefined;
    mockFindPodForSession.mockResolvedValue("pod-trunc");
    mockStreamPodLogs.mockImplementation(async (_pod, _ns, onLine) => {
      capturedOnLine = onLine as (line: string) => void;
      return vi.fn();
    });

    const ws = connectAuthed("/ws/logs/sess-trunc");
    await new Promise((r) => setTimeout(r, 10));

    const largeContent = "X".repeat(5000);
    capturedOnLine!(
      JSON.stringify({
        type: "user",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "tid-big",
              content: largeContent,
              is_error: false,
            },
          ],
        },
      })
    );

    const resultMsg = getSent(ws, "tool_result");
    expect(resultMsg).toBeDefined();
    const parsed = JSON.parse(resultMsg!) as Record<string, unknown>;
    expect((parsed.content as string).length).toBeLessThanOrEqual(4000);
    expect(parsed.content).not.toBe(largeContent);
  });

  it("emits FAIL verdict at stream end when FAIL is in session", async () => {
    let capturedOnLine: ((line: string) => void) | undefined;
    let capturedOnEnd: (() => void) | undefined;
    mockFindPodForSession.mockResolvedValue("pod-fail");
    mockStreamPodLogs.mockImplementation(async (_pod, _ns, onLine, onEnd) => {
      capturedOnLine = onLine as (line: string) => void;
      capturedOnEnd = onEnd as () => void;
      return vi.fn();
    });

    const ws = connectAuthed("/ws/logs/sess-fail");
    await new Promise((r) => setTimeout(r, 10));

    capturedOnLine!(
      JSON.stringify({
        type: "assistant",
        message: {
          content: [{ type: "text", text: "**Verdict:** FAIL — TypeScript errors found" }],
        },
      })
    );

    capturedOnEnd!();

    const verdictMsg = getSent(ws, "verdict");
    expect(verdictMsg).toBeDefined();
    const parsed = JSON.parse(verdictMsg!) as Record<string, unknown>;
    expect(parsed.pass).toBe(false);
    expect(parsed.summary).toContain("TypeScript errors found");
  });

  it("tool_call turnNum matches current turn counter", async () => {
    let capturedOnLine: ((line: string) => void) | undefined;
    mockFindPodForSession.mockResolvedValue("pod-toolnum");
    mockStreamPodLogs.mockImplementation(async (_pod, _ns, onLine) => {
      capturedOnLine = onLine as (line: string) => void;
      return vi.fn();
    });

    const ws = connectAuthed("/ws/logs/sess-toolnum");
    await new Promise((r) => setTimeout(r, 10));

    // First turn: just text
    capturedOnLine!(
      JSON.stringify({
        type: "assistant",
        message: { content: [{ type: "text", text: "first turn" }] },
      })
    );

    // Second turn: with tool
    capturedOnLine!(
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            { type: "tool_use", id: "tid-t2", name: "Bash", input: { command: "git status" } },
          ],
        },
      })
    );

    const toolMsg = getSent(ws, "tool_call");
    expect(toolMsg).toBeDefined();
    const parsed = JSON.parse(toolMsg!) as Record<string, unknown>;
    expect(parsed.turnNum).toBe(2);
  });

  it("reports correct sessionId in connected message", async () => {
    mockFindPodForSession.mockResolvedValue(null);

    const ws = connectAuthed("/ws/logs/my-unique-session");
    const msg = parseSent(ws, 0);
    expect(msg.type).toBe("connected");
    expect(msg.sessionId).toBe("my-unique-session");
  });

  it("URL with query params does not break sessionId extraction", async () => {
    mockFindPodForSession.mockResolvedValue(null);

    const ws = connectAuthed("/ws/logs/sess-qs?foo=bar");
    const connMsg = ws.sent.find((s) => {
      const p = JSON.parse(s) as Record<string, unknown>;
      return p.type === "connected";
    });
    expect(connMsg).toBeDefined();
    const parsed = JSON.parse(connMsg!) as Record<string, unknown>;
    expect(parsed.sessionId).toBe("sess-qs");
  });
});
