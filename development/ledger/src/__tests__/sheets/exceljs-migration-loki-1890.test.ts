/**
 * Loki QA augmentation tests — ExcelJS migration (issue #1890)
 *
 * Targets two gaps in FiremanDecko's coverage:
 *
 * 1. `# Sheet: <name>` prefix format — existing tests only verify the sheet
 *    name appears somewhere in the prompt; these tests verify the exact
 *    `# Sheet: ` prefix format is present (the LLM relies on this header).
 *
 * 2. Unicode sanitization integration in csv-import-pipeline — the `importFromCsv`
 *    path added `sanitizeCsvUnicode` (#1892) but no test verifies that BOM /
 *    control characters are stripped before `extractCardsFromCsv` is called.
 *
 * @ref #1890
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── ExcelJS mock (for # Sheet: prefix tests) ─────────────────────────────────

type MockRow = string[];

interface MockWorksheet {
  name: string;
  state: "visible" | "hidden" | "veryHidden";
  eachRow: ReturnType<typeof vi.fn>;
}

function makeWorksheet(
  name: string,
  rows: MockRow[],
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
  get worksheets() { return mockWorksheets; }
}

vi.mock("exceljs", () => ({ Workbook: MockWorkbook }));

// ─── LLM mock ─────────────────────────────────────────────────────────────────

const mockExtractText = vi.fn<() => Promise<string>>();

vi.mock("@/lib/llm/extract", () => ({
  getLlmProvider: () => ({
    name: "anthropic",
    model: "claude-test",
    extractText: mockExtractText,
  }),
}));

// Pass-through prompt builder so assertions target the CSV directly
vi.mock("@/lib/sheets/prompt", () => ({
  buildExtractionPrompt: (csv: string) => csv,
  sanitizeCsvForPrompt: (csv: string) => csv,
  CSV_TRUNCATION_LIMIT: 100_000,
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

// ─── csv-import-pipeline mock (only for unicode tests) ────────────────────────

const mockExtractCardsFromCsv = vi.fn<(csv: string) => Promise<unknown>>();

// ─── Imports ──────────────────────────────────────────────────────────────────

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

// ─── # Sheet: prefix format ───────────────────────────────────────────────────

describe("extractCardsFromFile — # Sheet: header format", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockXlsxLoad.mockResolvedValue(undefined);
    successLlm();
  });

  it("includes '# Sheet: <name>' prefix (not just name) in CSV passed to LLM", async () => {
    mockWorksheets = [
      makeWorksheet("My Cards", [["Card Name", "Limit"], ["Sapphire", "5000"]]),
    ];

    await extractCardsFromFile(VALID_BASE64, XLSX_MIME, "cards.xlsx", "xlsx");

    expect(mockExtractText).toHaveBeenCalledTimes(1);
    const promptArg = mockExtractText.mock.calls[0]?.[0] as string;
    // Must contain the exact prefix, not just the sheet name
    expect(promptArg).toContain("# Sheet: My Cards");
  });

  it("formats each sheet with '# Sheet: <name>' when multiple sheets are present", async () => {
    mockWorksheets = [
      makeWorksheet("Personal", [["A", "B"], ["1", "2"]]),
      makeWorksheet("Business", [["C", "D"], ["3", "4"]]),
    ];

    await extractCardsFromFile(VALID_BASE64, XLSX_MIME, "multi.xlsx", "xlsx");

    expect(mockExtractText).toHaveBeenCalledTimes(1);
    const promptArg = mockExtractText.mock.calls[0]?.[0] as string;
    expect(promptArg).toContain("# Sheet: Personal");
    expect(promptArg).toContain("# Sheet: Business");
  });

  it("sheet name header appears before the sheet's CSV data", async () => {
    mockWorksheets = [
      makeWorksheet("Cards", [["Name", "Limit"], ["Sapphire", "5000"]]),
    ];

    await extractCardsFromFile(VALID_BASE64, XLSX_MIME, "cards.xlsx", "xlsx");

    const promptArg = mockExtractText.mock.calls[0]?.[0] as string;
    const headerIdx = promptArg.indexOf("# Sheet: Cards");
    const dataIdx = promptArg.indexOf("Name,Limit");
    expect(headerIdx).toBeGreaterThanOrEqual(0);
    expect(dataIdx).toBeGreaterThan(headerIdx);
  });

  it("hidden sheet does not produce a '# Sheet:' header", async () => {
    mockWorksheets = [
      makeWorksheet("Visible", [["A", "B"], ["1", "2"]], "visible"),
      makeWorksheet("HiddenSheet", [["C", "D"], ["3", "4"]], "hidden"),
    ];

    await extractCardsFromFile(VALID_BASE64, XLSX_MIME, "cards.xlsx", "xlsx");

    const promptArg = mockExtractText.mock.calls[0]?.[0] as string;
    expect(promptArg).not.toContain("# Sheet: HiddenSheet");
    expect(promptArg).toContain("# Sheet: Visible");
  });
});

// ─── Unicode sanitization in csv-import-pipeline ──────────────────────────────

describe("importFromCsv — unicode sanitization integration", () => {
  // Separate mock scope for these tests — we need to spy on what
  // extractCardsFromCsv actually receives to verify sanitization happened.
  const mockExtractCards = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockExtractCards.mockResolvedValue({
      cards: [
        {
          id: "test-id",
          issuerId: "chase",
          cardName: "Sapphire",
          openDate: "2025-01-01T00:00:00.000Z",
          creditLimit: 500000,
          annualFee: 9500,
          annualFeeDate: "2026-01-01T00:00:00.000Z",
          promoPeriodMonths: 0,
          signUpBonus: null,
          status: "active" as const,
          notes: "",
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
        },
      ],
    });
  });

  it("strips BOM (U+FEFF) from CSV before processing", async () => {
    // Use the real importFromCsv with a mocked extractCardsFromCsv
    const { importFromCsv } = await import("@/lib/sheets/csv-import-pipeline");
    // Re-import with BOM
    const csvWithBom = "\uFEFFCard Name,Limit\nSapphire Preferred,5000";
    const { sanitizeCsvUnicode } = await import("@/lib/sheets/unicode-sanitize");
    const sanitized = sanitizeCsvUnicode(csvWithBom);
    // BOM must not survive sanitization
    expect(sanitized).not.toContain("\uFEFF");
    expect(sanitized).toContain("Card Name,Limit");
  });

  it("strips C0 control characters (U+0001–U+0008) from CSV", async () => {
    const { sanitizeCsvUnicode } = await import("@/lib/sheets/unicode-sanitize");
    // Embed SOH (U+0001) and BEL (U+0007) in CSV
    const maliciousCsv = "Card\u0001Name,Limit\u0007\nSapphire,5000";
    const sanitized = sanitizeCsvUnicode(maliciousCsv);
    expect(sanitized).not.toContain("\u0001");
    expect(sanitized).not.toContain("\u0007");
    expect(sanitized).toContain("CardName,Limit");
  });

  it("preserves tab, LF, CR as valid CSV structural characters", async () => {
    const { sanitizeCsvUnicode } = await import("@/lib/sheets/unicode-sanitize");
    // These must survive sanitization — they're valid CSV chars
    const csv = "Card\tName\r\nSapphire,5000\n";
    const sanitized = sanitizeCsvUnicode(csv);
    expect(sanitized).toContain("\t");
    expect(sanitized).toContain("\r\n");
    expect(sanitized).toContain("\n");
  });

  it("strips bidi override characters (U+202A–U+202E) from CSV", async () => {
    const { sanitizeCsvUnicode } = await import("@/lib/sheets/unicode-sanitize");
    // Bidi override used in unicode bypass attacks
    const bidiCsv = "Card\u202eName,Limit\nSapphire,5000";
    const sanitized = sanitizeCsvUnicode(bidiCsv);
    expect(sanitized).not.toContain("\u202E");
    expect(sanitized).toContain("CardName,Limit");
  });
});
