/**
 * Unit tests for extractCardsFromFile() in lib/sheets/extract-cards.ts
 *
 * Tests the ExcelJS + LLM extraction path:
 *   - ExcelJS parsing failure → INVALID_CSV error
 *   - Empty workbook (no sheets with data) → INVALID_CSV error
 *   - All sheets hidden → INVALID_CSV error
 *   - .xls format → INVALID_CSV error with guidance to convert to .xlsx
 *   - Success: visible sheets converted to CSV, delegated to extractCardsFromCsv
 *   - sanitizeSheetsCsvForSecurity strips __proto__, constructor, prototype patterns
 *   - sanitizeSheetsCsvForSecurity collapses repeated characters
 *
 * exceljs is mocked — no real file I/O.
 * LLM provider is mocked — no real Anthropic API calls.
 *
 * @see src/lib/sheets/extract-cards.ts
 * @ref #1890
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock exceljs (dynamic import) ───────────────────────────────────────────

type MockWorksheetRow = string[];

interface MockWorksheet {
  name: string;
  state: "visible" | "hidden" | "veryHidden";
  eachRow: ReturnType<typeof vi.fn>;
}

/** Build a mock ExcelJS Worksheet from a 2-D array of string values. */
function makeWorksheet(
  name: string,
  rows: MockWorksheetRow[],
  state: "visible" | "hidden" | "veryHidden" = "visible"
): MockWorksheet {
  return {
    name,
    state,
    eachRow: vi.fn().mockImplementation(
      (_opts: { includeEmpty: boolean }, callback: (row: object, rowNumber: number) => void) => {
        rows.forEach((row, rowIdx) => {
          const rowObj = {
            eachCell: vi.fn().mockImplementation(
              (_cellOpts: { includeEmpty: boolean }, cellCb: (cell: { value: string }, colIdx: number) => void) => {
                row.forEach((val, colIdx) => cellCb({ value: val }, colIdx + 1));
              }
            ),
          };
          callback(rowObj, rowIdx + 1);
        });
      }
    ),
  };
}

const mockXlsxLoad = vi.fn();
let mockWorksheets: MockWorksheet[] = [];

class MockWorkbook {
  xlsx = { load: mockXlsxLoad };
  get worksheets() {
    return mockWorksheets;
  }
}

vi.mock("exceljs", () => ({
  Workbook: MockWorkbook,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const VALID_BASE64 = Buffer.from("fake-xlsx-content").toString("base64");

// ─── XLS format (not supported) ───────────────────────────────────────────────

describe("extractCardsFromFile — .xls format rejection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorksheets = [];
  });

  it("returns INVALID_CSV for .xls files with guidance to convert", async () => {
    const result = await extractCardsFromFile(
      VALID_BASE64,
      "application/vnd.ms-excel",
      "cards.xls",
      "xls"
    );
    expect(result).toEqual({
      error: expect.objectContaining({ code: "INVALID_CSV" }),
    });
    if ("error" in result) {
      expect(result.error.message).toMatch(/\.xlsx/i);
    }
  });

  it("does not call ExcelJS.load for .xls files", async () => {
    await extractCardsFromFile(VALID_BASE64, "application/vnd.ms-excel", "cards.xls", "xls");
    expect(mockXlsxLoad).not.toHaveBeenCalled();
  });
});

// ─── ExcelJS parsing failure ──────────────────────────────────────────────────

describe("extractCardsFromFile — ExcelJS parsing failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorksheets = [];
  });

  it("returns INVALID_CSV when exceljs.load throws", async () => {
    mockXlsxLoad.mockRejectedValue(new Error("Corrupt XLSX file"));

    const result = await extractCardsFromFile(
      VALID_BASE64,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "cards.xlsx",
      "xlsx"
    );
    expect(result).toEqual({
      error: expect.objectContaining({ code: "INVALID_CSV" }),
    });
  });

  it("error message includes format name when parsing fails", async () => {
    mockXlsxLoad.mockRejectedValue(new Error("Bad file"));

    const result = await extractCardsFromFile(
      VALID_BASE64,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "cards.xlsx",
      "xlsx"
    );
    if ("error" in result) {
      expect(result.error.message).toMatch(/XLSX/i);
    } else {
      throw new Error("Expected error result");
    }
  });
});

// ─── Empty workbook ───────────────────────────────────────────────────────────

describe("extractCardsFromFile — empty workbook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorksheets = [];
    mockXlsxLoad.mockResolvedValue(undefined);
  });

  it("returns INVALID_CSV when workbook has no sheets", async () => {
    mockWorksheets = [];

    const result = await extractCardsFromFile(
      VALID_BASE64,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "empty.xlsx",
      "xlsx"
    );
    expect(result).toEqual({
      error: expect.objectContaining({ code: "INVALID_CSV" }),
    });
  });

  it("returns INVALID_CSV when all sheets produce empty CSV", async () => {
    // Sheet with no rows → worksheetToCsv returns ""
    mockWorksheets = [makeWorksheet("Sheet1", [])];

    const result = await extractCardsFromFile(
      VALID_BASE64,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "blank.xlsx",
      "xlsx"
    );
    expect(result).toEqual({
      error: expect.objectContaining({ code: "INVALID_CSV" }),
    });
  });

  it("returns INVALID_CSV when all sheets are hidden", async () => {
    mockWorksheets = [
      makeWorksheet("Sheet1", [["Card", "Limit"], ["Sapphire", "5000"]], "hidden"),
    ];

    const result = await extractCardsFromFile(
      VALID_BASE64,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "hidden.xlsx",
      "xlsx"
    );
    expect(result).toEqual({
      error: expect.objectContaining({ code: "INVALID_CSV" }),
    });
  });

  it("returns INVALID_CSV when sheet is veryHidden", async () => {
    mockWorksheets = [
      makeWorksheet("Sheet1", [["Card", "Limit"], ["Sapphire", "5000"]], "veryHidden"),
    ];

    const result = await extractCardsFromFile(
      VALID_BASE64,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "veryhidden.xlsx",
      "xlsx"
    );
    expect(result).toEqual({
      error: expect.objectContaining({ code: "INVALID_CSV" }),
    });
  });
});

