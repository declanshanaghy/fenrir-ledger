/**
 * Integration tests for POST /api/trial/status
 *
 * Covers:
 *  - Returns active status with remaining days for an existing trial
 *  - Returns { status: "none" } when no trial exists (read-only, issue #1627)
 *  - Returns correct status for expired trial
 *  - Returns correct status for converted trial
 *  - Unauthenticated request returns status:none (200, not 401)
 *  - Rate limit returns 429
 *  - Firestore failure returns "none" (getTrial swallows errors)
 *
 * @see src/app/api/trial/status/route.ts
 * @ref Issue #1627 (status is now read-only, no auto-init), #1634 (auth-based)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

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

const mockRateLimit = vi.hoisted(() => vi.fn(() => ({ success: true, remaining: 29 })));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mockRateLimit,
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockRequireAuth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

// ── Import route handler after mocks ──────────────────────────────────────────

import { POST } from "@/app/api/trial/status/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_ID = "google-sub-123";

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

function makeRequest(token = "valid-token"): NextRequest {
  return new NextRequest("http://localhost:9653/api/trial/status", {
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
  mockRequireAuth.mockResolvedValue({ ok: false });
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("POST /api/trial/status", () => {
  beforeEach(() => {
    authOk();
    mockDocRef.get.mockResolvedValue(missingSnap);
    mockDocRef.set.mockResolvedValue(undefined);
    mockDocRef.update.mockResolvedValue(undefined);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Active trial — existing Firestore record
  // ═══════════════════════════════════════════════════════════════════════

  it("returns active status with remaining days for a new trial", async () => {
    const startDate = daysAgo(0);
    mockDocRef.get.mockResolvedValueOnce(existingSnap({ startDate }));

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("active");
    expect(body.remainingDays).toBe(30);
    expect(mockDocRef.set).not.toHaveBeenCalled();
  });

  it("returns correct remaining days based on expiresAt", async () => {
    const startDate = daysAgo(5); // 5 days into 30-day trial
    // expiresAt is the canonical source — set it to 25 days from now
    const expiresAt = new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString();
    mockDocRef.get.mockResolvedValueOnce(existingSnap({ startDate, expiresAt }));

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("active");
    expect(body.remainingDays).toBe(25);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Read-only: returns "none" when no trial exists (issue #1627)
  // ═══════════════════════════════════════════════════════════════════════

  it("returns status none when no trial exists — does NOT auto-initialize", async () => {
    mockDocRef.get.mockResolvedValueOnce(missingSnap);

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("none");
    expect(mockDocRef.set).not.toHaveBeenCalled();
  });

  it("returns status none and includes cacheVersion when no trial exists", async () => {
    mockDocRef.get.mockResolvedValueOnce(missingSnap);

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("none");
    expect(typeof body.cacheVersion).toBe("number");
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Expired trial
  // ═══════════════════════════════════════════════════════════════════════

  it("returns expired status for trial started 31 days ago", async () => {
    const startDate = daysAgo(31);
    const expiresAt = new Date(new Date(startDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    mockDocRef.get.mockResolvedValueOnce(
      existingSnap({ startDate, expiresAt }),
    );

    const res = await POST(makeRequest());
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

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("converted");
    expect(body.remainingDays).toBe(0);
    expect(body.convertedDate).toBe(convertedDate);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Unauthenticated access — returns "none" (not 401)
  // ═══════════════════════════════════════════════════════════════════════

  it("returns status:none for unauthenticated request (200, not 401)", async () => {
    authFail();

    const res = await POST(makeRequest("invalid-token"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("none");
    // Firestore not hit — route bails before getTrial
    expect(mockDocRef.get).not.toHaveBeenCalled();
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
  // Cache-Control header
  // ═══════════════════════════════════════════════════════════════════════

  it("response includes Cache-Control: no-store", async () => {
    const res = await POST(makeRequest());

    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Firestore unavailable — getTrial swallows errors and returns null
  // ═══════════════════════════════════════════════════════════════════════

  it("returns status none when Firestore is unavailable (getTrial swallows errors)", async () => {
    mockDocRef.get.mockRejectedValue(new Error("Firestore unavailable"));

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("none");
    expect(mockDocRef.set).not.toHaveBeenCalled();
  });
});
