/**
 * Targeted tests for extractCardsFromFile — cell value type branches and
 * sanitize patterns NOT covered by extract-cards-file.test.ts.
 *
 * Covers:
 *   - cellValueToString: number, boolean, Date, null, RichText, Formula, Hyperlink, Error
 *   - quoteCsvField: comma / newline / double-quote quoting
 *   - sanitizeSheetsCsvForSecurity: constructor: pattern, prototype: pattern, ReDoS truncation
 *
 * All tested via the public extractCardsFromFile() API using worksheet mocks
 * that inject specific ExcelJS CellValue types into eachCell callbacks.
 *
 * @ref #1890
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── ExcelJS mock setup ───────────────────────────────────────────────────────

type CellValue =
  | null
  | string
  | number
  | boolean
  | Date
  | { formula: string; result?: CellValue }
  | { sharedFormula: string; result?: CellValue }
  | { richText: { text: string }[] }
  | { text: string; hyperlink: string }
  | { error: string };

interface MockCell {
  value: CellValue;
}

interface MockRow {
  cells: MockCell[];
}

interface MockWorksheetFull {
  name: string;
  state: "visible" | "hidden" | "veryHidden";
  rows: MockRow[];
  eachRow: ReturnType<typeof vi.fn>;
}

function makeWorksheetWithCells(
  name: string,
  rows: MockCell[][],
  state: "visible" | "hidden" | "veryHidden" = "visible"
): MockWorksheetFull {
  return {
    name,
    state,
    rows: rows.map((cells) => ({ cells })),
    eachRow: vi.fn().mockImplementation(
      (_opts: { includeEmpty: boolean }, callback: (row: object, rowNumber: number) => void) => {
        rows.forEach((cells, rowIdx) => {
          const rowObj = {
            eachCell: vi.fn().mockImplementation(
              (
                _cellOpts: { includeEmpty: boolean },
                cellCb: (cell: MockCell, colIdx: number) => void
              ) => {
                cells.forEach((cell, colIdx) => cellCb(cell, colIdx + 1));
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
let mockWorksheets: MockWorksheetFull[] = [];

class MockWorkbook {
  xlsx = { load: mockXlsxLoad };
  get worksheets() {
    return mockWorksheets;
  }
}

vi.mock("exceljs", () => ({
  Workbook: MockWorkbook,
}));

// ─── LLM mock ─────────────────────────────────────────────────────────────────

const mockExtractText = vi.fn<() => Promise<string>>();

vi.mock("@/lib/llm/extract", () => ({
  getLlmProvider: () => ({
    name: "anthropic",
    model: "claude-test",
    extractText: mockExtractText,
  }),
}));

vi.mock("@/lib/sheets/prompt", () => ({
  buildExtractionPrompt: (csv: string) => csv,
  sanitizeCsvForPrompt: (csv: string) => csv,
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { extractCardsFromFile } from "@/lib/sheets/extract-cards";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_BASE64 = Buffer.from("fake-xlsx-content").toString("base64");
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

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

function successLlm() {
  mockExtractText.mockResolvedValue(
    JSON.stringify({ cards: [makeRawCard()], sensitiveDataWarning: false })
  );
}

/** Call extractCardsFromFile and return the CSV string passed to LLM. */
async function getCsvPassedToLlm(): Promise<string> {
  expect(mockExtractText).toHaveBeenCalledTimes(1);
  return mockExtractText.mock.calls[0]![0] as string;
}

// ─── cellValueToString: primitive types ──────────────────────────────────────

