/**
 * Card tile issuer name display — Issue #1965
 *
 * Validates that card dashboard tiles show real issuer names (Chase, Capital One, etc.)
 * and that all norse rune name mapping has been removed from issuer-utils.
 *
 * Test scope:
 *   - getIssuerRune is NOT exported (regression — the function was removed)
 *   - IssuerMeta has no rune/runeName fields
 *   - getIssuerBadgeChar returns ASCII initials, not rune Unicode characters
 *   - getIssuerName returns real bank names for all known issuers
 *   - IssuerLogo showLabel renders real issuer name, not rune name for tile issuers
 *
 * @ref #1965
 */

import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import * as issuerUtils from "@/lib/issuer-utils";
import { IssuerLogo } from "@/components/shared/IssuerLogo";

// ── Rune character set (BMP runic block U+16A0–U+16FF) ────────────────────────

const RUNIC_BLOCK_START = 0x16a0;
const RUNIC_BLOCK_END = 0x16ff;

function containsRuneChar(str: string): boolean {
  for (const ch of str) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= RUNIC_BLOCK_START && cp <= RUNIC_BLOCK_END) return true;
  }
  return false;
}

// Norse rune names that should not appear in any issuer display output
const RUNE_NAMES = [
  "Raidho", "RAIDHO",
  "Wunjo",  "WUNJO",
  "Fehu",   "FEHU",
  "Thurisaz", "THURISAZ",
  "Sowilo", "SOWILO",
  "Isa",    "ISA",
  "Naudiz", "NAUDIZ",
  "Berkanan", "BERKANAN",
  "Laguz",  "LAGUZ",
  "Hagalaz", "HAGALAZ",
];

const KNOWN_ISSUER_IDS = [
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

// ── Regression: removed API ───────────────────────────────────────────────────

describe("issuer-utils — rune API removed (#1965)", () => {
  it("does NOT export getIssuerRune (function was deleted)", () => {
    expect("getIssuerRune" in issuerUtils).toBe(false);
  });

  it("does NOT export any rune-related function by name", () => {
    const exports = Object.keys(issuerUtils);
    const runeExports = exports.filter((k) => k.toLowerCase().includes("rune"));
    expect(runeExports).toHaveLength(0);
  });

  it("IssuerMeta interface has no rune or runeName properties", () => {
    const meta = issuerUtils.getIssuerMeta("chase") as Record<string, unknown>;
    expect(meta).not.toBeNull();
    expect("rune" in meta).toBe(false);
    expect("runeName" in meta).toBe(false);
    expect("runeConnection" in meta).toBe(false);
  });
});

// ── Badge chars are initials, not rune characters ─────────────────────────────

describe("getIssuerBadgeChar — initials, not runes (#1965)", () => {
  it.each(KNOWN_ISSUER_IDS)(
    "%s badge char is ASCII initials (no runic Unicode)",
    (id) => {
      const badge = issuerUtils.getIssuerBadgeChar(id);
      expect(badge, `${id} badge should be truthy`).toBeTruthy();
      expect(containsRuneChar(badge), `${id} badge "${badge}" must not contain rune char`).toBe(false);
      // Must be ASCII letters only
      expect(/^[A-Z]+$/i.test(badge), `${id} badge "${badge}" must be ASCII letters`).toBe(true);
    }
  );
});

// ── getIssuerName returns real bank names ─────────────────────────────────────

describe("getIssuerName — real bank names (#1965)", () => {
  const expectedNames: Record<string, string> = {
    chase: "Chase",
    bank_of_america: "Bank of America",
    capital_one: "Capital One",
    wells_fargo: "Wells Fargo",
    amex: "American Express",
    citibank: "Citibank",
    discover: "Discover",
    us_bank: "US Bank",
    barclays: "Barclays",
    hsbc: "HSBC",
  };

  for (const [id, expectedName] of Object.entries(expectedNames)) {
    it(`${id} → "${expectedName}"`, () => {
      expect(issuerUtils.getIssuerName(id)).toBe(expectedName);
    });
  }

  it("no known issuer name contains a rune name word", () => {
    for (const id of KNOWN_ISSUER_IDS) {
      const name = issuerUtils.getIssuerName(id);
      for (const runeName of RUNE_NAMES) {
        expect(name, `${id} name "${name}" must not contain rune word "${runeName}"`).not.toContain(runeName);
      }
    }
  });

  it("no known issuer name contains runic Unicode characters", () => {
    for (const id of KNOWN_ISSUER_IDS) {
      const name = issuerUtils.getIssuerName(id);
      expect(containsRuneChar(name), `${id} name "${name}" must not contain runic Unicode`).toBe(false);
    }
  });
});

// ── IssuerLogo showLabel — card tile render path ──────────────────────────────

describe("IssuerLogo showLabel — card tile display (#1965)", () => {
  // These are the issuers most commonly seen on dashboard card tiles
  const tileIssuers = [
    { id: "chase", name: "Chase" },
    { id: "capital_one", name: "Capital One" },
    { id: "amex", name: "American Express" },
    { id: "wells_fargo", name: "Wells Fargo" },
    { id: "discover", name: "Discover" },
  ];

  for (const { id, name } of tileIssuers) {
    it(`${id}: showLabel renders "${name}", not a rune name`, () => {
      render(<IssuerLogo issuerId={id} showLabel />);
      const nameEl = screen.getByTestId("issuer-name");
      expect(nameEl.textContent).toBe(name);
      // Confirm no rune Unicode in the rendered name
      expect(containsRuneChar(nameEl.textContent ?? "")).toBe(false);
    });
  }

  it("issuer-name testid is present (rune-name testid is absent)", () => {
    render(<IssuerLogo issuerId="chase" showLabel />);
    expect(screen.getByTestId("issuer-name")).toBeDefined();
    expect(screen.queryByTestId("issuer-rune")).toBeNull();
    expect(screen.queryByTestId("issuer-rune-name")).toBeNull();
  });

  it("logo container title attribute shows real issuer name", () => {
    render(<IssuerLogo issuerId="capital_one" showLabel />);
    const logo = screen.getByTestId("issuer-logo");
    expect(logo.getAttribute("title")).toBe("Capital One");
    expect(containsRuneChar(logo.getAttribute("title") ?? "")).toBe(false);
  });
});
