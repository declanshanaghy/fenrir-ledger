/**
 * useCardForm + cardFormSchema — Issue #1682
 *
 * Tests for the extracted hook and Zod validation schema.
 * Covers schema validation (pure logic) and hook default-value
 * derivation via renderHook.
 *
 * @ref #1682
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

import { cardFormSchema } from "@/components/cards/useCardForm";
import { useCardForm } from "@/components/cards/useCardForm";

// ── cardFormSchema validation ─────────────────────────────────────────────────

describe("cardFormSchema — validation (issue #1682)", () => {
  describe("required fields", () => {
    it("rejects empty issuerId", () => {
      const result = cardFormSchema.safeParse({
        issuerId: "",
        cardName: "Test Card",
        openDate: "2024-01-01",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = result.error.issues.map((i) => i.path.join("."));
        expect(issues).toContain("issuerId");
      }
    });

    it("rejects empty cardName", () => {
      const result = cardFormSchema.safeParse({
        issuerId: "chase",
        cardName: "",
        openDate: "2024-01-01",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = result.error.issues.map((i) => i.path.join("."));
        expect(issues).toContain("cardName");
      }
    });

    it("rejects empty openDate", () => {
      const result = cardFormSchema.safeParse({
        issuerId: "chase",
        cardName: "Sapphire",
        openDate: "",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = result.error.issues.map((i) => i.path.join("."));
        expect(issues).toContain("openDate");
      }
    });
  });

  describe("optional numeric fields", () => {
    it("accepts empty string for creditLimit (optional)", () => {
      const result = cardFormSchema.safeParse({
        issuerId: "chase",
        cardName: "Sapphire",
        openDate: "2024-01-01",
        creditLimit: "",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid dollar amount for creditLimit", () => {
      const result = cardFormSchema.safeParse({
        issuerId: "chase",
        cardName: "Sapphire",
        openDate: "2024-01-01",
        creditLimit: "10000",
      });
      expect(result.success).toBe(true);
    });

    it("rejects negative creditLimit", () => {
      const result = cardFormSchema.safeParse({
        issuerId: "chase",
        cardName: "Sapphire",
        openDate: "2024-01-01",
        creditLimit: "-1",
      });
      expect(result.success).toBe(false);
    });

    it("rejects non-numeric creditLimit", () => {
      const result = cardFormSchema.safeParse({
        issuerId: "chase",
        cardName: "Sapphire",
        openDate: "2024-01-01",
        creditLimit: "abc",
      });
      expect(result.success).toBe(false);
    });

    it("accepts empty string for annualFee (optional)", () => {
      const result = cardFormSchema.safeParse({
        issuerId: "chase",
        cardName: "Sapphire",
        openDate: "2024-01-01",
        annualFee: "",
      });
      expect(result.success).toBe(true);
    });

    it("rejects negative annualFee", () => {
      const result = cardFormSchema.safeParse({
        issuerId: "chase",
        cardName: "Sapphire",
        openDate: "2024-01-01",
        annualFee: "-5",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("bonusType enum", () => {
    it("accepts 'points' bonus type", () => {
      const result = cardFormSchema.safeParse({
        issuerId: "chase",
        cardName: "Sapphire",
        openDate: "2024-01-01",
        bonusType: "points",
      });
      expect(result.success).toBe(true);
    });

    it("accepts 'miles' bonus type", () => {
      const result = cardFormSchema.safeParse({
        issuerId: "amex",
        cardName: "Platinum",
        openDate: "2024-01-01",
        bonusType: "miles",
      });
      expect(result.success).toBe(true);
    });

    it("accepts 'cashback' bonus type", () => {
      const result = cardFormSchema.safeParse({
        issuerId: "citi",
        cardName: "Double Cash",
        openDate: "2024-01-01",
        bonusType: "cashback",
      });
      expect(result.success).toBe(true);
    });

    it("rejects an invalid bonus type", () => {
      const result = cardFormSchema.safeParse({
        issuerId: "chase",
        cardName: "Sapphire",
        openDate: "2024-01-01",
        bonusType: "tokens",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("full valid payload", () => {
    it("accepts a complete valid new-card payload", () => {
      const result = cardFormSchema.safeParse({
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
        amountSpent: "1500",
        notes: "Great travel card",
      });
      expect(result.success).toBe(true);
    });

    it("defaults amountSpent to empty string when omitted", () => {
      const result = cardFormSchema.safeParse({
        issuerId: "chase",
        cardName: "Test",
        openDate: "2024-01-01",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amountSpent).toBe("");
      }
    });

    it("defaults notes to empty string when omitted", () => {
      const result = cardFormSchema.safeParse({
        issuerId: "chase",
        cardName: "Test",
        openDate: "2024-01-01",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.notes).toBe("");
      }
    });
  });
});

// ── useCardForm hook ──────────────────────────────────────────────────────────

describe("useCardForm hook (issue #1682)", () => {
  it("initialises in new-card mode with step 1", () => {
    const { result } = renderHook(() =>
      useCardForm({ householdId: "hh-1" })
    );
    expect(result.current.isEditMode).toBe(false);
    expect(result.current.currentStep).toBe(1);
  });

  it("initialises in edit mode when initialValues are provided", () => {
    const card = {
      id: "card-1",
      householdId: "hh-1",
      issuerId: "chase",
      cardName: "Sapphire",
      openDate: "2023-01-01T00:00:00.000Z",
      creditLimit: 1500000,
      annualFee: 9500,
      annualFeeDate: "2026-01-01T00:00:00.000Z",
      promoPeriodMonths: 0,
      signUpBonus: null,
      status: "active" as const,
      notes: "",
      createdAt: "2023-01-01T00:00:00.000Z",
      updatedAt: "2023-01-01T00:00:00.000Z",
    };
    const { result } = renderHook(() =>
      useCardForm({ householdId: "hh-1", initialValues: card })
    );
    expect(result.current.isEditMode).toBe(true);
  });

  it("goToStep advances to step 2 and sets forward direction", () => {
    const { result } = renderHook(() =>
      useCardForm({ householdId: "hh-1" })
    );
    act(() => {
      result.current.goToStep(2);
    });
    expect(result.current.currentStep).toBe(2);
    expect(result.current.direction).toBe(1);
  });

  it("goToStep goes back to step 1 and sets backward direction", () => {
    const { result } = renderHook(() =>
      useCardForm({ householdId: "hh-1" })
    );
    act(() => {
      result.current.goToStep(2);
    });
    act(() => {
      result.current.goToStep(1);
    });
    expect(result.current.currentStep).toBe(1);
    expect(result.current.direction).toBe(-1);
  });

  it("deleteDialogOpen starts closed and can be opened", () => {
    const { result } = renderHook(() =>
      useCardForm({ householdId: "hh-1" })
    );
    expect(result.current.deleteDialogOpen).toBe(false);
    act(() => {
      result.current.setDeleteDialogOpen(true);
    });
    expect(result.current.deleteDialogOpen).toBe(true);
  });

  it("closeDialogOpen starts closed and can be opened", () => {
    const { result } = renderHook(() =>
      useCardForm({ householdId: "hh-1" })
    );
    expect(result.current.closeDialogOpen).toBe(false);
    act(() => {
      result.current.setCloseDialogOpen(true);
    });
    expect(result.current.closeDialogOpen).toBe(true);
  });

  it("isSubmitting starts as false", () => {
    const { result } = renderHook(() =>
      useCardForm({ householdId: "hh-1" })
    );
    expect(result.current.isSubmitting).toBe(false);
  });

  it("exposes form register, setValue, errors, handleSubmit", () => {
    const { result } = renderHook(() =>
      useCardForm({ householdId: "hh-1" })
    );
    expect(typeof result.current.register).toBe("function");
    expect(typeof result.current.setValue).toBe("function");
    expect(typeof result.current.handleSubmit).toBe("function");
    expect(result.current.errors).toBeDefined();
  });

  it("exposes onSubmit, handleDelete, handleClose, handleMoreDetails", () => {
    const { result } = renderHook(() =>
      useCardForm({ householdId: "hh-1" })
    );
    expect(typeof result.current.onSubmit).toBe("function");
    expect(typeof result.current.handleDelete).toBe("function");
    expect(typeof result.current.handleClose).toBe("function");
    expect(typeof result.current.handleMoreDetails).toBe("function");
  });
});
