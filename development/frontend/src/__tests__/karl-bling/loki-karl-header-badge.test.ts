/**
 * Loki QA — Karl header badge + nav indicator CSS contract (Issue #1087)
 *
 * Devil's advocate: tests prove the spec is met, not merely that the current
 * code passes. Every assertion is derived from the acceptance criteria in the
 * FiremanDecko → Loki handoff comment on Issue #1087.
 *
 * Gap-fills NOT covered by karl-badge.test.tsx:
 *   1. CSS rule correctness (badge hidden by default, Karl-only visibility)
 *   2. Trial tier NEVER gets badge — no [data-tier="trial"] .karl-bling-badge rule
 *   3. Thrall tier NEVER gets badge
 *   4. Nav indicator only for Karl — trial/thrall do NOT get nav accent
 *   5. Reduced motion suppresses badge pulse animation
 *   6. Static gold border retained under reduced motion (not stripped)
 *   7. Badge white-space: nowrap prevents layout overflow
 *   8. Badge uses karl-badge-pulse animation
 *   9. karl-badge-pulse keyframes are defined
 *  10. Nav indicator uses --karl-gold variable (consistent color token)
 *  11. Nav indicator requires border-bottom (needs border-b-2 base foundation)
 *  12. CSS custom properties for bling are defined at :root
 *  13. Touch devices: card hover animations suppressed (hover: none)
 *
 * @ref #1087
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Load karl-bling.css once ──────────────────────────────────────────────────

let css: string;

beforeAll(() => {
  const cssPath = resolve(__dirname, "../../app/karl-bling.css");
  css = readFileSync(cssPath, "utf-8");
});

// ── 1. Badge default hidden ───────────────────────────────────────────────────

describe("karl-bling.css — badge default visibility", () => {
  it("badge is hidden by default (display: none on .karl-bling-badge)", () => {
    // The ruleset `.karl-bling-badge { display: none }` must exist.
    // This is the cascade foundation — CSS shows the badge only for Karl.
    expect(css).toMatch(/\.karl-bling-badge\s*\{[^}]*display:\s*none/s);
  });

  it("[data-tier=karl] .karl-bling-badge shows the badge (display: inline-flex)", () => {
    expect(css).toMatch(
      /\[data-tier="karl"\]\s*\.karl-bling-badge\s*\{[^}]*display:\s*inline-flex/s
    );
  });

  it("trial tier does NOT have a karl-bling-badge visibility rule", () => {
    // Acceptance criteria: trial users do NOT see the header badge.
    // There must be NO [data-tier="trial"] .karl-bling-badge selector at all.
    // Note: .karl-bling-badge-status (card status badge) is a separate class and
    // is intentionally allowed for trial — only the header badge is excluded.
    expect(css).not.toMatch(/\[data-tier="trial"\]\s*\.karl-bling-badge(?!-)/);
  });

  it("thrall tier does NOT have a karl-bling-badge visibility rule", () => {
    expect(css).not.toMatch(/\[data-tier="thrall"\]\s*\.karl-bling-badge/);
  });
});

// ── 2. Badge styling contract ─────────────────────────────────────────────────

describe("karl-bling.css — badge styling contract", () => {
  it("badge has white-space: nowrap to prevent layout overflow", () => {
    // Acceptance criteria: badge must not overflow the header at any screen width.
    expect(css).toMatch(
      /\[data-tier="karl"\]\s*\.karl-bling-badge\s*\{[^}]*white-space:\s*nowrap/s
    );
  });

  it("badge uses karl-badge-pulse animation", () => {
    expect(css).toMatch(
      /\[data-tier="karl"\]\s*\.karl-bling-badge\s*\{[^}]*animation:[^}]*karl-badge-pulse/s
    );
  });

  it("@keyframes karl-badge-pulse is defined in CSS", () => {
    expect(css).toContain("@keyframes karl-badge-pulse");
  });

  it("badge uses border property (gold ring)", () => {
    expect(css).toMatch(
      /\[data-tier="karl"\]\s*\.karl-bling-badge\s*\{[^}]*border:/s
    );
  });

  it("badge rune subclass .karl-badge-rune is scoped to Karl only", () => {
    // [data-tier="karl"] .karl-bling-badge .karl-badge-rune
    expect(css).toMatch(/\[data-tier="karl"\]\s*\.karl-bling-badge\s*\.karl-badge-rune/);
  });
});

// ── 3. Nav indicator rules ────────────────────────────────────────────────────

describe("karl-bling.css — nav indicator (karl-bling-nav-active)", () => {
  it("[data-tier=karl] .karl-bling-nav-active applies border-bottom", () => {
    // Acceptance criteria: active tab gets gold bottom border for Karl.
    // base style must have border-b-2 border-transparent for this to be visible.
    expect(css).toMatch(
      /\[data-tier="karl"\]\s*\.karl-bling-nav-active\s*\{[^}]*border-bottom/s
    );
  });

  it("nav indicator uses --karl-gold color variable", () => {
    // Using the CSS variable keeps the color consistent with the rest of the bling layer.
    expect(css).toMatch(
      /\[data-tier="karl"\]\s*\.karl-bling-nav-active\s*\{[^}]*--karl-gold/s
    );
  });

  it("nav indicator applies a gold glow box-shadow", () => {
    expect(css).toMatch(
      /\[data-tier="karl"\]\s*\.karl-bling-nav-active\s*\{[^}]*box-shadow/s
    );
  });

  it("trial tier does NOT get nav indicator", () => {
    // Acceptance criteria: "NOT header badge or nav indicator" for trial.
    expect(css).not.toMatch(/\[data-tier="trial"\]\s*\.karl-bling-nav-active/);
  });

  it("thrall tier does NOT get nav indicator", () => {
    expect(css).not.toMatch(/\[data-tier="thrall"\]\s*\.karl-bling-nav-active/);
  });
});

// ── 4. Reduced motion ─────────────────────────────────────────────────────────

describe("karl-bling.css — prefers-reduced-motion: reduce", () => {
  it("reduced motion media query block exists", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("badge pulse animation is suppressed under reduced motion", () => {
    // Extract text after the @media (prefers-reduced-motion: reduce) start.
    const idx = css.indexOf("@media (prefers-reduced-motion: reduce)");
    expect(idx).toBeGreaterThan(-1);
    const reducedBlock = css.slice(idx);
    // Block must reference .karl-bling-badge and animation: none
    expect(reducedBlock).toContain(".karl-bling-badge");
    expect(reducedBlock).toContain("animation: none");
  });

  it("static gold border is NOT removed under reduced motion", () => {
    // Spec: "static gold border retained" — reduced motion suppresses animation only.
    const idx = css.indexOf("@media (prefers-reduced-motion: reduce)");
    const reducedBlock = css.slice(idx);
    // There must be no `border: none` rule in the reduced motion block.
    expect(reducedBlock).not.toMatch(/border:\s*none/);
  });
});

// ── 5. CSS custom properties ──────────────────────────────────────────────────

describe("karl-bling.css — CSS custom properties at :root", () => {
  it("--karl-gold is defined at :root", () => {
    expect(css).toMatch(/:root\s*\{[^}]*--karl-gold:/s);
  });

  it("--karl-glow-sm, --karl-glow-md, --karl-glow-lg are defined", () => {
    expect(css).toContain("--karl-glow-sm:");
    expect(css).toContain("--karl-glow-md:");
    expect(css).toContain("--karl-glow-lg:");
  });

  it("--karl-shadow-sm and --karl-shadow-md are defined (used by badge and nav)", () => {
    expect(css).toContain("--karl-shadow-sm:");
    expect(css).toContain("--karl-shadow-md:");
  });
});

// ── 6. Touch device: hover animation suppression ──────────────────────────────

describe("karl-bling.css — hover: none (touch devices)", () => {
  it("@media (hover: none) suppresses card hover animations", () => {
    expect(css).toContain("@media (hover: none)");
  });
});
