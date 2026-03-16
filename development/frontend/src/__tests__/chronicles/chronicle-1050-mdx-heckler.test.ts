/**
 * chronicle-1050-mdx-heckler.test.ts
 *
 * Vitest suite validating Issue #1050 MDX heckler bubbles implementation:
 * - chronicle.css has correct heckle classes (mayo, comeback, entrance, explosion)
 * - chronicle.css has details.turn-box[open] and details.tool-block[open] support
 * - chronicle.css has .agent-turns-section / .agent-turns-title
 * - generate-agent-report.mjs MDX path uses correct class names
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

// ── Heckle bubble CSS classes ─────────────────────────────────────────────────

describe("chronicle.css — heckle bubble classes (issue #1050)", () => {
  it("has .heckle base class", () => {
    expect(css).toContain(".heckle {");
    expect(css).toContain("max-width: 60%");
  });

  it("has .heckle-mayo right-aligned with margin-left: auto", () => {
    expect(css).toContain(".heckle-mayo");
    expect(css).toContain("margin-left: auto");
  });

  it("has .heckle-mayo red styling (red-ragnarok)", () => {
    expect(css).toContain(".heckle-mayo .heckle-name");
    expect(css).toContain("color: var(--red-ragnarok)");
  });

  it("has .heckle-mayo heckle-text with red border and right bubble shape", () => {
    expect(css).toContain(".heckle-mayo .heckle-text");
    expect(css).toContain("rgba(239, 68, 68, 0.12)");
    // Right-shaped bubble: 0.5rem 0 0.5rem 0.5rem (top-right corner flat)
    expect(css).toContain("0.5rem 0 0.5rem 0.5rem");
  });

  it("has .heckle-comeback left-aligned Norse styling", () => {
    expect(css).toContain(".heckle-comeback .heckle-name");
    expect(css).toContain(".heckle-comeback .heckle-text");
    // Uses teal for heckle-name/avatar per existing CSS (Norse/Asgard color)
    expect(css).toContain("color: var(--teal-asgard)");
  });

  it("has .heckle-entrance announcement styling with amber", () => {
    expect(css).toContain(".heckle-entrance");
    expect(css).toContain(".heckle-entrance .heckle-name");
    expect(css).toContain("color: var(--amber-hati)");
  });

  it("has .heckle-explosion full-width with red ragnarok styling", () => {
    expect(css).toContain(".heckle-explosion");
    expect(css).toContain("border: 2px solid var(--red-ragnarok)");
    expect(css).toContain("max-width: 100%");
    expect(css).toContain("font-family: 'Cinzel', serif");
  });

  it("has .heckle-explosion::before rune row", () => {
    expect(css).toContain(".heckle-explosion::before");
    // Rune content
    expect(css).toContain("ᛏ ᚦ ᛊ ᚨ ᛗ");
  });

  it("has .heckle-explosion::after rune row", () => {
    expect(css).toContain(".heckle-explosion::after");
    expect(css).toContain("᛭ ᛭ ᛭");
  });

  it("has norse-tremble animation applied to heckle-explosion", () => {
    expect(css).toContain("animation: norse-tremble");
    expect(css).toContain("@keyframes norse-tremble");
  });
});

// ── Details/summary native collapse support ───────────────────────────────────

describe("chronicle.css — details.turn-box MDX support (issue #1050)", () => {
  it("has details.turn-box > summary list-style none", () => {
    expect(css).toContain("details.turn-box > summary");
    expect(css).toContain("list-style: none");
  });

  it("has details.turn-box[open] .turn-body display block", () => {
    expect(css).toContain("details.turn-box[open] .turn-body");
    expect(css).toContain("display: block");
  });

  it("has details.tool-block > summary", () => {
    expect(css).toContain("details.tool-block > summary");
  });

  it("has details.tool-block[open] .tool-block-body display block", () => {
    expect(css).toContain("details.tool-block[open] .tool-block-body");
  });
});

// ── Agent turns section CSS ───────────────────────────────────────────────────

describe("chronicle.css — .agent-turns-section (issue #1050)", () => {
  it("has .agent-turns-section", () => {
    expect(css).toContain(".agent-turns-section");
  });

  it("has .agent-turns-title with Cinzel font", () => {
    expect(css).toContain(".agent-turns-title");
    expect(css).toContain("font-family: 'Cinzel', serif");
  });
});

// ── MDX generator uses correct class names ────────────────────────────────────

describe("generate-agent-report.mjs — MDX class name correctness (issue #1050)", () => {
  it("uses turn-box (not agent-turn) for turn wrappers", () => {
    // Find the MDX path section
    const mdxSection = mjs.slice(mjs.indexOf("// Build MDX (--publish mode)"));
    expect(mdxSection).toContain('"turn-box"');
    expect(mdxSection).not.toContain('"agent-turn"');
  });

  it("uses turn-header for summary element", () => {
    const mdxSection = mjs.slice(mjs.indexOf("// Build MDX (--publish mode)"));
    expect(mdxSection).toContain('"turn-header"');
  });

  it("uses turn-body for body element", () => {
    const mdxSection = mjs.slice(mjs.indexOf("// Build MDX (--publish mode)"));
    expect(mdxSection).toContain('"turn-body"');
  });

  it("uses text-block (not agent-text-block) for agent text", () => {
    const mdxSection = mjs.slice(mjs.indexOf("// Build MDX (--publish mode)"));
    expect(mdxSection).toContain('"text-block"');
    expect(mdxSection).not.toContain('"agent-text-block"');
  });

  it("uses thinking (not agent-thinking) for thinking blocks", () => {
    const mdxSection = mjs.slice(mjs.indexOf("// Build MDX (--publish mode)"));
    expect(mdxSection).toContain('"thinking"');
    expect(mdxSection).not.toContain('"agent-thinking"');
  });

  it("uses tool-block (not agent-tool-block) for tool blocks", () => {
    const mdxSection = mjs.slice(mjs.indexOf("// Build MDX (--publish mode)"));
    expect(mdxSection).toContain('"tool-block"');
    expect(mdxSection).not.toContain('"agent-tool-block"');
  });

  it("uses tool-badge (not agent-tool-badge) for badges", () => {
    // Slice just the MDX turns section (between publish mode and HTML section)
    const start = mjs.indexOf("// Build MDX (--publish mode)");
    const end = mjs.indexOf("// Build HTML");
    const mdxSection = mjs.slice(start, end > start ? end : undefined);
    expect(mdxSection).toContain('"tool-badge ');
    expect(mdxSection).not.toContain('"agent-tool-badge"');
  });

  it("uses toolbox class for merged tool groups", () => {
    const mdxSection = mjs.slice(mjs.indexOf("// Build MDX (--publish mode)"));
    expect(mdxSection).toContain('"toolbox"');
  });

  it("uses stats-grid/stats-card (not agent-stats/stat-card) for stats", () => {
    const mdxSection = mjs.slice(mjs.indexOf("// Build MDX (--publish mode)"));
    expect(mdxSection).toContain('"stats-grid"');
    expect(mdxSection).toContain('"stats-card"');
    expect(mdxSection).not.toContain('"agent-stats"');
    expect(mdxSection).not.toContain('"stat-card"');
  });

  it("uses verdict.pass/fail (not agent-verdict) for verdict", () => {
    const start = mjs.indexOf("// Build MDX (--publish mode)");
    const end = mjs.indexOf("// Build HTML");
    const mdxSection = mjs.slice(start, end > start ? end : undefined);
    // className is "verdict pass" or "verdict fail" — check for the class prefix
    expect(mdxSection).toContain('"verdict ');
    expect(mdxSection).not.toContain('"agent-verdict"');
  });

  it("uses report (not agent-report) as top-level container", () => {
    const mdxSection = mjs.slice(mjs.indexOf("// Build MDX (--publish mode)"));
    expect(mdxSection).toContain('"report"');
    expect(mdxSection).not.toContain('"agent-report"');
  });
});

// ── Heckle rendering in MDX ───────────────────────────────────────────────────

describe("generate-agent-report.mjs — MDX heckle event rendering (issue #1050)", () => {
  it("renders mayo heckle as heckle heckle-mayo with right-aligned identity (name first)", () => {
    const mjsText = mjs;
    // Find mdxRenderHeckleEvents function
    const fnStart = mjsText.indexOf("function mdxRenderHeckleEvents");
    const fnEnd = mjsText.indexOf("\n  }", fnStart + 100) + 4;
    const fn = mjsText.slice(fnStart, fnEnd);

    expect(fn).toContain("heckle-mayo");
    // Mayo: name BEFORE avatar (right-aligned identity)
    const mayoBlock = fn.slice(fn.indexOf("heckle-mayo"), fn.indexOf("heckle-comeback"));
    const namePos = mayoBlock.indexOf("heckle-name");
    const avatarPos = mayoBlock.indexOf("heckle-avatar");
    expect(namePos).toBeLessThan(avatarPos);
  });

  it("renders comeback heckle as heckle heckle-comeback with agent avatar first", () => {
    const fnStart = mjs.indexOf("function mdxRenderHeckleEvents");
    const fn = mjs.slice(fnStart, fnStart + 2000);

    expect(fn).toContain("heckle-comeback");
    // Comeback: avatar BEFORE name (left-aligned identity)
    const comebackBlock = fn.slice(fn.indexOf("heckle-comeback"), fn.indexOf("heckle-entrance"));
    const avatarPos = comebackBlock.indexOf("heckle-avatar");
    const namePos = comebackBlock.indexOf("heckle-name");
    expect(avatarPos).toBeLessThan(namePos);
  });

  it("renders entrance heckle as heckle heckle-entrance", () => {
    const fnStart = mjs.indexOf("function mdxRenderHeckleEvents");
    const fn = mjs.slice(fnStart, fnStart + 2000);
    expect(fn).toContain("heckle-entrance");
  });

  it("renders explosion heckle as heckle heckle-explosion with ⚡ wrapping", () => {
    const fnStart = mjs.indexOf("function mdxRenderHeckleEvents");
    const fn = mjs.slice(fnStart, fnStart + 2000);
    expect(fn).toContain("heckle-explosion");
    expect(fn).toContain("⚡");
  });

  it("includes turn-agent-profile with agent avatar in turn rendering", () => {
    const mdxSection = mjs.slice(mjs.indexOf("// Build MDX (--publish mode)"));
    expect(mdxSection).toContain("turn-agent-profile");
    expect(mdxSection).toContain("turn-agent-avatar");
    expect(mdxSection).toContain("turn-agent-title");
  });

  it("merges consecutive tool-only turns into single toolbox", () => {
    const mdxSection = mjs.slice(mjs.indexOf("// Build MDX (--publish mode)"));
    expect(mdxSection).toContain("mdxIsToolOnly");
    expect(mdxSection).toContain("mergedTools");
    expect(mdxSection).toContain("toolbox");
  });
});
