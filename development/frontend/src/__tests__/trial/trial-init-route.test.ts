/**
 * Integration tests for POST /api/trial/init
 *
 * Covers:
 *  - Trial auto-starts on first sign-in (new fingerprint → Firestore write)
 *  - Idempotent: second call preserves original start date, no re-write
 *  - Invalid fingerprint returns 400
 *  - Missing fingerprint returns 400
 *  - Unauthenticated request returns 401
 *  - Firestore failure returns 500
 *
 * @see src/app/api/trial/init/route.ts
 * @ref Issue #922, #1516
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockDocRef = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
}));

const mockCollectionRef = vi.hoisted(() => ({
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  get: vi.fn(),
}));

const mockDb = vi.hoisted(() => ({
  doc: vi.fn(() => mockDocRef),
  collection: vi.fn(() => mockCollectionRef),
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

// requireAuthz: by default resolves to an authenticated user. Override per-test for 401 cases.
const mockRequireAuthz = vi.fn();
vi.mock("@/lib/auth/authz", () => ({
  requireAuthz: (...args: unknown[]) => mockRequireAuthz(...args),
}));

// ── Import route handler after mocks ──────────────────────────────────────────

import { POST } from "@/app/api/trial/init/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_FINGERPRINT = "a".repeat(64);

/** Snapshot for a missing document. */
const missingSnap = { exists: false, data: () => null };

/** Snapshot for an existing trial. */
function existingSnap(trial: Record<string, unknown>) {
  return { exists: true, data: () => ({ ...trial, expiresAt: {} }) };
}

function makeRequest(body: Record<string, unknown> = {}, token = "valid-token"): NextRequest {
  return new NextRequest("http://localhost:9653/api/trial/init", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-forwarded-for": "127.0.0.1",
    },
    body: JSON.stringify(body),
  });
}

const MOCK_FIRESTORE_USER = { userId: "google-sub-123", email: "test@test.com", displayName: "Test User", householdId: "hh-test", role: "owner" as const, createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" };

function authOk() {
  mockRequireAuthz.mockResolvedValue({ ok: true, user: { sub: "google-sub-123" }, firestoreUser: MOCK_FIRESTORE_USER });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("POST /api/trial/init", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authOk();
    // Default: doc not found
    mockDocRef.get.mockResolvedValue(missingSnap);
    mockDocRef.set.mockResolvedValue(undefined);
    mockDocRef.update.mockResolvedValue(undefined);
    mockCollectionRef.get.mockResolvedValue({ empty: true, docs: [] });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Trial auto-starts on first sign-in
  // ═══════════════════════════════════════════════════════════════════════

  it("creates a new trial on first sign-in and returns isNew:true", async () => {
    // Route calls getTrial → doc not found; then initTrial → getTrial again → not found → set
    mockDocRef.get
      .mockResolvedValueOnce(missingSnap) // route's getTrial
      .mockResolvedValueOnce(missingSnap); // initTrial's internal getTrial

    const res = await POST(makeRequest({ fingerprint: VALID_FINGERPRINT }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.isNew).toBe(true);
    expect(typeof body.startDate).toBe("string");
    expect(mockDocRef.set).toHaveBeenCalledOnce();
    expect(mockDb.doc).toHaveBeenCalledWith(`trials/${VALID_FINGERPRINT}`);
  });

  it("writes a valid ISO start date to Firestore on first sign-in", async () => {
    mockDocRef.get
      .mockResolvedValueOnce(missingSnap)
      .mockResolvedValueOnce(missingSnap);

    const before = Date.now();
    const res = await POST(makeRequest({ fingerprint: VALID_FINGERPRINT }));
    const after = Date.now();
    const body = await res.json();

    const startDate = new Date(body.startDate as string).getTime();
    expect(startDate).toBeGreaterThanOrEqual(before);
    expect(startDate).toBeLessThanOrEqual(after);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Idempotent — second sign-in preserves original trial
  // ═══════════════════════════════════════════════════════════════════════

  it("returns isNew:false and preserves original startDate on second call", async () => {
    const originalStartDate = "2026-03-01T00:00:00.000Z";
    mockDocRef.get.mockResolvedValueOnce(existingSnap({ startDate: originalStartDate }));

    const res = await POST(makeRequest({ fingerprint: VALID_FINGERPRINT }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.isNew).toBe(false);
    expect(body.startDate).toBe(originalStartDate);
    // Firestore set should NOT be called — existing trial preserved
    expect(mockDocRef.set).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Anonymous access — no auth token required (Issue #1413)
  // ═══════════════════════════════════════════════════════════════════════

  it("allows anonymous request (no Bearer token) with valid fingerprint", async () => {
    mockDocRef.get
      .mockResolvedValueOnce(missingSnap)
      .mockResolvedValueOnce(missingSnap);

    // Request with no Authorization header
    const req = new NextRequest("http://localhost:9653/api/trial/init", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "127.0.0.1",
      },
      body: JSON.stringify({ fingerprint: VALID_FINGERPRINT }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.isNew).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Input validation
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 400 for invalid fingerprint (too short)", async () => {
    const res = await POST(makeRequest({ fingerprint: "abc123" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("invalid_fingerprint");
  });

  it("returns 400 for invalid fingerprint (uppercase hex)", async () => {
    const res = await POST(makeRequest({ fingerprint: "A".repeat(64) }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("invalid_fingerprint");
  });

  it("returns 400 for missing fingerprint field", async () => {
    const res = await POST(makeRequest({ notAFingerprint: "whatever" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("invalid_body");
  });

  it("returns 400 for empty body", async () => {
    const req = new NextRequest("http://localhost:9653/api/trial/init", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token",
        "x-forwarded-for": "127.0.0.1",
      },
      body: "not-valid-json",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Firestore failure
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 500 when Firestore write fails", async () => {
    mockDocRef.get
      .mockResolvedValueOnce(missingSnap) // route's getTrial
      .mockResolvedValueOnce(missingSnap); // initTrial's internal getTrial
    mockDocRef.set.mockRejectedValueOnce(new Error("Firestore unavailable"));

    const res = await POST(makeRequest({ fingerprint: VALID_FINGERPRINT }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("internal_error");
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Cache-Control header
  // ═══════════════════════════════════════════════════════════════════════

  it("response includes Cache-Control: no-store", async () => {
    mockDocRef.get
      .mockResolvedValueOnce(missingSnap)
      .mockResolvedValueOnce(missingSnap);

    const res = await POST(makeRequest({ fingerprint: VALID_FINGERPRINT }));

    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Rate limiting — Loki QA addition (#922)
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 429 when rate limit is exceeded", async () => {
    mockRateLimit.mockReturnValueOnce({ success: false, remaining: 0 });

    const res = await POST(makeRequest({ fingerprint: VALID_FINGERPRINT }));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toBe("rate_limited");
  });
});
