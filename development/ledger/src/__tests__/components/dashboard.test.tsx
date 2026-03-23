/**
 * Dashboard — canonical unit tests
 *
 * Consolidates issue-numbered test clusters:
 *   - dashboard-1695.test.tsx (Regression: #1695)
 *   - dashboard-1741.test.tsx (Regression: #1741)
 *
 * Covers: empty state, tab rendering, tab panel visibility,
 * howl urgency bar presence, thrall card limit gate, trash tab actions,
 * Idle label rename (#1741), tab order (#1741).
 *
 * Heavy mocking strategy: child components are stubbed to isolate Dashboard logic.
 *
 * @ref Issue #1695, #1741
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { Dashboard } from "@/components/dashboard/Dashboard";
import type { Card } from "@/lib/types";

// ── Shared mock factories ──────────────────────────────────────────────────
// See src/__tests__/mocks/ for factory definitions.

vi.mock("@/lib/storage", async () => (await import("../mocks/storage-mocks")).storageMockTrash);
vi.mock("@/contexts/RagnarokContext", async () => (await import("../mocks/hook-mocks")).ragnarokContextMock);
vi.mock("@/hooks/useAuth", async () => (await import("../mocks/hook-mocks")).authMockAuthenticatedHh1);
vi.mock("@/lib/trial-utils", async () => (await import("../mocks/storage-mocks")).trialUtilsMockLimit);
vi.mock("@/components/dashboard/CardTile", async () => (await import("../mocks/component-mocks")).cardTileMock);
vi.mock("@/components/dashboard/ValhallaCardTile", async () => {
  const React = await import("react");
  return {
    ValhallaCardTile: ({ card }: { card: { cardName: string } }) =>
      React.createElement("div", { "data-testid": `card-tile-${card.cardName}` }, card.cardName),
  };
});
vi.mock("@/components/dashboard/EmptyState", async () => (await import("../mocks/component-mocks")).emptyStateMock);
vi.mock("@/components/dashboard/AnimatedCardGrid", async () => (await import("../mocks/component-mocks")).animatedCardGridMock);
vi.mock("@/components/entitlement/KarlUpsellDialog", async () => (await import("../mocks/component-mocks")).karlUpsellDialogMock);

// ── Inline mocks (Dashboard-specific) ─────────────────────────────────────

vi.mock("@/components/dashboard/HuntCardTile", () => ({
  HuntCardTile: ({ card }: { card: { cardName: string } }) => (
    <div data-testid={`card-tile-${card.cardName}`}>{card.cardName}</div>
  ),
}));

vi.mock("@/components/dashboard/HowlCardTile", () => ({
  HowlCardTile: ({ card }: { card: { cardName: string } }) => (
    <div data-testid={`card-tile-${card.cardName}`}>{card.cardName}</div>
  ),
}));

vi.mock("@/components/dashboard/ValhallaCardTile", () => ({
  ValhallaCardTile: ({ card }: { card: { cardName: string } }) => (
    <div data-testid={`card-tile-${card.cardName}`}>{card.cardName}</div>
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

vi.mock("@/hooks/useLokiMode", () => ({
  useLokiMode: (cards: unknown[]) => ({
    lokiActive: false,
    lokiOrder: cards,
    lokiLabels: {},
  }),
}));

// DashboardTabButton mock: renders the label so we can assert on it
// Regression: #1741 — exports data-tab-id for order assertions
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

// useDashboardTabs: mutable so individual tests can override
let mockActiveTab = "active";
const mockHandleTabClick = vi.hoisted(() => vi.fn((tabId: string) => {
  mockActiveTab = tabId;
}));
const mockSetUpsellOpen = vi.hoisted(() => vi.fn());

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

// ── Tests: empty state ─────────────────────────────────────────────────────

// Regression: #1695
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

// ── Tests: tab bar ─────────────────────────────────────────────────────────

// Regression: #1695, #1741
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

  it("renders expected tab buttons by testid", () => {
    render(<Dashboard cards={[makeCard("a1", "active")]} />);
    expect(screen.getByTestId("tab-btn-all")).toBeDefined();
    expect(screen.getByTestId("tab-btn-active")).toBeDefined();
    expect(screen.getByTestId("tab-btn-howl")).toBeDefined();
    expect(screen.getByTestId("tab-btn-hunt")).toBeDefined();
    expect(screen.getByTestId("tab-btn-valhalla")).toBeDefined();
    expect(screen.getByTestId("tab-btn-trash")).toBeDefined();
  });

  // Regression: #1741 — tab order changed to hunt → howl → active → valhalla → all → trash
  it("renders tabs in correct DOM order per #1741 spec", () => {
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

// ── Tests: Idle label (#1741) ──────────────────────────────────────────────

// Regression: #1741 — "Active" tab renamed to "Idle" (display label only)
describe("Dashboard — Idle label (renamed from Active, #1741)", () => {
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

// ── Tests: active tab panel ─────────────────────────────────────────────────

// Regression: #1695, #1741
describe("Dashboard — active/Idle tab panel", () => {
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
    expect(screen.getAllByTestId("card-tile-Chase Sapphire").length).toBeGreaterThan(0);
  });

  it("renders TabHeader and TabSummary for active tab", () => {
    render(<Dashboard cards={[makeCard("a1", "active")]} />);
    expect(screen.getByTestId("tab-header-active")).toBeDefined();
    expect(screen.getByTestId("tab-summary-active")).toBeDefined();
  });

  // Regression: #1741 — Idle tab empty state text
  it("shows 'No idle cards' when active panel is empty", () => {
    render(<Dashboard cards={[makeCard("v1", "closed")]} />);
    const panel = document.getElementById("panel-active");
    expect(panel?.textContent).toContain("No idle cards");
  });

  it("does NOT show 'No active cards' (old label) in empty state", () => {
    render(<Dashboard cards={[makeCard("v1", "closed")]} />);
    const panel = document.getElementById("panel-active");
    expect(panel?.textContent).not.toContain("No active cards");
  });

  // Regression: #1741 — Idle tab filter: CardStatus unchanged
  it("shows status=active cards when Idle tab is active", () => {
    const cards = [
      makeCard("a1", "active", "Active Chase"),
      makeCard("c1", "closed", "Closed Citi"),
    ];
    render(<Dashboard cards={cards} />);
    expect(screen.getAllByTestId("card-tile-Active Chase").length).toBeGreaterThan(0);
  });

  it("does not show closed cards in the Idle/active panel", () => {
    const cards = [
      makeCard("a1", "active", "Active Chase"),
      makeCard("c1", "closed", "Closed Citi"),
    ];
    render(<Dashboard cards={cards} />);
    const panel = document.getElementById("panel-active");
    expect(panel?.textContent).not.toContain("Closed Citi");
  });
});

// ── Tests: howl tab panel ──────────────────────────────────────────────────

// Regression: #1695
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
    expect(screen.getAllByTestId("card-grid").length).toBeGreaterThan(0);
  });
});

// ── Tests: all tab panel ───────────────────────────────────────────────────

// Regression: #1695
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
    expect(screen.getAllByTestId("card-tile-Active Card").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("card-tile-Valhalla Card").length).toBeGreaterThan(0);
  });

  // Issue #1850 — all tab delegates bonus_open → HuntCardTile
  it("renders bonus_open card in all panel via HuntCardTile mock", () => {
    render(<Dashboard cards={[makeCard("b1", "bonus_open", "Hunt Card")]} />);
    expect(screen.getAllByTestId("card-tile-Hunt Card").length).toBeGreaterThan(0);
  });

  // Issue #1850 — all tab delegates fee_approaching → HowlCardTile
  it("renders fee_approaching card in all panel via HowlCardTile mock", () => {
    render(<Dashboard cards={[makeCard("f1", "fee_approaching", "Howl Card")]} />);
    expect(screen.getAllByTestId("card-tile-Howl Card").length).toBeGreaterThan(0);
  });

  // Issue #1850 — all tab delegates closed → ValhallaCardTile
  it("renders closed card in all panel via ValhallaCardTile mock", () => {
    render(<Dashboard cards={[makeCard("v1", "closed", "Valhalla Closed")]} />);
    expect(screen.getAllByTestId("card-tile-Valhalla Closed").length).toBeGreaterThan(0);
  });
});

// ── Tests: valhalla tab panel ──────────────────────────────────────────────

// Regression: #1695
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
    expect(screen.getAllByTestId("card-tile-Old Card").length).toBeGreaterThan(0);
  });

  it("renders graduated cards in the valhalla panel", () => {
    const cards = [makeCard("g1", "graduated", "Grad Card")];
    render(<Dashboard cards={cards} />);
    expect(screen.getAllByTestId("card-tile-Grad Card").length).toBeGreaterThan(0);
  });
});

// ── Tests: trash tab panel ─────────────────────────────────────────────────

// Regression: #1695
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

// ── Tests: hunt tab panel ──────────────────────────────────────────────────

// Regression: #1695
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
