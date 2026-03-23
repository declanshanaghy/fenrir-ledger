/**
 * Integration tests for POST /api/trial/convert
 *
 * Covers:
 *  - Successfully marks an active trial as converted
 *  - Returns converted:false when no trial exists
 *  - Unauthenticated request returns 401
 *  - Rate limiting returns 429
 *  - Firestore failure returns 500
 *  - Cache-Control: no-store is present
 *
 * @see src/app/api/trial/convert/route.ts
 * @ref Issue #1635
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockDocRef = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
}));

const mockDb = vi.hoisted(() => ({
  doc: vi.fn(() => mockDocRef),
}));

vi.mock("@/lib/firebase/firestore", () => ({
  getFirestore: () => mockDb,
}));

const mockRateLimit = vi.hoisted(() => vi.fn(() => ({ success: true, remaining: 9 })));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mockRateLimit,
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockRequireAuth = vi.fn();
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

// ── Import route handler after mocks ──────────────────────────────────────────

import { POST } from "@/app/api/trial/convert/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_ID = "google-sub-convert-456";
const TRIAL_PATH = `households/${USER_ID}/trial/status`;

function activeTrialSnap() {
  return {
    exists: true,
    data: () => ({
      startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
    }),
  };
}

const missingSnap = { exists: false, data: () => null };

function makeRequest(token = "valid-token"): NextRequest {
  return new NextRequest("http://localhost:9653/api/trial/convert", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-forwarded-for": "127.0.0.1",
    },
    body: JSON.stringify({}),
  });
}

function authOk() {
  mockRequireAuth.mockResolvedValue({ ok: true, user: { sub: USER_ID } });
}

function authFail() {
  mockRequireAuth.mockResolvedValue({
    ok: false,
    response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("POST /api/trial/convert", () => {
  beforeEach(() => {
    authOk();
    mockDocRef.get.mockResolvedValue(activeTrialSnap());
    mockDocRef.update.mockResolvedValue(undefined);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Successful conversion
  // ═══════════════════════════════════════════════════════════════════════

  it("marks trial as converted and returns converted:true", async () => {
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.converted).toBe(true);
    expect(mockDocRef.update).toHaveBeenCalledOnce();
  });

  it("writes convertedDate to /households/{userId}/trial/status", async () => {
    await POST(makeRequest());

    expect(mockDb.doc).toHaveBeenCalledWith(TRIAL_PATH);
    expect(mockDocRef.update).toHaveBeenCalledWith(
      expect.objectContaining({ convertedDate: expect.any(String) }),
    );
  });

  it("convertedDate written to Firestore is a valid ISO timestamp", async () => {
    const before = Date.now();
    await POST(makeRequest());
    const after = Date.now();

    const updateArg = mockDocRef.update.mock.calls[0][0] as { convertedDate: string };
    const ts = new Date(updateArg.convertedDate).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // No trial found
  // ═══════════════════════════════════════════════════════════════════════

  it("returns converted:false when no trial exists for the user", async () => {
    mockDocRef.get.mockResolvedValueOnce(missingSnap);

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.converted).toBe(false);
    expect(mockDocRef.update).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Idempotent — already converted
  // ═══════════════════════════════════════════════════════════════════════

  it("returns converted:true idempotently when trial is already converted", async () => {
    mockDocRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
        convertedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.converted).toBe(true);
    // No double-write when already converted
    expect(mockDocRef.update).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Authentication required
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 401 when request is unauthenticated", async () => {
    authFail();

    const res = await POST(makeRequest("invalid-token"));

    expect(res.status).toBe(401);
    expect(mockDocRef.update).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Rate limiting
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 429 when rate limit is exceeded", async () => {
    mockRateLimit.mockReturnValueOnce({ success: false, remaining: 0 });

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toBe("rate_limited");
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Firestore failure — markTrialConverted swallows errors and returns false
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 200 with converted:false when Firestore update fails (error swallowed)", async () => {
    mockDocRef.update.mockRejectedValueOnce(new Error("Firestore unavailable"));

    const res = await POST(makeRequest());
    const body = await res.json();

    // markTrialConverted catches internal errors and returns false
    expect(res.status).toBe(200);
    expect(body.converted).toBe(false);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Cache-Control header
  // ═══════════════════════════════════════════════════════════════════════

  it("response includes Cache-Control: no-store", async () => {
    const res = await POST(makeRequest());

    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
