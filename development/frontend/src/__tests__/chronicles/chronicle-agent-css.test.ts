/**
 * chronicle-agent-css.test.ts
 *
 * Vitest suite validating development/frontend/src/app/chronicles/chronicle.css.
 * This file is the canonical shared CSS for Fenrir Ledger agent reports —
 * used by both the HTML report generator (brandify-agent) and future
 * Next.js chronicle pages.
 *
 * Ref: GitHub Issue #1048 — Extract shared Norse chronicle CSS
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const CSS_PATH = resolve(__dirname, "../../app/chronicles/chronicle.css");

let css: string;

beforeAll(() => {
  css = readFileSync(CSS_PATH, "utf-8");
});

// ── File existence ──────────────────────────────────────────────────────────

describe("chronicle.css — file existence", () => {
  it("exists at the expected path", () => {
    expect(css).toBeTruthy();
    expect(css.length).toBeGreaterThan(1000);
  });

  it("is importable from Next.js via @/app/chronicles/chronicle.css", () => {
    // The file must exist at src/app/chronicles/chronicle.css
    // (@ maps to ./src/, so @/app/chronicles/chronicle.css is valid)
    expect(() => readFileSync(CSS_PATH, "utf-8")).not.toThrow();
  });
});

// ── CSS Custom Properties ───────────────────────────────────────────────────

describe("chronicle.css — CSS custom properties", () => {
  it("defines dark theme vars in :root", () => {
    expect(css).toContain("--void:");
    expect(css).toContain("--forge:");
    expect(css).toContain("--chain:");
    expect(css).toContain("--gold:");
    expect(css).toContain("--teal-asgard:");
    expect(css).toContain("--text-saga:");
    expect(css).toContain("--red-ragnarok:");
    expect(css).toContain("--fire-muspel:");
    expect(css).toContain("--amber-hati:");
  });

  it("has dark theme as :root default", () => {
    // Dark hex values should be in :root block
    expect(css).toContain("--void:         #07070d");
    expect(css).toContain("--gold:         #c9920a");
  });

  it("defines light theme via prefers-color-scheme: light", () => {
    expect(css).toContain("prefers-color-scheme: light");
    // Light theme void is a light colour
    expect(css).toContain("--void:         #f5f3ee");
  });

  it("defines .dark class override for next-themes compatibility", () => {
    expect(css).toContain(".dark {");
    // Dark .dark class restores void to darkest value
    expect(css).toContain("--void:         #07070d");
  });

  it("defines surface aliases", () => {
    expect(css).toContain("--surface-base:");
    expect(css).toContain("--surface-raised:");
    expect(css).toContain("--surface-hover:");
    expect(css).toContain("--border-subtle:");
    expect(css).toContain("--border-strong:");
  });
});

// ── Component: decree ───────────────────────────────────────────────────────

describe("chronicle.css — component: decree", () => {
  it("has .decree selector", () => {
    expect(css).toContain(".decree {");
  });

  it("has .decree-title", () => {
    expect(css).toContain(".decree-title {");
  });

  it("has .decree-body", () => {
    expect(css).toContain(".decree-body {");
  });

  it("has .decree-law for blockquote-style rules", () => {
    expect(css).toContain(".decree-law {");
  });

  it("has .decree-seal elements", () => {
    expect(css).toContain(".decree-seal {");
    expect(css).toContain(".decree-seal-glyph {");
    expect(css).toContain(".decree-seal-text {");
  });

  it("has gold border decoration on decree", () => {
    const decreeBlock = css.slice(css.indexOf(".decree {"), css.indexOf(".decree-header {"));
    expect(decreeBlock).toContain("var(--gold)");
  });
});

// ── Component: agent-callback ───────────────────────────────────────────────

describe("chronicle.css — component: agent-callback", () => {
  it("has .agent-callback selector", () => {
    expect(css).toContain(".agent-callback {");
  });

  it("has .callback-declaration and .callback-quote", () => {
    expect(css).toContain(".callback-declaration {");
    expect(css).toContain(".callback-quote {");
  });

  it("has .callback-blood-seal and .callback-wolf", () => {
    expect(css).toContain(".callback-blood-seal {");
    expect(css).toContain(".callback-wolf {");
  });
});

// ── Component: turn / turn-box ──────────────────────────────────────────────

describe("chronicle.css — component: turn/turn-box", () => {
  it("has .turn and .turn-box selectors", () => {
    expect(css).toContain(".turn {");
    expect(css).toContain(".turn-box {");
  });

  it("has .turn-header with collapsible chevron", () => {
    expect(css).toContain(".turn-header {");
    expect(css).toContain(".turn-header .chevron {");
    expect(css).toContain(".turn-box.open .turn-header .chevron {");
  });

  it("has .turn-body that hides by default", () => {
    expect(css).toContain(".turn-body {");
    expect(css).toContain("display: none;");
    expect(css).toContain(".turn-box.open .turn-body {");
  });

  it("has .thinking block", () => {
    expect(css).toContain(".thinking {");
  });

  it("has .tool-badge variants for bash/read/edit/write/todo", () => {
    // CSS may use extra spaces before { for alignment
    expect(css).toMatch(/\.tool-badge\.bash\s*\{/);
    expect(css).toMatch(/\.tool-badge\.read\s*\{/);
    expect(css).toMatch(/\.tool-badge\.edit\s*\{/);
    expect(css).toMatch(/\.tool-badge\.write\s*\{/);
    expect(css).toMatch(/\.tool-badge\.todo\s*\{/);
  });
});

// ── Component: toolbox ──────────────────────────────────────────────────────

describe("chronicle.css — component: toolbox", () => {
  it("has .toolbox selector", () => {
    expect(css).toContain(".toolbox {");
  });

  it("has .tool-block and .tool-block-header", () => {
    expect(css).toContain(".tool-block {");
    expect(css).toContain(".tool-block-header {");
  });

  it("has .tool-input and .tool-output", () => {
    expect(css).toContain(".tool-input {");
    expect(css).toContain(".tool-output {");
  });

  it("has .tool-output.error variant", () => {
    expect(css).toContain(".tool-output.error {");
  });
});

// ── Component: text-block (chat bubble) ────────────────────────────────────

describe("chronicle.css — component: text-block", () => {
  it("has .text-block selector", () => {
    expect(css).toContain(".text-block {");
  });

  it("uses teal-asgard background for agent text", () => {
    const textBlock = css.slice(
      css.indexOf(".text-block {"),
      css.indexOf(".text-block {") + 300,
    );
    expect(textBlock).toContain("rgba(10, 140, 110");
  });
});

// ── Component: heckle ──────────────────────────────────────────────────────

describe("chronicle.css — component: heckle (chat bubbles)", () => {
  it("has .heckle base selector", () => {
    expect(css).toContain(".heckle {");
  });

  it("has .heckle-mayo (heckler, right-aligned)", () => {
    expect(css).toContain(".heckle-mayo {");
  });

  it("has .heckle-comeback (agent response, left-aligned)", () => {
    expect(css).toMatch(/\.heckle-comeback\s+\.heckle-name\s*\{/);
  });

  it("has .heckle-avatar with border", () => {
    expect(css).toContain(".heckle-avatar {");
    expect(css).toContain(".heckle-name {");
    expect(css).toContain(".heckle-text {");
  });

  it("has .heckle-entrance (arrival announcement)", () => {
    expect(css).toContain(".heckle-entrance {");
  });
});

// ── Component: heckle-explosion ────────────────────────────────────────────

describe("chronicle.css — component: heckle-explosion", () => {
  it("has .heckle-explosion selector", () => {
    expect(css).toContain(".heckle-explosion {");
  });

  it("uses red-ragnarok border colour", () => {
    const explosion = css.slice(
      css.indexOf(".heckle-explosion {"),
      css.indexOf(".heckle-explosion {") + 600,
    );
    expect(explosion).toContain("var(--red-ragnarok)");
  });

  it("has ::before and ::after rune decorators", () => {
    expect(css).toContain(".heckle-explosion::before {");
    expect(css).toContain(".heckle-explosion::after {");
  });

  it("uses norse-tremble animation", () => {
    const explosion = css.slice(
      css.indexOf(".heckle-explosion {"),
      css.indexOf(".heckle-explosion {") + 600,
    );
    expect(explosion).toContain("norse-tremble");
  });
});

// ── Component: verdict ─────────────────────────────────────────────────────

describe("chronicle.css — component: verdict", () => {
  it("has .verdict selector", () => {
    expect(css).toContain(".verdict {");
  });

  it("has .verdict.pass and .verdict.fail variants", () => {
    expect(css).toMatch(/\.verdict\.pass\s*\{/);
    expect(css).toMatch(/\.verdict\.fail\s*\{/);
  });
});

// ── Animations ─────────────────────────────────────────────────────────────

describe("chronicle.css — animations", () => {
  it("defines @keyframes norse-tremble", () => {
    expect(css).toContain("@keyframes norse-tremble {");
  });

  it("defines @keyframes explosion-glow", () => {
    expect(css).toContain("@keyframes explosion-glow {");
  });

  it("norse-tremble has 10 keyframe stops", () => {
    const trembleBlock = css.slice(
      css.indexOf("@keyframes norse-tremble {"),
      css.indexOf("@keyframes norse-tremble {") + 600,
    );
    // Should have 0%, 10%, 20%, ..., 100%
    const stops = trembleBlock.match(/\d+%/g) || [];
    expect(stops.length).toBeGreaterThanOrEqual(10);
  });
});

// ── Layout / Base ───────────────────────────────────────────────────────────

describe("chronicle.css — layout and base", () => {
  it("has .report container", () => {
    expect(css).toContain(".report {");
  });

  it("has responsive media queries", () => {
    expect(css).toContain("@media (max-width:");
  });

  it("has .stats-grid and .stats-card", () => {
    expect(css).toContain(".stats-grid {");
    expect(css).toContain(".stats-card {");
  });

  it("has .report-footer", () => {
    expect(css).toContain(".report-footer {");
  });

  it("has custom scrollbar styles", () => {
    expect(css).toMatch(/::-webkit-scrollbar\s*\{/);
  });
});

// ── Fonts ──────────────────────────────────────────────────────────────────

describe("chronicle.css — font imports", () => {
  it("imports Cinzel family", () => {
    expect(css).toContain("Cinzel");
  });

  it("imports Source Serif 4", () => {
    expect(css).toContain("Source+Serif+4");
  });

  it("imports JetBrains Mono", () => {
    expect(css).toContain("JetBrains+Mono");
  });
});
