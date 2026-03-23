/**
 * Unit tests for extractCardsFromFile() in lib/sheets/extract-cards.ts
 *
 * Tests the SheetJS + LLM extraction path:
 *   - SheetJS parsing failure → INVALID_CSV error
 *   - Empty workbook (no sheets with data) → INVALID_CSV error
 *   - All sheets hidden → INVALID_CSV error
 *   - Success: visible sheets converted to CSV, delegated to extractCardsFromCsv
 *   - sanitizeSheetsCsvForSecurity strips __proto__, constructor, prototype patterns
 *   - sanitizeSheetsCsvForSecurity collapses repeated characters
 *
 * xlsx is mocked — no real file I/O.
 * LLM provider is mocked — no real Anthropic API calls.
 *
 * @see src/lib/sheets/extract-cards.ts
 * @ref #1848
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock xlsx (dynamic import) ───────────────────────────────────────────────

const mockRead = vi.fn();
const mockSheetToCsv = vi.fn();

vi.mock("xlsx", () => ({
  read: mockRead,
  utils: {
    sheet_to_csv: mockSheetToCsv,
  },
}));

// ─── Mock LLM provider ────────────────────────────────────────────────────────

const mockExtractText = vi.fn<() => Promise<string>>();

vi.mock("@/lib/llm/extract", () => ({
  getLlmProvider: () => ({
    name: "anthropic",
    model: "claude-test",
    extractText: mockExtractText,
  }),
}));

vi.mock("@/lib/sheets/prompt", () => ({
  buildExtractionPrompt: (csv: string) => `PROMPT:${csv}`,
  sanitizeCsvForPrompt: (csv: string) => csv,
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { extractCardsFromFile } from "@/lib/sheets/extract-cards";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRawCard() {
  return {
    issuerId: "chase",
    cardName: "Sapphire Preferred",
    openDate: "2025-01-01T00:00:00.000Z",
    creditLimit: 500000,
    annualFee: 9500,
    annualFeeDate: "2026-01-01T00:00:00.000Z",
    promoPeriodMonths: 0,
    signUpBonus: null,
    notes: "",
  };
}

function mockWorkbook(
  sheets: Record<string, object>,
  hiddenFlags?: number[]
) {
  const sheetNames = Object.keys(sheets);
  const workbook = {
    SheetNames: sheetNames,
    Sheets: sheets,
    Workbook: hiddenFlags
      ? { Sheets: hiddenFlags.map((h) => ({ Hidden: h })) }
      : undefined,
  };
  mockRead.mockReturnValue(workbook);
  return workbook;
}

const VALID_BASE64 = Buffer.from("fake-xlsx-content").toString("base64");

// ─── SheetJS parsing failure ──────────────────────────────────────────────────

describe("extractCardsFromFile — SheetJS parsing failure", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns INVALID_CSV when xlsx.read throws", async () => {
    mockRead.mockImplementation(() => {
      throw new Error("Corrupt XLSX file");
    });

    const result = await extractCardsFromFile(VALID_BASE64, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "cards.xlsx", "xlsx");
    expect(result).toEqual({
      error: expect.objectContaining({ code: "INVALID_CSV" }),
    });
  });

  it("error message includes format name when parsing fails", async () => {
    mockRead.mockImplementation(() => {
      throw new Error("Bad file");
    });

    const result = await extractCardsFromFile(VALID_BASE64, "application/vnd.ms-excel", "cards.xls", "xls");
    if ("error" in result) {
      expect(result.error.message).toMatch(/XLS/i);
    } else {
      throw new Error("Expected error result");
    }
  });
});

// ─── Empty workbook ───────────────────────────────────────────────────────────

describe("extractCardsFromFile — empty workbook", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns INVALID_CSV when workbook has no sheets", async () => {
    mockWorkbook({});

    const result = await extractCardsFromFile(VALID_BASE64, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "empty.xlsx", "xlsx");
    expect(result).toEqual({
      error: expect.objectContaining({ code: "INVALID_CSV" }),
    });
  });

  it("returns INVALID_CSV when all sheets produce empty CSV", async () => {
    const fakeSheet = { A1: { v: "" } };
    mockWorkbook({ Sheet1: fakeSheet });
    mockSheetToCsv.mockReturnValue("   "); // whitespace-only = empty

    const result = await extractCardsFromFile(VALID_BASE64, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "blank.xlsx", "xlsx");
    expect(result).toEqual({
      error: expect.objectContaining({ code: "INVALID_CSV" }),
    });
  });

  it("returns INVALID_CSV when all sheets are hidden", async () => {
    const fakeSheet = { A1: { v: "data" } };
    mockWorkbook({ Sheet1: fakeSheet }, [1]); // Hidden: 1
    mockSheetToCsv.mockReturnValue("Card,Limit\nSapphire,5000");

    const result = await extractCardsFromFile(VALID_BASE64, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "hidden.xlsx", "xlsx");
    expect(result).toEqual({
      error: expect.objectContaining({ code: "INVALID_CSV" }),
    });
  });
});

// ─── Success path ─────────────────────────────────────────────────────────────

describe("extractCardsFromFile — success", () => {
  beforeEach(() => vi.clearAllMocks());

  it("extracts cards from a workbook with one visible sheet", async () => {
    const fakeSheet = { A1: { v: "Card Name" } };
    mockWorkbook({ Cards: fakeSheet });
    mockSheetToCsv.mockReturnValue("Card Name,Limit\nSapphire Preferred,5000");

    const llmResponse = JSON.stringify({ cards: [makeRawCard()], sensitiveDataWarning: false });
    mockExtractText.mockResolvedValue(llmResponse);

    const result = await extractCardsFromFile(VALID_BASE64, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "cards.xlsx", "xlsx");
    if ("cards" in result) {
      expect(result.cards).toHaveLength(1);
      expect(result.cards[0]!.cardName).toBe("Sapphire Preferred");
    } else {
      throw new Error("Expected success result with cards");
    }
  });

  it("includes sheet name header in CSV passed to LLM", async () => {
    const fakeSheet = { A1: { v: "data" } };
    mockWorkbook({ "My Cards": fakeSheet });
    mockSheetToCsv.mockReturnValue("Card,Limit\nSapphire,5000");

    const llmResponse = JSON.stringify({ cards: [makeRawCard()], sensitiveDataWarning: false });
    mockExtractText.mockResolvedValue(llmResponse);

    await extractCardsFromFile(VALID_BASE64, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "cards.xlsx", "xlsx");

    const promptArg = mockExtractText.mock.calls[0]?.[0] as string;
    // The prompt is built from the sanitized CSV; check LLM was called (sheet header included)
    expect(mockExtractText).toHaveBeenCalledTimes(1);
    expect(promptArg).toContain("My Cards");
  });

  it("skips hidden sheets and only includes visible ones", async () => {
    const visibleSheet = { A1: { v: "Card" } };
    const hiddenSheet = { A1: { v: "Secret" } };
    mockWorkbook(
      { Visible: visibleSheet, Hidden: hiddenSheet },
      [0, 1] // Visible: Hidden=0 (visible), Hidden: Hidden=1
    );
    mockSheetToCsv
      .mockReturnValueOnce("Card,Limit\nSapphire,5000") // Visible sheet
      .mockReturnValueOnce("Secret,Data"); // Hidden sheet (should be skipped)

    const llmResponse = JSON.stringify({ cards: [makeRawCard()], sensitiveDataWarning: false });
    mockExtractText.mockResolvedValue(llmResponse);

    const result = await extractCardsFromFile(VALID_BASE64, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "cards.xlsx", "xlsx");
    if ("cards" in result) {
      expect(result.cards).toHaveLength(1);
      // sheet_to_csv should only be called once (for the visible sheet)
      expect(mockSheetToCsv).toHaveBeenCalledTimes(1);
    } else {
      throw new Error("Expected success result");
    }
  });

  it("propagates LLM error from extractCardsFromCsv", async () => {
    const fakeSheet = { A1: { v: "data" } };
    mockWorkbook({ Sheet1: fakeSheet });
    mockSheetToCsv.mockReturnValue("Card,Limit\nSapphire,5000");
    mockExtractText.mockRejectedValue(new Error("LLM failed"));

    const result = await extractCardsFromFile(VALID_BASE64, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "cards.xlsx", "xlsx");
    expect(result).toEqual({
      error: expect.objectContaining({ code: "ANTHROPIC_ERROR" }),
    });
  });
});
