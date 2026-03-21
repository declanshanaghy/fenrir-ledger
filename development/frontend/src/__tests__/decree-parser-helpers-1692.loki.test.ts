/**
 * decree-parser-helpers-1692.loki.test.ts
 *
 * Loki QA — Issue #1692: validate extracted helper functions from decree-parser.ts.
 * Tests target the refactored helpers directly: normalisePr, extractSummary,
 * parseCheckLine, extractCanonicalChecks, parseSealLine.
 */

import { describe, it, expect } from "vitest";
import {
  normalisePr,
  extractSummary,
  parseCheckLine,
  extractCanonicalChecks,
  parseSealLine,
} from "@/lib/decree-parser";

// ── normalisePr ───────────────────────────────────────────────────────────────

describe("normalisePr", () => {
  it("returns null for null input", () => {
    expect(normalisePr(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalisePr("")).toBeNull();
  });

  it("returns null for 'N/A'", () => {
    expect(normalisePr("N/A")).toBeNull();
  });

  it("returns null for 'none'", () => {
    expect(normalisePr("none")).toBeNull();
  });

  it("returns null for '-'", () => {
    expect(normalisePr("-")).toBeNull();
  });

  it("returns valid URL unchanged", () => {
    const url = "https://github.com/declanshanaghy/fenrir-ledger/pull/1715";
    expect(normalisePr(url)).toBe(url);
  });

  it("returns PR hash reference unchanged", () => {
    expect(normalisePr("#1715")).toBe("#1715");
  });
});

// ── extractSummary ────────────────────────────────────────────────────────────

describe("extractSummary", () => {
  it("returns empty array when SUMMARY section is absent", () => {
    const body = "ISSUE: #1\nVERDICT: DONE\n";
    expect(extractSummary(body)).toEqual([]);
  });

  it("returns empty array when SUMMARY section has no bullet lines", () => {
    const body = "SUMMARY:\nCHECKS:\n- tsc: PASS\n";
    expect(extractSummary(body)).toEqual([]);
  });

  it("extracts dash-bulleted items", () => {
    const body = "SUMMARY:\n- First item\n- Second item\nCHECKS:\n";
    expect(extractSummary(body)).toEqual(["First item", "Second item"]);
  });

  it("extracts asterisk-bulleted items", () => {
    const body = "SUMMARY:\n* Alpha\n* Beta\nCHECKS:\n";
    expect(extractSummary(body)).toEqual(["Alpha", "Beta"]);
  });

  it("strips leading whitespace and bullet chars from items", () => {
    const body = "SUMMARY:\n  - Indented item\n  * Also indented\nCHECKS:\n";
    expect(extractSummary(body)).toEqual(["Indented item", "Also indented"]);
  });

  it("stops collecting at the CHECKS section boundary", () => {
    const body = "SUMMARY:\n- Only this\nCHECKS:\n- tsc: PASS\n";
    const result = extractSummary(body);
    expect(result).toEqual(["Only this"]);
  });

  it("handles single bullet point", () => {
    const body = "SUMMARY:\n- One thing done\n";
    expect(extractSummary(body)).toEqual(["One thing done"]);
  });
});

// ── parseCheckLine ────────────────────────────────────────────────────────────

describe("parseCheckLine", () => {
  it("parses colon-separated 'name: result' line", () => {
    expect(parseCheckLine("tsc: PASS")).toEqual({ name: "tsc", result: "PASS" });
  });

  it("parses build check", () => {
    expect(parseCheckLine("build: FAIL")).toEqual({ name: "build", result: "FAIL" });
  });

  it("parses multi-word result after colon", () => {
    expect(parseCheckLine("vitest: 42 tests, all passing")).toEqual({
      name: "vitest",
      result: "42 tests, all passing",
    });
  });

  it("returns bare entry with empty result when no colon present", () => {
    expect(parseCheckLine("manually verified")).toEqual({
      name: "manually verified",
      result: "",
    });
  });

  it("trims whitespace from name and result", () => {
    expect(parseCheckLine("  tsc  :  PASS  ")).toEqual({ name: "tsc", result: "PASS" });
  });

  it("handles colon in result value", () => {
    // Only first colon splits name from result
    expect(parseCheckLine("playwright: 3 tests: 1 FAIL")).toEqual({
      name: "playwright",
      result: "3 tests: 1 FAIL",
    });
  });
});

// ── extractCanonicalChecks ────────────────────────────────────────────────────

describe("extractCanonicalChecks", () => {
  it("returns empty array when CHECKS section is absent", () => {
    const body = "ISSUE: #1\nVERDICT: DONE\n";
    expect(extractCanonicalChecks(body)).toEqual([]);
  });

  it("returns empty array when CHECKS section has no entries", () => {
    const body = "CHECKS:\nSEAL: Loki · ᛚᛟᚲᛁ · QA Tester\n";
    expect(extractCanonicalChecks(body)).toEqual([]);
  });

  it("extracts multiple check entries", () => {
    const body = "CHECKS:\n- tsc: PASS\n- build: PASS\nSEAL: Loki · ᛚᛟᚲᛁ · QA Tester\n";
    const checks = extractCanonicalChecks(body);
    expect(checks).toHaveLength(2);
    expect(checks[0]).toEqual({ name: "tsc", result: "PASS" });
    expect(checks[1]).toEqual({ name: "build", result: "PASS" });
  });

  it("stops at SEAL boundary", () => {
    const body = "CHECKS:\n- tsc: PASS\nSEAL: FiremanDecko · ᚠᛁᚱᛖᛗᚨᚾᛞᛖᚲᚲᛟ · Principal Engineer\n";
    const checks = extractCanonicalChecks(body);
    expect(checks).toHaveLength(1);
    expect(checks[0]).toEqual({ name: "tsc", result: "PASS" });
  });

  it("stops at SIGNOFF boundary", () => {
    const body = "CHECKS:\n- build: PASS\nSIGNOFF: Forged in fire\n";
    const checks = extractCanonicalChecks(body);
    expect(checks).toHaveLength(1);
    expect(checks[0]).toEqual({ name: "build", result: "PASS" });
  });

  it("stops at END DECREE rune boundary", () => {
    const body = "CHECKS:\n- vitest: 69 tests\n᛭᛭᛭ END DECREE ᛭᛭᛭\n";
    const checks = extractCanonicalChecks(body);
    expect(checks).toHaveLength(1);
    expect(checks[0]).toEqual({ name: "vitest", result: "69 tests" });
  });

  it("handles bare check entries (no colon) — result is empty string", () => {
    const body = "CHECKS:\n- manually validated\nSEAL: Loki · ᛚᛟᚲᛁ · QA Tester\n";
    const checks = extractCanonicalChecks(body);
    expect(checks).toHaveLength(1);
    expect(checks[0]).toEqual({ name: "manually validated", result: "" });
  });
});

// ── parseSealLine ─────────────────────────────────────────────────────────────

describe("parseSealLine", () => {
  it("returns all null for null input", () => {
    expect(parseSealLine(null)).toEqual({
      sealAgent: null,
      sealRunes: null,
      sealTitle: null,
    });
  });

  it("handles 1-part seal (agent name only)", () => {
    expect(parseSealLine("Loki")).toEqual({
      sealAgent: "Loki",
      sealRunes: null,
      sealTitle: null,
    });
  });

  it("handles 2-part seal (agent + runes, no title)", () => {
    expect(parseSealLine("Loki · ᛚᛟᚲᛁ")).toEqual({
      sealAgent: "Loki",
      sealRunes: "ᛚᛟᚲᛁ",
      sealTitle: null,
    });
  });

  it("handles 3-part seal (agent + runes + title)", () => {
    expect(parseSealLine("Loki · ᛚᛟᚲᛁ · QA Tester")).toEqual({
      sealAgent: "Loki",
      sealRunes: "ᛚᛟᚲᛁ",
      sealTitle: "QA Tester",
    });
  });

  it("handles 4-part seal — 4th part is ignored, title is 3rd", () => {
    expect(parseSealLine("Freya · ᚠᚱᛖᚤᚨ · Product Owner · Extra")).toEqual({
      sealAgent: "Freya",
      sealRunes: "ᚠᚱᛖᚤᚨ",
      sealTitle: "Product Owner",
    });
  });

  it("trims whitespace around each part", () => {
    expect(parseSealLine("  FiremanDecko  ·  ᚠᛁᚱᛖᛗᚨᚾᛞᛖᚲᚲᛟ  ·  Principal Engineer  ")).toEqual({
      sealAgent: "FiremanDecko",
      sealRunes: "ᚠᛁᚱᛖᛗᚨᚾᛞᛖᚲᚲᛟ",
      sealTitle: "Principal Engineer",
    });
  });

  it("handles FiremanDecko seal correctly", () => {
    expect(parseSealLine("FiremanDecko · ᚠᛁᚱᛖᛗᚨᚾᛞᛖᚲᚲᛟ · Principal Engineer")).toEqual({
      sealAgent: "FiremanDecko",
      sealRunes: "ᚠᛁᚱᛖᛗᚨᚾᛞᛖᚲᚲᛟ",
      sealTitle: "Principal Engineer",
    });
  });
});
