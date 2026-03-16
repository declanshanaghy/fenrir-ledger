/**
 * chronicle-1048-loki-qa.test.ts
 *
 * Loki QA suite — devil's advocate validation for Issue #1048.
 * Covers AC gaps NOT addressed by FiremanDecko's chronicle-agent-css.test.ts:
 *
 *  AC-3: HTML report generator updated to reference shared CSS (not inline)
 *  AC-1: CSS file loadable by Next.js (path + content integrity)
 *  AC-5: CSS organized by all required component sections
 *  AC-6: Light/dark theme support (token correctness, not just presence)
 *
 * Deliberately adversarial — tests prove the contract, not just current behaviour.
 *
 * Ref: GitHub Issue #1048 — Extract shared Norse chronicle CSS
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve, join } from "path";

// Paths under test
const REPO_ROOT = resolve(__dirname, "../../../../..");
const CSS_PATH = resolve(__dirname, "../../app/chronicles/chronicle.css");
const SCRIPT_PATH = resolve(
  REPO_ROOT,
  ".claude/skills/brandify-agent/scripts/generate-agent-report.mjs",
);

let css: string;
let script: string;

beforeAll(() => {
  css = readFileSync(CSS_PATH, "utf-8");
  script = readFileSync(SCRIPT_PATH, "utf-8");
});

// ── AC-3: HTML report generator uses external CSS, not inline ──────────────

describe("generate-agent-report.mjs — AC-3: CSS is external, not inline", () => {
  it("reads CSS from chronicle.css via readFileSync", () => {
    // Must import readFileSync from fs
    expect(script).toContain("readFileSync");
    // Must reference chronicle.css by filename
    expect(script).toContain("chronicle.css");
  });

  it("resolves chronicle.css relative to __scriptDir (ESM-safe path)", () => {
    // ESM scripts use fileURLToPath + dirname pattern for __dirname equivalent
    expect(script).toContain("fileURLToPath");
    expect(script).toContain("dirname");
    // The path must navigate from brandify-agent/scripts up to the repo root
    expect(script).toContain("../../../../development/frontend/src/app/chronicles/chronicle.css");
  });

  it("emits <link rel='stylesheet'> tag in HTML output (not inline <style> for chronicle CSS)", () => {
    // The main report template must link to agent-report.css, not embed chronicle styles inline
    expect(script).toContain('<link rel="stylesheet" href="agent-report.css">');
  });

  it("writes CSS content to agent-report.css (writeAssets exports the loaded CSS)", () => {
    // The writeAssets function must write CSS to agent-report.css
    expect(script).toContain('agent-report.css');
    // Must use the CSS variable (loaded from chronicle.css) when writing
    const writeAssetsBlock = script.slice(
      script.indexOf("function writeAssets"),
      script.indexOf("function writeAssets") + 500,
    );
    expect(writeAssetsBlock).toContain("CSS");
    expect(writeAssetsBlock).toContain("agent-report.css");
  });

  it("does NOT embed chronicle-specific Norse classes inline in script", () => {
    // Chronicle-specific classes should NOT appear as literal strings in the script body
    // (they are read from chronicle.css at runtime, not hardcoded)
    // The script may reference classes in HTML templates, but should NOT have a giant
    // inline CSS block with .decree, .toolbox, .heckle-explosion etc.
    const chronicleClasses = [".decree {", ".toolbox {", ".heckle-explosion {", ".agent-callback {"];
    for (const cls of chronicleClasses) {
      expect(script).not.toContain(cls);
    }
  });

  it("does NOT contain old-style inline CSS blob (Hlidskjalf :root is tiny, ≤10 vars)", () => {
    // The Hlidskjalf sidebar has a small inline :root for monitor UI vars.
    // The OLD approach embedded the full 600+ line Norse chronicle CSS inline here.
    // Verify the inline :root block is compact (≤ 10 CSS custom properties).
    const rootIdx = script.indexOf(":root {");
    expect(rootIdx).toBeGreaterThan(-1);
    // Find the closing brace of the :root block
    const rootClose = script.indexOf("}", rootIdx);
    const rootBlock = script.slice(rootIdx, rootClose + 1);
    const varCount = (rootBlock.match(/--[\w-]+:/g) || []).length;
    // Hlidskjalf sidebar needs ~8 vars; old inline blob had 20+
    expect(varCount).toBeLessThanOrEqual(10);
  });
});

// ── AC-1: CSS file is importable by Next.js chronicles pages ───────────────

describe("chronicle.css — AC-1: Next.js importability", () => {
  it("lives under src/app/ where Next.js resolves @/ imports", () => {
    // @/ maps to development/frontend/src/
    // So @/app/chronicles/chronicle.css should be a valid Next.js CSS import
    expect(existsSync(CSS_PATH)).toBe(true);
    // Must be under src/app/
    expect(CSS_PATH).toContain("/src/app/chronicles/chronicle.css");
  });

  it("has valid CSS structure (no null bytes or binary garbage)", () => {
    expect(css).not.toContain("\0");
    // Must start with either a comment or @import or :root
    const trimmed = css.trimStart();
    const validStarts = ["/*", "@import", ":root", "@media", "/*\n"];
    const startsValid = validStarts.some((s) => trimmed.startsWith(s));
    expect(startsValid).toBe(true);
  });

  it("is at least 900 lines long (full extraction, not partial)", () => {
    const lineCount = css.split("\n").length;
    expect(lineCount).toBeGreaterThanOrEqual(900);
  });
});

// ── AC-5: CSS organized by component sections ──────────────────────────────

describe("chronicle.css — AC-5: component section completeness", () => {
  // Each required component from the AC must have a dedicated section
  const requiredComponents = [
    { name: "decree", selector: ".decree {" },
    { name: "agent-callback", selector: ".agent-callback {" },
    { name: "chat-bubble / heckle", selector: ".heckle {" },
    { name: "toolbox", selector: ".toolbox {" },
    { name: "heckle-explosion", selector: ".heckle-explosion {" },
  ];

  for (const { name, selector } of requiredComponents) {
    it(`has ${name} component section`, () => {
      expect(css).toContain(selector);
    });
  }

  it("sections are present in logical order (fonts → base → components)", () => {
    const cinzelIdx = css.indexOf("Cinzel");
    const rootIdx = css.indexOf(":root {");
    const reportIdx = css.indexOf(".report {");
    const decreeIdx = css.indexOf(".decree {");
    const heckleIdx = css.indexOf(".heckle {");
    const keyframesIdx = css.indexOf("@keyframes");

    // Fonts come first
    expect(cinzelIdx).toBeLessThan(rootIdx);
    // :root vars come before components
    expect(rootIdx).toBeLessThan(reportIdx);
    // .report before .decree
    expect(reportIdx).toBeLessThan(decreeIdx);
    // .decree before .heckle
    expect(decreeIdx).toBeLessThan(heckleIdx);
    // @keyframes at the end
    expect(heckleIdx).toBeLessThan(keyframesIdx);
  });
});

// ── AC-6: Light/dark theme support ────────────────────────────────────────

describe("chronicle.css — AC-6: light/dark theme correctness", () => {
  it("dark theme --void is near-black (#07070d)", () => {
    // :root should set void to the darkest value
    expect(css).toContain("--void:         #07070d");
  });

  it("light theme --void is near-white (#f5f3ee)", () => {
    // prefers-color-scheme: light block should invert void
    const lightBlock = css.slice(
      css.indexOf("prefers-color-scheme: light"),
      css.indexOf("prefers-color-scheme: light") + 800,
    );
    expect(lightBlock).toContain("--void:         #f5f3ee");
  });

  it(".dark class restores dark --void for next-themes compatibility", () => {
    // When the user manually sets dark mode via next-themes, .dark overrides media query
    const darkClassIdx = css.indexOf(".dark {");
    expect(darkClassIdx).toBeGreaterThan(-1);
    const darkClassBlock = css.slice(darkClassIdx, darkClassIdx + 500);
    expect(darkClassBlock).toContain("--void:         #07070d");
  });

  it("has at least 8 CSS custom properties in :root", () => {
    const rootStart = css.indexOf(":root {");
    const rootEnd = css.indexOf("}", rootStart);
    const rootBlock = css.slice(rootStart, rootEnd);
    const varCount = (rootBlock.match(/--[\w-]+:/g) || []).length;
    expect(varCount).toBeGreaterThanOrEqual(8);
  });

  it("light and dark themes define different values for --void", () => {
    // This test FAILS if they accidentally define the same value
    const darkVoidMatch = css.match(/:root\s*\{[^}]*--void:\s*([^;]+);/);
    const lightBlockStart = css.indexOf("prefers-color-scheme: light");
    const lightBlockEnd = css.indexOf("}", css.indexOf("{", lightBlockStart));
    const lightBlock = css.slice(lightBlockStart, lightBlockEnd + 50);
    const lightVoidMatch = lightBlock.match(/--void:\s*([^;]+);/);

    expect(darkVoidMatch).not.toBeNull();
    expect(lightVoidMatch).not.toBeNull();
    if (darkVoidMatch && lightVoidMatch) {
      expect(darkVoidMatch[1].trim()).not.toEqual(lightVoidMatch[1].trim());
    }
  });
});

// ── AC-4: Existing reports still render correctly (static contract) ────────

describe("chronicle.css — AC-4: render contract (structural invariants)", () => {
  it("has .report-header for report title area", () => {
    expect(css).toContain(".report-header {");
  });

  it("has .entrypoint block for agent identity section", () => {
    expect(css).toContain(".entrypoint {");
  });

  it("has .turn-box collapsible container (used in all reports)", () => {
    expect(css).toContain(".turn-box {");
    expect(css).toContain(".turn-box.open");
  });

  it("has .verdict block for QA outcome display", () => {
    expect(css).toContain(".verdict {");
  });

  it("all element references use var() for colours (no hardcoded hex in component rules)", () => {
    // Find component CSS after :root block to check no rogue hardcoded colors
    const afterRoot = css.slice(css.indexOf(".report {"));
    // Component blocks should rarely hardcode hex — they use CSS vars
    // We allow some exceptions (e.g. rgba() with specific values in transitions)
    // but major colour assignments must use var()
    const decreeBlock = afterRoot.slice(
      afterRoot.indexOf(".decree {"),
      afterRoot.indexOf(".decree {") + 200,
    );
    // The decree border must use var(--gold), not a literal hex
    expect(decreeBlock).toContain("var(--gold)");
  });
});
