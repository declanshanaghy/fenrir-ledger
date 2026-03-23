/**
 * AnonEmptyState + Dashboard conditional rendering — tests for issue #1748.
 *
 * Covers:
 *  - AnonEmptyState renders sign-in primary CTA and add-locally secondary CTA
 *  - Primary CTA calls router.push with buildSignInUrl result
 *  - Secondary CTA is a link to /ledger/cards/new
 *  - "or" divider is aria-hidden
 *  - Footnotes are associated via aria-describedby
 *  - Dashboard renders AnonEmptyState when status=anonymous and zero cards
 *  - Dashboard renders EmptyState when status=authenticated and zero cards
 *  - Dashboard renders EmptyState when status=loading and zero cards
 *  - SignInNudge renders null when hasCards=false (both anonymous and after fix)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AnonEmptyState } from "@/components/dashboard/AnonEmptyState";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { SignInNudge } from "@/components/layout/SignInNudge";

// ── Shared mock factories ──────────────────────────────────────────────────
// See src/__tests__/mocks/ for factory definitions.

vi.mock("next/link", async () => (await import("../mocks/component-mocks")).nextLinkMock);
vi.mock("@/lib/storage", async () => (await import("../mocks/storage-mocks")).storageMockTrash);
vi.mock("@/contexts/RagnarokContext", async () => (await import("../mocks/hook-mocks")).ragnarokContextMock);
vi.mock("@/lib/trial-utils", async () => (await import("../mocks/storage-mocks")).trialUtilsMockLimit);
vi.mock("@/components/dashboard/CardTile", async () => (await import("../mocks/component-mocks")).cardTileMock);
vi.mock("@/components/dashboard/AnimatedCardGrid", async () => (await import("../mocks/component-mocks")).animatedCardGridMock);
vi.mock("@/components/entitlement/KarlUpsellDialog", async () => (await import("../mocks/component-mocks")).karlUpsellDialogMock);

// ── Inline mocks ──────────────────────────────────────────────────────────

const mockPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/ledger",
  useSearchParams: () => new URLSearchParams(),
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
  TrashView: () => <div data-testid="trash-view" />,
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

vi.mock("@/hooks/useDashboardTabs", () => ({
  useDashboardTabs: () => ({
    activeTab: "active",
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

// ── useAuth — controllable per describe block ────────────────────────────────

let mockAuthStatus: "authenticated" | "anonymous" | "loading" = "anonymous";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    status: mockAuthStatus,
    householdId: mockAuthStatus === "authenticated" ? "hh-1" : null,
    data: null,
    signOut: vi.fn(),
    ensureHouseholdId: () =>
      mockAuthStatus === "authenticated" ? "hh-1" : "anon",
  }),
}));

// ── AnonEmptyState unit tests ────────────────────────────────────────────────

describe("AnonEmptyState #1748", () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it("renders the atmospheric heading", () => {
    render(<AnonEmptyState />);
    expect(
      screen.getByRole("heading", { level: 2 }),
    ).toBeInTheDocument();
  });

  it("renders the primary CTA button with trial copy", () => {
    render(<AnonEmptyState />);
    expect(
      screen.getByRole("button", { name: /start your free 30-day trial/i }),
    ).toBeInTheDocument();
  });

  it("renders the secondary CTA link to /ledger/cards/new", () => {
    render(<AnonEmptyState />);
    const link = screen.getByRole("link", { name: /add a card locally/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/ledger/cards/new");
  });

  it("renders the 'or' divider as aria-hidden", () => {
    render(<AnonEmptyState />);
    const divider = screen.getByText(/^or$/i);
    expect(divider).toHaveAttribute("aria-hidden", "true");
  });

  it("primary button has aria-describedby pointing to the sign-in footnote", () => {
    render(<AnonEmptyState />);
    const btn = screen.getByRole("button", { name: /start your free 30-day trial/i });
    const footnoteId = btn.getAttribute("aria-describedby");
    expect(footnoteId).toBeTruthy();
    const footnote = document.getElementById(footnoteId!);
    expect(footnote).not.toBeNull();
    expect(footnote?.textContent).toMatch(/sync cards/i);
  });

  it("secondary link has aria-describedby pointing to the local footnote", () => {
    render(<AnonEmptyState />);
    const link = screen.getByRole("link", { name: /add a card locally/i });
    const footnoteId = link.getAttribute("aria-describedby");
    expect(footnoteId).toBeTruthy();
    const footnote = document.getElementById(footnoteId!);
    expect(footnote).not.toBeNull();
    expect(footnote?.textContent).toMatch(/stored on this device/i);
  });

  it("clicking primary CTA calls router.push with sign-in URL", () => {
    render(<AnonEmptyState />);
    fireEvent.click(
      screen.getByRole("button", { name: /start your free 30-day trial/i }),
    );
    expect(mockPush).toHaveBeenCalledOnce();
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("/ledger/sign-in"),
    );
  });

  it("outer div has aria-description easter egg attribute", () => {
    const { container } = render(<AnonEmptyState />);
    const outer = container.firstChild as HTMLElement;
    expect(outer.getAttribute("aria-description")).toBe("the spittle of a bird");
  });
});

// ── Dashboard conditional rendering — zero-cards state ──────────────────────

describe("Dashboard #1748 — zero-cards conditional rendering", () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it("renders AnonEmptyState when status=anonymous and zero cards", () => {
    mockAuthStatus = "anonymous";
    render(<Dashboard cards={[]} />);
    // AnonEmptyState renders the trial CTA button
    expect(
      screen.getByRole("button", { name: /start your free 30-day trial/i }),
    ).toBeInTheDocument();
  });

  it("does NOT render EmptyState when status=anonymous and zero cards", () => {
    mockAuthStatus = "anonymous";
    render(<Dashboard cards={[]} />);
    expect(screen.queryByTestId("empty-state")).not.toBeInTheDocument();
  });

  it("renders EmptyState when status=authenticated and zero cards", () => {
    mockAuthStatus = "authenticated";
    // EmptyState is mocked to render data-testid="empty-state"
    vi.mock("@/components/dashboard/EmptyState", () => ({
      EmptyState: () => <div data-testid="empty-state">No cards yet</div>,
    }));
    render(<Dashboard cards={[]} />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("does NOT render AnonEmptyState when status=authenticated and zero cards", () => {
    mockAuthStatus = "authenticated";
    render(<Dashboard cards={[]} />);
    expect(
      screen.queryByRole("button", { name: /start your free 30-day trial/i }),
    ).not.toBeInTheDocument();
  });

  it("renders EmptyState (not AnonEmptyState) when status=loading and zero cards", () => {
    mockAuthStatus = "loading";
    render(<Dashboard cards={[]} />);
    expect(
      screen.queryByRole("button", { name: /start your free 30-day trial/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });
});

// ── SignInNudge: hasCards=false returns null ─────────────────────────────────

describe("SignInNudge #1748 — hasCards=false returns null", () => {
  it("renders nothing for anonymous user with zero cards (hasCards=false)", () => {
    // SignInNudge uses its own useAuth internally — we rely on the module mock above.
    mockAuthStatus = "anonymous";
    const { container } = render(<SignInNudge hasCards={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for authenticated user regardless of hasCards", () => {
    mockAuthStatus = "authenticated";
    const { container } = render(<SignInNudge hasCards={true} />);
    expect(container).toBeEmptyDOMElement();
  });
});
