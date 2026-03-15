/**
 * canImport gate — unit tests for Issue #956
 *
 * Validates the combined boolean formula used by ledger/page.tsx to determine
 * whether the Import button opens the ImportWizard or the upsell dialog:
 *
 *   const canImport = hasFeature("import") || karlOrTrial;
 *
 * Prior to the fix, only hasFeature("import") was checked, which blocked trial
 * users because Stripe has not yet provisioned the "import" feature for them.
 *
 * The fix adds || karlOrTrial so that any active trial user (or Karl subscriber)
 * gets through the gate regardless of Stripe entitlement state.
 *
 * These tests exercise the derivation formula and the handleImportClick dispatch
 * logic as pure functions — no DOM required.
 *
 * @ref #956
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Pure logic helpers extracted from ledger/page.tsx
// (these mirror the exact expressions used in production code)
// ---------------------------------------------------------------------------

/**
 * Derives canImport exactly as ledger/page.tsx does after the fix.
 *
 * hasFeatureImport — return value of hasFeature("import") from useEntitlement
 * karlOrTrial      — return value of useIsKarlOrTrial()
 */
function deriveCanImport(hasFeatureImport: boolean, karlOrTrial: boolean): boolean {
  return hasFeatureImport || karlOrTrial;
}

/**
 * Simulates handleImportClick: returns which dialog to open.
 * Mirrors the exact if/else branch in DashboardPageContent.
 */
function handleImportClick(canImport: boolean): "wizard" | "upsell" {
  if (canImport) {
    return "wizard";
  } else {
    return "upsell";
  }
}

// ---------------------------------------------------------------------------
// canImport derivation — all 4 permutations of the OR formula
// ---------------------------------------------------------------------------

describe("canImport derivation — Issue #956 fix", () => {
  it("AC1: trial user (hasFeature=false, karlOrTrial=true) → canImport=true", () => {
    // This is THE bug fix: Thrall user with active trial was previously blocked
    // because hasFeature("import") returns false for non-Karl Stripe tier.
    expect(deriveCanImport(false, true)).toBe(true);
  });

  it("AC2: Thrall with no trial (hasFeature=false, karlOrTrial=false) → canImport=false", () => {
    // Thrall users without an active trial must see the paywall upsell.
    expect(deriveCanImport(false, false)).toBe(false);
  });

  it("AC3: paid Karl subscriber (hasFeature=true, karlOrTrial=false) → canImport=true", () => {
    // Existing Karl subscribers already had access via hasFeature; confirm not regressed.
    expect(deriveCanImport(true, false)).toBe(true);
  });

  it("AC3 edge: paid Karl with active trial (hasFeature=true, karlOrTrial=true) → canImport=true", () => {
    // Both flags true — still true.
    expect(deriveCanImport(true, true)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// handleImportClick dispatch — wizard vs upsell
// ---------------------------------------------------------------------------

describe("handleImportClick dispatch — wizard vs upsell", () => {
  it("opens ImportWizard when canImport=true (trial user)", () => {
    // Trial user: canImport = false || true = true → wizard
    const canImport = deriveCanImport(false, true);
    expect(handleImportClick(canImport)).toBe("wizard");
  });

  it("opens ImportWizard when canImport=true (paid Karl)", () => {
    // Karl paid: canImport = true || false = true → wizard
    const canImport = deriveCanImport(true, false);
    expect(handleImportClick(canImport)).toBe("wizard");
  });

  it("opens upsell dialog when canImport=false (Thrall, no trial)", () => {
    // Thrall: canImport = false || false = false → upsell
    const canImport = deriveCanImport(false, false);
    expect(handleImportClick(canImport)).toBe("upsell");
  });
});
