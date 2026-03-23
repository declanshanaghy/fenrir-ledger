/**
 * Unit tests for lib/sheets/csv-import-pipeline.ts — Fenrir Ledger
 *
 * Tests the importFromCsv() orchestrator:
 *   - Validation: empty/null/short CSV rejected with INVALID_CSV
 *   - Truncation: long CSV truncated and warning merged
 *   - LLM delegation: extractCardsFromCsv called with truncated text
 *   - Error passthrough: extract error forwarded as-is
 *   - Success: cards returned with merged warnings
 *
 * extractCardsFromCsv is mocked — no real LLM calls.
 *
 * @see src/lib/sheets/csv-import-pipeline.ts
 * @ref #1848
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/sheets/extract-cards", () => ({
  extractCardsFromCsv: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { extractCardsFromCsv } from "@/lib/sheets/extract-cards";
import { importFromCsv } from "@/lib/sheets/csv-import-pipeline";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CSV_TRUNCATION_LIMIT = 100_000;

function makeCard(id = "card-1") {
  return {
    id,
    issuerId: "chase",
    cardName: "Sapphire Preferred",
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
  };
}

function makeSuccessResult(cards = [makeCard()], warning?: string) {
  return warning ? { cards, warning } : { cards };
}

// ─── Validation ───────────────────────────────────────────────────────────────

describe("importFromCsv — validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns INVALID_CSV for empty string", async () => {
    const result = await importFromCsv("");
    expect(result).toEqual({
      error: expect.objectContaining({ code: "INVALID_CSV" }),
    });
    expect(extractCardsFromCsv).not.toHaveBeenCalled();
  });

  it("returns INVALID_CSV for whitespace-only string", async () => {
    const result = await importFromCsv("   \n  ");
    expect(result).toEqual({
      error: expect.objectContaining({ code: "INVALID_CSV" }),
    });
    expect(extractCardsFromCsv).not.toHaveBeenCalled();
  });

  it("returns INVALID_CSV for string shorter than minimum length", async () => {
    // MIN_CSV_LENGTH = 10; "a,b\nc,d" = 7 chars
    const result = await importFromCsv("a,b\nc,d");
    expect(result).toEqual({
      error: expect.objectContaining({ code: "INVALID_CSV" }),
    });
    expect(extractCardsFromCsv).not.toHaveBeenCalled();
  });

  it("accepts CSV at exactly the minimum length", async () => {
    vi.mocked(extractCardsFromCsv).mockResolvedValue(makeSuccessResult());
    // Exactly 10 non-whitespace chars
    const minCsv = "Card,Limit";
    const result = await importFromCsv(minCsv);
    expect(extractCardsFromCsv).toHaveBeenCalledWith(minCsv);
    expect("error" in result).toBe(false);
  });
});

// ─── Truncation ───────────────────────────────────────────────────────────────

describe("importFromCsv — truncation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes full CSV when within truncation limit", async () => {
    vi.mocked(extractCardsFromCsv).mockResolvedValue(makeSuccessResult());
    const csv = "Card Name,Limit\nSapphire Preferred,5000";
    await importFromCsv(csv);
    expect(extractCardsFromCsv).toHaveBeenCalledWith(csv);
  });

  it("truncates CSV to limit and adds truncation warning", async () => {
    vi.mocked(extractCardsFromCsv).mockResolvedValue(makeSuccessResult());
    const longCsv = "A".repeat(CSV_TRUNCATION_LIMIT + 500);

    const result = await importFromCsv(longCsv);

    // extractCardsFromCsv should receive only the first CSV_TRUNCATION_LIMIT chars
    expect(extractCardsFromCsv).toHaveBeenCalledWith(
      longCsv.slice(0, CSV_TRUNCATION_LIMIT)
    );

    // Result should include a truncation warning
    if ("cards" in result) {
      expect(result.warning).toMatch(/truncated/i);
    } else {
      throw new Error("Expected success result with cards");
    }
  });

  it("merges extract warning with truncation warning when both present", async () => {
    vi.mocked(extractCardsFromCsv).mockResolvedValue(
      makeSuccessResult([makeCard()], "Some extraction warning.")
    );
    const longCsv = "B".repeat(CSV_TRUNCATION_LIMIT + 100);

    const result = await importFromCsv(longCsv);

    if ("cards" in result) {
      expect(result.warning).toContain("Some extraction warning.");
      expect(result.warning).toMatch(/truncated/i);
    } else {
      throw new Error("Expected success result with cards");
    }
  });

  it("does not add truncation warning when CSV is within limit", async () => {
    vi.mocked(extractCardsFromCsv).mockResolvedValue(makeSuccessResult());
    const csv = "Card,Limit\nSapphire,5000";
    const result = await importFromCsv(csv);
    if ("cards" in result) {
      expect(result.warning).toBeUndefined();
    } else {
      throw new Error("Expected success result");
    }
  });
});

// ─── Error passthrough ────────────────────────────────────────────────────────

describe("importFromCsv — error passthrough", () => {
  beforeEach(() => vi.clearAllMocks());

  it("forwards ANTHROPIC_ERROR from extractCardsFromCsv", async () => {
    vi.mocked(extractCardsFromCsv).mockResolvedValue({
      error: { code: "ANTHROPIC_ERROR", message: "LLM failed." },
    });

    const result = await importFromCsv("Card,Limit\nSapphire,5000");
    expect(result).toEqual({
      error: { code: "ANTHROPIC_ERROR", message: "LLM failed." },
    });
  });

  it("forwards PARSE_ERROR from extractCardsFromCsv", async () => {
    vi.mocked(extractCardsFromCsv).mockResolvedValue({
      error: { code: "PARSE_ERROR", message: "Bad JSON." },
    });

    const result = await importFromCsv("Card,Limit\nSapphire,5000");
    expect(result).toEqual({
      error: { code: "PARSE_ERROR", message: "Bad JSON." },
    });
  });

  it("forwards NO_CARDS_FOUND from extractCardsFromCsv", async () => {
    vi.mocked(extractCardsFromCsv).mockResolvedValue({
      error: { code: "NO_CARDS_FOUND", message: "No cards found." },
    });

    const result = await importFromCsv("Card,Limit\nSapphire,5000");
    expect(result).toEqual({
      error: { code: "NO_CARDS_FOUND", message: "No cards found." },
    });
  });
});

// ─── Success path ─────────────────────────────────────────────────────────────

describe("importFromCsv — success", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns cards from extractCardsFromCsv on success", async () => {
    const cards = [makeCard("c1"), makeCard("c2")];
    vi.mocked(extractCardsFromCsv).mockResolvedValue({ cards });

    const result = await importFromCsv("Card,Limit\nSapphire,5000");
    if ("cards" in result) {
      expect(result.cards).toHaveLength(2);
    } else {
      throw new Error("Expected success result");
    }
  });

  it("preserves extract warning when no truncation occurred", async () => {
    vi.mocked(extractCardsFromCsv).mockResolvedValue(
      makeSuccessResult([makeCard()], "Partial data detected.")
    );

    const result = await importFromCsv("Card,Limit\nSapphire,5000");
    if ("cards" in result) {
      expect(result.warning).toBe("Partial data detected.");
    } else {
      throw new Error("Expected success result");
    }
  });
});
