/**
 * CardForm decomposition — Issue #1682
 *
 * Smoke tests verifying the extracted sub-components render correctly,
 * and regression guard ensuring existing CardForm behaviour is preserved
 * after the complexity refactor.
 *
 * @ref #1682
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Framer Motion ──────────────────────────────────────────────────────────────

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

// ── Next.js Router ─────────────────────────────────────────────────────────────

const mockPush = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ── Storage ───────────────────────────────────────────────────────────────────

vi.mock("@/lib/storage", () => ({
  saveCard: vi.fn(),
  deleteCard: vi.fn(),
  closeCard: vi.fn(),
  getCards: vi.fn().mockReturnValue([]),
}));

// ── Entitlement ───────────────────────────────────────────────────────────────

vi.mock("@/lib/entitlement/card-limit", () => ({
  canAddCard: vi.fn().mockReturnValue({ allowed: true }),
}));

vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => ({ tier: "karl" }),
}));

vi.mock("@/hooks/useTrialStatus", () => ({
  clearTrialStatusCache: vi.fn(),
  useTrialStatus: () => ({ status: "none" }),
}));

vi.mock("@/lib/trial-utils", () => ({
  LS_TRIAL_START_TOAST_SHOWN: "fenrir:trial-start-toast-shown",
}));

// ── Misc ──────────────────────────────────────────────────────────────────────

vi.mock("@/lib/milestone-utils", () => ({
  checkMilestone: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/auth/refresh-session", () => ({
  ensureFreshToken: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/analytics/track", () => ({
  track: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

vi.mock("@/components/cards/GleipnirBearSinews", () => ({
  GleipnirBearSinews: () => null,
  useGleipnirFragment4: () => ({ open: false, trigger: vi.fn(), dismiss: vi.fn() }),
}));

vi.mock("@/lib/issuer-utils", () => ({
  getIssuerRune: vi.fn().mockReturnValue("ᚠ"),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { CardForm } from "@/components/cards/CardForm";
import type { Card } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: "card-1",
    householdId: "hh-1",
    issuerId: "chase",
    cardName: "Sapphire Preferred",
    openDate: "2023-01-01T00:00:00.000Z",
    creditLimit: 1000000,
    annualFee: 9500,
    annualFeeDate: "2026-01-01T00:00:00.000Z",
    promoPeriodMonths: 0,
    signUpBonus: {
      type: "points",
      amount: 6000000,
      spendRequirement: 400000,
      deadline: "2023-04-01T00:00:00.000Z",
      met: false,
    },
    status: "active",
    notes: "some notes",
    createdAt: "2023-01-01T00:00:00.000Z",
    updatedAt: "2023-01-01T00:00:00.000Z",
    ...overrides,
  } as Card;
}

// ── CardForm orchestrator tests ───────────────────────────────────────────────

describe("CardForm (issue #1682 — decomposed orchestrator)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders wizard step 1 by default for new cards", () => {
    render(<CardForm householdId="hh-1" />);
    // Card Details fieldset is visible on step 1
    expect(screen.getByText("Card Details")).toBeDefined();
    // Issuer label
    expect(screen.getByText(/issuer \*/i)).toBeDefined();
  });

  it("renders step indicator (tablist) for new cards", () => {
    render(<CardForm householdId="hh-1" />);
    expect(screen.getByRole("tablist")).toBeDefined();
  });

  it("does NOT render step indicator in edit mode", () => {
    render(<CardForm householdId="hh-1" initialValues={makeCard()} />);
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("renders Cancel button in both new-card and edit-card modes", () => {
    const { rerender } = render(<CardForm householdId="hh-1" />);
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDefined();

    rerender(<CardForm householdId="hh-1" initialValues={makeCard()} />);
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDefined();
  });

  it("renders 'More Details' and 'Save Card' buttons on wizard step 1", () => {
    render(<CardForm householdId="hh-1" />);
    expect(screen.getByRole("button", { name: /more details/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /save card/i })).toBeDefined();
  });

  it("renders 'Save changes' button in edit mode", () => {
    render(<CardForm householdId="hh-1" initialValues={makeCard()} />);
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDefined();
  });

  it("renders 'Close Card' button for non-closed card in edit mode", () => {
    render(<CardForm householdId="hh-1" initialValues={makeCard({ status: "active" })} />);
    expect(screen.getByRole("button", { name: /close card/i })).toBeDefined();
  });

  it("does NOT render 'Close Card' for already-closed card in edit mode", () => {
    render(<CardForm householdId="hh-1" initialValues={makeCard({ status: "closed" })} />);
    expect(screen.queryByRole("button", { name: /close card/i })).toBeNull();
  });

  it("renders 'Delete card' button in edit mode", () => {
    render(<CardForm householdId="hh-1" initialValues={makeCard()} />);
    expect(screen.getByRole("button", { name: /delete card/i })).toBeDefined();
  });

  it("edit mode shows notes textarea with pre-populated value", () => {
    render(<CardForm householdId="hh-1" initialValues={makeCard({ notes: "my notes" })} />);
    const textarea = screen.getByPlaceholderText(/any notes about this card/i);
    expect((textarea as HTMLTextAreaElement).value).toBe("my notes");
  });

  it("wizard step 1 contains Sign-up Bonus section", () => {
    render(<CardForm householdId="hh-1" />);
    expect(screen.getByText("Sign-up Bonus")).toBeDefined();
  });

  it("edit mode renders Annual Fee fieldset", () => {
    render(<CardForm householdId="hh-1" initialValues={makeCard()} />);
    expect(screen.getByText("Annual Fee")).toBeDefined();
  });
});

