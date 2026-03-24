/**
 * useCardForm bonus amount storage — Issue #1915
 *
 * Verifies that points/miles bonus amounts are stored as whole units
 * (not multiplied by 100 like monetary cents values), and that
 * cashback bonuses remain stored in cents.
 *
 * @ref #1915
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/storage", () => ({
  saveCard: vi.fn(),
  deleteCard: vi.fn(),
  closeCard: vi.fn(),
  getCards: vi.fn().mockReturnValue([]),
}));

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
  useGleipnirFragment4: () => ({
    open: false,
    trigger: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

vi.mock("@/lib/issuer-utils", () => ({
  getIssuerRune: vi.fn().mockReturnValue("ᚠ"),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { saveCard } from "@/lib/storage";
import { useCardForm } from "@/components/cards/useCardForm";
import {
  getValhallaSignupBonusLabel,
  formatBonusReward,
} from "@/components/dashboard/ValhallaCardTile";
import type { Card } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: "card-1",
    householdId: "hh-1",
    issuerId: "chase",
    cardName: "Sapphire Preferred",
    openDate: "2023-01-01T00:00:00.000Z",
    creditLimit: 15000,   // dollars
    annualFee: 95,         // dollars
    annualFeeDate: "2026-01-01T00:00:00.000Z",
    promoPeriodMonths: 0,
    amountSpent: 0,
    signUpBonus: null,
    status: "active",
    notes: "",
    createdAt: "2023-01-01T00:00:00.000Z",
    updatedAt: "2023-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ── getValhallaSignupBonusLabel display tests ─────────────────────────────────

describe("getValhallaSignupBonusLabel — issue #1915", () => {
  it("displays 65000 miles as '65,000 mi' (no extra zeros)", () => {
    const card = makeCard({
      signUpBonus: {
        type: "miles",
        amount: 65000,
        spendRequirement: 4000,  // dollars
        deadline: "2023-04-01T00:00:00.000Z",
        met: true,
      },
    });
    expect(getValhallaSignupBonusLabel(card)).toBe("65,000 mi");
  });

  it("displays 1000000 points as '1,000,000 pts' (no extra zeros)", () => {
    const card = makeCard({
      signUpBonus: {
        type: "points",
        amount: 1000000,
        spendRequirement: 6000,  // dollars
        deadline: "2023-04-01T00:00:00.000Z",
        met: true,
      },
    });
    expect(getValhallaSignupBonusLabel(card)).toBe("1,000,000 pts");
  });

  it("does NOT display 65000 miles as 6,500,000 mi (regression guard)", () => {
    const card = makeCard({
      signUpBonus: {
        type: "miles",
        amount: 65000,
        spendRequirement: 4000,  // dollars
        deadline: "2023-04-01T00:00:00.000Z",
        met: true,
      },
    });
    expect(getValhallaSignupBonusLabel(card)).not.toBe("6,500,000 mi");
  });

  it("displays cashback amount as formatted currency (dollars-based)", () => {
    const card = makeCard({
      signUpBonus: {
        type: "cashback",
        amount: 500, // $500 in dollars
        spendRequirement: 3000,
        deadline: "2023-04-01T00:00:00.000Z",
        met: true,
      },
    });
    expect(getValhallaSignupBonusLabel(card)).toBe("$500 cashback");
  });
});

// ── formatBonusReward display tests ───────────────────────────────────────────

describe("formatBonusReward — issue #1915", () => {
  it("formats 65000 miles as '65,000 mi'", () => {
    expect(formatBonusReward("miles", 65000)).toBe("65,000 mi");
  });

  it("formats 1000000 points as '1,000,000 pts'", () => {
    expect(formatBonusReward("points", 1000000)).toBe("1,000,000 pts");
  });

  it("formats cashback in dollars — $695", () => {
    expect(formatBonusReward("cashback", 695)).toBe("$695");
  });
});

// ── useCardForm save path — bonus amount storage ──────────────────────────────

describe("useCardForm onSubmit — bonus amount storage (issue #1915)", () => {
  beforeEach(() => {
    vi.mocked(saveCard).mockClear();
  });

  it("stores miles bonus as whole units (65000 → 65000, not 6500000)", () => {
    const { result } = renderHook(() =>
      useCardForm({ householdId: "hh-1" })
    );
    act(() => {
      result.current.onSubmit({
        issuerId: "chase",
        cardName: "Sapphire Preferred",
        openDate: "2024-01-15",
        creditLimit: "15000",
        annualFee: "95",
        annualFeeDate: "2025-01-15",
        bonusType: "miles",
        bonusAmount: "65000",
        bonusSpendRequirement: "4000",
        bonusDeadline: "2024-04-15",
        amountSpent: "",
        notes: "",
      });
    });
    expect(vi.mocked(saveCard)).toHaveBeenCalledOnce();
    const saved = vi.mocked(saveCard).mock.calls[0]![0] as Card;
    expect(saved.signUpBonus?.amount).toBe(65000);
  });

  it("stores points bonus as whole units (1000000 → 1000000, not 100000000)", () => {
    const { result } = renderHook(() =>
      useCardForm({ householdId: "hh-1" })
    );
    act(() => {
      result.current.onSubmit({
        issuerId: "amex",
        cardName: "Platinum",
        openDate: "2024-01-15",
        creditLimit: "30000",
        annualFee: "695",
        annualFeeDate: "2025-01-15",
        bonusType: "points",
        bonusAmount: "1000000",
        bonusSpendRequirement: "6000",
        bonusDeadline: "2024-04-15",
        amountSpent: "",
        notes: "",
      });
    });
    expect(vi.mocked(saveCard)).toHaveBeenCalledOnce();
    const saved = vi.mocked(saveCard).mock.calls[0]![0] as Card;
    expect(saved.signUpBonus?.amount).toBe(1000000);
  });

  it("stores cashback bonus in dollars (500 → 500)", () => {
    const { result } = renderHook(() =>
      useCardForm({ householdId: "hh-1" })
    );
    act(() => {
      result.current.onSubmit({
        issuerId: "citi",
        cardName: "Double Cash",
        openDate: "2024-01-15",
        creditLimit: "10000",
        annualFee: "0",
        annualFeeDate: "2025-01-15",
        bonusType: "cashback",
        bonusAmount: "500",
        bonusSpendRequirement: "1500",
        bonusDeadline: "2024-04-15",
        amountSpent: "",
        notes: "",
      });
    });
    expect(vi.mocked(saveCard)).toHaveBeenCalledOnce();
    const saved = vi.mocked(saveCard).mock.calls[0]![0] as Card;
    expect(saved.signUpBonus?.amount).toBe(500);
  });

  it("stores annual fee in dollars (95 → 95)", () => {
    const { result } = renderHook(() =>
      useCardForm({ householdId: "hh-1" })
    );
    act(() => {
      result.current.onSubmit({
        issuerId: "chase",
        cardName: "Sapphire Preferred",
        openDate: "2024-01-15",
        creditLimit: "15000",
        annualFee: "95",
        annualFeeDate: "2025-01-15",
        bonusType: "points",
        bonusAmount: "60000",
        bonusSpendRequirement: "4000",
        bonusDeadline: "2024-04-15",
        amountSpent: "",
        notes: "",
      });
    });
    expect(vi.mocked(saveCard)).toHaveBeenCalledOnce();
    const saved = vi.mocked(saveCard).mock.calls[0]![0] as Card;
    expect(saved.annualFee).toBe(95);
  });
});

// ── useCardForm load path — defaultValues for bonus ───────────────────────────

describe("useCardForm defaultValues — bonus amount load (issue #1915)", () => {
  it("loads miles bonus amount as string of whole units (65000 → '65000')", () => {
    const card = makeCard({
      signUpBonus: {
        type: "miles",
        amount: 65000,
        spendRequirement: 4000,  // dollars
        deadline: "2025-04-01T00:00:00.000Z",
        met: false,
      },
    });
    const { result } = renderHook(() =>
      useCardForm({ householdId: "hh-1", initialValues: card })
    );
    expect(result.current.defaultValues.bonusAmount).toBe("65000");
  });

  it("loads points bonus amount as string of whole units (1000000 → '1000000')", () => {
    const card = makeCard({
      signUpBonus: {
        type: "points",
        amount: 1000000,
        spendRequirement: 6000,  // dollars
        deadline: "2025-04-01T00:00:00.000Z",
        met: false,
      },
    });
    const { result } = renderHook(() =>
      useCardForm({ householdId: "hh-1", initialValues: card })
    );
    expect(result.current.defaultValues.bonusAmount).toBe("1000000");
  });

  it("loads cashback bonus amount as string of dollar value (500 → '500')", () => {
    const card = makeCard({
      signUpBonus: {
        type: "cashback",
        amount: 500, // $500 in dollars
        spendRequirement: 1500,
        deadline: "2025-04-01T00:00:00.000Z",
        met: false,
      },
    });
    const { result } = renderHook(() =>
      useCardForm({ householdId: "hh-1", initialValues: card })
    );
    expect(result.current.defaultValues.bonusAmount).toBe("500");
  });
});
