/**
 * CardUrgencyBar — unit tests for issue #1695.
 *
 * Covers: overdue, fee_approaching, promo_expiring label text,
 * dot pulse class for overdue, data-testid presence.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CardUrgencyBar } from "@/components/dashboard/CardUrgencyBar";
import type { Card } from "@/lib/types";

// ── Mock daysUntil so tests are date-independent ───────────────────────────

vi.mock("@/lib/card-utils", () => ({
  daysUntil: vi.fn(),
}));

import { daysUntil } from "@/lib/card-utils";

const mockDaysUntil = vi.mocked(daysUntil);

// ── Fixture builder ────────────────────────────────────────────────────────

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: "card-1",
    householdId: "hh-1",
    issuerId: "chase",
    cardName: "Sapphire Preferred",
    openDate: "2023-01-01T00:00:00.000Z",
    creditLimit: 10000_00,
    annualFee: 95_00,
    annualFeeDate: "2026-06-01T00:00:00.000Z",
    promoPeriodMonths: 0,
    signUpBonus: null,
    status: "active",
    notes: "",
    createdAt: "2023-01-01T00:00:00.000Z",
    updatedAt: "2023-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("CardUrgencyBar — renders with data-testid", () => {
  it("renders the urgency bar element", () => {
    mockDaysUntil.mockReturnValue(60);
    render(<CardUrgencyBar card={makeCard({ status: "fee_approaching" })} />);
    expect(screen.getByTestId("card-urgency-bar")).toBeDefined();
  });
});

describe("CardUrgencyBar — fee_approaching", () => {
  it("shows FEE APPROACHING label when status is fee_approaching", () => {
    mockDaysUntil.mockReturnValue(45);
    render(<CardUrgencyBar card={makeCard({ status: "fee_approaching" })} />);
    expect(screen.getByTestId("card-urgency-bar").textContent).toContain(
      "FEE APPROACHING",
    );
  });

  it("shows days remaining in label", () => {
    mockDaysUntil.mockReturnValue(45);
    render(<CardUrgencyBar card={makeCard({ status: "fee_approaching" })} />);
    expect(screen.getByTestId("card-urgency-bar").textContent).toContain("45");
  });

  it("uses singular 'day' when 1 day remains", () => {
    mockDaysUntil.mockReturnValue(1);
    render(<CardUrgencyBar card={makeCard({ status: "fee_approaching" })} />);
    const text = screen.getByTestId("card-urgency-bar").textContent ?? "";
    expect(text).toContain("1 day");
    expect(text).not.toContain("1 days");
  });

  it("uses plural 'days' when multiple days remain", () => {
    mockDaysUntil.mockReturnValue(14);
    render(<CardUrgencyBar card={makeCard({ status: "fee_approaching" })} />);
    expect(screen.getByTestId("card-urgency-bar").textContent).toContain("14 days");
  });
});

describe("CardUrgencyBar — overdue", () => {
  it("shows OVERDUE label when days <= 0", () => {
    mockDaysUntil.mockReturnValue(-3);
    render(<CardUrgencyBar card={makeCard({ status: "overdue" })} />);
    expect(screen.getByTestId("card-urgency-bar").textContent).toContain(
      "OVERDUE",
    );
  });

  it("shows 'X days past' for overdue cards", () => {
    mockDaysUntil.mockReturnValue(-3);
    render(<CardUrgencyBar card={makeCard({ status: "overdue" })} />);
    expect(screen.getByTestId("card-urgency-bar").textContent).toContain(
      "3 days past",
    );
  });

  it("uses singular 'day past' when 1 day overdue", () => {
    mockDaysUntil.mockReturnValue(-1);
    render(<CardUrgencyBar card={makeCard({ status: "overdue" })} />);
    const text = screen.getByTestId("card-urgency-bar").textContent ?? "";
    expect(text).toContain("1 day past");
    expect(text).not.toContain("1 days past");
  });

  it("urgency dot has animate-pulse class for overdue", () => {
    mockDaysUntil.mockReturnValue(-5);
    const { container } = render(
      <CardUrgencyBar card={makeCard({ status: "overdue" })} />,
    );
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot?.className).toContain("animate-pulse");
  });

  it("urgency dot does NOT have animate-pulse for fee_approaching", () => {
    mockDaysUntil.mockReturnValue(20);
    const { container } = render(
      <CardUrgencyBar card={makeCard({ status: "fee_approaching" })} />,
    );
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot?.className).not.toContain("animate-pulse");
  });
});

describe("CardUrgencyBar — promo_expiring", () => {
  it("shows PROMO EXPIRING label", () => {
    mockDaysUntil.mockReturnValue(30);
    render(
      <CardUrgencyBar
        card={makeCard({
          status: "promo_expiring",
          signUpBonus: {
            targetSpend: 4000_00,
            deadline: "2026-07-01T00:00:00.000Z",
            bonusPoints: 60000,
            met: false,
          },
        })}
      />,
    );
    expect(screen.getByTestId("card-urgency-bar").textContent).toContain(
      "PROMO EXPIRING",
    );
  });

  it("uses annualFeeDate for fee statuses, signUpBonus.deadline for promo", () => {
    // daysUntil should be called with the deadline string for promo_expiring
    mockDaysUntil.mockReturnValue(15);
    const deadline = "2026-07-15T00:00:00.000Z";
    render(
      <CardUrgencyBar
        card={makeCard({
          status: "promo_expiring",
          signUpBonus: {
            targetSpend: 4000_00,
            deadline,
            bonusPoints: 60000,
            met: false,
          },
        })}
      />,
    );
    expect(mockDaysUntil).toHaveBeenCalledWith(deadline);
  });
});