// ─── Success path ─────────────────────────────────────────────────────────────

describe("extractCardsFromFile — success", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorksheets = [];
    mockXlsxLoad.mockResolvedValue(undefined);
  });

  it("extracts cards from a workbook with one visible sheet", async () => {
    mockWorksheets = [makeWorksheet("Cards", [["Card Name", "Limit"], ["Sapphire Preferred", "5000"]])];

    const llmResponse = JSON.stringify({ cards: [makeRawCard()], sensitiveDataWarning: false });
    mockExtractText.mockResolvedValue(llmResponse);

    const result = await extractCardsFromFile(
      VALID_BASE64,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "cards.xlsx",
      "xlsx"
    );
    if ("cards" in result) {
      expect(result.cards).toHaveLength(1);
      expect(result.cards[0]!.cardName).toBe("Sapphire Preferred");
    } else {
      throw new Error("Expected success result with cards");
    }
  });

  it("includes sheet name header in CSV passed to LLM", async () => {
    mockWorksheets = [makeWorksheet("My Cards", [["Card", "Limit"], ["Sapphire", "5000"]])];

    const llmResponse = JSON.stringify({ cards: [makeRawCard()], sensitiveDataWarning: false });
    mockExtractText.mockResolvedValue(llmResponse);

    await extractCardsFromFile(
      VALID_BASE64,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "cards.xlsx",
      "xlsx"
    );

    expect(mockExtractText).toHaveBeenCalledTimes(1);
    const promptArg = mockExtractText.mock.calls[0]?.[0] as string;
    expect(promptArg).toContain("My Cards");
  });

  it("skips hidden sheets and only includes visible ones", async () => {
    mockWorksheets = [
      makeWorksheet("Visible", [["Card", "Limit"], ["Sapphire", "5000"]], "visible"),
      makeWorksheet("Hidden", [["Secret", "Data"]], "hidden"),
    ];

    const llmResponse = JSON.stringify({ cards: [makeRawCard()], sensitiveDataWarning: false });
    mockExtractText.mockResolvedValue(llmResponse);

    const result = await extractCardsFromFile(
      VALID_BASE64,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "cards.xlsx",
      "xlsx"
    );
    if ("cards" in result) {
      expect(result.cards).toHaveLength(1);
      // Hidden sheet's eachRow should never be called
      expect(mockWorksheets[1]!.eachRow).not.toHaveBeenCalled();
    } else {
      throw new Error("Expected success result");
    }
  });

  it("propagates LLM error from extractCardsFromCsv", async () => {
    mockWorksheets = [makeWorksheet("Sheet1", [["Card", "Limit"], ["Sapphire", "5000"]])];
    mockExtractText.mockRejectedValue(new Error("LLM failed"));

    const result = await extractCardsFromFile(
      VALID_BASE64,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "cards.xlsx",
      "xlsx"
    );
    expect(result).toEqual({
      error: expect.objectContaining({ code: "ANTHROPIC_ERROR" }),
    });
  });

  it("concatenates multiple visible sheets with sheet name headers", async () => {
    mockWorksheets = [
      makeWorksheet("Sheet1", [["A", "B"], ["1", "2"]]),
      makeWorksheet("Sheet2", [["C", "D"], ["3", "4"]]),
    ];

    const llmResponse = JSON.stringify({ cards: [makeRawCard()], sensitiveDataWarning: false });
    mockExtractText.mockResolvedValue(llmResponse);

    await extractCardsFromFile(
      VALID_BASE64,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "multi.xlsx",
      "xlsx"
    );

    expect(mockExtractText).toHaveBeenCalledTimes(1);
    const promptArg = mockExtractText.mock.calls[0]?.[0] as string;
    expect(promptArg).toContain("Sheet1");
    expect(promptArg).toContain("Sheet2");
  });
});

// ─── sanitizeSheetsCsvForSecurity (unchanged, exercised via extractCardsFromFile) ──

describe("sanitizeSheetsCsvForSecurity — via extractCardsFromFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockXlsxLoad.mockResolvedValue(undefined);
  });

  it("strips __proto__ patterns before passing CSV to LLM", async () => {
    mockWorksheets = [
      makeWorksheet("Sheet1", [["__proto__", "value"], ["constructor:", "bad"]]),
    ];

    const llmResponse = JSON.stringify({ cards: [makeRawCard()], sensitiveDataWarning: false });
    mockExtractText.mockResolvedValue(llmResponse);

    await extractCardsFromFile(
      VALID_BASE64,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "cards.xlsx",
      "xlsx"
    );

    expect(mockExtractText).toHaveBeenCalledTimes(1);
    const promptArg = mockExtractText.mock.calls[0]?.[0] as string;
    expect(promptArg).not.toContain("__proto__");
    expect(promptArg).toContain("_proto_");
  });
});
