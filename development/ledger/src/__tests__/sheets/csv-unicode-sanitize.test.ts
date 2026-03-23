/**
 * Unit tests for lib/sheets/unicode-sanitize.ts — Fenrir Ledger
 *
 * Tests the sanitizeCsvUnicode() function:
 *   - NFC normalization defeats combining-char bypass attacks
 *   - C0 controls stripped (except tab, LF, CR)
 *   - DEL and C1 controls stripped
 *   - Zero-width / invisible chars stripped
 *   - Bidirectional overrides stripped
 *   - BOM stripped
 *   - Structural whitespace (tab, LF, CR) preserved
 *   - Printable ASCII and Unicode text preserved
 *   - Integration: importFromCsv rejects input that is only Unicode control chars
 *
 * @see src/lib/sheets/unicode-sanitize.ts
 * @ref #1892 MEDIUM-003
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Top-level mocks — hoisted before any imports by Vitest
vi.mock("@/lib/sheets/extract-cards", () => ({
  extractCardsFromCsv: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { sanitizeCsvUnicode } from "@/lib/sheets/unicode-sanitize";

// ─── sanitizeCsvUnicode — NFC normalization ───────────────────────────────────

describe("sanitizeCsvUnicode — NFC normalization", () => {
  it("normalizes NFC: combining form equals precomposed form after sanitize", () => {
    // "é" as combining sequence: e + U+0301 COMBINING ACUTE ACCENT
    const combining = "e\u0301";
    // "é" precomposed
    const precomposed = "\u00E9";
    expect(combining).not.toBe(precomposed);
    expect(sanitizeCsvUnicode(combining)).toBe(sanitizeCsvUnicode(precomposed));
  });

  it("normalizes output to NFC form", () => {
    const combining = "a\u0301b\u0300c";
    const result = sanitizeCsvUnicode(combining);
    // Result should match its own NFC form
    expect(result).toBe(result.normalize("NFC"));
  });
});

// ─── sanitizeCsvUnicode — C0 control characters ───────────────────────────────

describe("sanitizeCsvUnicode — C0 control characters stripped", () => {
  it("strips NULL (U+0000)", () => {
    expect(sanitizeCsvUnicode("Card\u0000Name")).toBe("CardName");
  });

  it("strips SOH through BS (U+0001–U+0008)", () => {
    const input = "\u0001\u0002\u0003\u0004\u0005\u0006\u0007\u0008";
    expect(sanitizeCsvUnicode(input)).toBe("");
  });

  it("preserves HT (tab, U+0009)", () => {
    expect(sanitizeCsvUnicode("a\tb")).toBe("a\tb");
  });

  it("preserves LF (U+000A)", () => {
    expect(sanitizeCsvUnicode("a\nb")).toBe("a\nb");
  });

  it("strips VT (U+000B)", () => {
    expect(sanitizeCsvUnicode("a\u000Bb")).toBe("ab");
  });

  it("strips FF (U+000C)", () => {
    expect(sanitizeCsvUnicode("a\u000Cb")).toBe("ab");
  });

  it("preserves CR (U+000D)", () => {
    expect(sanitizeCsvUnicode("a\rb")).toBe("a\rb");
  });

  it("strips SO through US (U+000E–U+001F)", () => {
    const input = "\u000E\u000F\u0010\u001F";
    expect(sanitizeCsvUnicode(input)).toBe("");
  });
});

// ─── sanitizeCsvUnicode — DEL and C1 controls ─────────────────────────────────

describe("sanitizeCsvUnicode — DEL and C1 controls stripped", () => {
  it("strips DEL (U+007F)", () => {
    expect(sanitizeCsvUnicode("a\u007Fb")).toBe("ab");
  });

  it("strips C1 control range U+0080–U+009F", () => {
    const input = "\u0080\u0090\u009F";
    expect(sanitizeCsvUnicode(input)).toBe("");
  });
});

// ─── sanitizeCsvUnicode — zero-width and invisible characters ─────────────────

describe("sanitizeCsvUnicode — zero-width / invisible chars stripped", () => {
  it("strips ZERO WIDTH SPACE (U+200B)", () => {
    expect(sanitizeCsvUnicode("Card\u200BName,Limit")).toBe("CardName,Limit");
  });

  it("strips ZERO WIDTH NON-JOINER (U+200C)", () => {
    expect(sanitizeCsvUnicode("a\u200Cb")).toBe("ab");
  });

  it("strips ZERO WIDTH JOINER (U+200D)", () => {
    expect(sanitizeCsvUnicode("a\u200Db")).toBe("ab");
  });

  it("strips LEFT-TO-RIGHT MARK (U+200E)", () => {
    expect(sanitizeCsvUnicode("\u200Ehello")).toBe("hello");
  });

  it("strips RIGHT-TO-LEFT MARK (U+200F)", () => {
    expect(sanitizeCsvUnicode("\u200Fhello")).toBe("hello");
  });

  it("strips BOM / ZERO WIDTH NO-BREAK SPACE (U+FEFF)", () => {
    expect(sanitizeCsvUnicode("\uFEFFCard,Limit\nSapphire,5000")).toBe("Card,Limit\nSapphire,5000");
  });

  it("strips invisible operator chars U+2060–U+2064", () => {
    const input = "\u2060\u2061\u2062\u2063\u2064";
    expect(sanitizeCsvUnicode(input)).toBe("");
  });

  it("strips interlinear annotation chars U+FFF9–U+FFFB", () => {
    const input = "\uFFF9\uFFFA\uFFFB";
    expect(sanitizeCsvUnicode(input)).toBe("");
  });
});

// ─── sanitizeCsvUnicode — bidirectional overrides ─────────────────────────────

describe("sanitizeCsvUnicode — bidirectional overrides stripped", () => {
  it("strips LEFT-TO-RIGHT EMBEDDING (U+202A)", () => {
    expect(sanitizeCsvUnicode("a\u202Ab")).toBe("ab");
  });

  it("strips RIGHT-TO-LEFT EMBEDDING (U+202B)", () => {
    expect(sanitizeCsvUnicode("a\u202Bb")).toBe("ab");
  });

  it("strips RIGHT-TO-LEFT OVERRIDE (U+202E)", () => {
    // Classic bidi attack character
    expect(sanitizeCsvUnicode("evil\u202Econtent")).toBe("evilcontent");
  });

  it("strips full bidi override range U+202A–U+202E", () => {
    const input = "\u202A\u202B\u202C\u202D\u202E";
    expect(sanitizeCsvUnicode(input)).toBe("");
  });
});

// ─── sanitizeCsvUnicode — content preservation ────────────────────────────────

describe("sanitizeCsvUnicode — valid content preserved", () => {
  it("preserves printable ASCII CSV", () => {
    const csv = "Card Name,Limit,Open Date\nSapphire Preferred,5000,2025-01-01";
    expect(sanitizeCsvUnicode(csv)).toBe(csv);
  });

  it("preserves non-ASCII Unicode letters (e.g. accented, CJK)", () => {
    const csv = "Carte,Límite\nVisà,5000";
    const result = sanitizeCsvUnicode(csv);
    // Should preserve the text (possibly NFC-normalized, which is equivalent)
    expect(result.normalize("NFC")).toBe(csv.normalize("NFC"));
  });

  it("preserves tab-delimited CSV", () => {
    const csv = "Name\tLimit\nSapphire\t5000";
    expect(sanitizeCsvUnicode(csv)).toBe(csv);
  });

  it("preserves CRLF line endings", () => {
    const csv = "Name,Limit\r\nSapphire,5000";
    expect(sanitizeCsvUnicode(csv)).toBe(csv);
  });

  it("preserves empty string", () => {
    expect(sanitizeCsvUnicode("")).toBe("");
  });
});

// ─── sanitizeCsvUnicode — bypass attack scenarios ─────────────────────────────

describe("sanitizeCsvUnicode — bypass attack scenarios", () => {
  it("BOM-padded input is stripped to real content", () => {
    // Attacker sends BOM + legible CSV to try to confuse parsers
    const input = "\uFEFFCard,Limit\nSapphire,5000";
    expect(sanitizeCsvUnicode(input)).toBe("Card,Limit\nSapphire,5000");
  });

  it("zero-width padding does not pad content length past minimum", () => {
    // Attacker sends only zero-width chars to pass MIN_CSV_LENGTH check
    const zwspPadded = "\u200B".repeat(20);
    const result = sanitizeCsvUnicode(zwspPadded);
    expect(result).toBe("");
    expect(result.trim().length).toBe(0);
  });

  it("mixed control and visible chars: controls stripped, content preserved", () => {
    const input = "Card\u0000,\u200BLimit\u202E\nSapphire\uFEFF,5000";
    expect(sanitizeCsvUnicode(input)).toBe("Card,Limit\nSapphire,5000");
  });

  it("right-to-left override stripped from middle of field", () => {
    // U+202E can reverse displayed text — must be stripped
    const input = "Card,Limit\nSapphire,\u202E0005";
    expect(sanitizeCsvUnicode(input)).toBe("Card,Limit\nSapphire,0005");
  });
});

// ─── Integration: importFromCsv rejects pure-control-char input ───────────────

describe("importFromCsv — Unicode bypass rejection (integration)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects input consisting only of zero-width spaces (bypass attempt)", async () => {
    const { importFromCsv } = await import("@/lib/sheets/csv-import-pipeline");
    const { extractCardsFromCsv } = await import("@/lib/sheets/extract-cards");

    // 20 zero-width spaces — enough raw chars to pass MIN_CSV_LENGTH if not stripped
    const bypassAttempt = "\u200B".repeat(20);
    const result = await importFromCsv(bypassAttempt);

    expect(result).toEqual({
      error: expect.objectContaining({ code: "INVALID_CSV" }),
    });
    expect(extractCardsFromCsv).not.toHaveBeenCalled();
  });

  it("rejects input consisting only of BOM characters", async () => {
    const { importFromCsv } = await import("@/lib/sheets/csv-import-pipeline");
    const { extractCardsFromCsv } = await import("@/lib/sheets/extract-cards");

    const bypassAttempt = "\uFEFF".repeat(15);
    const result = await importFromCsv(bypassAttempt);

    expect(result).toEqual({
      error: expect.objectContaining({ code: "INVALID_CSV" }),
    });
    expect(extractCardsFromCsv).not.toHaveBeenCalled();
  });
});
