/**
 * chronicle-norse-css.test.ts
 *
 * Vitest suite validating the chronicle-norse.css file structure and content.
 * Ensures all required Norse component classes are present and the CSS is
 * correctly scoped under .chronicle-page.
 *
 * Ref: GitHub Issue #1047 — Luna wireframes + FiremanDecko implementation
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const CSS_PATH = resolve(
  __dirname,
  "../../app/(marketing)/chronicles/chronicle-norse.css",
);

let css: string;

beforeAll(() => {
  css = readFileSync(CSS_PATH, "utf-8");
});

// ── File existence ─────────────────────────────────────────────────────────

describe("chronicle-norse.css — file existence", () => {
  it("exists at the expected path", () => {
    expect(css).toBeTruthy();
    expect(css.length).toBeGreaterThan(100);
  });
});

// ── Scope ─────────────────────────────────────────────────────────────────

describe("chronicle-norse.css — scoped under .chronicle-page", () => {
  it("all component selectors are scoped under .chronicle-page", () => {
    // Every non-comment rule block should start with .chronicle-page
    const ruleBlocks = css.match(/^\.[\w-]+\s*\{/gm) || [];
    // There should be no top-level class selectors other than .chronicle-page itself
    const unscoped = ruleBlocks.filter((r) => !r.startsWith(".chronicle-page"));
    expect(unscoped).toHaveLength(0);
  });
});

// ── Component 1: All-Father's Decree ──────────────────────────────────────

describe("chronicle-norse.css — Decree component", () => {
  it("defines .chronicle-page .decree", () => {
    expect(css).toContain(".chronicle-page .decree {");
  });

  it("decree has 2px border", () => {
    const decreeBlock = css.match(/\.chronicle-page \.decree \{[^}]+\}/s)?.[0] ?? "";
    expect(decreeBlock).toContain("border: 2px solid");
  });

  it("defines .decree-title (Cinzel Decorative)", () => {
    expect(css).toContain(".chronicle-page .decree-title");
    expect(css).toContain("Cinzel Decorative");
  });

  it("defines .decree-law with left border accent", () => {
    expect(css).toContain(".chronicle-page .decree-law");
    const lawBlock = css.match(/\.chronicle-page \.decree-law \{[^}]+\}/s)?.[0] ?? "";
    expect(lawBlock).toContain("border-left:");
  });

  it("defines .decree-oath", () => {
    expect(css).toContain(".chronicle-page .decree-oath");
  });

  it("defines .decree-seal", () => {
    expect(css).toContain(".chronicle-page .decree-seal");
  });

  it("defines .decree-rune-row", () => {
    expect(css).toContain(".chronicle-page .decree-rune-row");
  });

  it("has mobile responsive rule reducing decree padding at ≤480px", () => {
    // Should contain a 480px media query that targets .decree
    const mobileSection = css.match(/@media \(max-width: 480px\) \{[^}]*\.chronicle-page \.decree[^}]*\}/s)?.[0] ?? "";
    expect(mobileSection).toContain(".chronicle-page .decree");
  });
});

// ── Component 2: Agent Callback Footer ─────────────────────────────────────

describe("chronicle-norse.css — Agent Callback Footer", () => {
  it("defines .chronicle-page .agent-callback", () => {
    expect(css).toContain(".chronicle-page .agent-callback {");
  });

  it("agent-callback has 2px border", () => {
    const block = css.match(/\.chronicle-page \.agent-callback \{[^}]+\}/s)?.[0] ?? "";
    expect(block).toContain("border: 2px solid");
  });

  it("defines .callback-declaration", () => {
    expect(css).toContain(".chronicle-page .callback-declaration");
  });

  it("defines .callback-quote with max-width 70%", () => {
    expect(css).toContain(".chronicle-page .callback-quote");
    const block = css.match(/\.chronicle-page \.callback-quote \{[^}]+\}/s)?.[0] ?? "";
    expect(block).toContain("max-width: 70%");
  });

  it("defines .callback-blood-seal", () => {
    expect(css).toContain(".chronicle-page .callback-blood-seal");
  });

  it("defines .callback-wolf", () => {
    expect(css).toContain(".chronicle-page .callback-wolf");
  });

  it("defines .callback-avatar-wrap", () => {
    expect(css).toContain(".chronicle-page .callback-avatar-wrap");
  });
});

// ── Component 3: Chat Bubbles ──────────────────────────────────────────────

describe("chronicle-norse.css — Chat Bubbles", () => {
  it("defines .heckle-comeback (agent, left-aligned)", () => {
    expect(css).toContain(".chronicle-page .heckle-comeback {");
  });

  it("defines .heckle-mayo (heckler, right-aligned)", () => {
    expect(css).toContain(".chronicle-page .heckle-mayo {");
  });

  it("heckle-comeback has max-width 60%", () => {
    const block = css.match(/\.chronicle-page \.heckle-comeback \{[^}]+\}/s)?.[0] ?? "";
    expect(block).toContain("max-width: 60%");
  });

  it("heckle-mayo is right-aligned with margin-left: auto", () => {
    const block = css.match(/\.chronicle-page \.heckle-mayo \{[^}]+\}/s)?.[0] ?? "";
    expect(block).toContain("margin-left: auto");
  });

  it("heckle-mayo identity row is row-reverse", () => {
    const block = css.match(/\.chronicle-page \.heckle-mayo \.heckle-identity \{[^}]+\}/s)?.[0] ?? "";
    expect(block).toContain("row-reverse");
  });

  it("defines .heckle-identity (flex row)", () => {
    expect(css).toContain(".chronicle-page .heckle-identity");
  });

  it("defines .heckle-name (Cinzel, 0.75rem bold)", () => {
    expect(css).toContain(".chronicle-page .heckle-name");
    const block = css.match(/\.chronicle-page \.heckle-name \{[^}]+\}/s)?.[0] ?? "";
    expect(block).toContain("Cinzel");
  });

  it("defines .heckle-avatar with border-radius 50%", () => {
    expect(css).toContain(".chronicle-page .heckle-avatar");
    const block = css.match(/\.chronicle-page \.heckle-avatar \{[^}]+\}/s)?.[0] ?? "";
    expect(block).toContain("border-radius: 50%");
  });

  it("has mobile breakpoint changing bubbles to 90% max-width at ≤480px", () => {
    expect(css).toContain("@media (max-width: 480px)");
    expect(css).toContain("max-width: 90%");
  });
});

// ── Component 4: Agent Turns & Toolbox ────────────────────────────────────

describe("chronicle-norse.css — Agent Turns & Toolbox", () => {
  it("defines .agent-turn using <details>", () => {
    expect(css).toContain(".chronicle-page .agent-turn {");
  });

  it("agent-turn summary has list-style: none", () => {
    const block = css.match(/\.chronicle-page \.agent-turn > summary \{[^}]+\}/s)?.[0] ?? "";
    expect(block).toContain("list-style: none");
  });

  it("chevron rotates 90deg when [open]", () => {
    expect(css).toContain(".chronicle-page .agent-turn[open] > summary::before");
    const block = css.match(/\.chronicle-page \.agent-turn\[open\] > summary::before \{[^}]+\}/s)?.[0] ?? "";
    expect(block).toContain("rotate(90deg)");
  });

  it("chevron transition is 0.15s ease", () => {
    const block = css.match(/\.chronicle-page \.agent-turn > summary::before \{[^}]+\}/s)?.[0] ?? "";
    expect(block).toContain("transition: transform 0.15s ease");
  });

  it("defines .agent-turn-error state with red border", () => {
    expect(css).toContain(".chronicle-page .agent-turn.agent-turn-error");
  });

  it("defines .agent-thinking with max-height 180px", () => {
    expect(css).toContain(".chronicle-page .agent-thinking");
    const block = css.match(/\.chronicle-page \.agent-thinking \{[^}]+\}/s)?.[0] ?? "";
    expect(block).toContain("max-height: 180px");
  });

  it("thinking block has rune prefix via ::before", () => {
    expect(css).toContain(".chronicle-page .agent-thinking::before");
    const block = css.match(/\.chronicle-page \.agent-thinking::before \{[^}]+\}/s)?.[0] ?? "";
    expect(block).toContain("ᛒ");
  });

  it("defines .agent-toolbox with max-width 60%", () => {
    expect(css).toContain(".chronicle-page .agent-toolbox {");
    const block = css.match(/\.chronicle-page \.agent-toolbox \{[^}]+\}/s)?.[0] ?? "";
    expect(block).toContain("max-width: 60%");
  });

  it("defines .agent-tool-block (nested details)", () => {
    expect(css).toContain(".chronicle-page .agent-tool-block {");
  });

  it("tool input has blue-tint background (rgba 107,138,253)", () => {
    expect(css).toContain(".chronicle-page .agent-tool-input");
    // #6b8afd = rgb(107, 138, 253) — blue tint specified in wireframe
    expect(css).toContain("107, 138, 253");
  });

  it("tool output has max-height 350px with scroll", () => {
    expect(css).toContain(".chronicle-page .agent-tool-output");
    const block = css.match(/\.chronicle-page \.agent-tool-output \{[^}]+\}/s)?.[0] ?? "";
    expect(block).toContain("max-height: 350px");
    expect(block).toContain("overflow-y: auto");
  });

  it("hides tool badges on mobile ≤480px", () => {
    expect(css).toContain("@media (max-width: 480px)");
    expect(css).toContain(".agent-turn-badges");
    expect(css).toContain("display: none");
  });

  it("toolbox expands to 100% on mobile", () => {
    expect(css).toContain("@media (max-width: 480px)");
    expect(css).toContain(".agent-toolbox");
    expect(css).toContain("max-width: 100%");
  });
});

// ── Component 5: Explosion / Entrance ─────────────────────────────────────

describe("chronicle-norse.css — Explosion & Entrance Events", () => {
  it("defines .heckle-explosion with 2px solid border", () => {
    expect(css).toContain(".chronicle-page .heckle-explosion {");
    const block = css.match(/\.chronicle-page \.heckle-explosion \{[^}]+\}/s)?.[0] ?? "";
    expect(block).toContain("border: 2px solid");
  });

  it("defines .heckle-entrance with dashed border", () => {
    expect(css).toContain(".chronicle-page .heckle-entrance {");
    const block = css.match(/\.chronicle-page \.heckle-entrance \{[^}]+\}/s)?.[0] ?? "";
    expect(block).toContain("dashed");
  });

  it("defines .explosion-main with uppercase font", () => {
    expect(css).toContain(".chronicle-page .explosion-main");
    const block = css.match(/\.chronicle-page \.explosion-main \{[^}]+\}/s)?.[0] ?? "";
    expect(block).toContain("uppercase");
  });

  it("explosion text uses clamp() for responsive font size", () => {
    const block = css.match(/\.chronicle-page \.explosion-main \{[^}]+\}/s)?.[0] ?? "";
    expect(block).toContain("clamp(");
  });

  it("defines .explosion-rune-pre and .explosion-rune-post", () => {
    expect(css).toContain(".chronicle-page .explosion-rune-pre");
    expect(css).toContain(".chronicle-page .explosion-rune-post");
  });

  it("entrance identity row is row-reverse (right-aligned)", () => {
    expect(css).toContain(".chronicle-page .heckle-entrance .heckle-identity");
    const block = css.match(/\.chronicle-page \.heckle-entrance \.heckle-identity \{[^}]+\}/s)?.[0] ?? "";
    expect(block).toContain("row-reverse");
  });

  it("entrance heckle-name uses amber color (--c-amber)", () => {
    const block = css.match(/\.chronicle-page \.heckle-entrance \.heckle-name \{[^}]+\}/s)?.[0] ?? "";
    expect(block).toContain("--c-amber");
  });
});

// ── Animations ────────────────────────────────────────────────────────────

describe("chronicle-norse.css — Animations", () => {
  it("defines @keyframes norse-tremble", () => {
    expect(css).toContain("@keyframes norse-tremble");
  });

  it("norse-tremble has translate and rotate transforms", () => {
    const block = css.match(/@keyframes norse-tremble \{[\s\S]*?\}/)?.[0] ?? "";
    expect(block).toContain("translate(");
    expect(block).toContain("rotate(");
  });

  it("defines @keyframes explosion-glow", () => {
    expect(css).toContain("@keyframes explosion-glow");
  });

  it("heckle-explosion animation is wrapped in prefers-reduced-motion: no-preference (WCAG)", () => {
    expect(css).toContain("@media (prefers-reduced-motion: no-preference)");
    const mediaBlock = css.match(/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\}/)?.[0] ?? "";
    expect(mediaBlock).toContain(".heckle-explosion");
    expect(mediaBlock).toContain("norse-tremble");
  });

  it("animation duration is 0.8s ease-in-out", () => {
    expect(css).toContain("0.8s ease-in-out");
  });
});

// ── Agent Verdict ──────────────────────────────────────────────────────────

describe("chronicle-norse.css — Agent Verdict", () => {
  it("defines .agent-verdict", () => {
    expect(css).toContain(".chronicle-page .agent-verdict {");
  });

  it("defines .verdict-pass and .verdict-fail variants", () => {
    expect(css).toContain(".chronicle-page .agent-verdict.verdict-pass");
    expect(css).toContain(".chronicle-page .agent-verdict.verdict-fail");
  });

  it("defines .agent-verdict-label", () => {
    expect(css).toContain(".chronicle-page .agent-verdict-label");
  });
});
