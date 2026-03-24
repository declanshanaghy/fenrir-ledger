/**
 * KarlBadge (#1779, #1943) — unit tests
 *
 * Verifies the shared KarlBadge component (KarlBadge.tsx) behaviour:
 *   - Karl tier (active):  renders <span role="img"> with gold badge class
 *   - Karl tier (inactive): returns null — no badge rendered
 *   - Trial tier: returns null — badge not shown (issue #1943)
 *   - Thrall/none: returns null — badge not shown
 *
 * @ref #1779 #1943
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { KarlBadge } from "@/components/layout/KarlBadge";

// ── Mock state ────────────────────────────────────────────────────────────────

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
  mockTier = "thrall";
  mockIsActive = false;
});

// ── Karl tier (active) ────────────────────────────────────────────────────────

describe("KarlBadge — karl tier (active)", () => {
  beforeEach(() => {
    mockTier = "karl";
    mockIsActive = true;
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

  it("has two aria-hidden runic accent spans (ᚠ Fehu left, ᛟ Othala right)", () => {
    const { container } = render(<KarlBadge />);
    const runes = container.querySelectorAll(".karl-badge-rune");
    expect(runes).toHaveLength(2);
    runes.forEach((rune) => {
      expect(rune).toHaveAttribute("aria-hidden", "true");
    });
    expect(runes[0]).toHaveTextContent("ᚠ");
    expect(runes[1]).toHaveTextContent("ᛟ");
  });

  it("does not render an anchor element", () => {
    const { container } = render(<KarlBadge />);
    expect(container.querySelector("a")).not.toBeInTheDocument();
  });
});

// ── Karl tier (inactive) ──────────────────────────────────────────────────────

describe("KarlBadge — karl tier (inactive subscription)", () => {
  it("renders nothing when karl tier but not active", () => {
    mockTier = "karl";
    mockIsActive = false;
    const { container } = render(<KarlBadge />);
    expect(container.querySelector(".karl-bling-badge")).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });
});

// ── Trial tier — badge hidden (#1943) ─────────────────────────────────────────

describe("KarlBadge — trial tier (no badge)", () => {
  it("renders nothing for thrall tier (trial is represented as thrall in EntitlementTier)", () => {
    mockTier = "thrall";
    mockIsActive = false;
    const { container } = render(<KarlBadge />);
    expect(container.querySelector(".karl-bling-badge")).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });
});

// ── Thrall / no subscription ──────────────────────────────────────────────────

describe("KarlBadge — thrall / no subscription", () => {
  it("renders nothing for thrall tier", () => {
    mockTier = "thrall";
    mockIsActive = false;
    const { container } = render(<KarlBadge />);
    expect(container.querySelector(".karl-bling-badge")).not.toBeInTheDocument();
    expect(container.querySelector("a")).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });
});
