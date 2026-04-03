/**
 * TabSummary — hunt tab aggregate spend tests (issue #1792)
 *
 * Tests the huntSummary generator function behavior via component render.
 * Focuses on aggregate totals, percentage, approaching-deadline count, and
 * the no-spend-requirement fallback path.
 *
 * FiremanDecko covered the HuntCardTile pure helpers. These tests cover the
 * summary bar aggregate logic that was not otherwise tested.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { TabSummary } from "@/components/dashboard/TabSummary";
import type { Card } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal bonus_open card with controllable spend fields */
function makeHuntCard(opts: {
  id?: string;
  amountSpent?: number;
  spendRequirement?: number;
  /** ISO date string — far future keeps it non-urgent by default */
  deadline?: string;
} = {}): Card {
  return {
    id: opts.id ?? "card-1",
    householdId: "hh-test",
    issuerId: "chase",
    cardName: "Test Card",
    openDate: "2025-01-01T00:00:00.000Z",
    creditLimit: 1000000,
    annualFee: 0,
    annualFeeDate: "",
    promoPeriodMonths: 0,
    signUpBonus:
      opts.spendRequirement !== undefined
        ? {
            type: "points",
            amount: 60000,
            spendRequirement: opts.spendRequirement,
            deadline: opts.deadline ?? "2030-12-31T00:00:00.000Z",
            met: false,
          }
        : null,
    amountSpent: opts.amountSpent ?? 0,
    status: "bonus_open",
    notes: "",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };
}

// ── localStorage stub ─────────────────────────────────────────────────────────
// TabSummary checks localStorage for the dismissed flag on mount.
// We force it to return "false" (not dismissed) so the summary renders.

beforeEach(() => {
  vi.spyOn(Storage.prototype, "getItem").mockReturnValue("false");
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── huntSummary aggregate tests ───────────────────────────────────────────────

describe("TabSummary hunt — aggregate spend logic", () => {
  it("falls back to 'with open bonus windows' when no cards have spendRequirement", async () => {
    const cards: Card[] = [
      makeHuntCard({ id: "c1", spendRequirement: undefined }),
      makeHuntCard({ id: "c2", spendRequirement: undefined }),
    ];

    await act(async () => {
      render(<TabSummary tabId="hunt" cards={cards} />);
    });

    expect(screen.getByText(/with open bonus windows/)).toBeInTheDocument();
  });

  it("shows aggregate spent vs total min spend with correct percentage", async () => {
    // Card 1: $500 of $2,000 spent (25%)
    // Card 2: $1,500 of $2,000 spent (75%)
    // Aggregate: $2,000 of $4,000 = 50%
    const cards: Card[] = [
      makeHuntCard({ id: "c1", amountSpent: 50000, spendRequirement: 200000 }),
      makeHuntCard({ id: "c2", amountSpent: 150000, spendRequirement: 200000 }),
    ];

    await act(async () => {
      render(<TabSummary tabId="hunt" cards={cards} />);
    });

    expect(screen.getByText(/\$2,000/)).toBeInTheDocument(); // total spent
    expect(screen.getByText(/\$4,000 min spend/)).toBeInTheDocument(); // total required
    expect(screen.getByText(/\(50%\)/)).toBeInTheDocument();
  });

  it("shows 0% when nothing has been spent against a requirement", async () => {
    const cards: Card[] = [
      makeHuntCard({ id: "c1", amountSpent: 0, spendRequirement: 300000 }),
    ];

    await act(async () => {
      render(<TabSummary tabId="hunt" cards={cards} />);
    });

    expect(screen.getByText(/\$0/)).toBeInTheDocument();
    expect(screen.getByText(/\(0%\)/)).toBeInTheDocument();
  });

  it("shows approaching deadline count for cards within 30 days", async () => {
    // Deadline 10 days from now (dynamic — avoids staleness as time passes)
    const urgentDeadline = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const farDeadline = "2030-12-31T00:00:00.000Z";

    const cards: Card[] = [
      makeHuntCard({ id: "c1", spendRequirement: 100000, deadline: urgentDeadline }),
      makeHuntCard({ id: "c2", spendRequirement: 100000, deadline: urgentDeadline }),
      makeHuntCard({ id: "c3", spendRequirement: 100000, deadline: farDeadline }),
    ];

    await act(async () => {
      render(<TabSummary tabId="hunt" cards={cards} />);
    });

    expect(screen.getByText(/approaching their deadline/)).toBeInTheDocument();
    // 2 cards are approaching — the bold element shows "2"
    const boldEls = screen
      .getAllByText("2")
      .filter((el) => el.tagName.toLowerCase() === "span");
    expect(boldEls.length).toBeGreaterThan(0);
  });

  it("uses singular grammar for a single approaching card", async () => {
    const urgentDeadline = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const cards: Card[] = [
      makeHuntCard({ id: "c1", spendRequirement: 100000, deadline: urgentDeadline }),
    ];

    await act(async () => {
      render(<TabSummary tabId="hunt" cards={cards} />);
    });

    expect(screen.getByText(/approaching its deadline/)).toBeInTheDocument();
  });

  it("shows singular 'card' grammar for a single hunt card", async () => {
    const cards: Card[] = [
      makeHuntCard({ id: "c1", spendRequirement: 300000 }),
    ];

    await act(async () => {
      render(<TabSummary tabId="hunt" cards={cards} />);
    });

    // Should say "1 card" not "1 cards"
    expect(screen.getByText("1 card")).toBeInTheDocument();
  });
});
