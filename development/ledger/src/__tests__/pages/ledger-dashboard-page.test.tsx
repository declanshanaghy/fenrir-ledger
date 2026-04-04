/**
 * Vitest tests for src/app/ledger/page.tsx (DashboardPage)
 *
 * Covers: heading render, loading state, skeleton threshold, import button
 * visibility, Add Card link, SignInNudge. Issue #1470
 */

import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import DashboardPage from "@/app/ledger/page";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn() }),
}));

vi.mock("@/lib/trial-utils", () => ({
  LS_TRIAL_START_TOAST_SHOWN: "fenrir:trial-start-toast-shown",
}));

vi.mock("@/hooks/useTrialStatus", () => ({
  clearTrialStatusCache: vi.fn(),
}));

vi.mock("@/lib/auth/refresh-session", () => ({
  ensureFreshToken: vi.fn().mockResolvedValue("tok"),
}));

let mockHouseholdId: string | null = "anon-household-id";
let mockStatus: string = "authenticated";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    householdId: mockHouseholdId,
    status: mockStatus,
    data: null,
    signOut: vi.fn(),
    ensureHouseholdId: vi.fn(() => mockHouseholdId ?? ""),
  }),
}));

vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => ({
    hasFeature: () => false,
  }),
}));

vi.mock("@/hooks/useIsKarlOrTrial", () => ({
  useIsKarlOrTrial: () => false,
}));

vi.mock("@/lib/storage", () => ({
  getCards: vi.fn(() => []),
  getDeletedCards: vi.fn(() => []),
  saveCard: vi.fn(),
  migrateIfNeeded: vi.fn(),
  // Issue #2005: notifyCardsBulkChanged dispatched after bulk import
  notifyCardsBulkChanged: vi.fn(),
}));

vi.mock("@/lib/analytics/track", () => ({
  track: vi.fn(),
}));

vi.mock("@/components/dashboard/Dashboard", () => ({
  Dashboard: ({
    cards,
  }: {
    cards: unknown[];
    trashedCards: unknown[];
    householdId?: string;
    onCardsChange: () => void;
    initialTab?: string;
  }) => (
    <div data-testid="dashboard">
      Dashboard ({cards.length} cards)
    </div>
  ),
}));

vi.mock("@/components/dashboard/CardSkeletonGrid", () => ({
  CardSkeletonGrid: ({ count }: { count: number }) => (
    <div data-testid="skeleton-grid">Loading {count} skeletons</div>
  ),
}));

vi.mock("@/components/sheets/ImportWizard", () => ({
  ImportWizard: () => <div data-testid="import-wizard" />,
}));

vi.mock("@/components/shared/AuthGate", () => ({
  AuthGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/entitlement/KarlUpsellDialog", () => ({
  KarlUpsellDialog: () => <div data-testid="karl-upsell" />,
  KARL_UPSELL_IMPORT: {},
}));

vi.mock("@/components/entitlement/UpsellBanner", () => ({
  UpsellBanner: () => <div data-testid="upsell-banner" />,
}));

vi.mock("@/components/layout/SignInNudge", () => ({
  SignInNudge: ({ hasCards }: { hasCards: boolean }) => (
    <div data-testid="sign-in-nudge" data-has-cards={hasCards} />
  ),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DashboardPage", () => {
  beforeEach(() => {
    mockHouseholdId = "anon-household-id";
    mockStatus = "authenticated";
    sessionStorage.clear();
  });

  it("renders the page heading 'The Ledger of Fates'", async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/the ledger of fates/i)).toBeInTheDocument();
    });
  });

  it("renders Dashboard component after auth resolves", async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByTestId("dashboard")).toBeInTheDocument();
    });
  });

  it("renders SignInNudge component", async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByTestId("sign-in-nudge")).toBeInTheDocument();
    });
  });

  it("does not show skeleton initially when loading completes quickly", async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.queryByTestId("skeleton-grid")).not.toBeInTheDocument();
    });
  });

  it("renders Import Wizard immediately without waitFor (always in DOM)", () => {
    render(<DashboardPage />);
    // ImportWizard is always rendered (open=false by default) — no waitFor needed
    expect(screen.getByTestId("import-wizard")).toBeInTheDocument();
  });

  it("does not show Add Card link when there are no cards (empty state)", () => {
    render(<DashboardPage />);
    // Add Card button only visible when hasCards = true; getCards returns [] so no button
    expect(screen.queryByRole("link", { name: /add card/i })).not.toBeInTheDocument();
  });
});
