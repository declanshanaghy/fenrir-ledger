/**
 * Unit tests for entitlement/card-limit.ts — Thrall card limit enforcement.
 *
 * Tests the canAddCard() guard and THRALL_CARD_LIMIT constant.
 */

import { describe, it, expect } from "vitest";
import { canAddCard } from "@/lib/entitlement/card-limit";
import { THRALL_CARD_LIMIT } from "@/lib/entitlement/types";

// ── Constant ─────────────────────────────────────────────────────────────

describe("THRALL_CARD_LIMIT", () => {
  it("equals 5", () => {
    expect(THRALL_CARD_LIMIT).toBe(5);
  });
});

// ── canAddCard ───────────────────────────────────────────────────────────

describe("canAddCard", () => {
  // ── Karl tier (unlimited) ──────────────────────────────────────────

  describe("karl tier", () => {
    it("allows adding a card with 0 existing cards", () => {
      const result = canAddCard("karl", 0);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBeNull();
      expect(result.currentCount).toBe(0);
    });

    it("allows adding a card with 100 existing cards", () => {
      const result = canAddCard("karl", 100);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBeNull();
      expect(result.currentCount).toBe(100);
    });

    it("does not include a reason when allowed", () => {
      const result = canAddCard("karl", 50);
      expect(result.reason).toBeUndefined();
    });
  });

  // ── Thrall tier (limited to THRALL_CARD_LIMIT) ─────────────────────

  describe("thrall tier", () => {
    it("allows adding a card when count is 0", () => {
      const result = canAddCard("thrall", 0);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(THRALL_CARD_LIMIT);
      expect(result.currentCount).toBe(0);
    });

    it("allows adding a card when count is below limit", () => {
      const result = canAddCard("thrall", THRALL_CARD_LIMIT - 1);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(THRALL_CARD_LIMIT);
    });

    it("blocks adding a card when count equals limit", () => {
      const result = canAddCard("thrall", THRALL_CARD_LIMIT);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain("Thrall");
      expect(result.reason).toContain(String(THRALL_CARD_LIMIT));
      expect(result.limit).toBe(THRALL_CARD_LIMIT);
      expect(result.currentCount).toBe(THRALL_CARD_LIMIT);
    });

    it("blocks adding a card when count exceeds limit", () => {
      const result = canAddCard("thrall", THRALL_CARD_LIMIT + 5);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.currentCount).toBe(THRALL_CARD_LIMIT + 5);
    });

    it("suggests upgrading to Karl in the reason", () => {
      const result = canAddCard("thrall", THRALL_CARD_LIMIT);
      expect(result.reason).toContain("Karl");
    });
  });

  // ── Trial active (temporary Karl access) ───────────────────────────

  describe("thrall tier with active trial", () => {
    it("allows adding a card when trial is active regardless of count", () => {
      const result = canAddCard("thrall", 50, true);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBeNull();
      expect(result.currentCount).toBe(50);
    });

    it("allows adding a card at exactly the limit when trial is active", () => {
      const result = canAddCard("thrall", THRALL_CARD_LIMIT, true);
      expect(result.allowed).toBe(true);
      expect(result.limit).toBeNull();
    });

    it("blocks when trial is not active and at limit", () => {
      const result = canAddCard("thrall", THRALL_CARD_LIMIT, false);
      expect(result.allowed).toBe(false);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("defaults isTrialActive to false when not provided", () => {
      const result = canAddCard("thrall", THRALL_CARD_LIMIT);
      expect(result.allowed).toBe(false);
    });

    it("karl tier ignores trial flag entirely", () => {
      const withTrial = canAddCard("karl", 100, true);
      const withoutTrial = canAddCard("karl", 100, false);
      expect(withTrial.allowed).toBe(true);
      expect(withoutTrial.allowed).toBe(true);
    });

    it("exactly 4 cards allowed on thrall (one below limit)", () => {
      const result = canAddCard("thrall", 4);
      expect(result.allowed).toBe(true);
    });

    it("exactly 5 cards blocked on thrall (at limit)", () => {
      const result = canAddCard("thrall", 5);
      expect(result.allowed).toBe(false);
    });
  });
});
