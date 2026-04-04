/**
 * Unit tests for DashboardTabs component
 *
 * Covers: default tab selection, tab switching on click, badge counts,
 * keyboard navigation (ArrowLeft/ArrowRight), and card partitioning.
 *
 * Issue: #2046
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DashboardTabs, HOWL_STATUSES } from "@/components/dashboard/DashboardTabs";
import type { Card } from "@/lib/types";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/contexts/RagnarokContext", () => ({
  useRagnarok: () => ({ ragnarokActive: false }),
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<Card>): Card {
  return {
    id: "card-1",
    cardName: "Test Card",
    issuerId: "chase",
    status: "active",
    householdId: "hh-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    annualFeeDue: null,
    annualFeeAmount: null,
    signupBonus: null,
    spendDeadline: null,
    spendRequired: null,
    notes: null,
    deletedAt: null,
    creditLimit: null,
    last4: null,
    openedAt: null,
    ...overrides,
  };
}

const activeCard = makeCard({ id: "c1", cardName: "Active Card", status: "active" });
const howlCard = makeCard({ id: "c2", cardName: "Fee Card", status: "fee_approaching" });
const promoCard = makeCard({ id: "c3", cardName: "Promo Card", status: "promo_expiring" });
const overdueCard = makeCard({ id: "c4", cardName: "Overdue Card", status: "overdue" });

// ── Tests ────────────────────────────────────────────────────────────────────

describe("DashboardTabs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("defaults to 'howl' tab when howl cards are present", () => {
    render(
      <DashboardTabs cards={[howlCard, activeCard]}>
        {(_, tab) => <div data-testid="active-tab">{tab}</div>}
      </DashboardTabs>
    );
    expect(screen.getByTestId("active-tab")).toHaveTextContent("howl");
    expect(screen.getByTestId("tab-howl")).toHaveAttribute("aria-selected", "true");
  });

  it("defaults to 'active' tab when no howl cards are present", () => {
    render(
      <DashboardTabs cards={[activeCard]}>
        {(_, tab) => <div data-testid="active-tab">{tab}</div>}
      </DashboardTabs>
    );
    expect(screen.getByTestId("active-tab")).toHaveTextContent("active");
    expect(screen.getByTestId("tab-active")).toHaveAttribute("aria-selected", "true");
  });

  it("switches to 'active' tab when active tab button is clicked", () => {
    render(
      <DashboardTabs cards={[howlCard, activeCard]}>
        {(_, tab) => <div data-testid="active-tab">{tab}</div>}
      </DashboardTabs>
    );
    fireEvent.click(screen.getByTestId("tab-active"));
    expect(screen.getByTestId("active-tab")).toHaveTextContent("active");
    expect(screen.getByTestId("tab-active")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("tab-howl")).toHaveAttribute("aria-selected", "false");
  });

  it("switches to 'howl' tab when howl tab button is clicked", () => {
    render(
      <DashboardTabs cards={[howlCard, activeCard]}>
        {(_, tab) => <div data-testid="active-tab">{tab}</div>}
      </DashboardTabs>
    );
    // Start on howl, switch to active, switch back
    fireEvent.click(screen.getByTestId("tab-active"));
    fireEvent.click(screen.getByTestId("tab-howl"));
    expect(screen.getByTestId("active-tab")).toHaveTextContent("howl");
  });

  it("shows the howl card count badge", () => {
    render(
      <DashboardTabs cards={[howlCard, promoCard, activeCard]}>
        {() => null}
      </DashboardTabs>
    );
    const badge = screen.getByTestId("howl-badge");
    expect(badge).toHaveTextContent("2");
  });

  it("shows the active card count badge", () => {
    render(
      <DashboardTabs cards={[howlCard, activeCard, activeCard]}>
        {() => null}
      </DashboardTabs>
    );
    // activeCards should have 2 (both active cards)
    const badge = screen.getByTestId("active-badge");
    expect(badge).toHaveTextContent("2");
  });

  it("passes filtered howl cards to the children render function", () => {
    render(
      <DashboardTabs cards={[howlCard, promoCard, activeCard]}>
        {(filteredCards) => (
          <ul>
            {filteredCards.map((c) => (
              <li key={c.id} data-testid={`card-${c.id}`}>{c.cardName}</li>
            ))}
          </ul>
        )}
      </DashboardTabs>
    );
    expect(screen.getByTestId("card-c2")).toBeInTheDocument();
    expect(screen.getByTestId("card-c3")).toBeInTheDocument();
    expect(screen.queryByTestId("card-c1")).not.toBeInTheDocument();
  });

  it("passes filtered active cards after switching to active tab", () => {
    render(
      <DashboardTabs cards={[howlCard, activeCard]}>
        {(filteredCards) => (
          <ul>
            {filteredCards.map((c) => (
              <li key={c.id} data-testid={`card-${c.id}`}>{c.cardName}</li>
            ))}
          </ul>
        )}
      </DashboardTabs>
    );
    fireEvent.click(screen.getByTestId("tab-active"));
    expect(screen.getByTestId("card-c1")).toBeInTheDocument();
    expect(screen.queryByTestId("card-c2")).not.toBeInTheDocument();
  });

  it("ArrowRight key moves focus to next tab", () => {
    render(
      <DashboardTabs cards={[howlCard, activeCard]}>
        {(_, tab) => <div data-testid="active-tab">{tab}</div>}
      </DashboardTabs>
    );
    const howlBtn = screen.getByTestId("tab-howl");
    fireEvent.keyDown(howlBtn, { key: "ArrowRight" });
    expect(screen.getByTestId("active-tab")).toHaveTextContent("active");
  });

  it("ArrowLeft key moves focus to previous tab (wraps around)", () => {
    render(
      <DashboardTabs cards={[howlCard, activeCard]}>
        {(_, tab) => <div data-testid="active-tab">{tab}</div>}
      </DashboardTabs>
    );
    // Start on "howl" tab, ArrowLeft should wrap to "active"
    const howlBtn = screen.getByTestId("tab-howl");
    fireEvent.keyDown(howlBtn, { key: "ArrowLeft" });
    expect(screen.getByTestId("active-tab")).toHaveTextContent("active");
  });

  it("ignores non-arrow keys", () => {
    render(
      <DashboardTabs cards={[howlCard, activeCard]}>
        {(_, tab) => <div data-testid="active-tab">{tab}</div>}
      </DashboardTabs>
    );
    const howlBtn = screen.getByTestId("tab-howl");
    fireEvent.keyDown(howlBtn, { key: "Enter" });
    expect(screen.getByTestId("active-tab")).toHaveTextContent("howl"); // unchanged
  });
});

describe("HOWL_STATUSES", () => {
  it("includes fee_approaching, promo_expiring, overdue", () => {
    expect(HOWL_STATUSES.has("fee_approaching")).toBe(true);
    expect(HOWL_STATUSES.has("promo_expiring")).toBe(true);
    expect(HOWL_STATUSES.has("overdue")).toBe(true);
  });

  it("does not include active or graduated", () => {
    expect(HOWL_STATUSES.has("active")).toBe(false);
    expect(HOWL_STATUSES.has("graduated")).toBe(false);
  });
});

describe("DashboardTabs with overdue card", () => {
  it("routes overdue cards to howl tab", () => {
    render(
      <DashboardTabs cards={[overdueCard]}>
        {(filteredCards, tab) => (
          <div>
            <span data-testid="active-tab">{tab}</span>
            <span data-testid="card-count">{filteredCards.length}</span>
          </div>
        )}
      </DashboardTabs>
    );
    expect(screen.getByTestId("active-tab")).toHaveTextContent("howl");
    expect(screen.getByTestId("card-count")).toHaveTextContent("1");
  });
});
