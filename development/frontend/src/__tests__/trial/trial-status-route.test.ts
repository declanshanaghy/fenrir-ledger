/**
 * Integration tests for POST /api/trial/status
 *
 * Covers:
 *  - Returns active status with remaining days for an existing trial
 *  - Auto-initializes trial when none exists (defense-in-depth fallback, #944)
 *  - Canceled Stripe customers receive an active trial (no blocking)
 *  - Returns correct status for expired trial
 *  - Returns correct status for converted trial
 *  - Invalid fingerprint returns 400
 *  - Missing fingerprint returns 400
 *  - Rate limit returns 429
 *  - Firestore failure falls through gracefully
 *
 * @see src/app/api/trial/status/route.ts
 * @ref Issue #944 (regression of #922), #1516
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

const mockRateLimit = vi.hoisted(() => vi.fn(() => ({ success: true, remaining: 29 })));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mockRateLimit,
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockRequireAuthz = vi.fn();
vi.mock("@/lib/auth/authz", () => ({
  requireAuthz: (...args: unknown[]) => mockRequireAuthz(...args),
}));

// ── Import route handler after mocks ──────────────────────────────────────────

import { POST } from "@/app/api/trial/status/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_FINGERPRINT = "a".repeat(64);

/** Snapshot for a missing document. */
const missingSnap = { exists: false, data: () => null };

/** Snapshot for an existing trial. */
function existingSnap(trial: Record<string, unknown>) {
  return { exists: true, data: () => ({ ...trial, expiresAt: {} }) };
}

function makeRequest(body: Record<string, unknown> = {}, token = "valid-token"): NextRequest {
  return new NextRequest("http://localhost:9653/api/trial/status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-forwarded-for": "127.0.0.1",
    },
    body: JSON.stringify(body),
  });
}