// ── CardFormStep1 smoke tests ─────────────────────────────────────────────────

import { CardFormStep1 } from "@/components/cards/CardFormStep1";

describe("CardFormStep1 — smoke tests", () => {
  it("renders Card Details and Sign-up Bonus sections (Annual Fee is on Step 2)", () => {
    const mockRegister = vi.fn().mockReturnValue({});
    const mockSetValue = vi.fn();
    const errors = {};

    render(
      <CardFormStep1
        register={mockRegister as never}
        setValue={mockSetValue as never}
        errors={errors as never}
        issuerId={undefined}
        bonusType={undefined}
        bonusSpendRequirement={undefined}
        amountSpent={undefined}
      />,
    );

    expect(screen.getByText("Card Details")).toBeDefined();
    expect(screen.queryByText("Annual Fee")).toBeNull();
    expect(screen.getByText("Sign-up Bonus")).toBeDefined();
  });

  it("renders Issuer, Card name, and Date opened fields", () => {
    const mockRegister = vi.fn().mockReturnValue({});
    const mockSetValue = vi.fn();

    render(
      <CardFormStep1
        register={mockRegister as never}
        setValue={mockSetValue as never}
        errors={{} as never}
        issuerId={undefined}
        bonusType={undefined}
        bonusSpendRequirement={undefined}
        amountSpent={undefined}
      />,
    );

    expect(screen.getByText(/issuer \*/i)).toBeDefined();
    expect(screen.getByText(/card name \*/i)).toBeDefined();
    expect(screen.getByText(/date opened \*/i)).toBeDefined();
  });
});

// ── CardFormStep2 smoke tests ─────────────────────────────────────────────────

import { CardFormStep2 } from "@/components/cards/CardFormStep2";

describe("CardFormStep2 — smoke tests", () => {
  it("renders Credit Limit, Annual Fee Date, Bonus Deadline, and Notes sections", () => {
    const mockRegister = vi.fn().mockReturnValue({});
    const mockSetValue = vi.fn();

    render(
      <CardFormStep2
        register={mockRegister as never}
        setValue={mockSetValue as never}
        errors={{} as never}
        creditLimit={undefined}
      />,
    );

    expect(screen.getByText(/credit limit/i)).toBeDefined();
    expect(screen.getByText(/annual fee date/i)).toBeDefined();
    expect(screen.getByText(/bonus deadline/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/any notes about this card/i)).toBeDefined();
  });
});
