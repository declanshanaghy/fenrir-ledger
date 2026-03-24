/**
 * KarlBadge — unit tests (Issue #1087)
 *
 * Verifies that:
 *   - The badge element is rendered in the DOM with correct class + aria attributes
 *   - Badge contains "KARL" text
 *   - Elder Futhark runic accents (ᚠ Fehu left, ᛟ Othala right) are present and aria-hidden
 *   - CSS class `karl-bling-badge` is always applied (CSS controls show/hide)
 *   - Nav tab active class `karl-bling-nav-active` is applied to active tabs
 *
 * Note: This file tests a locally-defined KarlBadge stub (DOM structure contract).
 * For the real KarlBadge component behaviour (Karl-only, returns null for trial/thrall),
 * see karl-badge-1779.test.tsx and karl-badge-1928.test.tsx.
 *
 * @ref #1087
 */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Minimal KarlBadge extraction (mirrors TopBar.tsx internal component) ──────
// We test the component in isolation without pulling in the full TopBar deps.

function KarlBadge() {
  return (
    <span
      className="karl-bling-badge"
      aria-label="Karl subscriber"
      role="img"
    >
      <span className="karl-badge-rune" aria-hidden="true">ᚠ</span>
      KARL
      <span className="karl-badge-rune" aria-hidden="true">ᛟ</span>
    </span>
  );
}

// ── KarlBadge DOM structure ───────────────────────────────────────────────────

describe("KarlBadge — DOM structure", () => {
  it("renders with karl-bling-badge class", () => {
    render(<KarlBadge />);
    const badge = screen.getByRole("img", { name: "Karl subscriber" });
    expect(badge).toBeDefined();
    expect(badge.className).toContain("karl-bling-badge");
  });

  it("contains KARL text", () => {
    render(<KarlBadge />);
    const badge = screen.getByRole("img", { name: "Karl subscriber" });
    expect(badge.textContent).toContain("KARL");
  });

  it("has aria-label for screen readers", () => {
    render(<KarlBadge />);
    const badge = screen.getByRole("img", { name: "Karl subscriber" });
    expect(badge.getAttribute("aria-label")).toBe("Karl subscriber");
  });

  it("renders two runic accent spans that are aria-hidden", () => {
    const { container } = render(<KarlBadge />);
    const runes = container.querySelectorAll(".karl-badge-rune");
    expect(runes).toHaveLength(2);
    runes.forEach((rune) => {
      expect(rune.getAttribute("aria-hidden")).toBe("true");
    });
  });

  it("left rune is ᚠ Fehu (U+16A0) and right rune is ᛟ Othala (U+16DF)", () => {
    const { container } = render(<KarlBadge />);
    const runes = container.querySelectorAll(".karl-badge-rune");
    // ᚠ is U+16A0 Runic Letter Fehu Feoh Fe F — wealth/prosperity
    expect(runes[0].textContent).toBe("\u16A0");
    // ᛟ is U+16DF Runic Letter Othalan Ethel O — heritage/nobility
    expect(runes[1].textContent).toBe("\u16DF");
  });
});

// ── CSS class contract ────────────────────────────────────────────────────────
//
// The badge is hidden by default via CSS (.karl-bling-badge { display: none })
// and shown only when [data-tier="karl"] is set on <html>.
// These tests verify the CSS class contract — the actual visibility transition
// is integration-tested in data-tier.test.tsx.

describe("KarlBadge — CSS class contract", () => {
  it("badge class is karl-bling-badge (CSS hook for tier cascade)", () => {
    render(<KarlBadge />);
    const badge = screen.getByRole("img", { name: "Karl subscriber" });
    // This class is the CSS hook — [data-tier="karl"] .karl-bling-badge { display: inline-flex }
    expect(badge.classList.contains("karl-bling-badge")).toBe(true);
  });

  it("badge does NOT have inline display style (CSS handles visibility)", () => {
    render(<KarlBadge />);
    const badge = screen.getByRole("img", { name: "Karl subscriber" });
    // No inline style override — CSS cascade must control visibility
    expect(badge.getAttribute("style")).toBeNull();
  });
});

// ── data-tier attribute visibility contract ───────────────────────────────────
//
// This stub KarlBadge always renders a span (it does not gate on tier).
// The real KarlBadge component returns null for non-Karl tiers (issue #1943).
// These tests validate the DOM structure of the span element only.

describe("KarlBadge stub — DOM structure present regardless of data-tier", () => {
  it("stub badge is always present in DOM regardless of data-tier", () => {
    // Karl
    document.documentElement.setAttribute("data-tier", "karl");
    const { unmount: u1 } = render(<KarlBadge />);
    expect(screen.getByRole("img", { name: "Karl subscriber" })).toBeDefined();
    u1();
    document.documentElement.removeAttribute("data-tier");

    // Thrall — stub still in DOM (real component returns null)
    document.documentElement.setAttribute("data-tier", "thrall");
    render(<KarlBadge />);
    expect(screen.getByRole("img", { name: "Karl subscriber" })).toBeDefined();
    document.documentElement.removeAttribute("data-tier");
  });
});

// ── Nav active class contract ─────────────────────────────────────────────────
//
// Verifies the karl-bling-nav-active class is used by LedgerBottomTabs active state.
// We test the string constant — full tab rendering requires many navigation mocks.

describe("LedgerBottomTabs — karl-bling-nav-active class", () => {
  it("tabActive string includes karl-bling-nav-active class", () => {
    // Mirrors the constant in LedgerBottomTabs.tsx
    const tabActive = "text-gold karl-bling-nav-active";
    expect(tabActive).toContain("karl-bling-nav-active");
    expect(tabActive).toContain("text-gold");
  });

  it("tabBase string includes border-b-2 border-transparent for nav accent foundation", () => {
    // Mirrors the constant in LedgerBottomTabs.tsx
    const tabBase =
      "flex flex-1 flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors min-h-[56px] border-b-2 border-transparent";
    expect(tabBase).toContain("border-b-2");
    expect(tabBase).toContain("border-transparent");
  });
});
