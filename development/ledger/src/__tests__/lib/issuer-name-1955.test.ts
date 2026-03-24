/**
 * issuer-name — Issue #1955
 *
 * Regression tests confirming that getIssuerName returns real bank names
 * (not Norse rune names) for all known issuers.
 *
 * Before the fix, card tile tooltips and dropdowns showed the internal
 * runeName ("Raidho", "Sowilo", etc.) instead of the display name
 * ("Chase", "American Express", etc.).
 *
 * @ref #1955
 */

import { describe, it, expect } from "vitest";
import { getIssuerName } from "@/lib/issuer-utils";

// All Norse rune names that must NOT appear as issuer display names.
const RUNE_NAMES = [
  "Raidho",
  "Fehu",
  "Thurisaz",
  "Wunjo",
  "Sowilo",
  "Isa",
  "Naudiz",
  "Uruz",
  "Gebo",
  "Ehwaz",
];

describe("getIssuerName — issue #1955 regression: real names, not rune names", () => {
  describe("returns real issuer display names", () => {
    const expectedNames: [string, string][] = [
      ["amex", "American Express"],
      ["bank_of_america", "Bank of America"],
      ["barclays", "Barclays"],
      ["capital_one", "Capital One"],
      ["chase", "Chase"],
      ["citibank", "Citibank"],
      ["discover", "Discover"],
      ["hsbc", "HSBC"],
      ["us_bank", "US Bank"],
      ["wells_fargo", "Wells Fargo"],
      ["other", "Other"],
    ];

    for (const [id, expectedName] of expectedNames) {
      it(`${id} → "${expectedName}"`, () => {
        expect(getIssuerName(id)).toBe(expectedName);
      });
    }
  });

  describe("never returns a Norse rune name", () => {
    const knownIds = [
      "amex",
      "bank_of_america",
      "barclays",
      "capital_one",
      "chase",
      "citibank",
      "discover",
      "hsbc",
      "us_bank",
      "wells_fargo",
    ];

    for (const id of knownIds) {
      it(`${id} result does not contain any rune name`, () => {
        const name = getIssuerName(id);
        for (const runeName of RUNE_NAMES) {
          expect(name, `${id} should not return "${runeName}"`).not.toContain(runeName);
        }
      });
    }
  });

  describe("fallback behaviour", () => {
    it("returns raw issuerId for unknown issuer (not null, not undefined)", () => {
      expect(getIssuerName("my_unknown_issuer")).toBe("my_unknown_issuer");
    });

    it("returns raw issuerId — not a rune name — for custom issuer", () => {
      const result = getIssuerName("custom_credit_union");
      for (const runeName of RUNE_NAMES) {
        expect(result).not.toContain(runeName);
      }
    });
  });
});
