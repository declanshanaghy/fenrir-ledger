/**
 * Dashboard — QA tests for issue #1741.
 *
 * Validates:
 * - "Active" tab renamed to "Idle" (display label only — CardStatus unchanged)
 * - Tab order: hunt → howl → active(Idle) → valhalla → all → trash
 * - Empty state text for the Idle tab is "No idle cards"
 * - Idle tab still shows status="active" cards (filter logic unchanged)
 * - Trash tab is last in the tab order
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Dashboard } from "@/components/dashboard/Dashboard";
import type { Card } from "@/lib/types";

// ── Module mocks (mirrors dashboard-1695.test.tsx) ─────────────────────────

vi.mock("@/lib/storage", () => ({
  restoreCard: vi.fn(),
  expungeCard: vi.fn(),
  expungeAllCards: vi.fn(),
}));

vi.mock("@/contexts/RagnarokContext", () => ({
  useRagnarok: () => ({ ragnarokActive: false }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ status: "authenticated", householdId: "hh-1", data: null, signOut: vi.fn(), ensureHouseholdId: () => "hh-1" }),
}));

vi.mock("@/lib/trial-utils", () => ({
  THRALL_CARD_LIMIT: 5,
}));

vi.mock("@/components/dashboard/CardTile", () => ({
  CardTile: ({ card }: { card: { cardName: string } }) => (
    <div data-testid={`card-tile-${card.cardName}`}>{card.cardName}</div>
  ),
}));

vi.mock("@/components/dashboard/EmptyState", () => ({
  EmptyState: () => <div data-testid="empty-state">No cards yet</div>,
}));

vi.mock("@/components/dashboard/AnimatedCardGrid", () => ({
  AnimatedCardGrid: ({
    cards,
    renderCard,
  }: {
    cards: { id: string; cardName: string }[];
    renderCard: (card: { id: string; cardName: string }) => React.ReactNode;
  }) => (
    <div data-testid="card-grid">
      {cards.map((card) => (
        <div key={card.id}>{renderCard(card)}</div>
      ))}
    </div>
  ),
}));

vi.mock("@/components/dashboard/TabHeader", () => ({
  TabHeader: ({ tabId }: { tabId: string }) => (
    <div data-testid={`tab-header-${tabId}`} />
  ),
}));

vi.mock("@/components/dashboard/TabSummary", () => ({
  TabSummary: ({ tabId }: { tabId: string }) => (
    <div data-testid={`tab-summary-${tabId}`} />
  ),
}));

vi.mock("@/components/entitlement/KarlUpsellDialog", () => ({
  KarlUpsellDialog: ({ open, onDismiss }: { open: boolean; onDismiss: () => void }) =>
    open ? (
      <div data-testid="karl-upsell-dialog">
        <button onClick={onDismiss}>Dismiss</button>
      </div>
    ) : null,
  KARL_UPSELL_VALHALLA: {},
  KARL_UPSELL_VELOCITY: {},
  KARL_UPSELL_HOWL: {},
  KARL_UPSELL_TRASH: {},
}));

vi.mock("@/components/dashboard/TrashView", () => ({
  TrashView: () => <div data-testid="trash-view" />,
}));

vi.mock("@/hooks/useLokiMode", () => ({
  useLokiMode: (cards: unknown[]) => ({
    lokiActive: false,
    lokiOrder: cards,
    lokiLabels: {},
  }),
}));

// DashboardTabButton mock: renders the label so we can assert on it
vi.mock("@/components/dashboard/DashboardTabButton", () => ({
  DashboardTabButton: ({
    tab,
    onClick,
  }: {
    tab: { id: string; label: string };
    isActive: boolean;
    onClick: () => void;
  }) => (
    <button
      role="tab"
      data-testid={`tab-btn-${tab.id}`}
      data-tab-id={tab.id}
      onClick={onClick}
    >
      {tab.label}
    </button>
  ),
}));

// useDashboardTabs: allow per-test activeTab override
let mockActiveTab = "active";

vi.mock("@/hooks/useDashboardTabs", () => ({
  useDashboardTabs: () => ({
    activeTab: mockActiveTab,
    gates: {
      isHowlUnlocked: true,
      hasValhalla: true,
      hasVelocity: true,
      hasTrash: true,
    },
    karlOrTrial: true,
    upsellOpen: false,
    setUpsellOpen: vi.fn(),
    velocityUpsellOpen: false,
    setVelocityUpsellOpen: vi.fn(),
    howlUpsellOpen: false,
    setHowlUpsellOpen: vi.fn(),
    trashUpsellOpen: false,
    setTrashUpsellOpen: vi.fn(),
    howlBadgeShake: false,
    setHowlBadgeShake: vi.fn(),
    handleTabClick: vi.fn(),
    handleTabKeyDown: vi.fn(),
  }),
}));

// ── Fixture helpers ─────────────────────────────────────────────────────────

function makeCard(id: string, status: Card["status"], name?: string): Card {
  return {
    id,
    householdId: "hh-1",
    issuerId: "chase",
    cardName: name ?? `Card ${id}`,
    openDate: "2023-01-01T00:00:00.000Z",
    creditLimit: 10000_00,
    annualFee: 95_00,
    annualFeeDate: "2026-06-01T00:00:00.000Z",
    promoPeriodMonths: 0,
    signUpBonus: null,
    status,
    notes: "",
    createdAt: "2023-01-01T00:00:00.000Z",
    updatedAt: "2023-01-01T00:00:00.000Z",
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("Dashboard #1741 — Idle label (renamed from Active)", () => {
  beforeEach(() => {
    mockActiveTab = "active";
  });

  it("renders 'Idle' as the label for the active tab button", () => {
    render(<Dashboard cards={[makeCard("a1", "active")]} />);
    const tabBtn = screen.getByTestId("tab-btn-active");
    expect(tabBtn.textContent).toBe("Idle");
  });

  it("does NOT render 'Active' as a tab label", () => {
    render(<Dashboard cards={[makeCard("a1", "active")]} />);
    const tabs = screen.getAllByRole("tab");
    const labels = tabs.map((t) => t.textContent);
    expect(labels).not.toContain("Active");
  });
});

describe("Dashboard #1741 — tab order (hunt → howl → active → valhalla → all → trash)", () => {
  beforeEach(() => {
    mockActiveTab = "active";
  });

  it("renders tabs in correct DOM order per spec", () => {
    render(<Dashboard cards={[makeCard("a1", "active")]} />);
    const tabs = screen.getAllByRole("tab");
    const ids = tabs.map((t) => t.getAttribute("data-tab-id"));
    expect(ids).toEqual(["hunt", "howl", "active", "valhalla", "all", "trash"]);
  });

  it("hunt tab is first (index 0)", () => {
    render(<Dashboard cards={[makeCard("a1", "active")]} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0].getAttribute("data-tab-id")).toBe("hunt");
  });

  it("trash tab is last (index 5)", () => {
    render(<Dashboard cards={[makeCard("a1", "active")]} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs[tabs.length - 1].getAttribute("data-tab-id")).toBe("trash");
  });

  it("active (Idle) tab is at index 2, between howl and valhalla", () => {
    render(<Dashboard cards={[makeCard("a1", "active")]} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs[2].getAttribute("data-tab-id")).toBe("active");
    expect(tabs[1].getAttribute("data-tab-id")).toBe("howl");
    expect(tabs[3].getAttribute("data-tab-id")).toBe("valhalla");
  });
});

describe("Dashboard #1741 — Idle tab empty state", () => {
  beforeEach(() => {
    mockActiveTab = "active";
  });

  it("shows 'No idle cards' when active panel is empty", () => {
    // Render with no active-status cards (only a closed card)
    render(<Dashboard cards={[makeCard("v1", "closed")]} />);
    const panel = document.getElementById("panel-active");
    expect(panel?.textContent).toContain("No idle cards");
  });

  it("does NOT show 'No active cards' (old label) in empty state", () => {
    render(<Dashboard cards={[makeCard("v1", "closed")]} />);
    const panel = document.getElementById("panel-active");
    expect(panel?.textContent).not.toContain("No active cards");
  });
});

describe("Dashboard #1741 — Idle tab filter (CardStatus unchanged)", () => {
  beforeEach(() => {
    mockActiveTab = "active";
  });

  it("shows status=active cards when Idle tab is active", () => {
    const cards = [
      makeCard("a1", "active", "Active Chase"),
      makeCard("c1", "closed", "Closed Citi"),
    ];
    render(<Dashboard cards={cards} />);
    // Active card appears in the active panel (and all panel)
    expect(screen.getAllByTestId("card-tile-Active Chase").length).toBeGreaterThan(0);
  });

  it("does not show closed cards in the Idle/active panel", () => {
    mockActiveTab = "active";
    const cards = [
      makeCard("a1", "active", "Active Chase"),
      makeCard("c1", "closed", "Closed Citi"),
    ];
    render(<Dashboard cards={cards} />);
    const panel = document.getElementById("panel-active");
    // The closed card should not be in the active panel
    expect(panel?.textContent).not.toContain("Closed Citi");
  });
});
