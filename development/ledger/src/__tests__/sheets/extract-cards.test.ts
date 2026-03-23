/**
 * Unit tests for lib/sheets/extract-cards.ts — Fenrir Ledger
 *
 * Tests extractCardsFromCsv() core logic:
 *   - LLM provider error → ANTHROPIC_ERROR
 *   - Non-JSON LLM response → PARSE_ERROR
 *   - Schema mismatch → PARSE_ERROR
 *   - Empty cards array → NO_CARDS_FOUND
 *   - Wrapped format (ImportResponseSchema) parsed correctly
 *   - Plain array format (backwards compat) parsed correctly
 *   - sensitiveDataWarning propagated from wrapped format
 *   - UUIDs and timestamps assigned to extracted cards
 *   - closedAt sets status="closed"; absent closedAt sets status="active"
 *   - Markdown code fence stripped before JSON.parse
 *
 * getLlmProvider is mocked — no real Anthropic API calls.
 *
 * @see src/lib/sheets/extract-cards.ts
 * @ref #1848
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

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
  sanitizeCsvForPrompt: (csv: string) => csv, // pass-through for tests
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { extractCardsFromCsv } from "@/lib/sheets/extract-cards";

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface RawCard {
  issuerId: string;
  cardName: string;
  openDate: string;
  creditLimit: number;
  annualFee: number;
  annualFeeDate: string;
  promoPeriodMonths: number;
  signUpBonus: null;
  notes: string;
  closedAt?: string;
}

function makeRawCard(overrides: Partial<RawCard> = {}): RawCard {
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
    ...overrides,
  };
}

function jsonResponse(data: unknown): string {
  return JSON.stringify(data);
}

function wrappedResponse(cards: RawCard[], sensitiveDataWarning = false): string {
  return jsonResponse({ cards, sensitiveDataWarning });
}

// ─── LLM errors ──────────────────────────────────────────────────────────────

describe("extractCardsFromCsv — LLM errors", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ANTHROPIC_ERROR when LLM provider throws", async () => {
    mockExtractText.mockRejectedValue(new Error("Anthropic API unreachable"));

    const result = await extractCardsFromCsv("Card,Limit\nSapphire,5000");
    expect(result).toEqual({
      error: expect.objectContaining({ code: "ANTHROPIC_ERROR" }),
    });
  });
});

// ─── JSON parsing ─────────────────────────────────────────────────────────────

describe("extractCardsFromCsv — JSON parsing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns PARSE_ERROR when LLM returns non-JSON text", async () => {
    mockExtractText.mockResolvedValue("Sorry, I cannot help with that.");

    const result = await extractCardsFromCsv("Card,Limit\nSapphire,5000");
    expect(result).toEqual({
      error: expect.objectContaining({ code: "PARSE_ERROR" }),
    });
  });

  it("strips ```json ... ``` code fence before parsing", async () => {
    const cards = [makeRawCard()];
    mockExtractText.mockResolvedValue(
      "```json\n" + wrappedResponse(cards) + "\n```"
    );

    const result = await extractCardsFromCsv("Card,Limit\nSapphire,5000");
    expect("error" in result).toBe(false);
    if ("cards" in result) {
      expect(result.cards).toHaveLength(1);
    }
  });

  it("strips plain ``` code fence before parsing", async () => {
    const cards = [makeRawCard()];
    mockExtractText.mockResolvedValue(
      "```\n" + wrappedResponse(cards) + "\n```"
    );

    const result = await extractCardsFromCsv("Card,Limit\nSapphire,5000");
    expect("error" in result).toBe(false);
  });

  it("returns PARSE_ERROR when JSON schema doesn't match expected shape", async () => {
    mockExtractText.mockResolvedValue(
      JSON.stringify({ unexpected_key: "totally_wrong" })
    );

    const result = await extractCardsFromCsv("Card,Limit\nSapphire,5000");
    expect(result).toEqual({
      error: expect.objectContaining({ code: "PARSE_ERROR" }),
    });
  });
});

// ─── No cards found ───────────────────────────────────────────────────────────

describe("extractCardsFromCsv — empty results", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns NO_CARDS_FOUND when LLM returns empty array in wrapped format", async () => {
    mockExtractText.mockResolvedValue(wrappedResponse([]));

    const result = await extractCardsFromCsv("Card,Limit");
    expect(result).toEqual({
      error: expect.objectContaining({ code: "NO_CARDS_FOUND" }),
    });
  });

  it("returns NO_CARDS_FOUND when LLM returns empty plain array", async () => {
    mockExtractText.mockResolvedValue(jsonResponse([]));

    const result = await extractCardsFromCsv("Card,Limit");
    expect(result).toEqual({
      error: expect.objectContaining({ code: "NO_CARDS_FOUND" }),
    });
  });
});

// ─── Wrapped format ───────────────────────────────────────────────────────────

describe("extractCardsFromCsv — wrapped format", () => {
  beforeEach(() => vi.clearAllMocks());

  it("parses wrapped format { cards, sensitiveDataWarning: false }", async () => {
    const cards = [makeRawCard(), makeRawCard({ cardName: "Freedom Unlimited" })];
    mockExtractText.mockResolvedValue(wrappedResponse(cards, false));

    const result = await extractCardsFromCsv("Card,Limit\nSapphire,5000");
    expect("error" in result).toBe(false);
    if ("cards" in result) {
      expect(result.cards).toHaveLength(2);
    }
  });

  it("propagates sensitiveDataWarning=true from wrapped format", async () => {
    const cards = [makeRawCard()];
    mockExtractText.mockResolvedValue(wrappedResponse(cards, true));

    const result = await extractCardsFromCsv("CSV data here with SSN numbers");
    expect("error" in result).toBe(false);
    if ("cards" in result) {
      expect((result as { cards: unknown[]; sensitiveDataWarning?: boolean }).sensitiveDataWarning).toBe(true);
    }
  });

  it("does not set sensitiveDataWarning when false in wrapped response", async () => {
    const cards = [makeRawCard()];
    mockExtractText.mockResolvedValue(wrappedResponse(cards, false));

    const result = await extractCardsFromCsv("Card,Limit\nSapphire,5000");
    expect("error" in result).toBe(false);
    if ("cards" in result) {
      const r = result as { cards: unknown[]; sensitiveDataWarning?: boolean };
      expect(r.sensitiveDataWarning).toBeFalsy();
    }
  });
});

// ─── Plain array format (backwards compat) ────────────────────────────────────

describe("extractCardsFromCsv — plain array format", () => {
  beforeEach(() => vi.clearAllMocks());

  it("falls back to plain array format when wrapped format doesn't match", async () => {
    const cards = [makeRawCard()];
    // Plain array (not wrapped)
    mockExtractText.mockResolvedValue(jsonResponse(cards));

    const result = await extractCardsFromCsv("Card,Limit\nSapphire,5000");
    expect("error" in result).toBe(false);
    if ("cards" in result) {
      expect(result.cards).toHaveLength(1);
    }
  });
});

// ─── UUID and timestamp assignment ────────────────────────────────────────────

describe("extractCardsFromCsv — ID and timestamp assignment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("assigns a UUID id to each extracted card", async () => {
    const rawCards = [makeRawCard(), makeRawCard({ cardName: "Freedom" })];
    mockExtractText.mockResolvedValue(wrappedResponse(rawCards));

    const result = await extractCardsFromCsv("Card,Limit\nSapphire,5000");
    if ("cards" in result) {
      for (const card of result.cards) {
        expect(card.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
      }
    }
  });

  it("assigns unique IDs to each card", async () => {
    const rawCards = [makeRawCard(), makeRawCard(), makeRawCard()];
    mockExtractText.mockResolvedValue(wrappedResponse(rawCards));

    const result = await extractCardsFromCsv("Card,Limit\nSapphire,5000");
    if ("cards" in result) {
      const ids = result.cards.map((c) => c.id);
      expect(new Set(ids).size).toBe(3);
    }
  });

  it("assigns createdAt and updatedAt timestamps", async () => {
    mockExtractText.mockResolvedValue(wrappedResponse([makeRawCard()]));

    const before = new Date().toISOString();
    const result = await extractCardsFromCsv("Card,Limit\nSapphire,5000");
    const after = new Date().toISOString();

    if ("cards" in result) {
      const card = result.cards[0]!;
      expect(card.createdAt >= before).toBe(true);
      expect(card.createdAt <= after).toBe(true);
      expect(card.updatedAt).toBe(card.createdAt);
    }
  });
});

// ─── Status derivation ────────────────────────────────────────────────────────

describe("extractCardsFromCsv — status derivation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets status=active when closedAt is absent", async () => {
    mockExtractText.mockResolvedValue(wrappedResponse([makeRawCard()]));

    const result = await extractCardsFromCsv("Card,Limit\nSapphire,5000");
    if ("cards" in result) {
      expect(result.cards[0]!.status).toBe("active");
    }
  });

  it("sets status=closed and preserves closedAt when closedAt is present", async () => {
    const closedCard = makeRawCard({ closedAt: "2024-06-01T00:00:00.000Z" });
    mockExtractText.mockResolvedValue(wrappedResponse([closedCard]));

    const result = await extractCardsFromCsv("Card,Limit\nOld Sapphire,5000");
    if ("cards" in result) {
      const card = result.cards[0]!;
      expect(card.status).toBe("closed");
      expect((card as { closedAt?: string }).closedAt).toBe("2024-06-01T00:00:00.000Z");
    }
  });

  it("sets status=active and does not include closedAt when closedAt is empty string", async () => {
    const cardWithEmptyClose = makeRawCard({ closedAt: "" });
    mockExtractText.mockResolvedValue(wrappedResponse([cardWithEmptyClose]));

    const result = await extractCardsFromCsv("Card,Limit\nSapphire,5000");
    if ("cards" in result) {
      const card = result.cards[0]!;
      expect(card.status).toBe("active");
      expect((card as { closedAt?: string }).closedAt).toBeUndefined();
    }
  });

  it("handles mixed active and closed cards", async () => {
    const rawCards = [
      makeRawCard({ cardName: "Active Card" }),
      makeRawCard({ cardName: "Closed Card", closedAt: "2023-01-01T00:00:00.000Z" }),
    ];
    mockExtractText.mockResolvedValue(wrappedResponse(rawCards));

    const result = await extractCardsFromCsv("Card,Limit\nData");
    if ("cards" in result) {
      expect(result.cards[0]!.status).toBe("active");
      expect(result.cards[1]!.status).toBe("closed");
    }
  });
});
