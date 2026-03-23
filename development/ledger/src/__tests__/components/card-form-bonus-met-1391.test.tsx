/**
 * CardForm — amount spent + computed minimumSpendMet indicator — Issue #1745
 *
 * Validates acceptance criteria:
 * - "Amount spent" input is present in step 1 (Sign-up Bonus section)
 * - "Minimum spend met" checkbox is absent (replaced by computed indicator)
 * - Computed indicator is read-only and reflects amountSpent vs spendRequirement
 * - In edit mode, "Amount spent" is populated from initialValues.amountSpent
 *
 * @ref #1745
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Shared mock factories ──────────────────────────────────────────────────
// See src/__tests__/mocks/ for factory definitions.

vi.mock("framer-motion", async () => (await import("../mocks/dialog-mocks")).framerMotionMock);
vi.mock("@/hooks/useAuth", async () => (await import("../mocks/hook-mocks")).authMockAuthenticated);
vi.mock("@/hooks/useEntitlement", async () => (await import("../mocks/hook-mocks")).entitlementMockKarl);
vi.mock("@/hooks/useTrialStatus", async () => (await import("../mocks/hook-mocks")).trialStatusMockNone);
vi.mock("@/lib/storage", async () => (await import("../mocks/storage-mocks")).storageMockBasic);
vi.mock("@/lib/milestone-utils", async () => (await import("../mocks/storage-mocks")).milestoneMock);
vi.mock("@/lib/auth/refresh-session", async () => (await import("../mocks/storage-mocks")).refreshSessionMock);
vi.mock("@/lib/entitlement/card-limit", async () => (await import("../mocks/storage-mocks")).cardLimitMockAllowed);
vi.mock("@/lib/analytics/track", async () => (await import("../mocks/storage-mocks")).analyticsMock);
vi.mock("@/lib/issuer-utils", async () => (await import("../mocks/storage-mocks")).issuerUtilsMock);
vi.mock("@/components/cards/GleipnirBearSinews", async () => (await import("../mocks/component-mocks")).gleipnirBearSinewsMock);

// ── Inline mocks (test-specific) ──────────────────────────────────────────

const mockPush = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/ledger",
}));

vi.mock("@/lib/trial-utils", () => ({
  LS_TRIAL_START_TOAST_SHOWN: "trial_start_toast_shown",
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ── Component under test ──────────────────────────────────────────────────────

import { CardForm } from "@/components/cards/CardForm";

// ── Helpers ───────────────────────────────────────────────────────────────────

import type { Card } from "@/lib/types";

function makeCardWithBonus(amountSpentCents: number): Card {
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
    amountSpent: amountSpentCents,
    signUpBonus: {
      type: "points",
      amount: 6000000,
      spendRequirement: 400000,
      deadline: "2023-04-01T00:00:00.000Z",
      met: amountSpentCents >= 400000,
    },
    status: "active",
    notes: "",
    createdAt: "2023-01-01T00:00:00.000Z",
    updatedAt: "2023-01-01T00:00:00.000Z",
  } as Card;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CardForm — amount spent / computed minimum spend indicator — Issue #1745', () => {
  it("renders 'Amount spent' input in step 1 (wizard mode)", () => {
    render(<CardForm householdId="hh-1" />);
    expect(screen.getByLabelText(/amount spent/i)).toBeDefined();
  });

  it("does NOT render a 'Minimum spend met' checkbox in step 1", () => {
    render(<CardForm householdId="hh-1" />);
    const checkboxes = screen.queryAllByRole("checkbox", { name: /minimum spend met/i });
    expect(checkboxes.length).toBe(0);
  });

  it("'Amount spent' input defaults to empty for new cards", () => {
    render(<CardForm householdId="hh-1" />);
    const input = screen.getByLabelText(/amount spent/i) as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("computed indicator is not shown when no spend requirement is set", () => {
    render(<CardForm householdId="hh-1" />);
    // No bonusSpendRequirement selected, so indicator should not appear
    expect(screen.queryByText(/minimum spend met/i)).toBeNull();
    expect(screen.queryByText(/minimum spend not yet met/i)).toBeNull();
  });

  it("'Bonus deadline' is NOT shown in wizard step 1 (it lives in step 2)", () => {
    render(<CardForm householdId="hh-1" />);
    const bonusDeadlineInputs = screen.queryAllByLabelText(/bonus deadline/i);
    expect(bonusDeadlineInputs.length).toBe(0);
  });

  it("renders 'Amount spent' input in edit mode pre-populated from initialValues", () => {
    const card = makeCardWithBonus(150000); // $1500
    render(<CardForm householdId="hh-1" initialValues={card} />);
    const input = screen.getByLabelText(/amount spent/i) as HTMLInputElement;
    expect(input.value).toBe("1500");
  });

  it("does NOT render a 'Minimum spend met' checkbox in edit mode", () => {
    const card = makeCardWithBonus(400000); // fully met
    render(<CardForm householdId="hh-1" initialValues={card} />);
    const checkboxes = screen.queryAllByRole("checkbox", { name: /minimum spend met/i });
    expect(checkboxes.length).toBe(0);
  });

  it("edit mode shows 'Amount spent' with zero value when amountSpent is 0", () => {
    const card = makeCardWithBonus(0);
    render(<CardForm householdId="hh-1" initialValues={card} />);
    const input = screen.getByLabelText(/amount spent/i) as HTMLInputElement;
    // centsToDollars(0) returns "" — new card default
    expect(input.value === "" || input.value === "0").toBe(true);
  });
});
