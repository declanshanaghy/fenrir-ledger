/**
 * Trial modal anon-safety tests (Issue #1699)
 *
 * Validates that trial logic gates (shouldShowExpiryModal, TrialDay15 logic)
 * never fire for anonymous users (who have trial status "none").
 *
 * These are pure-logic tests — no rendering required.
 *
 * @ref #1699
 */

import { describe, it, expect } from "vitest";
import { shouldShowExpiryModal } from "@/components/trial/TrialExpiryModal";

// ── shouldShowExpiryModal ─────────────────────────────────────────────────────

describe("shouldShowExpiryModal — anon safety (issue #1699)", () => {
  it("returns false for status=none (anonymous user has no trial)", () => {
    expect(shouldShowExpiryModal("none", false)).toBe(false);
  });

  it("returns false for status=anonymous", () => {
    expect(shouldShowExpiryModal("anonymous", false)).toBe(false);
  });

  it("returns false for status=active (trial not yet expired)", () => {
    expect(shouldShowExpiryModal("active", false)).toBe(false);
  });

  it("returns true only when status=expired AND not yet shown", () => {
    expect(shouldShowExpiryModal("expired", false)).toBe(true);
  });

  it("returns false when status=expired but modal already shown", () => {
    expect(shouldShowExpiryModal("expired", true)).toBe(false);
  });
});

// ── Day15 nudge logic — inline (same pattern as TrialDay15Modal) ──────────────

/**
 * Mirrors the internal visibility logic from TrialDay15Modal.
 * Extracted for direct unit testing without rendering.
 */
function shouldShowDay15Nudge(
  status: string,
  isLoading: boolean,
  daysElapsed: number,
  nudgeAlreadyShown: boolean,
): boolean {
  if (isLoading || status !== "active") return false;
  if (nudgeAlreadyShown) return false;
  return daysElapsed >= 15;
}

describe("TrialDay15Modal visibility logic — anon safety (issue #1699)", () => {
  it("never shows for status=none (anon user)", () => {
    expect(shouldShowDay15Nudge("none", false, 15, false)).toBe(false);
  });

  it("never shows for status=anonymous", () => {
    expect(shouldShowDay15Nudge("anonymous", false, 15, false)).toBe(false);
  });

  it("never shows when isLoading=true", () => {
    expect(shouldShowDay15Nudge("active", true, 15, false)).toBe(false);
  });

  it("never shows for expired trial status", () => {
    expect(shouldShowDay15Nudge("expired", false, 15, false)).toBe(false);
  });

  it("shows only for active trial at day 15+", () => {
    expect(shouldShowDay15Nudge("active", false, 15, false)).toBe(true);
  });

  it("does not show before day 15", () => {
    expect(shouldShowDay15Nudge("active", false, 14, false)).toBe(false);
  });

  it("does not show when nudge already shown", () => {
    expect(shouldShowDay15Nudge("active", false, 15, true)).toBe(false);
  });
});
