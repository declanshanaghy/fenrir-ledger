/**
 * Integration tests for POST /api/trial/status
 *
 * Covers:
 *  - Returns active status with remaining days for an existing trial
 *  - Returns { status: "none" } when no trial exists (read-only, issue #1627)
 *  - Returns correct status for expired trial
 *  - Returns correct status for converted trial
 *  - Invalid fingerprint returns 400
 *  - Missing fingerprint returns 400
 *  - Rate limit returns 429
 *  - Firestore failure returns "none" (getTrial swallows errors)
 *
 * @see src/app/api/trial/status/route.ts
 * @ref Issue #1627 (status is now read-only, no auto-init)
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

const MOCK_FIRESTORE_USER = { userId: "google-sub-123", email: "test@test.com", displayName: "Test User", householdId: "hh-test", role: "owner" as const, createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" };

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
  // Read-only: returns "none" when no trial exists (issue #1627)
  // ═══════════════════════════════════════════════════════════════════════

  it("returns status none when no trial exists — does NOT auto-initialize", async () => {
    // getTrial returns null (not found)
    mockDocRef.get.mockResolvedValueOnce(missingSnap);

    const res = await POST(makeRequest({ fingerprint: VALID_FINGERPRINT }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("none");
    // Firestore set must NOT be called — status endpoint is read-only
    expect(mockDocRef.set).not.toHaveBeenCalled();
  });

  it("returns status none and includes cacheVersion when no trial exists", async () => {
    mockDocRef.get.mockResolvedValueOnce(missingSnap);

    const res = await POST(makeRequest({ fingerprint: VALID_FINGERPRINT }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("none");
    expect(typeof body.cacheVersion).toBe("number");
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
  // Firestore unavailable — getTrial swallows errors and returns null
  // ═══════════════════════════════════════════════════════════════════════

  it("returns status none when Firestore is unavailable (getTrial swallows errors)", async () => {
    // getTrial's internal try-catch swallows Firestore errors and returns null
    mockDocRef.get.mockRejectedValue(new Error("Firestore unavailable"));

    const res = await POST(makeRequest({ fingerprint: VALID_FINGERPRINT }));
    const body = await res.json();

    // Status endpoint returns "none" — Firestore errors are absorbed by getTrial
    expect(res.status).toBe(200);
    expect(body.status).toBe("none");
    // No write attempt — status route is read-only
    expect(mockDocRef.set).not.toHaveBeenCalled();
  });
});
