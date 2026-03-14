import { describe, it, expect } from "vitest";
import {
  parseJsonlLine,
  extractTurns,
  detectVerdict,
  extractMeta,
  generateReportHtml,
  type JsonEvent,
} from "../report.js";

// ── parseJsonlLine ────────────────────────────────────────────────────────────

describe("parseJsonlLine", () => {
  it("parses a plain JSON line", () => {
    const ev = parseJsonlLine('{"type":"assistant"}');
    expect(ev).not.toBeNull();
    expect(ev?.type).toBe("assistant");
  });

  it("strips Kubernetes timestamp prefix", () => {
    const ev = parseJsonlLine(
      '2024-01-01T00:00:00.000000000Z {"type":"system","subtype":"init"}'
    );
    expect(ev).not.toBeNull();
    expect(ev?.type).toBe("system");
    expect(ev?.subtype).toBe("init");
  });

  it("returns null for non-JSON lines", () => {
    expect(parseJsonlLine("plain log text")).toBeNull();
    expect(parseJsonlLine("")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseJsonlLine("{broken json")).toBeNull();
  });

  it("returns null for lines that don't start with {", () => {
    expect(parseJsonlLine("[1,2,3]")).toBeNull();
  });
});

// ── extractTurns ──────────────────────────────────────────────────────────────

describe("extractTurns", () => {
  it("returns empty array for no events", () => {
    expect(extractTurns([])).toEqual([]);
  });

  it("returns one turn per assistant event", () => {
    const events: JsonEvent[] = [
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "Hello" }],
        },
      },
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "World" }],
        },
      },
    ];
    const turns = extractTurns(events);
    expect(turns).toHaveLength(2);
    expect(turns[0].turnNum).toBe(1);
    expect(turns[1].turnNum).toBe(2);
  });

  it("extracts text blocks from assistant turns", () => {
    const events: JsonEvent[] = [
      {
        type: "assistant",
        message: {
          content: [
            { type: "text", text: "First text" },
            { type: "text", text: "Second text" },
          ],
        },
      },
    ];
    const turns = extractTurns(events);
    expect(turns[0].texts).toEqual(["First text", "Second text"]);
  });

  it("extracts tool_use blocks into tools array", () => {
    const events: JsonEvent[] = [
      {
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              id: "tool-1",
              name: "Bash",
              input: { command: "ls" },
            },
          ],
        },
      },
    ];
    const turns = extractTurns(events);
    expect(turns[0].tools).toHaveLength(1);
    expect(turns[0].tools[0].name).toBe("Bash");
    expect(turns[0].tools[0].input).toEqual({ command: "ls" });
  });

  it("associates tool results from user events", () => {
    const events: JsonEvent[] = [
      {
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              id: "tool-abc",
              name: "Bash",
              input: { command: "pwd" },
            },
          ],
        },
      },
      {
        type: "user",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool-abc",
              content: "/workspace/repo",
              is_error: false,
            },
          ],
        },
      },
    ];
    const turns = extractTurns(events);
    expect(turns[0].tools[0].result).toBe("/workspace/repo");
    expect(turns[0].tools[0].isError).toBe(false);
  });

  it("marks tool result as error when is_error is true", () => {
    const events: JsonEvent[] = [
      {
        type: "assistant",
        message: {
          content: [
            { type: "tool_use", id: "t1", name: "Bash", input: { command: "badcmd" } },
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
              content: "command not found",
              is_error: true,
            },
          ],
        },
      },
    ];
    const turns = extractTurns(events);
    expect(turns[0].tools[0].isError).toBe(true);
    expect(turns[0].tools[0].result).toBe("command not found");
  });

  it("handles tool result content as array of text blocks", () => {
    const events: JsonEvent[] = [
      {
        type: "assistant",
        message: {
          content: [
            { type: "tool_use", id: "t2", name: "Read", input: { file_path: "/foo.ts" } },
          ],
        },
      },
      {
        type: "user",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "t2",
              content: [
                { type: "text", text: "line one\n" },
                { type: "text", text: "line two" },
              ],
            },
          ],
        },
      },
    ];
    const turns = extractTurns(events);
    expect(turns[0].tools[0].result).toBe("line one\nline two");
  });
});

// ── detectVerdict ─────────────────────────────────────────────────────────────

