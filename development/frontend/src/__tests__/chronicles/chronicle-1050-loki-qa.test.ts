/**
 * chronicle-1050-loki-qa.test.ts — Loki QA edge-case tests for Issue #1050
 *
 * Validates edge cases NOT covered by FiremanDecko's 33 tests:
 * - mdxIsToolOnly: thinking-only turns must NOT be treated as tool-only
 * - Tool block is_error propagation (has-error + error class on output)
 * - Tool output truncation via sanitizeToolOutput (800-char limit)
 * - Toolbox merge: stops at text turn (consecutive merge boundary)
 * - Victory heckle always generates heckle-explosion
 * - mdxRenderHeckleEvents: null/undefined guard returns ""
 * - Explosion event has no heckle-identity markup (full-width, text only)
 * - Entrance event falls back to "Mayo Fan" when name is absent
 * - mdxHecklerAvatar: deterministic hash (same name → same path)
 * - mdxAgentAvatarPath: known agent slugs mapped correctly
 * - CSS dark theme compatibility (light override doesn't remove heckle classes)
 * - .heckle max-width 60% vs .heckle-explosion max-width 100%
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const CSS_PATH = resolve(__dirname, "../../app/chronicles/chronicle.css");
const MJS_PATH = resolve(
  __dirname,
  "../../../../../.claude/skills/brandify-agent/scripts/generate-agent-report.mjs"
);

let css: string;
let mjs: string;

beforeAll(() => {
  css = readFileSync(CSS_PATH, "utf-8");
  mjs = readFileSync(MJS_PATH, "utf-8");
});

// ── mdxIsToolOnly edge cases ──────────────────────────────────────────────────

describe("generate-agent-report.mjs — mdxIsToolOnly edge cases (Loki QA #1050)", () => {
  it("mdxIsToolOnly requires tools.length > 0 (thinking-only turn is NOT tool-only)", () => {
    // The function must check tools.length > 0 — so a thinking-only turn won't merge
    const fnStart = mjs.indexOf("function mdxIsToolOnly");
    const fnEnd = mjs.indexOf("}", fnStart) + 1;
    const fn = mjs.slice(fnStart, fnEnd);
    // Must guard: tools.length > 0
    expect(fn).toContain("tools.length > 0");
    // Must guard: texts.length === 0
    expect(fn).toContain("texts.length === 0");
    // Must guard: thinking.length === 0 (thinking-only turns must NOT be merged)
    expect(fn).toContain("thinking.length === 0");
  });

  it("toolbox merging while-loop advances index (prevents infinite loop)", () => {
    const mdxSection = mjs.slice(mjs.indexOf("// Build MDX (--publish mode)"));
    // The merge loop must have mi++ inside it
    expect(mdxSection).toContain("mi++");
    // And uses while (mi < turns.length
    expect(mdxSection).toContain("while (mi < turns.length");
  });

  it("toolbox merge boundary: continues outer loop with 'continue' after merging", () => {
    const mdxSection = mjs.slice(mjs.indexOf("// Build MDX (--publish mode)"));
    // After building the merged toolbox, must 'continue' to skip the normal turn path
    expect(mdxSection).toContain("continue;");
  });
});

// ── Tool error class propagation ──────────────────────────────────────────────

describe("generate-agent-report.mjs — tool is_error class propagation (Loki QA #1050)", () => {
  it("tool-block details element gets has-error class when is_error is true", () => {
    // Check mdxRenderToolBlock emits 'has-error' on the details element
    const fnStart = mjs.indexOf("function mdxRenderToolBlock");
    const fn = mjs.slice(fnStart, fnStart + 400);
    expect(fn).toContain("has-error");
    expect(fn).toContain('tool.is_error ? " has-error" : ""');
  });

  it("tool-output pre element gets 'error' class when is_error is true", () => {
    const fnStart = mjs.indexOf("function mdxRenderToolBlock");
    const fn = mjs.slice(fnStart, fnStart + 600);
    // The pre tag applies 'error' class via template literal when is_error is true
    expect(fn).toContain('tool.is_error ? " error" : ""');
    expect(fn).toContain("tool-output");
  });

  it("turn div gets has-error class when any tool in the turn has is_error", () => {
    const mdxSection = mjs.slice(mjs.indexOf("// Build MDX (--publish mode)"));
    // hasError is computed from turn.tools.some(t => t.is_error)
    expect(mdxSection).toContain("turn.tools.some(t => t.is_error)");
    // And applied to the turn div
    expect(mdxSection).toContain('turn${hasError ? " has-error" : ""}');
  });

  it("merged toolbox turn gets has-error when any merged tool has is_error", () => {
    const mdxSection = mjs.slice(mjs.indexOf("// Build MDX (--publish mode)"));
    // The merge loop must also accumulate hasError
    expect(mdxSection).toContain("turns[mi].tools.some(t => t.is_error)");
  });
});

// ── Tool output truncation ────────────────────────────────────────────────────

describe("generate-agent-report.mjs — tool output sanitization (Loki QA #1050)", () => {
  it("mdxRenderToolOutput calls sanitizeToolOutput for truncation", () => {
    const fnStart = mjs.indexOf("function mdxRenderToolOutput");
    const fn = mjs.slice(fnStart, fnStart + 300);
    expect(fn).toContain("sanitizeToolOutput");
  });

  it("mdxRenderToolOutput passes 800 as char limit to sanitizeToolOutput", () => {
    const fnStart = mjs.indexOf("function mdxRenderToolOutput");
    const fn = mjs.slice(fnStart, fnStart + 500);
    expect(fn).toContain("800");
  });

  it("mdxRenderToolOutput applies mdxEsc after sanitization (XSS safe)", () => {
    const fnStart = mjs.indexOf("function mdxRenderToolOutput");
    const fn = mjs.slice(fnStart, fnStart + 500);
    expect(fn).toContain("mdxEsc");
  });
});

// ── Victory heckle always generates explosion ─────────────────────────────────

describe("generate-agent-report.mjs — victory heckle always fires (Loki QA #1050)", () => {
  it("victoryHeckle() is always called and renders as heckle-explosion", () => {
    const mdxSection = mjs.slice(mjs.indexOf("// Build MDX (--publish mode)"));
    // Victory heckle unconditionally called
    expect(mdxSection).toContain("hecklerEngine.victoryHeckle()");
    // Renders as heckle-explosion (not conditional)
    expect(mdxSection).toContain('"heckle heckle-explosion"');
  });

  it("victory heckle markup is included in the final MDX output", () => {
    const mdxSection = mjs.slice(mjs.indexOf("// Build MDX (--publish mode)"));
    // victoryHeckleMarkup is interpolated into the MDX template string
    expect(mdxSection).toContain("victoryHeckleMarkup");
    // The template includes it — search the full mdxSection for the interpolation
    const templateStart = mdxSection.indexOf("const mdx = `");
    // victoryHeckleMarkup appears ~2353 chars into the template, use 3000 char window
    const templateSrc = mdxSection.slice(templateStart, templateStart + 3000);
    expect(templateSrc).toContain("victoryHeckleMarkup");
  });
});

// ── mdxRenderHeckleEvents null guard ─────────────────────────────────────────

describe("generate-agent-report.mjs — mdxRenderHeckleEvents null guard (Loki QA #1050)", () => {
  it("returns empty string for null events (no heckle turns)", () => {
    const fnStart = mjs.indexOf("function mdxRenderHeckleEvents");
    const fn = mjs.slice(fnStart, fnStart + 200);
    // Must guard against null/undefined
    expect(fn).toContain("if (!events) return");
  });
});

// ── Explosion event structure (no identity, just text) ────────────────────────

describe("generate-agent-report.mjs — explosion event structure (Loki QA #1050)", () => {
  it("explosion event has NO heckle-identity div (full-width plain layout)", () => {
    const fnStart = mjs.indexOf("function mdxRenderHeckleEvents");
    const fn = mjs.slice(fnStart, fnStart + 2000);
    // Isolate the explosion branch
    const explosionStart = fn.indexOf("mayo-explosion");
    const explosionEnd = fn.indexOf("\n      }", explosionStart);
    const explosionBranch = fn.slice(explosionStart, explosionEnd);
    // Explosion must NOT have heckle-identity
    expect(explosionBranch).not.toContain("heckle-identity");
    // Must have ⚡ wrapping
    expect(explosionBranch).toContain("⚡");
  });

  it("explosion event wraps text with ⚡ on both sides", () => {
    const fnStart = mjs.indexOf("function mdxRenderHeckleEvents");
    const fn = mjs.slice(fnStart, fnStart + 2000);
    // ⚡ text ⚡ pattern
    expect(fn).toContain("⚡ ${mdxEsc(event.text)} ⚡");
  });
});

// ── Entrance event fallback name ──────────────────────────────────────────────

describe("generate-agent-report.mjs — entrance event fallback (Loki QA #1050)", () => {
  it("entrance event falls back to 'Mayo Fan' when event.name is missing", () => {
    const fnStart = mjs.indexOf("function mdxRenderHeckleEvents");
    const fn = mjs.slice(fnStart, fnStart + 2000);
    // The fallback assignment in the entrance branch
    expect(fn).toContain('"Mayo Fan"');
    // Must use || pattern for fallback
    expect(fn).toContain('event.name || "Mayo Fan"');
  });
});

// ── mdxHecklerAvatar deterministic hash ──────────────────────────────────────

describe("generate-agent-report.mjs — mdxHecklerAvatar deterministic hash (Loki QA #1050)", () => {
  it("mdxHecklerAvatar uses hash derived from name characters", () => {
    const fnStart = mjs.indexOf("function mdxHecklerAvatar");
    const fn = mjs.slice(fnStart, fnStart + 300);
    // Uses reduce over [...name] for deterministic hash
    expect(fn).toContain("[...name].reduce");
    // Uses charCodeAt
    expect(fn).toContain("charCodeAt");
  });

  it("mdxHecklerAvatar returns path under /hecklers/ prefix", () => {
    const fnStart = mjs.indexOf("function mdxHecklerAvatar");
    const fn = mjs.slice(fnStart, fnStart + 300);
    expect(fn).toContain("/hecklers/");
  });

  it("mdxHecklerAvatar uses Math.abs to avoid negative indices", () => {
    const fnStart = mjs.indexOf("function mdxHecklerAvatar");
    const fn = mjs.slice(fnStart, fnStart + 300);
    expect(fn).toContain("Math.abs");
  });
});

// ── mdxAgentAvatarPath slug map ───────────────────────────────────────────────

describe("generate-agent-report.mjs — mdxAgentAvatarPath slug mapping (Loki QA #1050)", () => {
  it("maps FiremanDecko to fireman-decko slug", () => {
    const fnStart = mjs.indexOf("function mdxAgentAvatarPath");
    const fn = mjs.slice(fnStart, fnStart + 300);
    expect(fn).toContain("FiremanDecko:'fireman-decko'");
  });

  it("maps Loki to loki slug", () => {
    const fnStart = mjs.indexOf("function mdxAgentAvatarPath");
    const fn = mjs.slice(fnStart, fnStart + 300);
    expect(fn).toContain("Loki:'loki'");
  });

  it("returns path ending in -dark.png for dark theme chronicles", () => {
    const fnStart = mjs.indexOf("function mdxAgentAvatarPath");
    const fn = mjs.slice(fnStart, fnStart + 300);
    expect(fn).toContain("-dark.png");
  });
});

// ── CSS dark/light theme compatibility ───────────────────────────────────────

describe("chronicle.css — dark/light theme does not break heckle classes (Loki QA #1050)", () => {
  it("has @media prefers-color-scheme: light override", () => {
    expect(css).toContain("@media (prefers-color-scheme: light)");
  });

  it("has .dark explicit override class for next-themes", () => {
    expect(css).toContain(".dark {");
  });

  it(".heckle class is defined AFTER theme vars so it inherits correctly", () => {
    // heckle must be defined after the custom property blocks
    const hecklePos = css.indexOf(".heckle {");
    const darkPos = css.indexOf(".dark {");
    // .heckle must come after .dark theme block
    expect(hecklePos).toBeGreaterThan(darkPos);
  });
});

// ── .heckle base width constraint ────────────────────────────────────────────

describe("chronicle.css — heckle width constraints (Loki QA #1050)", () => {
  it(".heckle base has max-width: 60% for chat bubble sizing", () => {
    const heckleStart = css.indexOf(".heckle {");
    const heckleEnd = css.indexOf("}", heckleStart);
    const heckleBlock = css.slice(heckleStart, heckleEnd);
    expect(heckleBlock).toContain("max-width: 60%");
  });

  it(".heckle-explosion overrides to max-width: 100% for full-width rage", () => {
    const explosionStart = css.indexOf(".heckle-explosion {");
    const explosionEnd = css.indexOf("}", explosionStart);
    const explosionBlock = css.slice(explosionStart, explosionEnd);
    expect(explosionBlock).toContain("max-width: 100%");
  });

  it(".heckle-mayo identity uses flex-direction: row-reverse (name before avatar visually)", () => {
    expect(css).toContain(".heckle-mayo .heckle-identity");
    expect(css).toContain("flex-direction: row-reverse");
  });
});
