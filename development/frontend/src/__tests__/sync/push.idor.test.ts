/**
 * IDOR regression tests for POST /api/sync/push — Issue #1193
 *
 * Verifies that the route uses the server-verified householdId (from the
 * authenticated user's Firestore record) for all Firestore operations, and
 * never the raw caller-supplied body value.
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

describe("POST /api/sync/push — IDOR regression (#1193)", () => {
  it("uses the server-verified householdId for Firestore reads, not the caller-supplied value", async () => {
    // Attacker supplies a different householdId in the body than their actual household.
    // requireAuthz resolves the real household from the authenticated user's Firestore record.
    mockRequireAuthz.mockResolvedValue({
      ok: true as const,
      user: { sub: "attacker-sub" },
      firestoreUser: { householdId: "hh-server-verified" },
    });

    const req = makeRequest({ householdId: "hh-caller-supplied", cards: [] });
    const res = await POST(req);

    expect(res.status).toBe(200);
    // Firestore must be queried with the server-verified id, never the caller-supplied one
    expect(mockGetAllFirestoreCards).toHaveBeenCalledWith("hh-server-verified");
    expect(mockGetAllFirestoreCards).not.toHaveBeenCalledWith("hh-caller-supplied");
  });

  it("does not touch Firestore at all when authz rejects the request", async () => {
    mockRequireAuthz.mockResolvedValue({
      ok: false as const,
      response: new Response(
        JSON.stringify({ error: "forbidden", error_description: "You do not have access to the requested household." }),
        { status: 403 },
      ),
    });

    const req = makeRequest({ householdId: "victim-household", cards: [] });
    const res = await POST(req);

    expect(res.status).toBe(403);
    expect(mockGetAllFirestoreCards).not.toHaveBeenCalled();
    expect(mockSetCards).not.toHaveBeenCalled();
  });

  it("does not leak the victim householdId in the 403 response body", async () => {
    const victimHouseholdId = "hh-victim-secret-id";

    mockRequireAuthz.mockResolvedValue({
      ok: false as const,
      response: new Response(
        JSON.stringify({ error: "forbidden", error_description: "You do not have access to the requested household." }),
        { status: 403 },
      ),
    });

    const req = makeRequest({ householdId: victimHouseholdId, cards: [] });
    const res = await POST(req);

    expect(res.status).toBe(403);
    const text = await res.text();
    expect(text).not.toContain(victimHouseholdId);
  });
});