describe("detectVerdict", () => {
  it("returns null when no verdict present", () => {
    const events: JsonEvent[] = [
      {
        type: "assistant",
        message: { content: [{ type: "text", text: "Just doing work" }] },
      },
    ];
    expect(detectVerdict(events)).toBeNull();
  });

  it("detects PASS verdict from text content", () => {
    const events: JsonEvent[] = [
      {
        type: "assistant",
        message: {
          content: [
            { type: "text", text: "**Verdict:** PASS — all checks green" },
          ],
        },
      },
    ];
    const verdict = detectVerdict(events);
    expect(verdict).not.toBeNull();
    expect(verdict?.pass).toBe(true);
  });

  it("detects FAIL verdict from text content", () => {
    const events: JsonEvent[] = [
      {
        type: "assistant",
        message: {
          content: [
            { type: "text", text: "**Verdict:** FAIL — tests broken" },
          ],
        },
      },
    ];
    const verdict = detectVerdict(events);
    expect(verdict?.pass).toBe(false);
  });

  it("detects verdict from Loki QA Verdict phrasing", () => {
    const events: JsonEvent[] = [
      {
        type: "assistant",
        message: {
          content: [
            { type: "text", text: "Loki QA Verdict: PASS" },
          ],
        },
      },
    ];
    expect(detectVerdict(events)?.pass).toBe(true);
  });

  it("detects FAIL verdict from Bash tool comment command", () => {
    const events: JsonEvent[] = [
      {
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              id: "t1",
              name: "Bash",
              input: { command: 'gh issue comment 885 --body "Loki QA Verdict: FAIL"' },
            },
          ],
        },
      },
    ];
    const verdict = detectVerdict(events);
    expect(verdict?.pass).toBe(false);
  });
});

// ── extractMeta ───────────────────────────────────────────────────────────────

describe("extractMeta", () => {
  it("returns defaults when no events", () => {
    const meta = extractMeta([], "sess-123");
    expect(meta.sessionId).toBe("sess-123");
    expect(meta.totalInputTokens).toBe(0);
    expect(meta.totalOutputTokens).toBe(0);
  });

  it("sums token usage across assistant events", () => {
    const events: JsonEvent[] = [
      {
        type: "assistant",
        message: { usage: { input_tokens: 100, output_tokens: 50 }, content: [] },
      },
      {
        type: "assistant",
        message: { usage: { input_tokens: 200, output_tokens: 80 }, content: [] },
      },
    ];
    const meta = extractMeta(events, "s1");
    expect(meta.totalInputTokens).toBe(300);
    expect(meta.totalOutputTokens).toBe(130);
  });

  it("extracts model from system init event", () => {
    const events: JsonEvent[] = [
      { type: "system", subtype: "init", model: "claude-opus-4-6" },
    ];
    const meta = extractMeta(events, "s1");
    expect(meta.model).toBe("claude-opus-4-6");
  });
});

// ── generateReportHtml ────────────────────────────────────────────────────────

describe("generateReportHtml", () => {
  it("returns a valid HTML string", () => {
    const html = generateReportHtml([], "test-session");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("test-session");
  });

  it("includes turn section when events are provided", () => {
    const events: JsonEvent[] = [
      {
        type: "assistant",
        message: { content: [{ type: "text", text: "working" }] },
      },
    ];
    const html = generateReportHtml(events, "sess-abc");
    expect(html).toContain('aria-label="Turn 1"');
  });

  it("includes PASS verdict section when verdict is PASS", () => {
    const events: JsonEvent[] = [
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "**Verdict:** PASS — all good" }],
        },
      },
    ];
    const html = generateReportHtml(events, "s1");
    expect(html).toContain("verdict pass");
    expect(html).toContain("✓ PASS");
  });

  it("includes FAIL verdict section when verdict is FAIL", () => {
    const events: JsonEvent[] = [
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "**Verdict:** FAIL — tests broken" }],
        },
      },
    ];
    const html = generateReportHtml(events, "s1");
    expect(html).toContain("verdict fail");
    expect(html).toContain("✗ FAIL");
  });

  it("escapes HTML in session ID to prevent XSS", () => {
    const html = generateReportHtml([], '<script>alert(1)</script>');
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes HTML in tool input to prevent XSS", () => {
    const events: JsonEvent[] = [
      {
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              id: "t1",
              name: "Bash",
              input: { command: '<img src=x onerror=alert(1)>' },
            },
          ],
        },
      },
    ];
    const html = generateReportHtml(events, "s1");
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
  });
});