describe("cellValueToString — primitive types via worksheet cells", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockXlsxLoad.mockResolvedValue(undefined);
    successLlm();
  });

  it("converts number cell to plain digit string (no quoting)", async () => {
    mockWorksheets = [makeWorksheetWithCells("Sheet1", [[{ value: 42 }, { value: 100.5 }]])];
    await extractCardsFromFile(VALID_BASE64, XLSX_MIME, "cards.xlsx", "xlsx");
    const csv = await getCsvPassedToLlm();
    expect(csv).toContain("42");
    expect(csv).toContain("100.5");
  });

  it("converts boolean true/false to string", async () => {
    mockWorksheets = [
      makeWorksheetWithCells("Sheet1", [[{ value: true }, { value: false }]]),
    ];
    await extractCardsFromFile(VALID_BASE64, XLSX_MIME, "cards.xlsx", "xlsx");
    const csv = await getCsvPassedToLlm();
    expect(csv).toContain("true");
    expect(csv).toContain("false");
  });

  it("converts null cell to empty string (two commas adjacent)", async () => {
    mockWorksheets = [
      makeWorksheetWithCells("Sheet1", [[{ value: "A" }, { value: null }, { value: "B" }]]),
    ];
    await extractCardsFromFile(VALID_BASE64, XLSX_MIME, "cards.xlsx", "xlsx");
    const csv = await getCsvPassedToLlm();
    // null produces "" so row should be "A,,B"
    expect(csv).toContain("A,,B");
  });

  it("converts Date cell to ISO string", async () => {
    const d = new Date("2025-06-15T00:00:00.000Z");
    mockWorksheets = [makeWorksheetWithCells("Sheet1", [[{ value: d }]])];
    await extractCardsFromFile(VALID_BASE64, XLSX_MIME, "cards.xlsx", "xlsx");
    const csv = await getCsvPassedToLlm();
    expect(csv).toContain("2025-06-15T00:00:00.000Z");
  });
});

// ─── cellValueToString: complex ExcelJS types ─────────────────────────────────

describe("cellValueToString — complex ExcelJS cell types", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockXlsxLoad.mockResolvedValue(undefined);
    successLlm();
  });

  it("extracts result from formula cell", async () => {
    mockWorksheets = [
      makeWorksheetWithCells("Sheet1", [[{ value: { formula: "=A1+B1", result: 99 } }]]),
    ];
    await extractCardsFromFile(VALID_BASE64, XLSX_MIME, "cards.xlsx", "xlsx");
    const csv = await getCsvPassedToLlm();
    expect(csv).toContain("99");
  });

  it("extracts result from sharedFormula cell", async () => {
    mockWorksheets = [
      makeWorksheetWithCells("Sheet1", [
        [{ value: { sharedFormula: "=C1", result: "Chase Sapphire" } }],
      ]),
    ];
    await extractCardsFromFile(VALID_BASE64, XLSX_MIME, "cards.xlsx", "xlsx");
    const csv = await getCsvPassedToLlm();
    expect(csv).toContain("Chase Sapphire");
  });

  it("joins richText runs into a single string", async () => {
    mockWorksheets = [
      makeWorksheetWithCells("Sheet1", [
        [{ value: { richText: [{ text: "Sapphire " }, { text: "Preferred" }] } }],
      ]),
    ];
    await extractCardsFromFile(VALID_BASE64, XLSX_MIME, "cards.xlsx", "xlsx");
    const csv = await getCsvPassedToLlm();
    expect(csv).toContain("Sapphire Preferred");
  });

  it("extracts display text from hyperlink cell", async () => {
    mockWorksheets = [
      makeWorksheetWithCells("Sheet1", [
        [{ value: { text: "Chase Portal", hyperlink: "https://chase.com" } }],
      ]),
    ];
    await extractCardsFromFile(VALID_BASE64, XLSX_MIME, "cards.xlsx", "xlsx");
    const csv = await getCsvPassedToLlm();
    expect(csv).toContain("Chase Portal");
  });

  it("converts error cell value to empty string", async () => {
    mockWorksheets = [
      makeWorksheetWithCells("Sheet1", [
        [{ value: "Header" }, { value: { error: "#REF!" } }, { value: "After" }],
      ]),
    ];
    await extractCardsFromFile(VALID_BASE64, XLSX_MIME, "cards.xlsx", "xlsx");
    const csv = await getCsvPassedToLlm();
    // Error cell → "" so: "Header,,After"
    expect(csv).toContain("Header,,After");
  });

  it("returns empty string for formula cell with no result", async () => {
    mockWorksheets = [
      makeWorksheetWithCells("Sheet1", [
        [{ value: "A" }, { value: { formula: "=IFERROR(X1,'')" } }, { value: "B" }],
      ]),
    ];
    await extractCardsFromFile(VALID_BASE64, XLSX_MIME, "cards.xlsx", "xlsx");
    const csv = await getCsvPassedToLlm();
    // formula with no result → "" so: "A,,B"
    expect(csv).toContain("A,,B");
  });
});

