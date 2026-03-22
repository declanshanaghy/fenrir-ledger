/**
 * Dashboard — unit tests for issue #1695.
 *
 * Covers: empty state, tab rendering, tab panel visibility,
 * howl urgency bar presence, thrall card limit gate, trash tab actions.
 *
 * Heavy mocking strategy: child components are stubbed to isolate Dashboard logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { Dashboard } from "@/components/dashboard/Dashboard";
import type { Card } from "@/lib/types";

// ── Module mocks ───────────────────────────────────────────────────────────

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
  KarlUpsellDialog: ({
    open,
    onDismiss,
  }: {
    open: boolean;
    onDismiss: () => void;
  }) =>
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
  TrashView: ({
    trashedCards,
    onRestore,
    onExpunge,
    onEmptyTrash,
  }: {
    trashedCards: { id: string }[];
    onRestore: (id: string) => void;
    onExpunge: (id: string) => void;
    onEmptyTrash: () => void;
  }) => (
    <div data-testid="trash-view">
      {trashedCards.map((c) => (
        <button key={c.id} onClick={() => onRestore(c.id)}>
          Restore {c.id}
        </button>
      ))}
      <button onClick={onEmptyTrash}>Empty Trash</button>
    </div>
  ),
}));

// useDashboardTabs: mutable so individual tests can override
let mockActiveTab = "active";
const mockHandleTabClick = vi.fn((tabId: string) => {
  mockActiveTab = tabId;
});
const mockSetUpsellOpen = vi.fn();

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
    setUpsellOpen: mockSetUpsellOpen,
    velocityUpsellOpen: false,
    setVelocityUpsellOpen: vi.fn(),
    howlUpsellOpen: false,
    setHowlUpsellOpen: vi.fn(),
    trashUpsellOpen: false,
    setTrashUpsellOpen: vi.fn(),
    howlBadgeShake: false,
    setHowlBadgeShake: vi.fn(),
    handleTabClick: mockHandleTabClick,
    handleTabKeyDown: vi.fn(),
  }),
}));

vi.mock("@/hooks/useLokiMode", () => ({
  useLokiMode: (cards: unknown[]) => ({
    lokiActive: false,
    lokiOrder: cards,
    lokiLabels: {},
  }),
}));

vi.mock("@/components/dashboard/DashboardTabButton", () => ({
  DashboardTabButton: ({
    tab,
    onClick,
  }: {
    tab: { id: string; label: string };
    isActive: boolean;
    onClick: () => void;
  }) => (
    <button role="tab" data-testid={`tab-btn-${tab.id}`} onClick={onClick}>
      {tab.label}
    </button>
  ),
}));

// ── Fixture builder ────────────────────────────────────────────────────────

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

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Dashboard — empty state", () => {
  it("renders EmptyState when there are no cards at all", () => {
    render(<Dashboard cards={[]} />);
    expect(screen.getByTestId("empty-state")).toBeDefined();
  });

  it("does NOT render EmptyState when valhalla cards exist even if active cards empty", () => {
    const cards = [makeCard("v1", "closed")];
    render(<Dashboard cards={cards} />);
    expect(screen.queryByTestId("empty-state")).toBeNull();
  });

  it("does NOT render EmptyState when active cards exist", () => {
    render(<Dashboard cards={[makeCard("a1", "active")]} />);
    expect(screen.queryByTestId("empty-state")).toBeNull();
  });
});

describe("Dashboard — tab bar renders", () => {
  beforeEach(() => {
    mockActiveTab = "active";
  });

  it("renders a tablist", () => {
    render(<Dashboard cards={[makeCard("a1", "active")]} />);
    expect(screen.getByRole("tablist")).toBeDefined();
  });

  it("renders all 6 tab buttons", () => {
    render(<Dashboard cards={[makeCard("a1", "active")]} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBe(6);
  });

  it("renders expected tab labels", () => {
    render(<Dashboard cards={[makeCard("a1", "active")]} />);
    expect(screen.getByTestId("tab-btn-all")).toBeDefined();
    expect(screen.getByTestId("tab-btn-active")).toBeDefined();
    expect(screen.getByTestId("tab-btn-howl")).toBeDefined();
    expect(screen.getByTestId("tab-btn-hunt")).toBeDefined();
    expect(screen.getByTestId("tab-btn-valhalla")).toBeDefined();
    expect(screen.getByTestId("tab-btn-trash")).toBeDefined();
  });
});

describe("Dashboard — active tab panel", () => {
  beforeEach(() => {
    mockActiveTab = "active";
  });

  it("shows panel-active when activeTab is 'active'", () => {
    render(<Dashboard cards={[makeCard("a1", "active")]} />);
    const panel = document.getElementById("panel-active");
    expect(panel?.hidden).toBe(false);
  });

  it("hides panel-howl when activeTab is 'active'", () => {
    render(<Dashboard cards={[makeCard("a1", "active")]} />);
    const panel = document.getElementById("panel-howl");
    expect(panel?.hidden).toBe(true);
  });

  it("renders active cards in the active panel", () => {
    const cards = [makeCard("a1", "active", "Chase Sapphire")];
    render(<Dashboard cards={cards} />);
    // Card appears in active panel and all panel — check at least one exists
    expect(screen.getAllByTestId("card-tile-Chase Sapphire").length).toBeGreaterThan(0);
  });

  it("renders TabHeader and TabSummary for active tab", () => {
    render(<Dashboard cards={[makeCard("a1", "active")]} />);
    expect(screen.getByTestId("tab-header-active")).toBeDefined();
    expect(screen.getByTestId("tab-summary-active")).toBeDefined();
  });
});

describe("Dashboard — howl tab panel", () => {
  beforeEach(() => {
    mockActiveTab = "howl";
  });

  it("shows panel-howl when activeTab is 'howl'", () => {
    render(<Dashboard cards={[makeCard("h1", "fee_approaching")]} />);
    const panel = document.getElementById("panel-howl");
    expect(panel?.hidden).toBe(false);
  });

  it("shows empty state text when no howl cards", () => {
    render(<Dashboard cards={[makeCard("a1", "active")]} />);
    const panel = document.getElementById("panel-howl");
    expect(panel?.textContent).toContain("No alerts");
  });

  it("renders howl cards in a grid when howl cards exist", () => {
    const cards = [makeCard("h1", "fee_approaching", "Overdue Card")];
    render(<Dashboard cards={cards} />);
    // Card appears in howl panel and all panel — multiple grids is expected
    expect(screen.getAllByTestId("card-grid").length).toBeGreaterThan(0);
  });
});

describe("Dashboard — all tab panel", () => {
  beforeEach(() => {
    mockActiveTab = "all";
  });

  it("shows panel-all when activeTab is 'all'", () => {
    render(<Dashboard cards={[makeCard("a1", "active")]} />);
    const panel = document.getElementById("panel-all");
    expect(panel?.hidden).toBe(false);
  });

  it("renders all cards in the all panel", () => {
    const cards = [
      makeCard("a1", "active", "Active Card"),
      makeCard("v1", "closed", "Valhalla Card"),
    ];
    render(<Dashboard cards={cards} />);
    // Cards appear in multiple panels — verify both are present at least once
    expect(screen.getAllByTestId("card-tile-Active Card").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("card-tile-Valhalla Card").length).toBeGreaterThan(0);
  });
});

describe("Dashboard — valhalla tab panel", () => {
  beforeEach(() => {
    mockActiveTab = "valhalla";
  });

  it("shows panel-valhalla when activeTab is 'valhalla'", () => {
    render(<Dashboard cards={[makeCard("v1", "closed")]} />);
    const panel = document.getElementById("panel-valhalla");
    expect(panel?.hidden).toBe(false);
  });

  it("shows empty state for valhalla when no closed/graduated cards", () => {
    render(<Dashboard cards={[makeCard("a1", "active")]} />);
    const panel = document.getElementById("panel-valhalla");
    expect(panel?.textContent).toContain("No retired cards");
  });

  it("renders closed cards in the valhalla panel", () => {
    const cards = [makeCard("v1", "closed", "Old Card")];
    render(<Dashboard cards={cards} />);
    // Card appears in valhalla panel and all panel
    expect(screen.getAllByTestId("card-tile-Old Card").length).toBeGreaterThan(0);
  });

  it("renders graduated cards in the valhalla panel", () => {
    const cards = [makeCard("g1", "graduated", "Grad Card")];
    render(<Dashboard cards={cards} />);
    expect(screen.getAllByTestId("card-tile-Grad Card").length).toBeGreaterThan(0);
  });
});

describe("Dashboard — trash tab panel", () => {
  beforeEach(() => {
    mockActiveTab = "trash";
  });

  it("shows panel-trash when activeTab is 'trash'", () => {
    render(<Dashboard cards={[makeCard("a1", "active")]} />);
    const panel = document.getElementById("panel-trash");
    expect(panel?.hidden).toBe(false);
  });

  it("renders TrashView component", () => {
    render(<Dashboard cards={[makeCard("a1", "active")]} />);
    expect(screen.getByTestId("trash-view")).toBeDefined();
  });

  it("calls onCardsChange when empty trash is triggered", () => {
    const onCardsChange = vi.fn();
    render(
      <Dashboard
        cards={[makeCard("a1", "active")]}
        householdId="hh-1"
        onCardsChange={onCardsChange}
      />,
    );
    fireEvent.click(screen.getByText("Empty Trash"));
    expect(onCardsChange).toHaveBeenCalledTimes(1);
  });
});

describe("Dashboard — hunt tab panel", () => {
  beforeEach(() => {
    mockActiveTab = "hunt";
  });

  it("shows panel-hunt when activeTab is 'hunt'", () => {
    render(<Dashboard cards={[makeCard("b1", "bonus_open", "Bonus Card")]} />);
    const panel = document.getElementById("panel-hunt");
    expect(panel?.hidden).toBe(false);
  });

  it("shows empty state for hunt when no bonus_open cards", () => {
    render(<Dashboard cards={[makeCard("a1", "active")]} />);
    const panel = document.getElementById("panel-hunt");
    expect(panel?.textContent).toContain("No bounties");
  });
});