const MOCK_FIRESTORE_USER = { clerkUserId: "google-sub-123", email: "test@test.com", displayName: "Test User", householdId: "hh-test", role: "owner" as const, createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" };

function authOk() {
  mockRequireAuthz.mockResolvedValue({ ok: true, user: { sub: "google-sub-123" }, firestoreUser: MOCK_FIRESTORE_USER });
}

/** Returns an ISO date N days ago. */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("POST /api/trial/status", () => {
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
  // Active trial — existing Firestore record
  // ═══════════════════════════════════════════════════════════════════════

  it("returns active status with remaining days for a new trial", async () => {
    const startDate = daysAgo(0); // started today
    mockDocRef.get.mockResolvedValueOnce(existingSnap({ startDate }));

    const res = await POST(makeRequest({ fingerprint: VALID_FINGERPRINT }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("active");
    expect(body.remainingDays).toBe(30);
    // Firestore set should NOT be called — trial already exists
    expect(mockDocRef.set).not.toHaveBeenCalled();
  });

  it("returns correct remaining days based on start date", async () => {
    const startDate = daysAgo(5); // 5 days into 30-day trial
    mockDocRef.get.mockResolvedValueOnce(existingSnap({ startDate }));

    const res = await POST(makeRequest({ fingerprint: VALID_FINGERPRINT }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("active");
    expect(body.remainingDays).toBe(25);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Defense-in-depth: auto-init when trial is missing (#944)
  // ═══════════════════════════════════════════════════════════════════════

  it("auto-initializes trial when none exists and returns active status", async () => {
    // First GET (status route's getTrial) returns null
    mockDocRef.get
      .mockResolvedValueOnce(missingSnap) // getTrial in status route: not found
      .mockResolvedValueOnce(missingSnap); // getTrial inside initTrial: also not found
    // Firestore SET succeeds for the new trial
    mockDocRef.set.mockResolvedValueOnce(undefined);

    const res = await POST(makeRequest({ fingerprint: VALID_FINGERPRINT }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("active");
    expect(body.remainingDays).toBe(30);
    // Trial was written to Firestore
    expect(mockDocRef.set).toHaveBeenCalledOnce();
    expect(mockDb.doc).toHaveBeenCalledWith(`trials/${VALID_FINGERPRINT}`);
  });

  it("auto-init is idempotent: if trial exists between getTrial and initTrial, preserves original", async () => {
    const originalStartDate = "2026-03-01T00:00:00.000Z";
    // getTrial returns null (missed by callback), but initTrial finds it (race condition resolved)
    mockDocRef.get
      .mockResolvedValueOnce(missingSnap) // getTrial in status route: not found
      .mockResolvedValueOnce(existingSnap({ startDate: originalStartDate })); // getTrial inside initTrial: found

    const res = await POST(makeRequest({ fingerprint: VALID_FINGERPRINT }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("active");
    // No new Firestore write — initTrial returned the existing record
    expect(mockDocRef.set).not.toHaveBeenCalled();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Canceled Stripe customers can start a trial (#944 AC)
  // ═══════════════════════════════════════════════════════════════════════

  it("returns active trial for a user with a canceled Stripe subscription", async () => {
    mockDocRef.get
      .mockResolvedValueOnce(missingSnap)
      .mockResolvedValueOnce(missingSnap);
    mockDocRef.set.mockResolvedValueOnce(undefined);

    mockRequireAuthz.mockResolvedValue({
      ok: true,
      user: { sub: "google-sub-canceled-stripe", email: "user@example.com" },
      firestoreUser: { ...MOCK_FIRESTORE_USER, clerkUserId: "google-sub-canceled-stripe", email: "user@example.com" },
    });

    const res = await POST(makeRequest({ fingerprint: VALID_FINGERPRINT }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("active");
    expect(body.remainingDays).toBe(30);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Expired trial
  // ═══════════════════════════════════════════════════════════════════════

  it("returns expired status for trial started 31 days ago", async () => {
    const startDate = daysAgo(31); // 31 days ago — beyond the 30-day trial
    mockDocRef.get.mockResolvedValueOnce(existingSnap({ startDate }));

    const res = await POST(makeRequest({ fingerprint: VALID_FINGERPRINT }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("expired");
    expect(body.remainingDays).toBe(0);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Converted trial
  // ═══════════════════════════════════════════════════════════════════════

  it("returns converted status for a trial with a convertedDate", async () => {
    const startDate = daysAgo(10);
    const convertedDate = daysAgo(2);
    mockDocRef.get.mockResolvedValueOnce(existingSnap({ startDate, convertedDate }));

    const res = await POST(makeRequest({ fingerprint: VALID_FINGERPRINT }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("converted");
    expect(body.remainingDays).toBe(0);
    expect(body.convertedDate).toBe(convertedDate);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Anonymous access — no auth token required (Issue #1413)
  // ═══════════════════════════════════════════════════════════════════════

  it("allows anonymous request (no Bearer token) with valid fingerprint", async () => {
    const startDate = daysAgo(0);
    mockDocRef.get.mockResolvedValueOnce(existingSnap({ startDate }));

    // Request with no Authorization header
    const req = new NextRequest("http://localhost:9653/api/trial/status", {
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
    expect(body.status).toBe("active");
    expect(body.remainingDays).toBe(30);
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

  it("returns 400 for missing fingerprint field", async () => {
    const res = await POST(makeRequest({ notAFingerprint: "whatever" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("invalid_body");
  });

  it("returns 400 for empty body", async () => {
    const req = new NextRequest("http://localhost:9653/api/trial/status", {
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
  // Rate limiting
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 429 when rate limit is exceeded", async () => {
    mockRateLimit.mockReturnValueOnce({ success: false, remaining: 0 });

    const res = await POST(makeRequest({ fingerprint: VALID_FINGERPRINT }));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toBe("rate_limited");
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Cache-Control header
  // ═══════════════════════════════════════════════════════════════════════

  it("response includes Cache-Control: no-store", async () => {
    const startDate = daysAgo(0);
    mockDocRef.get.mockResolvedValueOnce(existingSnap({ startDate }));

    const res = await POST(makeRequest({ fingerprint: VALID_FINGERPRINT }));

    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Auto-init failure: Firestore unavailable
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 500 when getTrial fails and auto-init Firestore write also fails", async () => {
    // getTrial fails — error is caught in getTrial, returns null
    // initTrial is then attempted; its Firestore SET also fails → throws
    mockDocRef.get.mockRejectedValue(new Error("Firestore unavailable"));
    mockDocRef.set.mockRejectedValue(new Error("Firestore unavailable"));

    const res = await POST(makeRequest({ fingerprint: VALID_FINGERPRINT }));
    const body = await res.json();

    // Auto-init failure is now surfaced as a 500 (fixes #1589: no silent "none")
    expect(res.status).toBe(500);
    expect(body.error).toBe("internal_error");
  });
});
