/**
 * Unit tests for lib/sheets/file-import-pipeline.ts — Fenrir Ledger
 *
 * Tests importFromFile() validation and delegation:
 *   - Empty base64 string rejected with INVALID_CSV
 *   - Payload exceeding 5MB limit rejected with INVALID_CSV
 *   - Correct MIME type selected based on format
 *   - Delegates to extractCardsFromFile with correct args
 *   - Error and success results forwarded transparently
 *
 * extractCardsFromFile is mocked — no real SheetJS or LLM calls.
 *
 * @see src/lib/sheets/file-import-pipeline.ts
 * @ref #1848
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/sheets/extract-cards", () => ({
  extractCardsFromFile: vi.fn(),
  extractCardsFromCsv: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { extractCardsFromFile } from "@/lib/sheets/extract-cards";
import { importFromFile } from "@/lib/sheets/file-import-pipeline";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MAX_BASE64_LENGTH = 6_900_000;

function makeCard(id = "card-1") {
  return {
    id,
    issuerId: "amex",
    cardName: "Gold Card",
    openDate: "2025-01-01T00:00:00.000Z",
    creditLimit: 0,
    annualFee: 25000,
    annualFeeDate: "2026-01-01T00:00:00.000Z",
    promoPeriodMonths: 0,
    signUpBonus: null,
    status: "active" as const,
    notes: "",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

describe("importFromFile — validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns INVALID_CSV for empty base64 string", async () => {
    const result = await importFromFile("", "cards.xlsx", "xlsx");
    expect(result).toEqual({
      error: expect.objectContaining({ code: "INVALID_CSV" }),
    });
    expect(extractCardsFromFile).not.toHaveBeenCalled();
  });

  it("returns INVALID_CSV for whitespace-only base64", async () => {
    const result = await importFromFile("   ", "cards.xlsx", "xlsx");
    expect(result).toEqual({
      error: expect.objectContaining({ code: "INVALID_CSV" }),
    });
    expect(extractCardsFromFile).not.toHaveBeenCalled();
  });

  it("returns INVALID_CSV when base64 payload exceeds 5MB limit", async () => {
    const tooBig = "A".repeat(MAX_BASE64_LENGTH + 1);
    const result = await importFromFile(tooBig, "cards.xlsx", "xlsx");
    expect(result).toEqual({
      error: expect.objectContaining({
        code: "INVALID_CSV",
        message: expect.stringContaining("5 MB"),
      }),
    });
    expect(extractCardsFromFile).not.toHaveBeenCalled();
  });

  it("accepts base64 at exactly the size limit", async () => {
    vi.mocked(extractCardsFromFile).mockResolvedValue({ cards: [makeCard()] });
    const exactlyMax = "A".repeat(MAX_BASE64_LENGTH);
    await importFromFile(exactlyMax, "cards.xlsx", "xlsx");
    expect(extractCardsFromFile).toHaveBeenCalledTimes(1);
  });
});

// ─── MIME type selection ───────────────────────────────────────────────────────

describe("importFromFile — MIME type selection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes xlsx MIME type for format='xlsx'", async () => {
    vi.mocked(extractCardsFromFile).mockResolvedValue({ cards: [] });
    const b64 = "dGVzdA=="; // "test" in base64

    await importFromFile(b64, "cards.xlsx", "xlsx");

    expect(extractCardsFromFile).toHaveBeenCalledWith(
      b64,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "cards.xlsx",
      "xlsx"
    );
  });

  it("passes xls MIME type for format='xls'", async () => {
    vi.mocked(extractCardsFromFile).mockResolvedValue({ cards: [] });
    const b64 = "dGVzdA==";

    await importFromFile(b64, "cards.xls", "xls");

    expect(extractCardsFromFile).toHaveBeenCalledWith(
      b64,
      "application/vnd.ms-excel",
      "cards.xls",
      "xls"
    );
  });
});

// ─── Delegation and result passthrough ────────────────────────────────────────

describe("importFromFile — result passthrough", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns success cards from extractCardsFromFile", async () => {
    const cards = [makeCard("c1"), makeCard("c2")];
    vi.mocked(extractCardsFromFile).mockResolvedValue({ cards });

    const result = await importFromFile("dGVzdA==", "data.xlsx", "xlsx");
    if ("cards" in result) {
      expect(result.cards).toHaveLength(2);
    } else {
      throw new Error("Expected success result");
    }
  });

  it("forwards ANTHROPIC_ERROR from extractCardsFromFile", async () => {
    vi.mocked(extractCardsFromFile).mockResolvedValue({
      error: { code: "ANTHROPIC_ERROR", message: "LLM error." },
    });

    const result = await importFromFile("dGVzdA==", "data.xlsx", "xlsx");
    expect(result).toEqual({
      error: { code: "ANTHROPIC_ERROR", message: "LLM error." },
    });
  });

  it("forwards INVALID_CSV error from extractCardsFromFile (e.g. empty spreadsheet)", async () => {
    vi.mocked(extractCardsFromFile).mockResolvedValue({
      error: { code: "INVALID_CSV", message: "No visible sheets." },
    });

    const result = await importFromFile("dGVzdA==", "empty.xls", "xls");
    expect(result).toEqual({
      error: { code: "INVALID_CSV", message: "No visible sheets." },
    });
  });

  it("forwards NO_CARDS_FOUND from extractCardsFromFile", async () => {
    vi.mocked(extractCardsFromFile).mockResolvedValue({
      error: { code: "NO_CARDS_FOUND", message: "No cards in spreadsheet." },
    });

    const result = await importFromFile("dGVzdA==", "empty.xlsx", "xlsx");
    expect(result).toEqual({
      error: { code: "NO_CARDS_FOUND", message: "No cards in spreadsheet." },
    });
  });

  it("passes original filename and format to extractCardsFromFile", async () => {
    vi.mocked(extractCardsFromFile).mockResolvedValue({ cards: [] });

    await importFromFile("dGVzdA==", "my-cards.xls", "xls");
    expect(extractCardsFromFile).toHaveBeenCalledWith(
      "dGVzdA==",
      expect.any(String),
      "my-cards.xls",
      "xls"
    );
  });
});
