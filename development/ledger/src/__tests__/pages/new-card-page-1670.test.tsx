/**
 * Vitest tests for src/app/ledger/cards/new/page.tsx — Issue #1671
 *
 * Issue #1671 updated the model: anonymous users use the fixed "anon" key.
 * No lazy UUID creation is needed. ensureHouseholdId is no longer called
 * from NewCardPage.
 *
 * Validates:
 *   - CardForm is not rendered while status is still loading
 *   - CardForm is rendered for anonymous users with householdId="anon"
 *   - CardForm is rendered for authenticated users with their householdId
 *   - ensureHouseholdId is NOT called (no longer needed)
 *
 * @ref Issue #1670, #1671
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockEnsureHouseholdId = vi.hoisted(() => vi.fn(() => "anon"));
let mockHouseholdId: string | null = null;
let mockStatus = "loading";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    householdId: mockHouseholdId,
    status: mockStatus,
    data: null,
    signOut: vi.fn(),
    ensureHouseholdId: mockEnsureHouseholdId,
  }),
}));

vi.mock("@/lib/storage", () => ({
  migrateIfNeeded: vi.fn(),
}));

vi.mock("@/components/cards/CardForm", () => ({
  CardForm: ({ householdId }: { householdId: string }) => (
    <div data-testid="card-form" data-household-id={householdId}>
      CardForm
    </div>
  ),
}));

import NewCardPage from "@/app/ledger/cards/new/page";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("NewCardPage — Issue #1671: anonymous uses fixed 'anon' key", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHouseholdId = null;
    mockStatus = "loading";
  });

  it("does NOT render CardForm while auth status is loading", () => {
    render(<NewCardPage />);
    expect(screen.queryByTestId("card-form")).not.toBeInTheDocument();
  });

  it("renders CardForm for anonymous user with householdId='anon'", async () => {
    mockStatus = "anonymous";
    mockHouseholdId = null; // anonymous = null
    render(<NewCardPage />);
    await waitFor(() => {
      const form = screen.getByTestId("card-form");
      expect(form).toBeInTheDocument();
      expect(form.getAttribute("data-household-id")).toBe("anon");
    });
  });

  it("renders CardForm for authenticated user with their householdId", async () => {
    mockStatus = "authenticated";
    mockHouseholdId = "google-sub-abc123";
    render(<NewCardPage />);
    await waitFor(() => {
      const form = screen.getByTestId("card-form");
      expect(form).toBeInTheDocument();
      expect(form.getAttribute("data-household-id")).toBe("google-sub-abc123");
    });
  });

  it("does NOT call ensureHouseholdId (no longer needed with fixed anon key)", async () => {
    mockStatus = "anonymous";
    mockHouseholdId = null;
    render(<NewCardPage />);
    await waitFor(() => {
      expect(screen.getByTestId("card-form")).toBeInTheDocument();
    });
    // ensureHouseholdId is no longer called from NewCardPage
    expect(mockEnsureHouseholdId).not.toHaveBeenCalled();
  });

  it("renders the page heading 'Forge a New Chain'", () => {
    mockStatus = "anonymous";
    mockHouseholdId = null;
    render(<NewCardPage />);
    expect(screen.getByRole("heading", { name: /forge a new chain/i })).toBeInTheDocument();
  });
});
