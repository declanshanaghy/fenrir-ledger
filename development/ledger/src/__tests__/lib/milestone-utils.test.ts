/**
 * Unit tests for milestone-utils.ts — milestone toast thresholds.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { checkMilestone } from "@/lib/milestone-utils";

describe("milestone-utils", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ── checkMilestone ──────────────────────────────────────────────────────

  describe("checkMilestone", () => {
    it("returns null when activeCardCount is 0", () => {
      expect(checkMilestone(0)).toBeNull();
    });

    it("fires threshold-1 milestone when card count reaches 1", () => {
      const result = checkMilestone(1);
      expect(result).not.toBeNull();
      expect(result!.threshold).toBe(1);
      expect(result!.message).toContain("First card forged");
    });

    it("fires threshold-5 milestone when card count reaches 5", () => {
      // Claim milestone-1 first so threshold-5 is the highest unclaimed
      localStorage.setItem("egg:milestone-1", "1");
      const result = checkMilestone(5);
      expect(result).not.toBeNull();
      expect(result!.threshold).toBe(5);
      expect(result!.message).toContain("Five chains tracked");
    });

    it("fires threshold-9 milestone when card count reaches 9", () => {
      localStorage.setItem("egg:milestone-1", "1");
      localStorage.setItem("egg:milestone-5", "1");
      const result = checkMilestone(9);
      expect(result).not.toBeNull();
      expect(result!.threshold).toBe(9);
      expect(result!.message).toContain("Nine realms");
    });

    it("fires threshold-13 milestone when card count reaches 13", () => {
      localStorage.setItem("egg:milestone-1", "1");
      localStorage.setItem("egg:milestone-5", "1");
      localStorage.setItem("egg:milestone-9", "1");
      const result = checkMilestone(13);
      expect(result).not.toBeNull();
      expect(result!.threshold).toBe(13);
      expect(result!.message).toContain("Thirteen bonds");
    });

    it("fires threshold-20 milestone when card count reaches 20", () => {
      localStorage.setItem("egg:milestone-1", "1");
      localStorage.setItem("egg:milestone-5", "1");
      localStorage.setItem("egg:milestone-9", "1");
      localStorage.setItem("egg:milestone-13", "1");
      const result = checkMilestone(20);
      expect(result).not.toBeNull();
      expect(result!.threshold).toBe(20);
      expect(result!.message).toContain("Twenty chains mastered");
    });

    it("returns highest unclaimed milestone first", () => {
      // Card count 20 with no milestones claimed — should fire 20 (highest)
      const result = checkMilestone(20);
      expect(result).not.toBeNull();
      expect(result!.threshold).toBe(20);
    });

    it("returns null when all milestones already claimed", () => {
      localStorage.setItem("egg:milestone-1", "1");
      localStorage.setItem("egg:milestone-5", "1");
      localStorage.setItem("egg:milestone-9", "1");
      localStorage.setItem("egg:milestone-13", "1");
      localStorage.setItem("egg:milestone-20", "1");
      expect(checkMilestone(25)).toBeNull();
    });

    it("sets localStorage key on milestone fire (one-shot)", () => {
      const result = checkMilestone(1);
      expect(result).not.toBeNull();
      expect(localStorage.getItem("egg:milestone-1")).toBe("1");

      // Second call returns null (already claimed)
      expect(checkMilestone(1)).toBeNull();
    });

    it("returns null for card count below any threshold (0)", () => {
      expect(checkMilestone(0)).toBeNull();
    });

    it("skips already-claimed milestones and fires next unclaimed", () => {
      // Claim threshold 20, count = 20 — should fire 13 (next highest unclaimed)
      localStorage.setItem("egg:milestone-20", "1");
      const result = checkMilestone(20);
      expect(result).not.toBeNull();
      expect(result!.threshold).toBe(13);
    });
  });
});
