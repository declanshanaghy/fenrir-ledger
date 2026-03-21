/**
 * Vitest tests for src/app/ledger/cards/new/page.tsx — Issue #1670
 *
 * Validates the lazy householdId pattern introduced in #1670:
 *   - ensureHouseholdId() is called in useEffect when the user visits /cards/new
 *     and has no householdId yet (brand-new anonymous user)
 *   - ensureHouseholdId() is NOT called when householdId is already set
 *   - CardForm is not rendered while status is still loading
 *   - CardForm is rendered once householdId is available
 *
 * @ref Issue #1670
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockEnsureHouseholdId = vi.fn(() => "lazy-created-uuid");
let mockHouseholdId = "";
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

describe("NewCardPage — Issue #1670: lazy ensureHouseholdId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHouseholdId = "";
    mockStatus = "loading";
  });

  it("does NOT render CardForm while auth status is loading", () => {
    render(<NewCardPage />);
    expect(screen.queryByTestId("card-form")).not.toBeInTheDocument();
  });

  it("does NOT call ensureHouseholdId while status is loading", () => {
    render(<NewCardPage />);
    expect(mockEnsureHouseholdId).not.toHaveBeenCalled();
  });

  it("calls ensureHouseholdId when status resolves and householdId is empty (new anonymous user)", async () => {
    mockStatus = "anonymous";
    mockHouseholdId = "";
    render(<NewCardPage />);
    await waitFor(() => {
      expect(mockEnsureHouseholdId).toHaveBeenCalledOnce();
    });
  });

  it("does NOT call ensureHouseholdId when householdId is already set (returning user)", async () => {
    mockStatus = "authenticated";
    mockHouseholdId = "existing-household-id";
    render(<NewCardPage />);
    // Give React time to flush effects
    await waitFor(() => {
      // ensureHouseholdId only called when !householdId — so NOT called here
      expect(mockEnsureHouseholdId).not.toHaveBeenCalled();
    });
  });

  it("does NOT render CardForm when status is resolved but householdId is still empty", () => {
    mockStatus = "anonymous";
    mockHouseholdId = "";
    render(<NewCardPage />);
    // CardForm gated on: status !== "loading" && householdId — empty means no render
    expect(screen.queryByTestId("card-form")).not.toBeInTheDocument();
  });

  it("renders CardForm when status resolves and householdId is available (returning anon)", async () => {
    mockStatus = "anonymous";
    mockHouseholdId = "returning-anon-uuid";
    render(<NewCardPage />);
    await waitFor(() => {
      expect(screen.getByTestId("card-form")).toBeInTheDocument();
    });
  });

  it("renders CardForm with user.sub as householdId for authenticated user", async () => {
    mockStatus = "authenticated";
    mockHouseholdId = "google-sub-abc123";
    render(<NewCardPage />);
    await waitFor(() => {
      const form = screen.getByTestId("card-form");
      expect(form).toBeInTheDocument();
      expect(form.getAttribute("data-household-id")).toBe("google-sub-abc123");
    });
  });

  it("renders the page heading 'Forge a New Chain'", () => {
    mockStatus = "anonymous";
    mockHouseholdId = "some-id";
    render(<NewCardPage />);
    expect(screen.getByRole("heading", { name: /forge a new chain/i })).toBeInTheDocument();
  });
});
