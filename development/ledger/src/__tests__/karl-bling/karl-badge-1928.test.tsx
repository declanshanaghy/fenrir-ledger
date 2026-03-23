/**
 * KarlBadge (#1928) — QA validation tests
 *
 * Validates the acceptance criteria for issue #1928:
 *   - Different Norse runes on left vs right (ᚠ Fehu left, ᛟ Othala right)
 *   - Runes are visually distinct (different Unicode codepoints)
 *   - aria-hidden retained on both decorative rune spans
 *   - Trial badge is a link (no glow CSS class), Karl badge is a span
 *   - Thrall tier: badge is in DOM (CSS controls visibility)
 *   - karl-badge-rune class applied to both rune spans
 *
 * CSS-only properties (hover glow, padding, font-size) are not testable in JSDOM.
 * Those are validated by CI visual review.
 *
 * @ref #1928
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { KarlBadge } from "@/components/layout/KarlBadge";

// ── Mocks ─────────────────────────────────────────────────────────────────────

let mockTrialStatus = "none" as "none" | "active" | "expired" | "converted";

vi.mock("@/hooks/useTrialStatus", () => ({
  useTrialStatus: () => ({
    status: mockTrialStatus,
    remainingDays: 0,
    isLoading: false,
    refresh: vi.fn(),
  }),
  clearTrialStatusCache: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
    "aria-label": ariaLabel,
    title,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    "aria-label"?: string;
    title?: string;
  }) => (
    <a href={href} className={className} aria-label={ariaLabel} title={title}>
      {children}
    </a>
  ),
}));

beforeEach(() => {
  mockTrialStatus = "none";
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
    mockTrialStatus = "none";
    render(<KarlBadge />);
    const badge = screen.getByRole("img", { name: "Karl subscriber" });
    expect(badge).toBeInTheDocument();
  });

  it("trial badge has accessible upgrade label", () => {
    mockTrialStatus = "active";
    render(<KarlBadge />);
    const link = screen.getByRole("link", { name: /upgrade to Karl/i });
    expect(link).toBeInTheDocument();
  });
});

// ── AC: Trial has no hover glow (structural — link vs span) ───────────────────
//
// Trial badge is a <Link> (navigates to /pricing — no glow).
// Karl badge is a <span role="img"> (non-interactive — glow via CSS on [data-tier="karl"]).

describe("KarlBadge #1928 — trial vs karl element type", () => {
  it("trial tier renders an anchor (no interactive hover glow expected)", () => {
    mockTrialStatus = "active";
    const { container } = render(<KarlBadge />);
    const anchor = container.querySelector("a.karl-bling-badge");
    expect(anchor).toBeInTheDocument();
    expect(anchor?.getAttribute("href")).toBe("/pricing");
  });

  it("karl tier renders a span (CSS delivers hover glow via data-tier)", () => {
    mockTrialStatus = "none";
    const { container } = render(<KarlBadge />);
    const span = container.querySelector("span.karl-bling-badge");
    expect(span).toBeInTheDocument();
    expect(container.querySelector("a")).not.toBeInTheDocument();
  });
});

// ── AC: Thrall tier — badge in DOM, CSS hides ─────────────────────────────────

describe("KarlBadge #1928 — thrall tier (CSS-hidden)", () => {
  it("badge is in DOM for thrall so CSS can control visibility", () => {
    mockTrialStatus = "none";
    document.documentElement.setAttribute("data-tier", "thrall");
    const { container } = render(<KarlBadge />);
    expect(container.querySelector(".karl-bling-badge")).toBeInTheDocument();
    expect(container.querySelector("a")).not.toBeInTheDocument();
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
