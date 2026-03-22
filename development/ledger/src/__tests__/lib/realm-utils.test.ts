/**
 * realm-utils — targeted branch coverage (issue #1656)
 *
 * realm-utils.ts had 50% coverage (56× hits on covered lines, 50% branches missed).
 * These tests target the previously uncovered branches:
 *   - getRealmLabel: bonus_open, overdue, graduated
 *   - getRealmDescription: all 7 statuses
 *   - getRealmLabel with daysRemaining interpolation for fee_approaching / promo_expiring
 *
 * Issue #1656
 */

import { describe, it, expect } from "vitest";
import { getRealmLabel, getRealmDescription } from "@/lib/realm-utils";

// ── getRealmLabel ─────────────────────────────────────────────────────────────

describe("getRealmLabel — covered branches (sanity)", () => {
  it("active → Asgard-bound", () => {
    const label = getRealmLabel("active");
    expect(label.label).toBe("Asgard-bound");
    expect(label.rune).toBe("ᛊ");
    expect(label.colorClass).toBe("text-realm-asgard");
  });

  it("fee_approaching → Muspelheim with daysRemaining interpolated", () => {
    const label = getRealmLabel("fee_approaching", 14);
    expect(label.label).toBe("Muspelheim");
    expect(label.sublabel).toContain("14");
    expect(label.rune).toBe("ᚲ");
    expect(label.colorClass).toBe("text-realm-muspel");
  });

  it("fee_approaching with no daysRemaining defaults to 0", () => {
    const label = getRealmLabel("fee_approaching");
    expect(label.sublabel).toContain("0");
  });

  it("promo_expiring → Hati approaches with daysRemaining interpolated", () => {
    const label = getRealmLabel("promo_expiring", 7);
    expect(label.label).toBe("Hati approaches");
    expect(label.sublabel).toContain("7");
    expect(label.rune).toBe("ᚺ");
    expect(label.colorClass).toBe("text-realm-hati");
  });

  it("closed → In Valhalla", () => {
    const label = getRealmLabel("closed");
    expect(label.label).toBe("In Valhalla");
    expect(label.rune).toBe("ᛏ");
    expect(label.colorClass).toBe("text-realm-hel");
  });
});

describe("getRealmLabel — previously uncovered branches", () => {
  it("bonus_open → Alfheim", () => {
    const label = getRealmLabel("bonus_open");
    expect(label.label).toBe("Alfheim");
    expect(label.sublabel).toContain("bonus");
    expect(label.rune).toBe("ᛅ");
    expect(label.colorClass).toBe("text-realm-alfheim");
  });

  it("overdue → Niflheim", () => {
    const label = getRealmLabel("overdue");
    expect(label.label).toBe("Niflheim");
    expect(label.sublabel).toContain("past due");
    expect(label.rune).toBe("ᚾ");
    expect(label.colorClass).toBe("text-realm-niflheim");
  });

  it("graduated → In Valhalla (earned variant)", () => {
    const label = getRealmLabel("graduated");
    expect(label.label).toBe("In Valhalla");
    expect(label.sublabel).toContain("bonus earned");
    expect(label.rune).toBe("ᛏ");
    expect(label.colorClass).toBe("text-realm-hel");
  });
});

// ── getRealmDescription ───────────────────────────────────────────────────────

describe("getRealmDescription — all 7 statuses", () => {
  it("active → Asgard-bound description", () => {
    expect(getRealmDescription("active")).toContain("Asgard-bound");
  });

  it("fee_approaching → Muspelheim description", () => {
    expect(getRealmDescription("fee_approaching")).toContain("Muspelheim");
  });

  it("promo_expiring → Hati approaches description", () => {
    expect(getRealmDescription("promo_expiring")).toContain("Hati");
  });

  it("closed → In Valhalla description", () => {
    expect(getRealmDescription("closed")).toContain("Valhalla");
  });

  it("bonus_open → Alfheim description", () => {
    expect(getRealmDescription("bonus_open")).toContain("Alfheim");
  });

  it("overdue → Niflheim description", () => {
    expect(getRealmDescription("overdue")).toContain("Niflheim");
  });

  it("graduated → Valhalla description", () => {
    expect(getRealmDescription("graduated")).toContain("Valhalla");
  });
});
