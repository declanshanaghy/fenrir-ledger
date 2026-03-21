/**
 * CardForm — card limit enforcement — Issue #1416
 *
 * Regression tests for the Thrall card limit gate inside CardForm.onSubmit.
 * These tests validate the component behaviour exercised by the E2E tests in
 * quality/test-suites/card-lifecycle/add-card.spec.ts (Thrall block tests).
 *
 * Acceptance criteria:
 *  - AC1: When Thrall user has 5 active cards, form submission shows error toast
 *         and does NOT call saveCard.
 *  - AC2: When Thrall user has 4 active cards, form submission proceeds normally.
 *  - AC3: canAddCard is called with the correct active-card count and trial status.
 *
 * @ref #1416
 * @ref #643
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";

// ── Framer Motion ─────────────────────────────────────────────────────────────

vi.mock("framer-motion", () => {
  const React = require("react");
  const motion = {
    div: React.forwardRef(
      (
        {
          children,
          className,
          ...rest
        }: React.HTMLAttributes<HTMLDivElement> & {
          custom?: unknown;
          variants?: unknown;
          initial?: unknown;
          animate?: unknown;
          exit?: unknown;
          transition?: unknown;
        },
        ref: React.Ref<HTMLDivElement>,
      ) => React.createElement("div", { ref, className, ...rest }, children),
    ),
  };
  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useReducedMotion: () => true,
  };
});

// ── Next.js Router ────────────────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/ledger",
}));

// ── Zod resolver — pass all form values through without validation ─────────────
// This allows tests to focus on business logic (card limit) rather than form UX.
vi.mock("@hookform/resolvers/zod", () => ({
  zodResolver: () => async (values: Record<string, unknown>) => ({
    values,
    errors: {},
  }),
}));

// ── Radix Select — rendered as plain HTML select for testability ──────────────

vi.mock("@/components/ui/select", () => {
  const React = require("react");
  return {
    Select: ({
      onValueChange,
      value,
      children,
    }: {
      onValueChange: (v: string) => void;
      value: string;
      children: React.ReactNode;
    }) =>
      React.createElement(
        "div",
        null,
        React.createElement("select", {
          value: value ?? "",
          "data-testid": "issuer-select",
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
            onValueChange(e.target.value),
        }),
        children,
      ),
    SelectTrigger: ({
      children,
      id,
    }: {
      children: React.ReactNode;
      id?: string;
    }) => React.createElement("div", { id }),
    SelectContent: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    SelectItem: ({
      value,
      children,
    }: {
      value: string;
      children: React.ReactNode;
    }) => React.createElement("option", { value }, children),
    SelectValue: () => null,
  };
});

// ── Storage ───────────────────────────────────────────────────────────────────

const mockSaveCard = vi.fn();
const mockGetCards = vi.fn();
vi.mock("@/lib/storage", () => ({
  saveCard: (...args: unknown[]) => mockSaveCard(...args),
  deleteCard: vi.fn(),
  closeCard: vi.fn(),
  getCards: (...args: unknown[]) => mockGetCards(...args),
}));

// ── canAddCard — the key mock for this test suite ─────────────────────────────

const mockCanAddCard = vi.fn();
vi.mock("@/lib/entitlement/card-limit", () => ({
  canAddCard: (...args: unknown[]) => mockCanAddCard(...args),
}));

// ── Entitlement ───────────────────────────────────────────────────────────────

vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => ({ tier: "thrall" }),
}));

// ── Auth ──────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ status: "authenticated", householdId: "hh-test", signOut: vi.fn(), ensureHouseholdId: () => "hh-test" }),
}));

// ── Trial ─────────────────────────────────────────────────────────────────────

vi.mock("@/hooks/useTrialStatus", () => ({
  clearTrialStatusCache: vi.fn(),
  useTrialStatus: () => ({ status: "none" }),
}));

vi.mock("@/lib/trial-utils", () => ({
  LS_TRIAL_START_TOAST_SHOWN: "fenrir:trial-start-toast-shown",
}));

// ── Milestone ─────────────────────────────────────────────────────────────────

vi.mock("@/lib/milestone-utils", () => ({
  checkMilestone: vi.fn().mockResolvedValue(undefined),
}));

// ── Auth ──────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/refresh-session", () => ({
  ensureFreshToken: vi.fn().mockResolvedValue(undefined),
}));

// ── Analytics ─────────────────────────────────────────────────────────────────

vi.mock("@/lib/analytics/track", () => ({
  track: vi.fn(),
}));

// ── Toast ─────────────────────────────────────────────────────────────────────

const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: (...args: unknown[]) => mockToastError(...args),
    success: vi.fn(),
  }),
}));

// ── Gleipnir ──────────────────────────────────────────────────────────────────

vi.mock("@/components/cards/GleipnirBearSinews", () => ({
  GleipnirBearSinews: () => null,
  useGleipnirFragment4: () => ({ open: false, trigger: vi.fn(), dismiss: vi.fn() }),
}));

// ── Issuer utils ──────────────────────────────────────────────────────────────

vi.mock("@/lib/issuer-utils", () => ({
  getIssuerRune: vi.fn().mockReturnValue("ᚠ"),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

import type { Card } from "@/lib/types";

/** Build a minimal active card record. */
function makeActiveCard(id: string): Card {
  return {
    id,
    householdId: "hh-test",
    issuerId: "chase",
    cardName: `Card ${id}`,
    openDate: "2024-01-01T00:00:00.000Z",
    creditLimit: 0,
    annualFee: 0,
    annualFeeDate: "2025-01-01T00:00:00.000Z",
    promoPeriodMonths: 0,
    signUpBonus: null,
    status: "active" as const,
    notes: "",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  } as Card;
}

