/**
 * Tests for useDashboardTabs hook helpers — issue #1684.
 *
 * Focuses on the pure functions extracted to reduce Dashboard.tsx complexity:
 *   - resolveInitialTab: initial tab priority logic (prop > localStorage > default)
 *
 * Hook integration (useEffect, event listeners, localStorage) is tested via
 * the existing dashboard page tests and E2E.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resolveInitialTab } from "@/hooks/useDashboardTabs";
import type { DashboardGates } from "@/hooks/useDashboardTabs";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FULL_ACCESS: DashboardGates = {
  isHowlUnlocked: true,
  hasValhalla: true,
  hasVelocity: true,
  hasTrash: true,
};

const THRALL_ACCESS: DashboardGates = {
  isHowlUnlocked: false,
  hasValhalla: false,
  hasVelocity: false,
  hasTrash: false,
};

// ── resolveInitialTab ─────────────────────────────────────────────────────────

describe("resolveInitialTab", () => {
  beforeEach(() => {
    // Clear localStorage between tests
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("URL param (initialTab prop) takes highest priority", () => {
    it("returns the prop tab when valid and user has access", () => {
      expect(resolveInitialTab("valhalla", FULL_ACCESS, 0)).toBe("valhalla");
      expect(resolveInitialTab("hunt", FULL_ACCESS, 0)).toBe("hunt");
      expect(resolveInitialTab("howl", FULL_ACCESS, 5)).toBe("howl");
      expect(resolveInitialTab("trash", FULL_ACCESS, 0)).toBe("trash");
      expect(resolveInitialTab("active", FULL_ACCESS, 0)).toBe("active");
      expect(resolveInitialTab("all", FULL_ACCESS, 0)).toBe("all");
    });

    it("falls through for invalid tab strings", () => {
      // Invalid tab → falls to default (no localStorage, 0 howl cards)
      expect(resolveInitialTab("invalid", FULL_ACCESS, 0)).toBe("active");
      expect(resolveInitialTab("", FULL_ACCESS, 0)).toBe("active");
    });

    it("falls through for undefined initialTab", () => {
      expect(resolveInitialTab(undefined, FULL_ACCESS, 0)).toBe("active");
    });

    it("falls through when Thrall user requests gated valhalla tab", () => {
      // No localStorage, 0 howl cards → should default to "active"
      expect(resolveInitialTab("valhalla", THRALL_ACCESS, 0)).toBe("active");
    });

    it("falls through when Thrall user requests gated hunt tab", () => {
      expect(resolveInitialTab("hunt", THRALL_ACCESS, 0)).toBe("active");
    });

    it("falls through to default (howl) when Thrall user requests gated howl tab and howlCount > 0", () => {
      // isHowlUnlocked=false → prop is ignored, but default logic sees howlCount=5 → "howl"
      expect(resolveInitialTab("howl", THRALL_ACCESS, 5)).toBe("howl");
    });

    it("falls through to default (active) when Thrall user requests gated howl tab and howlCount === 0", () => {
      expect(resolveInitialTab("howl", THRALL_ACCESS, 0)).toBe("active");
    });

    it("falls through when Thrall user requests gated trash tab", () => {
      expect(resolveInitialTab("trash", THRALL_ACCESS, 0)).toBe("active");
    });
  });

  describe("localStorage takes second priority", () => {
    it("returns stored tab when no initialTab prop and stored tab is valid", () => {
      localStorage.setItem("fenrir:dashboard-tab", "valhalla");
      expect(resolveInitialTab(undefined, FULL_ACCESS, 0)).toBe("valhalla");
    });

    it("ignores stored invalid tab values", () => {
      localStorage.setItem("fenrir:dashboard-tab", "invalid-tab");
      expect(resolveInitialTab(undefined, FULL_ACCESS, 0)).toBe("active");
    });

    it("is overridden by a valid initialTab prop", () => {
      localStorage.setItem("fenrir:dashboard-tab", "valhalla");
      expect(resolveInitialTab("hunt", FULL_ACCESS, 0)).toBe("hunt");
    });
  });

  describe("default logic (no prop, no localStorage)", () => {
    it("defaults to howl when howlCount > 0", () => {
      expect(resolveInitialTab(undefined, FULL_ACCESS, 3)).toBe("howl");
    });

    it("defaults to active when howlCount === 0", () => {
      expect(resolveInitialTab(undefined, FULL_ACCESS, 0)).toBe("active");
    });

    it("defaults to active when howlCount === 0 even for Thrall", () => {
      expect(resolveInitialTab(undefined, THRALL_ACCESS, 0)).toBe("active");
    });

    it("defaults to howl when howlCount > 0 for full-access users", () => {
      expect(resolveInitialTab(undefined, FULL_ACCESS, 1)).toBe("howl");
    });
  });
});
