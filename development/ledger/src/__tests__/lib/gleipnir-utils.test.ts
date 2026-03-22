/**
 * Unit tests for gleipnir-utils.ts — fragment tracking and completion detection.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  getFoundFragmentCount,
  isGleipnirComplete,
  GLEIPNIR_FRAGMENTS,
} from "@/lib/gleipnir-utils";

describe("gleipnir-utils", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ── getFoundFragmentCount ───────────────────────────────────────────────

  describe("getFoundFragmentCount", () => {
    it("returns 0 when no fragments are found", () => {
      expect(getFoundFragmentCount()).toBe(0);
    });

    it("returns 1 when a single fragment is set", () => {
      localStorage.setItem("egg:gleipnir-1", "1");
      expect(getFoundFragmentCount()).toBe(1);
    });

    it("returns 3 when three fragments are set", () => {
      localStorage.setItem("egg:gleipnir-1", "1");
      localStorage.setItem("egg:gleipnir-3", "1");
      localStorage.setItem("egg:gleipnir-5", "1");
      expect(getFoundFragmentCount()).toBe(3);
    });

    it("returns 6 when all fragments are set", () => {
      for (const f of GLEIPNIR_FRAGMENTS) {
        localStorage.setItem(f.key, "1");
      }
      expect(getFoundFragmentCount()).toBe(6);
    });

    it("ignores unrelated localStorage keys", () => {
      localStorage.setItem("unrelated-key", "1");
      localStorage.setItem("egg:milestone-5", "1");
      expect(getFoundFragmentCount()).toBe(0);
    });
  });

  // ── isGleipnirComplete ──────────────────────────────────────────────────

  describe("isGleipnirComplete", () => {
    it("returns false when no fragments are found", () => {
      expect(isGleipnirComplete()).toBe(false);
    });

    it("returns false when some but not all fragments are found", () => {
      localStorage.setItem("egg:gleipnir-1", "1");
      localStorage.setItem("egg:gleipnir-2", "1");
      localStorage.setItem("egg:gleipnir-3", "1");
      localStorage.setItem("egg:gleipnir-4", "1");
      localStorage.setItem("egg:gleipnir-5", "1");
      // Missing gleipnir-6
      expect(isGleipnirComplete()).toBe(false);
    });

    it("returns true when all 6 fragments are found", () => {
      for (const f of GLEIPNIR_FRAGMENTS) {
        localStorage.setItem(f.key, "1");
      }
      expect(isGleipnirComplete()).toBe(true);
    });
  });

  // ── GLEIPNIR_FRAGMENTS constant ─────────────────────────────────────────

  describe("GLEIPNIR_FRAGMENTS", () => {
    it("has exactly 6 fragments", () => {
      expect(GLEIPNIR_FRAGMENTS).toHaveLength(6);
    });

    it("each fragment has a key and name", () => {
      for (const f of GLEIPNIR_FRAGMENTS) {
        expect(f.key).toMatch(/^egg:gleipnir-\d$/);
        expect(f.name).toBeTruthy();
      }
    });
  });
});
