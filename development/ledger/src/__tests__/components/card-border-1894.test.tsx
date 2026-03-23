/**
 * Card border consistency — issue #1894
 *
 * Verifies that ValhallaCardTile and HowlCardTile render with the same
 * uniform border style as HuntCardTile (border border-secondary) and do NOT
 * carry a thick left-accent border (border-l-4, realm-stone, etc.).
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { ValhallaCardTile } from "@/components/dashboard/ValhallaCardTile";
import { HowlCardTile } from "@/components/dashboard/HowlCardTile";
import { HuntCardTile } from "@/components/dashboard/HuntCardTile";
import type { Card } from "@/lib/types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseCard: Card = {
  id: "card-1894",
  householdId: "hh-test",
  issuerId: "chase",
  cardName: "Border Test Card",
  openDate: "2024-01-01T00:00:00.000Z",
  creditLimit: 1000000,
  annualFee: 9500,
  annualFeeDate: "2025-01-01",
  promoPeriodMonths: 0,
  signUpBonus: {
    type: "points",
    amount: 60000,
    spendRequirement: 400000,
    deadline: "2024-04-01",
    met: false,
  },
  amountSpent: 100000,
  status: "bonus_open",
  closedAt: undefined,
};

const closedCard: Card = {
  ...baseCard,
  status: "closed",
  closedAt: "2025-06-01T00:00:00.000Z",
  signUpBonus: { ...baseCard.signUpBonus!, met: true },
};

const howlCard: Card = {
  ...baseCard,
  status: "fee_approaching",
  annualFeeDate: "2024-04-10",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Card border consistency (#1894)", () => {
  it("ValhallaCardTile does NOT have a thick left border", () => {
    render(<ValhallaCardTile card={closedCard} />);
    const tile = screen.getByTestId("valhalla-card-tile");
    expect(tile).not.toHaveClass("border-l-4");
    expect(tile).not.toHaveClass("border-l-[hsl(var(--realm-stone))]");
  });

  it("ValhallaCardTile has uniform border matching HuntCardTile", () => {
    render(<ValhallaCardTile card={closedCard} />);
    const tile = screen.getByTestId("valhalla-card-tile");
    expect(tile).toHaveClass("border");
    expect(tile).toHaveClass("border-secondary");
  });

  it("HowlCardTile does NOT have a thick left border", () => {
    render(<HowlCardTile card={howlCard} />);
    const tile = screen.getByTestId("howl-card-tile");
    expect(tile).not.toHaveClass("border-l-4");
    expect(tile).not.toHaveClass("border-l-[hsl(var(--realm-muspel))]");
    expect(tile).not.toHaveClass("border-l-[hsl(var(--realm-hati))]");
  });

  it("HowlCardTile has uniform border matching HuntCardTile", () => {
    render(<HowlCardTile card={howlCard} />);
    const tile = screen.getByTestId("howl-card-tile");
    expect(tile).toHaveClass("border");
    expect(tile).toHaveClass("border-secondary");
  });

  it("HuntCardTile has uniform border (reference)", () => {
    render(<HuntCardTile card={baseCard} />);
    const tile = screen.getByTestId("hunt-card-tile");
    expect(tile).toHaveClass("border");
    expect(tile).toHaveClass("border-secondary");
    expect(tile).not.toHaveClass("border-l-4");
  });
});
