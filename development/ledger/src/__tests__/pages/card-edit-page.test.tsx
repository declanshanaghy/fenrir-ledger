/**
 * Vitest tests for src/app/ledger/cards/[id]/edit/page.tsx
 *
 * Updated for Issue #1671: anonymous users (householdId=null) use the fixed
 * "anon" key — they should NOT be redirected to /ledger.
 *
 * Covers: loading state, redirect when card not found, anonymous card lookup,
 * renders CardForm when card found.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import EditCardPage from "@/app/ledger/cards/[id]/edit/page";
import type { Card } from "@/lib/types";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockReplace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useParams: () => ({ id: "card-123" }),
}));

let mockAuthHouseholdId: string | null = "household-abc";
let mockAuthStatus: string = "authenticated";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    householdId: mockAuthHouseholdId,
    status: mockAuthStatus,
    data: null,
    ensureHouseholdId: vi.fn(() => mockAuthHouseholdId ?? "anon"),
  }),
}));

vi.mock("@/components/cards/CardForm", () => ({
  CardForm: ({
    initialValues,
  }: {
    initialValues: Card;
    householdId: string;
  }) => (
    <div data-testid="card-form">
      CardForm: {initialValues.cardName}
    </div>
  ),
}));

let mockFoundCard: Card | null = null;

vi.mock("@/lib/storage", () => ({
  migrateIfNeeded: vi.fn(),
  getCardById: vi.fn(() => mockFoundCard),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("EditCardPage", () => {
  beforeEach(() => {
    mockAuthHouseholdId = "household-abc";
    mockAuthStatus = "authenticated";
    mockFoundCard = null;
  });

  it("shows loading state ('Consulting the runes...') while status is loading", () => {
    mockAuthStatus = "loading";
    render(<EditCardPage />);
    expect(screen.getByText(/consulting the runes/i)).toBeInTheDocument();
  });

  it("does NOT redirect for anonymous users (householdId=null) — looks up anon key", async () => {
    // Issue #1671: null householdId = anonymous, NOT an error state.
    // Anonymous users use ANON_HOUSEHOLD_ID ("anon") for lookup.
    mockAuthHouseholdId = null;
    mockAuthStatus = "anonymous";
    mockFoundCard = {
      id: "card-123",
      cardName: "Anon Card",
      householdId: "anon",
      status: "active",
    } as Card;
    render(<EditCardPage />);
    await waitFor(() => {
      expect(screen.getByTestId("card-form")).toBeInTheDocument();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("redirects to /ledger when card is not found (authenticated user)", async () => {
    mockFoundCard = null;
    render(<EditCardPage />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/ledger");
    });
  });

  it("redirects to /ledger when card is not found (anonymous user)", async () => {
    mockAuthHouseholdId = null;
    mockAuthStatus = "anonymous";
    mockFoundCard = null;
    render(<EditCardPage />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/ledger");
    });
  });

  it("renders CardForm when card is found", async () => {
    mockFoundCard = {
      id: "card-123",
      cardName: "Asgardian Mortgage",
      householdId: "household-abc",
      status: "active",
    } as Card;
    render(<EditCardPage />);
    await waitFor(() => {
      expect(screen.getByTestId("card-form")).toBeInTheDocument();
    });
  });

  it("renders card name as page heading when card is found", async () => {
    mockFoundCard = {
      id: "card-123",
      cardName: "Bifrost Insurance",
      householdId: "household-abc",
      status: "active",
    } as Card;
    render(<EditCardPage />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /bifrost insurance/i })
      ).toBeInTheDocument();
    });
  });

  it("renders 'Card record' subtext when card is found", async () => {
    mockFoundCard = {
      id: "card-123",
      cardName: "Valhalla Visa",
      householdId: "household-abc",
      status: "active",
    } as Card;
    render(<EditCardPage />);
    await waitFor(() => {
      expect(screen.getByText(/card record/i)).toBeInTheDocument();
    });
  });
});
