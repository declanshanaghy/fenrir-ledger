/**
 * Integration tests for POST /api/trial/init
 *
 * Covers:
 *  - Trial initializes for authenticated user (userId from auth token)
 *  - Idempotent: second call preserves original trial, returns isNew:false
 *  - Unauthenticated request returns 401
 *  - Returns 409 when trial already expired (restart blocked)
 *  - Firestore failure returns 500
 *  - Rate limiting returns 429
 *
 * @see src/app/api/trial/init/route.ts
 * @ref Issue #1634
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

const mockEnsureSoloHousehold = vi.hoisted(() => vi.fn().mockResolvedValue({ created: false }));

vi.mock("@/lib/firebase/firestore", () => ({
  getFirestore: () => mockDb,
  ensureSoloHousehold: (...args: unknown[]) => mockEnsureSoloHousehold(...args),
}));

const mockRateLimit = vi.hoisted(() => vi.fn(() => ({ success: true, remaining: 9 })));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mockRateLimit,
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// requireAuth: by default resolves authenticated. Override per-test for 401 cases.
const mockRequireAuth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

// ── Import route handler after mocks ──────────────────────────────────────────

import { POST } from "@/app/api/trial/init/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_ID = "google-sub-test-123";
const TRIAL_PATH = `households/${USER_ID}/trial/status`;

const missingSnap = { exists: false, data: () => null };

function existingSnap(trial: Record<string, unknown>) {
  return {
    exists: true,
    data: () => ({
      startDate: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      ...trial,
    }),
  };
}

function expiredSnap() {
  const start = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  return {
    exists: true,
    data: () => ({
      startDate: start.toISOString(),
      expiresAt: new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }),
  };
}

function makeRequest(token = "valid-token"): NextRequest {
  return new NextRequest("http://localhost:9653/api/trial/init", {
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
  mockRequireAuth.mockResolvedValue({
    ok: true,
    user: { sub: USER_ID, email: "user@example.com", name: "Test User" },
  });
}

function authFail() {
  mockRequireAuth.mockResolvedValue({
    ok: false,
    response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("POST /api/trial/init", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authOk();
    mockEnsureSoloHousehold.mockResolvedValue({ created: false });
    mockDocRef.get.mockResolvedValue(missingSnap);
    mockDocRef.set.mockResolvedValue(undefined);
    mockDocRef.update.mockResolvedValue(undefined);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Successful trial creation
  // ═══════════════════════════════════════════════════════════════════════

  it("creates a new trial and returns isNew:true on first call", async () => {
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.isNew).toBe(true);
    expect(typeof body.startDate).toBe("string");
    expect(typeof body.expiresAt).toBe("string");
    expect(mockDocRef.set).toHaveBeenCalledOnce();
  });

  it("writes trial to /households/{userId}/trial/status", async () => {
    await POST(makeRequest());

    expect(mockDb.doc).toHaveBeenCalledWith(TRIAL_PATH);
  });

  it("writes a valid ISO start date to Firestore", async () => {
    const before = Date.now();
    const res = await POST(makeRequest());
    const after = Date.now();
    const body = await res.json();

    const startDate = new Date(body.startDate as string).getTime();
    expect(startDate).toBeGreaterThanOrEqual(before);
    expect(startDate).toBeLessThanOrEqual(after);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Idempotent — second call preserves original trial
  // ═══════════════════════════════════════════════════════════════════════

  it("returns isNew:false and preserves original startDate on second call", async () => {
    const originalStartDate = "2026-03-01T00:00:00.000Z";
    mockDocRef.get.mockResolvedValueOnce(
      existingSnap({ startDate: originalStartDate }),
    );

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.isNew).toBe(false);
    expect(body.startDate).toBe(originalStartDate);
    expect(mockDocRef.set).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Authentication required
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 401 when request is unauthenticated", async () => {
    authFail();

    const res = await POST(makeRequest("invalid-token"));

    expect(res.status).toBe(401);
    expect(mockDocRef.set).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Trial restart blocked
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 409 with trial_expired error when trial has already expired (restart blocked)", async () => {
    mockDocRef.get.mockResolvedValueOnce(expiredSnap());

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("trial_expired");
    expect(body.message).toBe("Contact customer service");
    expect(mockDocRef.set).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Firestore failure
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 500 when Firestore write fails", async () => {
    mockDocRef.set.mockRejectedValueOnce(new Error("Firestore unavailable"));

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("internal_error");
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Cache-Control header
  // ═══════════════════════════════════════════════════════════════════════

  it("response includes Cache-Control: no-store", async () => {
    const res = await POST(makeRequest());

    expect(res.headers.get("Cache-Control")).toBe("no-store");
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
  // Issue #1707 — ensureSoloHousehold called on trial init
  // ═══════════════════════════════════════════════════════════════════════

  it("calls ensureSoloHousehold with userId, email, and name from auth token", async () => {
    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(mockEnsureSoloHousehold).toHaveBeenCalledOnce();
    expect(mockEnsureSoloHousehold).toHaveBeenCalledWith({
      userId: USER_ID,
      email: "user@example.com",
      displayName: "Test User",
    });
  });

  it("returns 500 when ensureSoloHousehold throws (household init failure)", async () => {
    mockEnsureSoloHousehold.mockRejectedValueOnce(new Error("Firestore write failed"));

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("internal_error");
    expect(body.error_description).toMatch(/trial/i);
    // Trial should NOT be initialized if household creation failed
    expect(mockDocRef.set).not.toHaveBeenCalled();
  });

  it("does not call ensureSoloHousehold when request is unauthenticated", async () => {
    authFail();

    await POST(makeRequest("bad-token"));

    expect(mockEnsureSoloHousehold).not.toHaveBeenCalled();
  });
});
