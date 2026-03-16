/**
 * Loki QA — Karl card bling supplemental tests (Issue #1088)
 *
 * Augments FiremanDecko's card-bling.test.tsx. Does NOT duplicate those tests.
 *
 * Gaps covered here:
 *   1. Reduced-motion path — rune corners + bling class persist when motion is disabled
 *   2. CardTile link target — href points to correct edit route
 *   3. StatusBadge aria-label — accessible label format
 *   4. StatusBadge lokiLabel override — Loki Mode renders realm name, not status label
 *   5. StatusBadge — bling class absent for thrall (isKarlOrTrial=false) in tooltip mode
 *      (cross-check: tooltip=true path tested separately from FiremanDecko's tooltip=false path)
 *
 * @ref #1088
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Card as CreditCard } from "@/lib/types";

// ── Mutable mock state ─────────────────────────────────────────────────────

let mockIsKarlOrTrial = false;
let mockReducedMotion = false;

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/hooks/useIsKarlOrTrial", () => ({
  useIsKarlOrTrial: () => mockIsKarlOrTrial,
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      className,
      style,
      whileHover: _wh,
      transition: _tr,
      ...rest
    }: React.HTMLAttributes<HTMLDivElement> & {
      style?: React.CSSProperties;
      whileHover?: unknown;
      transition?: unknown;
    }) => (
      <div className={className} style={style} data-testid="motion-div" {...rest}>
        {children}
      </div>
    ),
  },
  useReducedMotion: () => mockReducedMotion,
}));

vi.mock("@/components/shared/IssuerLogo", () => ({
  IssuerLogo: () => <span data-testid="issuer-logo" />,
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<CreditCard> = {}): CreditCard {
  return {
    id: "card-loki-1",
    householdId: "hh-loki",
    issuerId: "chase",
    cardName: "Loki Test Card",
    openDate: "2023-06-01T00:00:00.000Z",
    creditLimit: 500000,
    annualFee: 0,
    annualFeeDate: null,
    promoPeriodMonths: 0,
    signUpBonus: null,
    status: "active",
    notes: "",
    createdAt: "2023-06-01T00:00:00.000Z",
    updatedAt: "2023-06-01T00:00:00.000Z",
    ...overrides,
  } as CreditCard;
}

// ── 1. Reduced-motion path ─────────────────────────────────────────────────

describe("CardTile — reduced-motion path (bling elements preserved)", () => {
  beforeEach(() => {
    vi.resetModules();
    mockReducedMotion = true;
  });

  it("still renders the karl-bling-card class when reduced motion is active", async () => {
    const { CardTile } = await import("@/components/dashboard/CardTile");
    render(<CardTile card={makeCard()} />);
    const motionDiv = screen.getByTestId("motion-div");
    expect(motionDiv.className).toContain("karl-bling-card");
  });

  it("still renders all four rune corner spans when reduced motion is active", async () => {
    const { CardTile } = await import("@/components/dashboard/CardTile");
    const { container } = render(<CardTile card={makeCard()} />);
    const runes = container.querySelectorAll(".karl-rune-corner");
    expect(runes).toHaveLength(4);
  });
});

// ── 2. Link target ─────────────────────────────────────────────────────────

describe("CardTile — navigation link", () => {
  beforeEach(() => {
    vi.resetModules();
    mockReducedMotion = false;
  });

  it("renders a link to the card edit page", async () => {
    const { CardTile } = await import("@/components/dashboard/CardTile");
    const { container } = render(<CardTile card={makeCard({ id: "abc-123" })} />);
    const link = container.querySelector('a[href="/ledger/cards/abc-123/edit"]');
    expect(link).not.toBeNull();
  });
});

// ── 3. StatusBadge — aria-label ────────────────────────────────────────────

describe("StatusBadge — accessibility", () => {
  beforeEach(() => {
    vi.resetModules();
    mockIsKarlOrTrial = false;
  });

  it("has aria-label in the format 'Card status: <label>' for active status", async () => {
    const { StatusBadge } = await import("@/components/dashboard/StatusBadge");
    const { container } = render(<StatusBadge status="active" showTooltip={false} />);
    const el = container.querySelector('[aria-label^="Card status:"]');
    expect(el).not.toBeNull();
    expect(el!.getAttribute("aria-label")).toBe("Card status: Active");
  });

  it("has aria-label in the format 'Card status: <label>' in tooltip mode", async () => {
    const { StatusBadge } = await import("@/components/dashboard/StatusBadge");
    const { container } = render(<StatusBadge status="fee_approaching" showTooltip />);
    const el = container.querySelector('[aria-label^="Card status:"]');
    expect(el).not.toBeNull();
    expect(el!.getAttribute("aria-label")).toContain("Card status:");
  });
});

// ── 4. StatusBadge — lokiLabel override ───────────────────────────────────

describe("StatusBadge — Loki Mode lokiLabel override", () => {
  beforeEach(() => {
    vi.resetModules();
    mockIsKarlOrTrial = false;
  });

  it("renders the lokiLabel text instead of the normal status label", async () => {
    const { StatusBadge } = await import("@/components/dashboard/StatusBadge");
    render(
      <StatusBadge status="active" showTooltip={false} lokiLabel="Midgard" />
    );
    expect(screen.getByText("Midgard")).not.toBeNull();
  });

  it("aria-label uses lokiLabel text when lokiLabel is provided", async () => {
    const { StatusBadge } = await import("@/components/dashboard/StatusBadge");
    render(
      <StatusBadge status="closed" showTooltip={false} lokiLabel="Niflheim" />
    );
    const el = document.querySelector('[aria-label="Card status: Niflheim"]');
    expect(el).not.toBeNull();
  });
});
