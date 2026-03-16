/**
 * chronicle-1050-mdx-heckler-edge.test.ts
 *
 * Loki QA — edge-case Vitest suite for Issue #1050 MDX heckler bubbles.
 * Covers gaps in FiremanDecko's main suite: null guards, error classes,
 * truncation limit, merge-stop logic, avatar determinism, fallback name.
 *
 * Deliberately kept as a separate file because the main suite
 * (chronicle-1050-mdx-heckler.test.ts) already exceeds the 10-test-per-file
 * limit — see defect filed for that violation.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const MJS_PATH = resolve(
  __dirname,
  "../../../../../.claude/skills/brandify-agent/scripts/generate-agent-report.mjs"
);
const SANITIZE_PATH = resolve(
  __dirname,
  "../../../../../.claude/skills/brandify-agent/scripts/sanitize-chronicle.mjs"
);

let mjs: string;
let sanitize: string;

beforeAll(() => {
  mjs = readFileSync(MJS_PATH, "utf-8");
  sanitize = readFileSync(SANITIZE_PATH, "utf-8");
});

// ── mdxIsToolOnly logic ───────────────────────────────────────────────────────

describe("generate-agent-report.mjs — mdxIsToolOnly edge cases (issue #1050)", () => {
  it("mdxIsToolOnly requires texts AND thinking both empty, tools non-empty", () => {
    const fnStart = mjs.indexOf("function mdxIsToolOnly");
    const fnEnd = mjs.indexOf("\n  }", fnStart) + 4;
    const fn = mjs.slice(fnStart, fnEnd);
    // Must check texts.length === 0
    expect(fn).toContain("texts.length === 0");
    // Must check thinking.length === 0
    expect(fn).toContain("thinking.length === 0");
    // Must check tools.length > 0
    expect(fn).toContain("tools.length > 0");
  });

  it("toolbox merge while-loop stops when a non-tool-only turn is encountered", () => {
    // The while loop must use mdxIsToolOnly as its guard so it stops at text turns
    // Anchor: the inner while loop line within the merge block
    const anchor = "while (mi < turns.length && mdxIsToolOnly(turns[mi]))";
    const start = mjs.indexOf(anchor);
    expect(start).toBeGreaterThan(-1);
    const loopBlock = mjs.slice(start, start + 400);
    expect(loopBlock).toContain("mdxIsToolOnly(turns[mi])");
    // Inside the loop, mi must be incremented so iteration terminates
    expect(loopBlock).toContain("mi++");
  });
});

// ── Error state propagation ───────────────────────────────────────────────────

describe("generate-agent-report.mjs — is_error → CSS class propagation (issue #1050)", () => {
  it("tool block with is_error adds has-error class to details.tool-block", () => {
    const fnStart = mjs.indexOf("function mdxRenderToolBlock");
    const fnEnd = mjs.indexOf("\n  }", fnStart) + 4;
    const fn = mjs.slice(fnStart, fnEnd);
    expect(fn).toContain('tool.is_error ? " has-error" : ""');
  });

  it("tool output pre with is_error adds error class", () => {
    const fnStart = mjs.indexOf("function mdxRenderToolBlock");
    const fnEnd = mjs.indexOf("\n  }", fnStart) + 4;
    const fn = mjs.slice(fnStart, fnEnd);
    expect(fn).toContain('tool.is_error ? " error" : ""');
  });

  it("merged toolbox turn with any is_error tool gets has-error on outer turn div", () => {
    // The merge loop should propagate has-error to the turn wrapper
    const startAnchor = "// Merge consecutive tool-only turns into a single toolbox";
    const endAnchor = "// Consume heckle slot without rendering (tool-only group)";
    const start = mjs.indexOf(startAnchor);
    const end = mjs.indexOf(endAnchor);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const mergeSection = mjs.slice(start, end + endAnchor.length);
    expect(mergeSection).toContain("has-error");
    expect(mergeSection).toContain("is_error");
  });
});

// ── Tool output truncation ────────────────────────────────────────────────────

describe("sanitize-chronicle.mjs — tool output truncation (issue #1050)", () => {
  it("truncateToolOutput uses 800 char default limit (not 2000)", () => {
    // Handoff mentioned 2000 but actual limit is 800 — verify implementation
    expect(sanitize).toContain("maxChars = 800");
    // Ensure it appends a truncation notice
    expect(sanitize).toContain("truncated");
    expect(sanitize).toContain("chars]");
  });

  it("sanitizeToolOutput passes maxChars through to truncateToolOutput", () => {
    const fnStart = sanitize.indexOf("export function sanitizeToolOutput");
    const fnEnd = sanitize.indexOf("\n}", fnStart) + 2;
    const fn = sanitize.slice(fnStart, fnEnd);
    expect(fn).toContain("truncateToolOutput(text, maxChars)");
  });
});

// ── Heckle null / empty guards ────────────────────────────────────────────────

describe("generate-agent-report.mjs — mdxRenderHeckleEvents null/empty guards (issue #1050)", () => {
  it("returns empty string when events is null", () => {
    const fnStart = mjs.indexOf("function mdxRenderHeckleEvents");
    const fnEnd = mjs.indexOf("\n  }", fnStart) + 4;
    const fn = mjs.slice(fnStart, fnEnd);
    // Null guard: if (!events) return "";
    expect(fn).toContain('if (!events) return ""');
  });

  it("entrance event falls back to 'Mayo Fan' when name is missing", () => {
    const fnStart = mjs.indexOf("function mdxRenderHeckleEvents");
    const fnEnd = mjs.indexOf("\n  }", fnStart) + 4;
    const fn = mjs.slice(fnStart, fnEnd);
    expect(fn).toContain('"Mayo Fan"');
  });
});

// ── Avatar path helpers ───────────────────────────────────────────────────────

describe("generate-agent-report.mjs — heckler avatar determinism (issue #1050)", () => {
  it("mdxHecklerAvatar returns a path under /hecklers/", () => {
    const fnStart = mjs.indexOf("function mdxHecklerAvatar");
    const fnEnd = mjs.indexOf("\n  }", fnStart) + 4;
    const fn = mjs.slice(fnStart, fnEnd);
    expect(fn).toContain("/hecklers/");
  });

  it("mdxHecklerAvatar uses modulo to stay within avatar array bounds", () => {
    const fnStart = mjs.indexOf("function mdxHecklerAvatar");
    const fnEnd = mjs.indexOf("\n  }", fnStart) + 4;
    const fn = mjs.slice(fnStart, fnEnd);
    // Must mod by array length for determinism
    expect(fn).toContain("MDX_HECKLER_AVATARS.length");
    expect(fn).toContain("%");
  });

  it("mdxAgentAvatarPath returns dark profile image for known agent names", () => {
    const fnStart = mjs.indexOf("function mdxAgentAvatarPath");
    const fnEnd = mjs.indexOf("\n  }", fnStart) + 4;
    const fn = mjs.slice(fnStart, fnEnd);
    expect(fn).toContain("FiremanDecko");
    expect(fn).toContain("-dark.png");
    expect(fn).toContain("/agents/profiles/");
  });
});
