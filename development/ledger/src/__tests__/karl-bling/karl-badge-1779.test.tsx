/**
 * KarlBadge (#1779) — unit tests
 *
 * Verifies the shared KarlBadge component (KarlBadge.tsx) behaviour:
 *   - Karl tier:  renders <span role="img"> with gold badge class
 *   - Trial tier: renders <a> Link to /pricing with trial badge class
 *   - Thrall/none: renders <span> (CSS hides it — display:none)
 *
 * CSS visibility is not asserted here (JSDOM doesn't compute stylesheets).
 * The CSS cascade contract is covered by data-tier.test.tsx.
 *
 * @ref #1779
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { KarlBadge } from "@/components/layout/KarlBadge";

// ── Mock state ────────────────────────────────────────────────────────────────

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

// next/link renders as <a> in tests
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

// ── Karl tier ─────────────────────────────────────────────────────────────────

describe("KarlBadge — karl tier", () => {
  beforeEach(() => {
    mockTrialStatus = "none"; // not trial; karl CSS handled by data-tier attribute
  });

  it("renders a span with karl-bling-badge class", () => {
    const { container } = render(<KarlBadge />);
    const badge = container.querySelector(".karl-bling-badge");
    expect(badge).toBeInTheDocument();
    expect(badge!.tagName.toLowerCase()).toBe("span");
  });

  it("has role=img and aria-label for screen readers", () => {
    render(<KarlBadge />);
    const badge = screen.getByRole("img", { name: "Karl subscriber" });
    expect(badge).toBeInTheDocument();
  });

  it("contains KARL text", () => {
    render(<KarlBadge />);
    const badge = screen.getByRole("img", { name: "Karl subscriber" });
    expect(badge).toHaveTextContent("KARL");
  });

  it("has two aria-hidden runic accent spans (ᚷ Gebo)", () => {
    const { container } = render(<KarlBadge />);
    const runes = container.querySelectorAll(".karl-badge-rune");
    expect(runes).toHaveLength(2);
    runes.forEach((rune) => {
      expect(rune).toHaveAttribute("aria-hidden", "true");
      expect(rune).toHaveTextContent("ᚷ");
    });
  });

  it("does not render an anchor element", () => {
    const { container } = render(<KarlBadge />);
    expect(container.querySelector("a")).not.toBeInTheDocument();
  });
});

// ── Trial tier ────────────────────────────────────────────────────────────────

describe("KarlBadge — trial tier", () => {
  beforeEach(() => {
    mockTrialStatus = "active";
  });

  it("renders an anchor linking to /pricing", () => {
    render(<KarlBadge />);
    const link = screen.getByRole("link");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/pricing");
  });

  it("has karl-bling-badge class on the anchor", () => {
    render(<KarlBadge />);
    const link = screen.getByRole("link");
    expect(link).toHaveClass("karl-bling-badge");
  });

  it("has accessible aria-label for upgrade intent", () => {
    render(<KarlBadge />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("aria-label", "Karl trial — upgrade to Karl");
  });

  it("contains KARL text", () => {
    render(<KarlBadge />);
    const link = screen.getByRole("link");
    expect(link).toHaveTextContent("KARL");
  });

  it("has two aria-hidden runic accents", () => {
    const { container } = render(<KarlBadge />);
    const runes = container.querySelectorAll(".karl-badge-rune");
    expect(runes).toHaveLength(2);
    runes.forEach((r) => expect(r).toHaveAttribute("aria-hidden", "true"));
  });

  it("does not render role=img span", () => {
    render(<KarlBadge />);
    expect(
      screen.queryByRole("img", { name: "Karl subscriber" })
    ).not.toBeInTheDocument();
  });
});

// ── Thrall / no trial ─────────────────────────────────────────────────────────

describe("KarlBadge — thrall / no trial", () => {
  it("renders span (CSS will hide it) — not a link", () => {
    mockTrialStatus = "none";
    const { container } = render(<KarlBadge />);
    expect(container.querySelector(".karl-bling-badge")).toBeInTheDocument();
    expect(container.querySelector("a")).not.toBeInTheDocument();
  });

  it("expired trial renders span (not a link)", () => {
    mockTrialStatus = "expired";
    const { container } = render(<KarlBadge />);
    expect(container.querySelector("a")).not.toBeInTheDocument();
    expect(container.querySelector(".karl-bling-badge")).toBeInTheDocument();
  });

  it("converted trial renders span (not a link) — upsell link only for active trial", () => {
    mockTrialStatus = "converted";
    const { container } = render(<KarlBadge />);
    expect(container.querySelector("a")).not.toBeInTheDocument();
    expect(container.querySelector(".karl-bling-badge")).toBeInTheDocument();
  });
});
