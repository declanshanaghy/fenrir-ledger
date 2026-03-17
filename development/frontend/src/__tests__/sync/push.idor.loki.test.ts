/**
 * Loki IDOR regression tests for POST /api/sync/push — Issue #1193
 *
 * Augments push.idor.test.ts (FiremanDecko) with gap coverage:
 *
 * Gap: setCards() uses card.householdId for Firestore path resolution
 * (FIRESTORE_PATHS.card(card.householdId, card.id)). An attacker whose own
 * householdId passes the authz membership check can still inject cards with a
 * victim's householdId embedded in the cards array, writing to the victim's
 * Firestore path via the LWW merge.
 *
 * Issue #1193
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Card } from "@/lib/types";
import { NextRequest } from "next/server";

// ── Mock: authz ────────────────────────────────────────────────────────────

const mockRequireAuthz = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/authz", () => ({
  requireAuthz: mockRequireAuthz,
}));

// ── Mock: Firestore ────────────────────────────────────────────────────────

const mockGetAllFirestoreCards = vi.hoisted(() => vi.fn());
const mockSetCards = vi.hoisted(() => vi.fn());

vi.mock("@/lib/firebase/firestore", () => ({
  getAllFirestoreCards: mockGetAllFirestoreCards,
  setCards: mockSetCards,
}));

// ── Import after mocks ────────────────────────────────────────────────────

import { POST } from "@/app/api/sync/push/route";

// ── Helpers ───────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/sync/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test-token",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSetCards.mockResolvedValue(undefined);
  mockGetAllFirestoreCards.mockResolvedValue([]);
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe("POST /api/sync/push — card-embedded householdId injection (#1193)", () => {
  /**
   * Attack vector: attacker supplies their own valid householdId as the top-level
   * body value (passing authz), but embeds a victim's householdId inside the cards
   * array. setCards() uses card.householdId for Firestore path resolution, so any
   * card that wins LWW merge with a victim householdId would be written to the
   * victim's Firestore path.
   *
   * Expected: all cards written to Firestore must have householdId === verifiedHouseholdId.
   *
   * Fixed in Issue #1208: FiremanDecko sanitises localCards householdId fields.
   */
  it("all cards written to Firestore use the verified householdId, not embedded card values", async () => {
    mockRequireAuthz.mockResolvedValue({
      ok: true as const,
      user: { sub: "attacker-sub" },
      firestoreUser: { householdId: "hh-attacker" },
    });

    mockGetAllFirestoreCards.mockResolvedValue([]);

    // Attacker injects a card with victim's householdId — far-future timestamp ensures
    // it wins LWW against any remote card (including tombstones)
    const injectedCard: Card = {
      id: "injected-card",
      householdId: "hh-victim",          // ← injection: not the attacker's household
      issuerId: "amex",
      cardName: "Victim Gold Card",
      openDate: "2025-01-01T00:00:00.000Z",
      creditLimit: 1000000,
      annualFee: 25000,
      annualFeeDate: "",
      promoPeriodMonths: 0,
      signUpBonus: null,
      status: "active",
      notes: "stolen data",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "9999-01-01T00:00:00.000Z",  // far future — wins every LWW race
    };

    const req = makeRequest({
      householdId: "hh-attacker",   // valid: attacker's own household passes authz
      cards: [injectedCard],
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Every card written to Firestore MUST use the server-verified householdId.
    // If any card retains the injected "hh-victim" householdId, setCards() would
    // write to the victim's Firestore path — a write IDOR.
    expect(mockSetCards).toHaveBeenCalledOnce();
    const writtenCards = mockSetCards.mock.calls[0]?.[0] as Card[];
    expect(writtenCards.every((c) => c.householdId === "hh-attacker")).toBe(true);
    expect(writtenCards.some((c) => c.householdId === "hh-victim")).toBe(false);
  });

  /**
   * Verify the response body also returns cards with the verified householdId,
   * ensuring the client is not returned cards marked as belonging to another household.
   *
   * Fixed in Issue #1208: FiremanDecko sanitises localCards householdId fields.
   */
  it("response cards contain only the verified householdId, not injected values", async () => {
    mockRequireAuthz.mockResolvedValue({
      ok: true as const,
      user: { sub: "attacker-sub" },
      firestoreUser: { householdId: "hh-attacker" },
    });

    mockGetAllFirestoreCards.mockResolvedValue([]);

    const injectedCard: Card = {
      id: "injected-card",
      householdId: "hh-victim",
      issuerId: "chase",
      cardName: "Injected Card",
      openDate: "2025-01-01T00:00:00.000Z",
      creditLimit: 500000,
      annualFee: 0,
      annualFeeDate: "",
      promoPeriodMonths: 0,
      signUpBonus: null,
      status: "active",
      notes: "",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "9999-01-01T00:00:00.000Z",
    };

    const req = makeRequest({
      householdId: "hh-attacker",
      cards: [injectedCard],
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json() as { cards: Card[] };
    expect(body.cards.every((c) => c.householdId === "hh-attacker")).toBe(true);
    expect(body.cards.some((c) => c.householdId === "hh-victim")).toBe(false);
  });
});
