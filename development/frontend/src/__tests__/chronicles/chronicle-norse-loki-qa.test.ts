/**
 * chronicle-norse-loki-qa.test.ts
 *
 * Loki QA suite — devil's advocate validation for Issue #1047.
 * Covers acceptance criteria gaps, token hygiene, responsive edge cases,
 * page integration, and component completeness not captured in the
 * FiremanDecko implementation tests.
 *
 * Ref: GitHub Issue #1047 acceptance criteria
 *      ux/wireframes/chronicles/interaction-spec.md
 *      ux/wireframes/chronicles/norse-components-catalog.html
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const CSS_PATH = resolve(
  __dirname,
  "../../app/(marketing)/chronicles/chronicle-norse.css",
);

const PAGE_PATH = resolve(
  __dirname,
  "../../app/(marketing)/chronicles/[slug]/page.tsx",
);

let css: string;
let page: string;

beforeAll(() => {
  css = readFileSync(CSS_PATH, "utf-8");
  page = readFileSync(PAGE_PATH, "utf-8");
});

// ── Acceptance Criterion: Page integration ─────────────────────────────────

describe("AC: chronicle-norse.css is imported in [slug]/page.tsx", () => {
  it("page.tsx imports chronicle-norse.css", () => {
    expect(page).toContain('import "../chronicle-norse.css"');
  });

  it("chronicle-norse.css import comes after chronicle.css import", () => {
    const chronicleIdx = page.indexOf('import "../chronicle.css"');
    const norseIdx = page.indexOf('import "../chronicle-norse.css"');
    expect(chronicleIdx).toBeGreaterThan(-1);
    expect(norseIdx).toBeGreaterThan(-1);
    expect(norseIdx).toBeGreaterThan(chronicleIdx);
  });
});

// ── Acceptance Criterion: File substance ──────────────────────────────────

describe("AC: chronicle-norse.css file substance", () => {
  it("CSS file is substantial (>5000 chars)", () => {
    expect(css.length).toBeGreaterThan(5000);
  });

  it("contains at least 5 component sections", () => {
    const componentHeaders = (css.match(/COMPONENT \d+/g) || []).length;
    expect(componentHeaders).toBeGreaterThanOrEqual(5);
  });
});

// ── Acceptance Criterion: Token hygiene ───────────────────────────────────

describe("AC: CSS uses --c-* design tokens", () => {
  it("uses --c-gold token (not hardcoded gold hex)", () => {
    expect(css).toContain("var(--c-gold)");
  });

  it("uses --c-fire token (not hardcoded red hex)", () => {
    expect(css).toContain("var(--c-fire)");
  });

  it("uses --c-teal token", () => {
    expect(css).toContain("var(--c-teal)");
  });

  it("uses --c-amber token", () => {
    expect(css).toContain("var(--c-amber)");
  });

  it("uses --c-violet token", () => {
    expect(css).toContain("var(--c-violet)");
  });

  it("uses --c-border token for borders", () => {
    expect(css).toContain("var(--c-border)");
  });

  it("uses --c-fg and --c-fg-muted tokens for text", () => {
    expect(css).toContain("var(--c-fg)");
    expect(css).toContain("var(--c-fg-muted)");
  });

  it("does NOT use legacy --void or --gold token names (HTML generator tokens)", () => {
    // The interaction spec §6.4 says MDX CSS must use --c-* tokens, not HTML
    // generator's raw hex vars (--void, --gold without --c- prefix)
    expect(css).not.toMatch(/var\(--void\)/);
    expect(css).not.toMatch(/var\(--gold\b\)/);
  });
});

// ── Acceptance Criterion: All 5 components present ────────────────────────

describe("AC: All Norse styling components are present (decree, callback, chat, toolbox, explosions)", () => {
  it("decree component selectors present", () => {
    expect(css).toContain(".chronicle-page .decree");
  });

  it("agent-callback component present", () => {
    expect(css).toContain(".chronicle-page .agent-callback");
  });

  it("chat bubble components present (heckle-comeback + heckle-mayo)", () => {
    expect(css).toContain(".chronicle-page .heckle-comeback");
    expect(css).toContain(".chronicle-page .heckle-mayo");
  });

  it("toolbox/agent-turn components present", () => {
    expect(css).toContain(".chronicle-page .agent-turn");
    expect(css).toContain(".chronicle-page .agent-toolbox");
  });

  it("explosion/entrance event components present", () => {
    expect(css).toContain(".chronicle-page .heckle-explosion");
    expect(css).toContain(".chronicle-page .heckle-entrance");
  });
});

// ── Acceptance Criterion: Mobile responsive at 375px ─────────────────────

describe("AC: Mobile responsive (375px / 480px breakpoint)", () => {
  it("has at least one max-width: 480px media query", () => {
    const mobileQueries = (css.match(/@media \(max-width: 480px\)/g) || []).length;
    expect(mobileQueries).toBeGreaterThanOrEqual(1);
  });

  it("decree mobile padding is 16px 14px at ≤480px", () => {
    // Wireframe spec: 24px 32px → 16px 14px on mobile
    const mobileDecreeBlock =
      css.match(/@media \(max-width: 480px\) \{[\s\S]*?\.chronicle-page \.decree \{([^}]+)\}/)?.[1] ?? "";
    expect(mobileDecreeBlock).toContain("16px 14px");
  });

  it("agent-callback mobile padding is 16px at ≤480px", () => {
    // CSS has multiple 480px blocks — find the one that targets agent-callback
    const allMediaBlocks = css.match(/@media \(max-width: 480px\) \{[^@]+\}/gs) ?? [];
    const callbackBlock = allMediaBlocks.find((b) => b.includes(".agent-callback")) ?? "";
    expect(callbackBlock).toContain(".agent-callback");
    expect(callbackBlock).toContain("16px");
  });

  it("agent-text-block expands to 90% max-width on mobile", () => {
    expect(css).toContain("max-width: 90%");
    // Verify agent-text-block mobile rule exists
    const mobileSection =
      css.match(/@media \(max-width: 480px\) \{[\s\S]*?agent-text-block[\s\S]*?\}/)?.[0] ?? "";
    expect(mobileSection).toContain("agent-text-block");
  });

  it("callback-quote expands to max-width: 90% on mobile", () => {
    // Wireframe: 70% → 90% at mobile.
    // The mobile block for callback sets callback-quote { max-width: 90%; ... }
    // Find the SECOND occurrence of callback-quote (the mobile override, not the 70% default)
    const firstIdx = css.indexOf("callback-quote");
    const secondIdx = css.indexOf("callback-quote", firstIdx + 1);
    expect(secondIdx).toBeGreaterThan(-1);
    const mobileBlock = css.slice(secondIdx, secondIdx + 120);
    expect(mobileBlock).toContain("max-width: 90%");
  });
});

// ── Structural: Chat bubble directional styling ────────────────────────────

describe("Chat bubble directional correctness", () => {
  it("heckle-comeback has left-aligned 2px teal border", () => {
    const block =
      css.match(/\.chronicle-page \.heckle-comeback \.heckle-text \{[^}]+\}/s)?.[0] ?? "";
    expect(block).toContain("border-left: 2px solid var(--c-teal)");
  });

  it("heckle-mayo has right-aligned 2px fire border", () => {
    const block =
      css.match(/\.chronicle-page \.heckle-mayo \.heckle-text \{[^}]+\}/s)?.[0] ?? "";
    expect(block).toContain("border-right: 2px solid var(--c-fire)");
  });

  it("heckle-comeback is left-margin 0 (not auto)", () => {
    const block =
      css.match(/\.chronicle-page \.heckle-comeback \{[^}]+\}/s)?.[0] ?? "";
    expect(block).toContain("margin-left: 0");
  });

  it("heckle-mayo text-align right (outer), text-align left (inner bubble)", () => {
    const outerBlock =
      css.match(/\.chronicle-page \.heckle-mayo \{[^}]+\}/s)?.[0] ?? "";
    expect(outerBlock).toContain("text-align: right");
    const textBlock =
      css.match(/\.chronicle-page \.heckle-mayo \.heckle-text \{[^}]+\}/s)?.[0] ?? "";
    expect(textBlock).toContain("text-align: left");
  });
});

// ── Structural: Tool badge variants ──────────────────────────────────────

describe("Tool badge color variants", () => {
  const BADGES = ["bash", "read", "edit", "write", "todo"];
  for (const badge of BADGES) {
    it(`defines .badge-${badge} variant`, () => {
      expect(css).toContain(`.badge-${badge}`);
    });
  }
});

// ── Structural: Agent verdict completeness ────────────────────────────────

describe("Agent verdict component completeness", () => {
  it("defines .agent-verdict-text", () => {
    expect(css).toContain(".chronicle-page .agent-verdict-text");
  });

  it("verdict-pass label uses --c-teal color", () => {
    const passLabelBlock =
      css.match(/\.chronicle-page \.agent-verdict\.verdict-pass \.agent-verdict-label \{[^}]+\}/s)?.[0] ?? "";
    expect(passLabelBlock).toContain("var(--c-teal)");
  });

  it("verdict-fail label uses --c-fire color", () => {
    const failLabelBlock =
      css.match(/\.chronicle-page \.agent-verdict\.verdict-fail \.agent-verdict-label \{[^}]+\}/s)?.[0] ?? "";
    expect(failLabelBlock).toContain("var(--c-fire)");
  });
});

// ── Structural: Decree pseudo-elements ───────────────────────────────────

describe("Decree accent lines (pseudo-elements + MDX fallback divs)", () => {
  it("defines .decree::before top accent gradient", () => {
    expect(css).toContain(".chronicle-page .decree::before");
  });

  it("defines .decree::after bottom accent gradient", () => {
    expect(css).toContain(".chronicle-page .decree::after");
  });

  it("defines .decree-line-top and .decree-line-bottom (MDX div fallback)", () => {
    expect(css).toContain(".chronicle-page .decree-line-top");
    expect(css).toContain(".chronicle-page .decree-line-bottom");
  });
});

// ── Structural: Agent-callback pseudo-elements ───────────────────────────

describe("Agent-callback accent lines", () => {
  it("callback::before uses gold → fire → gold gradient", () => {
    const beforeBlock =
      css.match(/\.chronicle-page \.agent-callback::before \{[^}]+\}/s)?.[0] ?? "";
    // gradient must include both gold and fire tokens
    expect(beforeBlock).toContain("var(--c-gold)");
    expect(beforeBlock).toContain("var(--c-fire)");
  });

  it("defines .callback-line-top and .callback-line-bottom (MDX div fallback)", () => {
    expect(css).toContain(".chronicle-page .callback-line-top");
    expect(css).toContain(".chronicle-page .callback-line-bottom");
  });
});

// ── Structural: Agent turn profile row ───────────────────────────────────

describe("Agent turn profile row", () => {
  it("defines .turn-agent-profile above turn details", () => {
    expect(css).toContain(".chronicle-page .turn-agent-profile");
  });

  it("defines .agent-profile-name in monospace teal", () => {
    expect(css).toContain(".chronicle-page .agent-profile-name");
    const block =
      css.match(/\.chronicle-page \.agent-profile-name \{[^}]+\}/s)?.[0] ?? "";
    expect(block).toContain("var(--c-teal)");
  });
});

// ── Structural: Agent tool error state ───────────────────────────────────

describe("Agent tool error state", () => {
  it("defines .agent-tool-error with fire-tinted background", () => {
    expect(css).toContain(".chronicle-page .agent-tool-error");
    const block =
      css.match(/\.chronicle-page \.agent-tool-error \{[^}]+\}/s)?.[0] ?? "";
    expect(block).toContain("var(--c-fire)");
  });
});

// ── WCAG: Reduced motion compliance ──────────────────────────────────────

describe("WCAG: prefers-reduced-motion compliance", () => {
  it("@keyframes norse-tremble is NOT applied directly — only via media query", () => {
    // The animation must be gated behind prefers-reduced-motion: no-preference
    // Find any direct animation: norse-tremble outside a media query
    const strippedMedia = css.replace(
      /@media[^{]*\{[\s\S]*?\}\s*\}/g,
      "",
    );
    expect(strippedMedia).not.toContain("animation: norse-tremble");
  });

  it("prefers-reduced-motion media query only uses norse-tremble (not explosion-glow) for animation", () => {
    const mediaBlock =
      css.match(/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*?\}/)?.[0] ?? "";
    expect(mediaBlock).toContain("norse-tremble");
    // explosion-glow is defined but NOT auto-played (no animation: explosion-glow in media block)
    expect(mediaBlock).not.toContain("animation: explosion-glow");
  });
});
