/**
 * issuer-utils — Issue #1949 (updated #1965)
 *
 * Unit tests for the issuer utility functions used by IssuerLogo,
 * card tiles, and the issuer dropdown.
 *
 * @ref #1949 #1965
 */

import { describe, it, expect } from "vitest";
import {
  getIssuerMeta,
  getIssuerLogoPath,
  getIssuerName,
  getIssuerInitials,
  getIssuerBadgeChar,
} from "@/lib/issuer-utils";

describe("issuer-utils — issue #1949", () => {
  describe("getIssuerMeta", () => {
    it("returns logo metadata for chase", () => {
      const meta = getIssuerMeta("chase");
      expect(meta).not.toBeNull();
      expect(meta?.logoPath).toBe("/issuers/chase.svg");
      expect(meta?.brandColor).toBeTruthy();
    });

    it("returns null for an unknown issuer", () => {
      expect(getIssuerMeta("unknown_bank_xyz")).toBeNull();
    });

    it("returns logo metadata for amex", () => {
      const meta = getIssuerMeta("amex");
      expect(meta?.logoPath).toBe("/issuers/amex.svg");
      expect(meta?.brandColor).toBeTruthy();
    });

    it("returns metadata for all 10 known issuers", () => {
      const known = [
        "chase",
        "bank_of_america",
        "capital_one",
        "wells_fargo",
        "amex",
        "citibank",
        "discover",
        "us_bank",
        "barclays",
        "hsbc",
      ];
      for (const id of known) {
        const meta = getIssuerMeta(id);
        expect(meta, `${id} should have meta`).not.toBeNull();
        expect(meta?.logoPath, `${id} should have a logoPath`).toMatch(/\/issuers\/.+\.svg$/);
      }
    });

    it("meta does not contain rune or runeName fields", () => {
      const meta = getIssuerMeta("chase") as Record<string, unknown>;
      expect(meta).not.toBeNull();
      expect("rune" in meta).toBe(false);
      expect("runeName" in meta).toBe(false);
    });
  });

  describe("getIssuerLogoPath", () => {
    it("returns svg path for known issuer", () => {
      expect(getIssuerLogoPath("wells_fargo")).toBe("/issuers/wells-fargo.svg");
    });

    it("returns null for unknown issuer", () => {
      expect(getIssuerLogoPath("custom_issuer")).toBeNull();
    });
  });

  describe("getIssuerName", () => {
    it("returns display name for known issuer", () => {
      expect(getIssuerName("chase")).toBe("Chase");
    });

    it("returns raw ID as fallback for unknown issuer", () => {
      expect(getIssuerName("my_custom_bank")).toBe("my_custom_bank");
    });
  });

  describe("getIssuerInitials", () => {
    it("returns two initials for multi-word issuer name", () => {
      // "Capital One" → "CO"
      const initials = getIssuerInitials("capital_one");
      expect(initials).toBe("CO");
    });

    it("returns single initial for single-word issuer", () => {
      // "Chase" → "C"
      expect(getIssuerInitials("chase")).toBe("C");
    });

    it("handles unknown issuer by using raw ID first char", () => {
      // unknown → raw id → first char uppercased
      const result = getIssuerInitials("xyz_bank");
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getIssuerBadgeChar", () => {
    it("returns initials for known issuer", () => {
      expect(getIssuerBadgeChar("chase")).toBe("C");
    });

    it("returns initials for capital_one", () => {
      expect(getIssuerBadgeChar("capital_one")).toBe("CO");
    });

    it("returns initials for unknown issuer", () => {
      const badge = getIssuerBadgeChar("my_weird_issuer");
      expect(badge).toBeTruthy();
    });

    it("all known issuers return non-empty badge chars", () => {
      const known = [
        "chase",
        "bank_of_america",
        "capital_one",
        "wells_fargo",
        "amex",
        "citibank",
        "discover",
        "us_bank",
        "barclays",
        "hsbc",
      ];
      for (const id of known) {
        const badge = getIssuerBadgeChar(id);
        expect(badge, `${id} should have a badge char`).toBeTruthy();
      }
    });

    it("badge chars are initials, not rune characters", () => {
      const known = ["chase", "amex", "capital_one", "wells_fargo"];
      const RUNE_CHARS = ["ᚱ", "ᚠ", "ᚦ", "ᚹ", "ᛊ", "ᛁ", "ᚾ", "ᚢ", "ᚷ", "ᛇ"];
      for (const id of known) {
        const badge = getIssuerBadgeChar(id);
        expect(RUNE_CHARS, `${id} badge should not be a rune char`).not.toContain(badge);
      }
    });
  });
});
