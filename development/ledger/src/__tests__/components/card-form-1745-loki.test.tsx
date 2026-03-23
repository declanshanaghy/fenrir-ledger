/**
 * CardForm — Issue #1745 Loki QA tests
 *
 * Validates acceptance criteria NOT already covered by FiremanDecko's tests:
 * - CardFormStep1 computed indicator logic (indicator shown/hidden, met/not-met/boundary)
 * - CardFormEditFields has no "Status" fieldset
 * - CardFormStep2 has annual fee amount input (moved from Step 1)
 * - cardFormSchema rejects negative amountSpent
 *
 * @ref #1745
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Shared mock factories ──────────────────────────────────────────────────
// See src/__tests__/mocks/ for factory definitions.

vi.mock("framer-motion", async () => (await import("../mocks/dialog-mocks")).framerMotionMock);
vi.mock("@/hooks/useEntitlement", async () => (await import("../mocks/hook-mocks")).entitlementMockKarl);
vi.mock("@/hooks/useTrialStatus", async () => (await import("../mocks/hook-mocks")).trialStatusMockNone);
vi.mock("@/lib/storage", async () => (await import("../mocks/storage-mocks")).storageMockBasic);
vi.mock("@/lib/entitlement/card-limit", async () => (await import("../mocks/storage-mocks")).cardLimitMockAllowed);
vi.mock("@/lib/milestone-utils", async () => (await import("../mocks/storage-mocks")).milestoneMock);
vi.mock("@/lib/auth/refresh-session", async () => (await import("../mocks/storage-mocks")).refreshSessionMock);
vi.mock("@/lib/analytics/track", async () => (await import("../mocks/storage-mocks")).analyticsMock);
vi.mock("@/lib/issuer-utils", async () => (await import("../mocks/storage-mocks")).issuerUtilsMock);
vi.mock("@/components/cards/GleipnirBearSinews", async () => (await import("../mocks/component-mocks")).gleipnirBearSinewsMock);

// ── Inline mocks (test-specific) ──────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/trial-utils", () => ({
  LS_TRIAL_START_TOAST_SHOWN: "fenrir:trial-start-toast-shown",
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import { CardFormStep1 } from "@/components/cards/CardFormStep1";
import { CardFormStep2 } from "@/components/cards/CardFormStep2";
import { CardFormEditFields } from "@/components/cards/CardFormEditFields";
import { cardFormSchema } from "@/components/cards/useCardForm";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRegister() {
  return vi.fn().mockReturnValue({}) as never;
}
function makeSetValue() {
  return vi.fn() as never;
}

// ── CardFormStep1: computed indicator ─────────────────────────────────────────

describe("CardFormStep1 — computed minimumSpendMet indicator (issue #1745)", () => {

  it("does NOT show indicator when no spend requirement is set", () => {
    render(
      <CardFormStep1
        register={makeRegister()}
        setValue={makeSetValue()}
        errors={{} as never}
        issuerId={undefined}
        bonusType={undefined}
        bonusSpendRequirement={undefined}
        amountSpent={undefined}
      />,
    );
    // The label "Minimum spend" is always rendered; only check that the indicator text is absent
    expect(screen.queryByText(/minimum spend not yet met/i)).toBeNull();
    expect(screen.queryByText(/✓ minimum spend met/i)).toBeNull();
  });

  it("shows 'not yet met' when spend requirement is set but amountSpent is below it", () => {
    render(
      <CardFormStep1
        register={makeRegister()}
        setValue={makeSetValue()}
        errors={{} as never}
        issuerId={undefined}
        bonusType={undefined}
        bonusSpendRequirement="3000"
        amountSpent="500"
      />,
    );
    expect(screen.getByText(/minimum spend not yet met/i)).toBeDefined();
    expect(screen.queryByText(/✓ minimum spend met/i)).toBeNull();
  });

  it("shows '✓ Minimum spend met' when amountSpent exactly equals spend requirement (boundary)", () => {
    render(
      <CardFormStep1
        register={makeRegister()}
        setValue={makeSetValue()}
        errors={{} as never}
        issuerId={undefined}
        bonusType={undefined}
        bonusSpendRequirement="4000"
        amountSpent="4000"
      />,
    );
    expect(screen.getByText(/✓ minimum spend met/i)).toBeDefined();
    expect(screen.queryByText(/not yet met/i)).toBeNull();
  });

  it("shows '✓ Minimum spend met' when amountSpent exceeds spend requirement", () => {
    render(
      <CardFormStep1
        register={makeRegister()}
        setValue={makeSetValue()}
        errors={{} as never}
        issuerId={undefined}
        bonusType={undefined}
        bonusSpendRequirement="2000"
        amountSpent="5000"
      />,
    );
    expect(screen.getByText(/✓ minimum spend met/i)).toBeDefined();
  });
});

// ── CardFormEditFields: no status dropdown ────────────────────────────────────

describe("CardFormEditFields — no Card Status field (issue #1745)", () => {

  it("does NOT render a Status dropdown or label in edit mode", () => {
    render(
      <CardFormEditFields
        register={makeRegister()}
        setValue={makeSetValue()}
        errors={{} as never}
        issuerId="chase"
        bonusType={undefined}
        bonusSpendRequirement={undefined}
        amountSpent={undefined}
      />,
    );
    // No Status label
    expect(screen.queryByLabelText(/^status$/i)).toBeNull();
    expect(screen.queryByText(/^card status$/i)).toBeNull();
  });
});

// ── CardFormStep2: annual fee amount input ────────────────────────────────────

describe("CardFormStep2 — annual fee amount in Step 2 (issue #1745)", () => {

  it("renders an 'Annual fee' amount input in Step 2", () => {
    render(
      <CardFormStep2
        register={makeRegister()}
        setValue={makeSetValue()}
        errors={{} as never}
        creditLimit={undefined}
      />,
    );
    expect(screen.getByLabelText(/^annual fee$/i)).toBeDefined();
  });
});

// ── cardFormSchema: amountSpent validation ────────────────────────────────────

describe("cardFormSchema — amountSpent field validation (issue #1745)", () => {
  it("rejects negative amountSpent", () => {
    const result = cardFormSchema.safeParse({
      issuerId: "chase",
      cardName: "Test",
      openDate: "2024-01-01",
      amountSpent: "-50",
    });
    expect(result.success).toBe(false);
  });

  it("accepts zero amountSpent", () => {
    const result = cardFormSchema.safeParse({
      issuerId: "chase",
      cardName: "Test",
      openDate: "2024-01-01",
      amountSpent: "0",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid positive amountSpent", () => {
    const result = cardFormSchema.safeParse({
      issuerId: "chase",
      cardName: "Test",
      openDate: "2024-01-01",
      amountSpent: "1500",
    });
    expect(result.success).toBe(true);
  });
});