// ─── quoteCsvField — quoting rules ────────────────────────────────────────────

describe("quoteCsvField — CSV quoting rules (via worksheet cells)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockXlsxLoad.mockResolvedValue(undefined);
    successLlm();
  });

  it("quotes string cells containing a comma", async () => {
    mockWorksheets = [
      makeWorksheetWithCells("Sheet1", [[{ value: "Visa, Mastercard" }]]),
    ];
    await extractCardsFromFile(VALID_BASE64, XLSX_MIME, "cards.xlsx", "xlsx");
    const csv = await getCsvPassedToLlm();
    expect(csv).toContain('"Visa, Mastercard"');
  });

  it("quotes string cells containing a newline", async () => {
    mockWorksheets = [
      makeWorksheetWithCells("Sheet1", [[{ value: "Line1\nLine2" }]]),
    ];
    await extractCardsFromFile(VALID_BASE64, XLSX_MIME, "cards.xlsx", "xlsx");
    const csv = await getCsvPassedToLlm();
    expect(csv).toContain('"Line1\nLine2"');
  });

  it("escapes double-quotes within a quoted field", async () => {
    mockWorksheets = [
      makeWorksheetWithCells("Sheet1", [[{ value: 'He said "hello"' }]]),
    ];
    await extractCardsFromFile(VALID_BASE64, XLSX_MIME, "cards.xlsx", "xlsx");
    const csv = await getCsvPassedToLlm();
    expect(csv).toContain('"He said ""hello"""');
  });

  it("does not quote plain alphanumeric strings", async () => {
    mockWorksheets = [makeWorksheetWithCells("Sheet1", [[{ value: "Sapphire" }]])];
    await extractCardsFromFile(VALID_BASE64, XLSX_MIME, "cards.xlsx", "xlsx");
    const csv = await getCsvPassedToLlm();
    // Should appear without surrounding quotes
    expect(csv).toContain("Sapphire");
    expect(csv).not.toContain('"Sapphire"');
  });
});

// ─── sanitizeSheetsCsvForSecurity — additional patterns ───────────────────────

describe("sanitizeSheetsCsvForSecurity — constructor/prototype/ReDoS patterns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockXlsxLoad.mockResolvedValue(undefined);
    successLlm();
  });

  it("neutralises constructor: pattern before passing to LLM", async () => {
    mockWorksheets = [
      makeWorksheetWithCells("Sheet1", [
        [{ value: "constructor: bad" }, { value: "value" }],
      ]),
    ];
    await extractCardsFromFile(VALID_BASE64, XLSX_MIME, "cards.xlsx", "xlsx");
    const csv = await getCsvPassedToLlm();
    expect(csv).not.toContain("constructor:");
    expect(csv).toContain("constructor_");
  });

  it("neutralises prototype: pattern before passing to LLM", async () => {
    mockWorksheets = [
      makeWorksheetWithCells("Sheet1", [
        [{ value: "prototype: danger" }, { value: "value" }],
      ]),
    ];
    await extractCardsFromFile(VALID_BASE64, XLSX_MIME, "cards.xlsx", "xlsx");
    const csv = await getCsvPassedToLlm();
    expect(csv).not.toContain("prototype:");
    expect(csv).toContain("prototype_");
  });

  it("truncates sequences of 50+ identical characters (ReDoS protection)", async () => {
    const longRepeat = "a".repeat(100); // 100 identical 'a' chars
    mockWorksheets = [
      makeWorksheetWithCells("Sheet1", [[{ value: longRepeat }]]),
    ];
    await extractCardsFromFile(VALID_BASE64, XLSX_MIME, "cards.xlsx", "xlsx");
    const csv = await getCsvPassedToLlm();
    // Should be truncated to max 50 identical chars
    expect(csv).not.toContain("a".repeat(51));
    expect(csv).toContain("a".repeat(50));
  });

  it("does NOT truncate sequences of exactly 49 identical characters", async () => {
    const borderline = "b".repeat(49);
    mockWorksheets = [
      makeWorksheetWithCells("Sheet1", [[{ value: borderline }]]),
    ];
    await extractCardsFromFile(VALID_BASE64, XLSX_MIME, "cards.xlsx", "xlsx");
    const csv = await getCsvPassedToLlm();
    expect(csv).toContain("b".repeat(49));
  });
});
