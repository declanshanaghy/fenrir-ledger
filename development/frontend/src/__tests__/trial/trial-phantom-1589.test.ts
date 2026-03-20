/**
 * Tests for phantom trial fixes — Issue #1589
 *
 * Covers:
 *  - /api/trial/status returns 500 when auto-init Firestore write fails
 *    (previously silently fell through with status "none")
 *  - /api/trial/status includes cacheVersion in every 200 response
 *  - cacheVersion equals TRIAL_CACHE_VERSION (2, the Firestore era)
 *  - useTrialStatus busts module-level cache when stored version mismatches
 *  - useTrialStatus persists cacheVersion to localStorage after successful fetch
 *
 * @ref Issue #1589
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { renderHook, waitFor } from "@testing-library/react";

// ── Route handler mocks ────────────────────────────────────────────────────────

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

// ── Hook mocks ─────────────────────────────────────────────────────────────────

const VALID_FINGERPRINT = "a".repeat(64);

const mockComputeFingerprint = vi.hoisted(() =>
  vi.fn(() => Promise.resolve(VALID_FINGERPRINT)),
);
vi.mock("@/lib/trial-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/trial-utils")>();
  return {
    ...actual,
    computeFingerprint: mockComputeFingerprint,
  };
});

const mockEnsureFreshToken = vi.hoisted(() =>
  vi.fn<() => Promise<string | null>>(() => Promise.resolve(null)),
);
vi.mock("@/lib/auth/refresh-session", () => ({
  ensureFreshToken: mockEnsureFreshToken,
}));

// ── Import after mocks ─────────────────────────────────────────────────────────

import { POST } from "@/app/api/trial/status/route";
import { useTrialStatus, clearTrialStatusCache } from "@/hooks/useTrialStatus";
import { TRIAL_CACHE_VERSION, LS_TRIAL_CACHE_VERSION } from "@/lib/trial-utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

const missingSnap = { exists: false, data: () => null };

function existingSnap(trial: Record<string, unknown>) {
  return { exists: true, data: () => ({ ...trial, expiresAt: {} }) };
}

function makeRequest(body: Record<string, unknown> = {}): NextRequest {
  return new NextRequest("http://localhost:9653/api/trial/status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "127.0.0.1",
    },
    body: JSON.stringify(body),
  });
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// ── Route handler tests ────────────────────────────────────────────────────────

describe("POST /api/trial/status — issue #1589 fixes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDocRef.get.mockResolvedValue(missingSnap);
    mockDocRef.set.mockResolvedValue(undefined);
    mockDocRef.update.mockResolvedValue(undefined);
    mockCollectionRef.get.mockResolvedValue({ empty: true, docs: [] });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Auto-init failure: return 500, not silent "none"
  // ═══════════════════════════════════════════════════════════════════════

  it("returns 500 when auto-init Firestore write fails (not silent none)", async () => {
    // getTrial: not found → triggers auto-init
    mockDocRef.get
      .mockResolvedValueOnce(missingSnap) // getTrial in status route
      .mockResolvedValueOnce(missingSnap); // getTrial inside initTrial
    // Firestore SET fails
    mockDocRef.set.mockRejectedValueOnce(new Error("Firestore quota exceeded"));

    const res = await POST(makeRequest({ fingerprint: VALID_FINGERPRINT }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("internal_error");
  });

  it("auto-init failure does NOT return status none (phantom prevention)", async () => {
    mockDocRef.get
      .mockResolvedValueOnce(missingSnap)
      .mockResolvedValueOnce(missingSnap);
    mockDocRef.set.mockRejectedValueOnce(new Error("Permission denied"));

    const res = await POST(makeRequest({ fingerprint: VALID_FINGERPRINT }));
    const body = await res.json();

    // Must not return a 200 with status "none" — that could mask a write failure
    expect(res.status).not.toBe(200);
    expect(body.status).toBeUndefined();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // cacheVersion included in 200 responses
  // ═══════════════════════════════════════════════════════════════════════

  it("includes cacheVersion in 200 response for existing trial", async () => {
    mockDocRef.get.mockResolvedValueOnce(existingSnap({ startDate: daysAgo(0) }));

    const res = await POST(makeRequest({ fingerprint: VALID_FINGERPRINT }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cacheVersion).toBe(TRIAL_CACHE_VERSION);
    expect(body.cacheVersion).toBe(2);
  });

  it("includes cacheVersion in 200 response after successful auto-init", async () => {
    mockDocRef.get
      .mockResolvedValueOnce(missingSnap)
      .mockResolvedValueOnce(missingSnap);
    mockDocRef.set.mockResolvedValueOnce(undefined);

    const res = await POST(makeRequest({ fingerprint: VALID_FINGERPRINT }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cacheVersion).toBe(TRIAL_CACHE_VERSION);
  });

  it("cacheVersion equals 2 (Firestore-era constant)", () => {
    expect(TRIAL_CACHE_VERSION).toBe(2);
  });
});

// ── useTrialStatus hook tests ──────────────────────────────────────────────────

describe("useTrialStatus — cache version invalidation (issue #1589)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let localStorageMock: Record<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    clearTrialStatusCache();

    // Mock localStorage
    localStorageMock = {};
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(
      (key) => localStorageMock[key] ?? null,
    );
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => {
      localStorageMock[key] = String(value);
    });

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify({ status: "active", remainingDays: 30, cacheVersion: 2 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("persists cacheVersion to localStorage after a successful fetch", async () => {
    renderHook(() => useTrialStatus());

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    expect(localStorageMock[LS_TRIAL_CACHE_VERSION]).toBe("2");
  });

  it("busts module-level cache when stored version is stale (e.g. version 1 from Redis era)", async () => {
    // Simulate stale Redis-era version in localStorage
    localStorageMock[LS_TRIAL_CACHE_VERSION] = "1";

    // Render hook — should bypass the module cache and fetch fresh
    renderHook(() => useTrialStatus());

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    // After fetch, localStorage should be updated to the current version
    expect(localStorageMock[LS_TRIAL_CACHE_VERSION]).toBe("2");
  });

  it("does not bypass cache when stored version matches current version", async () => {
    // Pre-populate localStorage with current version
    localStorageMock[LS_TRIAL_CACHE_VERSION] = String(TRIAL_CACHE_VERSION);

    // First render: populates module-level cache
    const { unmount } = renderHook(() => useTrialStatus());
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    unmount();

    // Second render with same version: should use cache (no second fetch)
    renderHook(() => useTrialStatus());
    // Wait a tick
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("fetches again after clearTrialStatusCache even if version matches", async () => {
    localStorageMock[LS_TRIAL_CACHE_VERSION] = String(TRIAL_CACHE_VERSION);

    renderHook(() => useTrialStatus());
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

    clearTrialStatusCache();

    renderHook(() => useTrialStatus());
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
  });
});