/** Fill and submit the CardForm step 1. */
async function fillAndSubmit(
  getAllByTestId: (id: string) => HTMLElement[],
  getByLabelText: (label: string | RegExp) => HTMLElement,
) {
  // Set issuer via mocked select — first Select in the form is the issuerId field
  await act(async () => {
    fireEvent.change(getAllByTestId("issuer-select")[0]!, {
      target: { value: "chase" },
    });
  });

  // Fill card name
  fireEvent.change(getByLabelText(/card name/i), {
    target: { value: "Test Card" },
  });

  // Fill open date
  fireEvent.change(getByLabelText(/date opened/i), {
    target: { value: "2024-06-01" },
  });

  // Submit the form (step 1 "Save Card" button)
  const submitButton = screen.getAllByRole("button", { name: /save card/i })[0]!;
  await act(async () => {
    fireEvent.click(submitButton);
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("CardForm — Thrall card limit enforcement (issue #643 / #1416)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveCard.mockResolvedValue(undefined);
  });

  // ── AC1: blocked at limit ──────────────────────────────────────────────

  it("shows error toast when Thrall user is at the 5-card limit", async () => {
    const fiveCards = Array.from({ length: 5 }, (_, i) => makeActiveCard(`card-${i}`));
    mockGetCards.mockReturnValue(fiveCards);
    mockCanAddCard.mockReturnValue({
      allowed: false,
      reason: "Thrall tier is limited to 5 active cards. Upgrade to Karl for unlimited cards.",
      currentCount: 5,
      limit: 5,
    });

    const { CardForm } = await import("@/components/cards/CardForm");
    const { getAllByTestId, getByLabelText } = render(<CardForm householdId="hh-test" />);

    await fillAndSubmit(getAllByTestId, getByLabelText);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "Thrall tier is limited to 5 active cards. Upgrade to Karl for unlimited cards.",
      );
    });
  }, 15000);

  // ── AC1: saveCard not called when blocked ──────────────────────────────

  it("does NOT call saveCard when card limit blocks submission", async () => {
    const fiveCards = Array.from({ length: 5 }, (_, i) => makeActiveCard(`card-${i}`));
    mockGetCards.mockReturnValue(fiveCards);
    mockCanAddCard.mockReturnValue({
      allowed: false,
      reason: "Thrall tier is limited to 5 active cards. Upgrade to Karl for unlimited cards.",
      currentCount: 5,
      limit: 5,
    });

    const { CardForm } = await import("@/components/cards/CardForm");
    const { getAllByTestId, getByLabelText } = render(<CardForm householdId="hh-test" />);

    await fillAndSubmit(getAllByTestId, getByLabelText);

    // Wait for async effects to settle, then assert saveCard was never called
    await new Promise((r) => setTimeout(r, 100));
    expect(mockSaveCard).not.toHaveBeenCalled();
  }, 15000);

  // ── AC2: allowed below limit ───────────────────────────────────────────

  it("proceeds with save when Thrall user is below the 5-card limit", async () => {
    const fourCards = Array.from({ length: 4 }, (_, i) => makeActiveCard(`card-${i}`));
    mockGetCards.mockReturnValue(fourCards);
    mockCanAddCard.mockReturnValue({
      allowed: true,
      currentCount: 4,
      limit: 5,
    });

    const { CardForm } = await import("@/components/cards/CardForm");
    const { getAllByTestId, getByLabelText } = render(<CardForm householdId="hh-test" />);

    await fillAndSubmit(getAllByTestId, getByLabelText);

    // saveCard should be called (card was allowed)
    await waitFor(() => {
      expect(mockSaveCard).toHaveBeenCalled();
    }, { timeout: 5000 });

    expect(mockToastError).not.toHaveBeenCalled();
  }, 15000);

  // ── AC3: canAddCard invoked with correct args ──────────────────────────

  it("calls canAddCard with active-card count and trial status from context", async () => {
    // 3 active + 1 closed — only active count (3) should be passed
    const mixedCards = [
      ...Array.from({ length: 3 }, (_, i) => makeActiveCard(`active-${i}`)),
      { ...makeActiveCard("closed-1"), status: "closed" as const },
    ];
    mockGetCards.mockReturnValue(mixedCards);
    mockCanAddCard.mockReturnValue({ allowed: true, currentCount: 3, limit: 5 });

    const { CardForm } = await import("@/components/cards/CardForm");
    const { getAllByTestId, getByLabelText } = render(<CardForm householdId="hh-test" />);

    await fillAndSubmit(getAllByTestId, getByLabelText);

    await waitFor(() => {
      expect(mockCanAddCard).toHaveBeenCalledWith(
        "thrall",    // tier from useEntitlement mock
        3,           // only active cards counted (not closed)
        false,       // isTrialActive=false when trial status is "none"
      );
    });
  }, 15000);
});
