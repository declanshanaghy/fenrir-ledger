/**
 * Karl card bling — CardTile + StatusBadge component tests
 *
 * Verifies Issue #1088 acceptance criteria:
 *   - CardTile renders the `karl-bling-card` CSS class on the motion wrapper
 *   - Four rune corner spans are present and aria-hidden
 *   - Rune glyphs are correct (ᚠ ᚱ ᛁ ᚾ)
 *   - StatusBadge adds `karl-bling-badge-status` when useIsKarlOrTrial() is true
 *   - StatusBadge omits `karl-bling-badge-status` for Thrall users
 *   - Both the tooltip and non-tooltip Badge paths receive the bling class
 *
 * @ref #1088
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Card as CreditCard } from "@/lib/types";

// ── Mutable mock state ────────────────────────────────────────────────────────

let mockIsKarlOrTrial = false;

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/useIsKarlOrTrial", () => ({
  useIsKarlOrTrial: () => mockIsKarlOrTrial,
}));

// Framer Motion: bypass animation wrappers in jsdom
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, className, style, ...rest }: React.HTMLAttributes<HTMLDivElement> & { style?: React.CSSProperties }) => (
      <div className={className} style={style} data-testid="motion-div" {...rest}>
        {children}
      </div>
    ),
  },
  useReducedMotion: () => false,
}));

// IssuerLogo: simple stub to avoid asset loading
vi.mock("@/components/shared/IssuerLogo", () => ({
  IssuerLogo: () => <span data-testid="issuer-logo" />,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<CreditCard> = {}): CreditCard {
  return {
    id: "card-1",
    householdId: "hh-1",
    issuerId: "chase",
    cardName: "Sapphire Preferred",
    openDate: "2023-01-01T00:00:00.000Z",
    creditLimit: 1000000,
    annualFee: 9500,
    annualFeeDate: "2026-01-01T00:00:00.000Z",
    promoPeriodMonths: 0,
    signUpBonus: null,
    status: "active",
    notes: "",
    createdAt: "2023-01-01T00:00:00.000Z",
    updatedAt: "2023-01-01T00:00:00.000Z",
    ...overrides,
  } as CreditCard;
}

// ── CardTile tests ─────────────────────────────────────────────────────────────

describe("CardTile — karl-bling-card class", () => {
  it("always renders the karl-bling-card class on the motion wrapper", async () => {
    const { CardTile } = await import("@/components/dashboard/CardTile");
    render(<CardTile card={makeCard()} />);
    const motionDiv = screen.getByTestId("motion-div");
    expect(motionDiv.className).toContain("karl-bling-card");
  });

  it("coexists with card-chain class on the motion wrapper", async () => {
    const { CardTile } = await import("@/components/dashboard/CardTile");
    render(<CardTile card={makeCard()} />);
    const motionDiv = screen.getByTestId("motion-div");
    expect(motionDiv.className).toContain("card-chain");
  });

  it("motion wrapper has position:relative style for rune corner positioning", async () => {
    const { CardTile } = await import("@/components/dashboard/CardTile");
    render(<CardTile card={makeCard()} />);
    const motionDiv = screen.getByTestId("motion-div");
    expect(motionDiv.getAttribute("style")).toContain("position");
  });
});

describe("CardTile — rune corner spans", () => {
  it("renders exactly four rune corner spans", async () => {
    const { CardTile } = await import("@/components/dashboard/CardTile");
    const { container } = render(<CardTile card={makeCard()} />);
    const runes = container.querySelectorAll(".karl-rune-corner");
    expect(runes).toHaveLength(4);
  });

  it("all rune corner spans are aria-hidden", async () => {
    const { CardTile } = await import("@/components/dashboard/CardTile");
    const { container } = render(<CardTile card={makeCard()} />);
    const runes = container.querySelectorAll(".karl-rune-corner");
    for (const rune of runes) {
      expect(rune.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("renders fehu (ᚠ) in the top-left corner", async () => {
    const { CardTile } = await import("@/components/dashboard/CardTile");
    const { container } = render(<CardTile card={makeCard()} />);
    const tl = container.querySelector(".karl-rune-tl");
    expect(tl).not.toBeNull();
    expect(tl!.textContent).toBe("ᚠ");
  });

  it("renders raidho (ᚱ) in the top-right corner", async () => {
    const { CardTile } = await import("@/components/dashboard/CardTile");
    const { container } = render(<CardTile card={makeCard()} />);
    const tr = container.querySelector(".karl-rune-tr");
    expect(tr).not.toBeNull();
    expect(tr!.textContent).toBe("ᚱ");
  });

  it("renders isa (ᛁ) in the bottom-left corner", async () => {
    const { CardTile } = await import("@/components/dashboard/CardTile");
    const { container } = render(<CardTile card={makeCard()} />);
    const bl = container.querySelector(".karl-rune-bl");
    expect(bl).not.toBeNull();
    expect(bl!.textContent).toBe("ᛁ");
  });

  it("renders naudiz (ᚾ) in the bottom-right corner", async () => {
    const { CardTile } = await import("@/components/dashboard/CardTile");
    const { container } = render(<CardTile card={makeCard()} />);
    const br = container.querySelector(".karl-rune-br");
    expect(br).not.toBeNull();
    expect(br!.textContent).toBe("ᚾ");
  });
});

// ── StatusBadge tests ─────────────────────────────────────────────────────────

describe("StatusBadge — karl-bling-badge-status class (tooltip mode)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("adds karl-bling-badge-status class when useIsKarlOrTrial() is true", async () => {
    mockIsKarlOrTrial = true;
    const { StatusBadge } = await import("@/components/dashboard/StatusBadge");
    const { container } = render(<StatusBadge status="active" showTooltip />);
    const badge = container.querySelector(".karl-bling-badge-status");
    expect(badge).not.toBeNull();
  });

  it("omits karl-bling-badge-status class when useIsKarlOrTrial() is false", async () => {
    mockIsKarlOrTrial = false;
    const { StatusBadge } = await import("@/components/dashboard/StatusBadge");
    const { container } = render(<StatusBadge status="active" showTooltip />);
    const badge = container.querySelector(".karl-bling-badge-status");
    expect(badge).toBeNull();
  });
});

describe("StatusBadge — karl-bling-badge-status class (no-tooltip mode)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("adds karl-bling-badge-status class in no-tooltip mode when useIsKarlOrTrial() is true", async () => {
    mockIsKarlOrTrial = true;
    const { StatusBadge } = await import("@/components/dashboard/StatusBadge");
    const { container } = render(
      <StatusBadge status="active" showTooltip={false} />
    );
    const badge = container.querySelector(".karl-bling-badge-status");
    expect(badge).not.toBeNull();
  });

  it("omits karl-bling-badge-status class in no-tooltip mode when useIsKarlOrTrial() is false", async () => {
    mockIsKarlOrTrial = false;
    const { StatusBadge } = await import("@/components/dashboard/StatusBadge");
    const { container } = render(
      <StatusBadge status="active" showTooltip={false} />
    );
    const badge = container.querySelector(".karl-bling-badge-status");
    expect(badge).toBeNull();
  });
});

describe("StatusBadge — karl-bling-badge-status across card statuses", () => {
  beforeEach(() => {
    vi.resetModules();
    mockIsKarlOrTrial = true;
  });

  const statuses = [
    "active",
    "fee_approaching",
    "promo_expiring",
    "closed",
    "bonus_open",
    "overdue",
    "graduated",
  ] as const;

  for (const status of statuses) {
    it(`adds karl-bling-badge-status for status="${status}"`, async () => {
      const { StatusBadge } = await import("@/components/dashboard/StatusBadge");
      const { container } = render(
        <StatusBadge status={status} showTooltip={false} />
      );
      const badge = container.querySelector(".karl-bling-badge-status");
      expect(badge).not.toBeNull();
    });
  }
});
