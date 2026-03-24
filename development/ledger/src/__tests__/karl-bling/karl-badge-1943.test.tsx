/**
 * KarlBadge (#1943) — Karl-only visibility QA tests
 *
 * Validates the acceptance criteria for issue #1943:
 *   - Trial users do NOT see the Karl badge (no Link, no span)
 *   - Thrall users do NOT see the Karl badge
 *   - Karl active users DO see the badge as a span (never an anchor)
 *   - No anchor element rendered for any tier (old trial code used <Link>)
 *   - Component gates on useEntitlement() tier/isActive only
 *
 * @ref #1943
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { KarlBadge } from "@/components/layout/KarlBadge";

// ── Mock useEntitlement ───────────────────────────────────────────────────────

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
  document.documentElement.removeAttribute("data-tier");
});

// ── AC: Trial users — badge is never rendered (#1943) ────────────────────────
//
// Previously a dimmed <Link> was shown for trial users. That branch is removed.
// The component must return null for all non-Karl tiers.

describe("KarlBadge #1943 — trial users see no badge", () => {
  it("renders null when tier is thrall and data-tier is trial on document", () => {
    // Simulates: context resolved trial => data-tier="trial" set by EntitlementContext
    // but the component itself must return null (no longer reads data-tier)
    mockTier = "thrall";
    mockIsActive = false;
    document.documentElement.setAttribute("data-tier", "trial");
    const { container } = render(<KarlBadge />);
    expect(container.firstChild).toBeNull();
    expect(container.querySelector(".karl-bling-badge")).not.toBeInTheDocument();
  });

  it("renders NO anchor element for thrall/trial tier (old trial Link is removed)", () => {
    mockTier = "thrall";
    mockIsActive = false;
    const { container } = render(<KarlBadge />);
    expect(container.querySelector("a")).not.toBeInTheDocument();
  });

  it("renders nothing even when thrall tier is active (isActive=true)", () => {
    // Defensive: even if isActive=true but tier is thrall, badge must not appear
    mockTier = "thrall";
    mockIsActive = true;
    const { container } = render(<KarlBadge />);
    expect(container.firstChild).toBeNull();
  });
});

// ── AC: Thrall users — badge not rendered ────────────────────────────────────

describe("KarlBadge #1943 — thrall users see no badge", () => {
  it("renders null for thrall tier with data-tier=thrall on document", () => {
    mockTier = "thrall";
    mockIsActive = false;
    document.documentElement.setAttribute("data-tier", "thrall");
    const { container } = render(<KarlBadge />);
    expect(container.firstChild).toBeNull();
    expect(container.querySelector(".karl-bling-badge")).not.toBeInTheDocument();
  });
});

// ── AC: Karl active — badge is rendered as span only ─────────────────────────

describe("KarlBadge #1943 — Karl subscribers see badge (span, not anchor)", () => {
  beforeEach(() => {
    mockTier = "karl";
    mockIsActive = true;
  });

  it("renders span.karl-bling-badge for active Karl tier", () => {
    const { container } = render(<KarlBadge />);
    const badge = container.querySelector("span.karl-bling-badge");
    expect(badge).toBeInTheDocument();
  });

  it("does NOT render an anchor element for Karl tier (non-interactive badge)", () => {
    const { container } = render(<KarlBadge />);
    expect(container.querySelector("a")).not.toBeInTheDocument();
  });

  it("badge is accessible as role=img with label", () => {
    render(<KarlBadge />);
    expect(screen.getByRole("img", { name: "Karl subscriber" })).toBeInTheDocument();
  });
});

// ── AC: Karl inactive — badge NOT rendered ────────────────────────────────────

describe("KarlBadge #1943 — Karl tier inactive (cancelled/lapsed)", () => {
  it("renders null for karl tier when subscription is not active", () => {
    mockTier = "karl";
    mockIsActive = false;
    const { container } = render(<KarlBadge />);
    expect(container.firstChild).toBeNull();
    expect(container.querySelector(".karl-bling-badge")).not.toBeInTheDocument();
  });
});
