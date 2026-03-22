/**
 * Unit tests for TrialStatusPanel helper functions.
 *
 * Tests the pure helper functions exported from TrialStatusPanel:
 *   - getAtmosphericSubtitle: Voice 2 subtitle rotation by days remaining
 *   - getCtaText: CTA button text rotation
 *   - getDismissText: Dismiss link text rotation
 *   - getValueHeading: Value section heading rotation
 *
 * @see components/trial/TrialStatusPanel.tsx
 * @see Issue #622
 */

import { describe, it, expect } from "vitest";
import {
  getAtmosphericSubtitle,
  getCtaText,
  getDismissText,
  getValueHeading,
} from "@/components/trial/TrialStatusPanel";

// ── getAtmosphericSubtitle ───────────────────────────────────────────────

describe("getAtmosphericSubtitle", () => {
  it("returns 'The wolf runs with the pack.' for days 20-30", () => {
    expect(getAtmosphericSubtitle(20, "active")).toBe("The wolf runs with the pack.");
    expect(getAtmosphericSubtitle(25, "active")).toBe("The wolf runs with the pack.");
    expect(getAtmosphericSubtitle(30, "active")).toBe("The wolf runs with the pack.");
  });

  it("returns 'The pack grows stronger.' for days 10-19", () => {
    expect(getAtmosphericSubtitle(10, "active")).toBe("The pack grows stronger.");
    expect(getAtmosphericSubtitle(15, "active")).toBe("The pack grows stronger.");
    expect(getAtmosphericSubtitle(19, "active")).toBe("The pack grows stronger.");
  });

  it("returns 'The hunt nears its end.' for days 4-9", () => {
    expect(getAtmosphericSubtitle(4, "active")).toBe("The hunt nears its end.");
    expect(getAtmosphericSubtitle(7, "active")).toBe("The hunt nears its end.");
    expect(getAtmosphericSubtitle(9, "active")).toBe("The hunt nears its end.");
  });

  it("returns 'N days remain. Your data is safe.' for days 1-3", () => {
    expect(getAtmosphericSubtitle(3, "active")).toBe("3 days remain. Your data is safe.");
    expect(getAtmosphericSubtitle(2, "active")).toBe("2 days remain. Your data is safe.");
    expect(getAtmosphericSubtitle(1, "active")).toBe("1 day remain. Your data is safe.");
  });

  it("returns last day message for day 0", () => {
    expect(getAtmosphericSubtitle(0, "active")).toBe("Today is the last day. Your data is safe.");
  });

  it("returns last day message for expired status", () => {
    expect(getAtmosphericSubtitle(0, "expired")).toBe("Today is the last day. Your data is safe.");
    expect(getAtmosphericSubtitle(5, "expired")).toBe("Today is the last day. Your data is safe.");
  });
});

// ── getCtaText ───────────────────────────────────────────────────────────

describe("getCtaText", () => {
  it("returns 'Subscribe for $3.99/month' for days 6-30", () => {
    expect(getCtaText(6, "active")).toBe("Subscribe for $3.99/month");
    expect(getCtaText(15, "active")).toBe("Subscribe for $3.99/month");
    expect(getCtaText(30, "active")).toBe("Subscribe for $3.99/month");
  });

  it("returns 'Keep full access' for days 0-5", () => {
    expect(getCtaText(5, "active")).toContain("Keep full access");
    expect(getCtaText(3, "active")).toContain("Keep full access");
    expect(getCtaText(0, "active")).toContain("Keep full access");
  });

  it("returns 'Reactivate' for expired status", () => {
    expect(getCtaText(0, "expired")).toContain("Reactivate");
  });
});

// ── getDismissText ───────────────────────────────────────────────────────

describe("getDismissText", () => {
  it("returns 'Not now' for days 6-30", () => {
    expect(getDismissText(6, "active")).toBe("Not now");
    expect(getDismissText(15, "active")).toBe("Not now");
    expect(getDismissText(30, "active")).toBe("Not now");
  });

  it("returns 'I'll decide later' for days 0-5", () => {
    expect(getDismissText(5, "active")).toContain("decide later");
    expect(getDismissText(3, "active")).toContain("decide later");
  });

  it("returns 'Maybe later' for expired status", () => {
    expect(getDismissText(0, "expired")).toBe("Maybe later");
  });
});

// ── getValueHeading ──────────────────────────────────────────────────────

describe("getValueHeading", () => {
  it("returns 'Your Trial So Far' for days 6-30", () => {
    expect(getValueHeading(6)).toBe("Your Trial So Far");
    expect(getValueHeading(15)).toBe("Your Trial So Far");
    expect(getValueHeading(30)).toBe("Your Trial So Far");
  });

  it("returns 'What You Built During Your Trial' for days 0-5", () => {
    expect(getValueHeading(5)).toBe("What You Built During Your Trial");
    expect(getValueHeading(3)).toBe("What You Built During Your Trial");
    expect(getValueHeading(0)).toBe("What You Built During Your Trial");
  });
});
