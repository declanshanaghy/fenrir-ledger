/**
 * KarlBadge (#1928, #1943) — QA validation tests
 *
 * Validates the acceptance criteria for issues #1928 and #1943:
 *   - Different Norse runes on left vs right (ᚠ Fehu left, ᛟ Othala right)
 *   - Runes are visually distinct (different Unicode codepoints)
 *   - aria-hidden retained on both decorative rune spans
 *   - Karl badge is a span (non-interactive)
 *   - Trial/Thrall tier: badge returns null (issue #1943)
 *   - karl-badge-rune class applied to both rune spans
 *
 * CSS-only properties (hover glow, padding, font-size) are not testable in JSDOM.
 * Those are validated by CI visual review.
 *
 * @ref #1928 #1943
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { KarlBadge } from "@/components/layout/KarlBadge";

// ── Mocks ─────────────────────────────────────────────────────────────────────

let mockTier = "thrall" as "thrall" | "karl";
let mockIsActive = false;

vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => ({
    tier: mockTier,
    isActive: mockIsActive,
    hasFeature: vi.fn(() => false),
    subscribeStripe: vi.fn(),
    isLinked: false,
  }),
}));

beforeEach(() => {
  mockTier = "karl";
  mockIsActive = true;
});

// ── AC: Distinct Norse runes on left vs right ─────────────────────────────────
//
// Left rune MUST be ᚠ (Fehu U+16A0) — wealth/prosperity, open fork shape.
// Right rune MUST be ᛟ (Othala U+16DF) — heritage/nobility, closed diamond.
// They MUST differ from each other.

describe("KarlBadge #1928 — distinct rune pair (ᚠ/ᛟ)", () => {
  it("left rune is ᚠ Fehu (U+16A0)", () => {
    const { container } = render(<KarlBadge />);
    const runes = container.querySelectorAll(".karl-badge-rune");
    expect(runes[0]?.textContent).toBe("\u16A0"); // ᚠ
  });

  it("right rune is ᛟ Othala (U+16DF)", () => {
    const { container } = render(<KarlBadge />);
    const runes = container.querySelectorAll(".karl-badge-rune");
    expect(runes[1]?.textContent).toBe("\u16DF"); // ᛟ
  });

  it("left and right runes are different from each other", () => {
    const { container } = render(<KarlBadge />);
    const runes = container.querySelectorAll(".karl-badge-rune");
    expect(runes[0]?.textContent).not.toBe(runes[1]?.textContent);
  });

  it("neither rune is the old Gebo rune ᚷ (U+16B7)", () => {
    const { container } = render(<KarlBadge />);
    const runes = container.querySelectorAll(".karl-badge-rune");
    expect(runes[0]?.textContent).not.toBe("\u16B7"); // not ᚷ Gebo
    expect(runes[1]?.textContent).not.toBe("\u16B7"); // not ᚷ Gebo
  });
});

// ── AC: aria-hidden retained on decorative rune spans ─────────────────────────

describe("KarlBadge #1928 — aria accessibility", () => {
  it("both rune spans have aria-hidden=true", () => {
    const { container } = render(<KarlBadge />);
    const runes = container.querySelectorAll(".karl-badge-rune");
    expect(runes).toHaveLength(2);
    runes.forEach((rune) => {
      expect(rune.getAttribute("aria-hidden")).toBe("true");
    });
  });

  it("karl tier badge has role=img and accessible label", () => {
    render(<KarlBadge />);
    const badge = screen.getByRole("img", { name: "Karl subscriber" });
    expect(badge).toBeInTheDocument();
  });

  it("trial tier renders nothing (no badge — issue #1943)", () => {
    mockTier = "thrall";
    mockIsActive = false;
    const { container } = render(<KarlBadge />);
    expect(container.firstChild).toBeNull();
  });
});

// ── AC: Karl badge is a non-interactive span ──────────────────────────────────
//
// Karl badge is a <span role="img"> (non-interactive).
// No anchor element should be rendered for any tier.

describe("KarlBadge #1928 — element type (span only)", () => {
  it("karl tier renders a span (CSS delivers hover glow via data-tier)", () => {
    const { container } = render(<KarlBadge />);
    const span = container.querySelector("span.karl-bling-badge");
    expect(span).toBeInTheDocument();
    expect(container.querySelector("a")).not.toBeInTheDocument();
  });

  it("non-karl tier renders nothing (returns null)", () => {
    mockTier = "thrall";
    mockIsActive = false;
    const { container } = render(<KarlBadge />);
    expect(container.firstChild).toBeNull();
    expect(container.querySelector("a")).not.toBeInTheDocument();
  });
});

// ── AC: Thrall tier — badge not rendered (#1943) ──────────────────────────────

describe("KarlBadge #1928/#1943 — thrall tier (returns null)", () => {
  it("badge is NOT in DOM for thrall (component returns null)", () => {
    mockTier = "thrall";
    mockIsActive = false;
    document.documentElement.setAttribute("data-tier", "thrall");
    const { container } = render(<KarlBadge />);
    expect(container.querySelector(".karl-bling-badge")).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
    document.documentElement.removeAttribute("data-tier");
  });
});

// ── AC: karl-badge-rune class applied to both spans ──────────────────────────

describe("KarlBadge #1928 — rune CSS class contract", () => {
  it("both rune spans have karl-badge-rune class", () => {
    const { container } = render(<KarlBadge />);
    const runes = container.querySelectorAll(".karl-badge-rune");
    expect(runes).toHaveLength(2);
  });

  it("rune spans are inside the karl-bling-badge element", () => {
    const { container } = render(<KarlBadge />);
    const badge = container.querySelector(".karl-bling-badge");
    const runes = badge?.querySelectorAll(".karl-badge-rune");
    expect(runes).toHaveLength(2);
  });
});
