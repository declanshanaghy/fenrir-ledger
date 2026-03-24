/**
 * issuer-utils — Issue #1949
 *
 * Unit tests for the issuer utility functions used by IssuerLogo,
 * card tiles, and the issuer dropdown.
 *
 * @ref #1949
 */

import { describe, it, expect } from "vitest";
import {
  getIssuerMeta,
  getIssuerRune,
  getIssuerLogoPath,
  getIssuerName,
  getIssuerInitials,
  getIssuerBadgeChar,
} from "@/lib/issuer-utils";

describe("issuer-utils — issue #1949", () => {
  describe("getIssuerMeta", () => {
    it("returns full metadata for chase", () => {
      const meta = getIssuerMeta("chase");
      expect(meta).not.toBeNull();
      expect(meta?.rune).toBe("ᚱ");
      expect(meta?.runeName).toBe("Raidho");
      expect(meta?.logoPath).toBe("/issuers/chase.svg");
    });

    it("returns null for an unknown issuer", () => {
      expect(getIssuerMeta("unknown_bank_xyz")).toBeNull();
    });

    it("returns full metadata for amex", () => {
      const meta = getIssuerMeta("amex");
      expect(meta?.rune).toBe("ᛊ");
      expect(meta?.runeName).toBe("Sowilo");
      expect(meta?.logoPath).toBe("/issuers/amex.svg");
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
        expect(meta?.rune, `${id} should have a rune`).toBeTruthy();
        expect(meta?.logoPath, `${id} should have a logoPath`).toMatch(/\/issuers\/.+\.svg$/);
      }
    });
  });

  describe("getIssuerRune", () => {
    it("returns rune char for known issuer", () => {
      expect(getIssuerRune("capital_one")).toBe("ᚦ");
    });

    it("returns null for unknown issuer", () => {
      expect(getIssuerRune("my_weird_bank")).toBeNull();
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
    it("returns rune for known issuer", () => {
      expect(getIssuerBadgeChar("chase")).toBe("ᚱ");
    });

    it("returns initials for unknown issuer (no rune available)", () => {
      const badge = getIssuerBadgeChar("my_weird_issuer");
      // Falls back to initials
      expect(badge).toBeTruthy();
      expect(badge).not.toContain("ᚱ"); // not chase's rune
    });

    it("all known issuers return unique rune chars", () => {
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
      const runes = known.map(getIssuerBadgeChar);
      const uniqueRunes = new Set(runes);
      expect(uniqueRunes.size).toBe(known.length);
    });
  });
});
