/**
 * Loki QA augmentation tests — Unicode sanitization (issue #1892, MEDIUM-003)
 *
 * Supplements FiremanDecko's csv-unicode-sanitize.test.ts with:
 *   - Deprecated formatting range U+206A–U+206F (gap in prior tests)
 *   - Success path: BOM-stripped valid CSV reaches extractCardsFromCsv
 *   - Non-string guard in importFromCsv
 *
 * @ref #1892 MEDIUM-003
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/sheets/extract-cards", () => ({
  extractCardsFromCsv: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { sanitizeCsvUnicode } from "@/lib/sheets/unicode-sanitize";

// ─── Deprecated formatting characters U+206A–U+206F ───────────────────────────

describe("sanitizeCsvUnicode — deprecated formatting chars stripped", () => {
  it("strips INHIBIT SYMMETRIC SWAPPING (U+206A)", () => {
    expect(sanitizeCsvUnicode("a\u206Ab")).toBe("ab");
  });

  it("strips ACTIVATE SYMMETRIC SWAPPING (U+206B)", () => {
    expect(sanitizeCsvUnicode("a\u206Bb")).toBe("ab");
  });

  it("strips INHIBIT ARABIC FORM SHAPING (U+206C)", () => {
    expect(sanitizeCsvUnicode("a\u206Cb")).toBe("ab");
  });

  it("strips ACTIVATE ARABIC FORM SHAPING (U+206D)", () => {
    expect(sanitizeCsvUnicode("a\u206Db")).toBe("ab");
  });

  it("strips NATIONAL DIGIT SHAPES (U+206E)", () => {
    expect(sanitizeCsvUnicode("a\u206Eb")).toBe("ab");
  });

  it("strips NOMINAL DIGIT SHAPES (U+206F)", () => {
    expect(sanitizeCsvUnicode("a\u206Fb")).toBe("ab");
  });

  it("strips full deprecated formatting range U+206A–U+206F", () => {
    const input = "\u206A\u206B\u206C\u206D\u206E\u206F";
    expect(sanitizeCsvUnicode(input)).toBe("");
  });

  it("strips deprecated formatting chars embedded in field values", () => {
    const input = "Card\u206AName,Limit\u206F\nSapphire,5000";
    expect(sanitizeCsvUnicode(input)).toBe("CardName,Limit\nSapphire,5000");
  });
});

// ─── Integration: success path — BOM-stripped valid CSV is processed ──────────

describe("importFromCsv — success path after Unicode sanitization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("strips BOM and processes the remaining valid CSV", async () => {
    const { importFromCsv } = await import("@/lib/sheets/csv-import-pipeline");
    const { extractCardsFromCsv } = await import("@/lib/sheets/extract-cards");

    const mockCards = [{ id: "1", name: "Sapphire Preferred", limit: 5000 }];
    vi.mocked(extractCardsFromCsv).mockResolvedValueOnce({ cards: mockCards as never });

    // BOM-prefixed CSV — parser should strip BOM and forward clean content
    const bomCsv = "\uFEFFCard Name,Limit\nSapphire Preferred,5000";
    const result = await importFromCsv(bomCsv);

    expect(result).toEqual({ cards: mockCards });
    // extractCardsFromCsv must have been called without the BOM
    const calledWith = vi.mocked(extractCardsFromCsv).mock.calls[0][0];
    expect(calledWith.startsWith("\uFEFF")).toBe(false);
    expect(calledWith).toBe("Card Name,Limit\nSapphire Preferred,5000");
  });
});
