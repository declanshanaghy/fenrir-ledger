/**
 * Vitest tests for src/app/ledger/cards/[id]/edit/page.tsx
 *
 * Covers: loading state, redirect when card not found, redirect when no householdId,
 * renders CardForm when card found. Issue #1470
 */

import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import EditCardPage from "@/app/ledger/cards/[id]/edit/page";
import type { Card } from "@/lib/types";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockReplace = vi.fn();
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
    ensureHouseholdId: vi.fn(() => mockAuthHouseholdId ?? ""),
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
    vi.clearAllMocks();
    mockAuthHouseholdId = "household-abc";
    mockAuthStatus = "authenticated";
    mockFoundCard = null;
  });

  it("shows loading state ('Consulting the runes...') while status is loading", () => {
    mockAuthStatus = "loading";
    render(<EditCardPage />);
    expect(screen.getByText(/consulting the runes/i)).toBeInTheDocument();
  });

  it("redirects to /ledger when householdId is null", async () => {
    mockAuthHouseholdId = null;
    mockAuthStatus = "authenticated";
    render(<EditCardPage />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/ledger");
    });
  });

  it("redirects to /ledger when card is not found", async () => {
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
