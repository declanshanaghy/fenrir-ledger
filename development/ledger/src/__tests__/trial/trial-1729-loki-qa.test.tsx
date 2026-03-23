/**
 * Loki QA tests for Issue #1729 — Trial expiration must use expiresAt from Firestore
 *
 * Validates the acceptance criteria:
 *  - computeTrialStatus() uses expiresAt, never startDate + TRIAL_DURATION_DAYS
 *  - Admin-adjusted expiresAt (extended beyond 30 days from start) is honoured
 *  - startDate+30d=expired but expiresAt=future → active (key divergence test)
 *  - expiresAt is forwarded from API response → TrialStatusContext → useTrialStatus hook
 *  - TRIAL_DURATION_DAYS only used on trial creation (makeExpiresAt / initTrial)
 *
 * @ref Issue #1729
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// ── Mocks for context tests ───────────────────────────────────────────────────

vi.mock("@/lib/auth/refresh-session", () => ({
  ensureFreshToken: vi.fn(() => Promise.resolve("mock-token")),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuthContext: () => ({
    status: "authenticated",
    session: null,
    householdId: "test-household",
    signOut: vi.fn(),
  }),
}));

// ── Mocks for trial-store tests ───────────────────────────────────────────────

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

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { computeTrialStatus, initTrial } from "@/lib/kv/trial-store";
import type { StoredTrial } from "@/lib/kv/trial-store";
import { TRIAL_DURATION_DAYS } from "@/lib/trial-utils";
import { useTrialStatus, clearTrialStatusCache } from "@/hooks/useTrialStatus";
import { TrialStatusProvider } from "@/contexts/TrialStatusContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();
}
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(TrialStatusProvider, null, children);
}

function makeApiResponse(overrides: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({ status: "active", remainingDays: 14, cacheVersion: 3, ...overrides }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

const missingSnap = { exists: false, data: () => null };

// ── 1. computeTrialStatus — expiresAt is the single source of truth ───────────

describe("computeTrialStatus — expiresAt as single source of truth (Issue #1729)", () => {
  it("uses expiresAt when startDate+30d would say expired but expiresAt is in the future", () => {
    // startDate 40 days ago → startDate + 30d = 10 days ago (would be expired)
    // expiresAt = 5 days from now → should be ACTIVE
    const trial: StoredTrial = {
      startDate: daysAgo(40),
      expiresAt: daysFromNow(5),
    };
    const result = computeTrialStatus(trial);
    expect(result.status).toBe("active");
    expect(result.remainingDays).toBe(5);
  });

  it("uses expiresAt when startDate+30d would say active but expiresAt is in the past", () => {
    // startDate 5 days ago → startDate + 30d = 25 days from now (would be active)
    // expiresAt = 1 day ago → should be EXPIRED
    const trial: StoredTrial = {
      startDate: daysAgo(5),
      expiresAt: daysAgo(1),
    };
    const result = computeTrialStatus(trial);
    expect(result.status).toBe("expired");
    expect(result.remainingDays).toBe(0);
  });

  it("honours admin-extended expiresAt beyond 30-day standard duration", () => {
    // Admin extended trial to 60 days total from start (30 days ago + 30 days future)
    const trial: StoredTrial = {
      startDate: daysAgo(30),
      expiresAt: daysFromNow(30), // 60 days total — beyond TRIAL_DURATION_DAYS
    };
    const result = computeTrialStatus(trial);
    expect(result.status).toBe("active");
    expect(result.remainingDays).toBe(30);
  });

  it("does NOT use TRIAL_DURATION_DAYS to compute remaining days", () => {
    // If the code used startDate + TRIAL_DURATION_DAYS, remainingDays would be
    // 30 - 10 = 20 days. But expiresAt says 7 days remain — that must win.
    const trial: StoredTrial = {
      startDate: daysAgo(10),
      expiresAt: daysFromNow(7), // not aligned with startDate + 30d
    };
    const result = computeTrialStatus(trial);
    expect(result.remainingDays).toBe(7);
    // Would be 20 if recalculated from startDate + TRIAL_DURATION_DAYS
    expect(result.remainingDays).not.toBe(TRIAL_DURATION_DAYS - 10);
  });

  it("returns expiresAt in the result so callers can display the canonical expiry date", () => {
    const expiresAt = daysFromNow(15);
    const trial: StoredTrial = {
      startDate: daysAgo(15),
      expiresAt,
    };
    const result = computeTrialStatus(trial);
    expect(result.expiresAt).toBe(expiresAt);
  });
});

// ── 2. initTrial — TRIAL_DURATION_DAYS only used on creation ─────────────────

describe("initTrial — TRIAL_DURATION_DAYS only used when creating a new record (Issue #1729)", () => {
  beforeEach(() => {
    mockDocRef.get.mockResolvedValue(missingSnap);
    mockDocRef.set.mockResolvedValue(undefined);
  });

  it("sets expiresAt = startDate + TRIAL_DURATION_DAYS on fresh trial creation", async () => {
    const { trial } = await initTrial("user-new-trial");
    const startMs = new Date(trial.startDate).getTime();
    const expiresMs = new Date(trial.expiresAt).getTime();
    const diffDays = (expiresMs - startMs) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeCloseTo(TRIAL_DURATION_DAYS, 0);
  });

  it("does NOT overwrite expiresAt when returning an existing active trial", async () => {
    // Simulate an admin-adjusted expiresAt far in the future
    const adminExpiresAt = daysFromNow(90);
    mockDocRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        startDate: daysAgo(10),
        expiresAt: adminExpiresAt,
      }),
    });

    const { trial, isNew } = await initTrial("user-existing");
    expect(isNew).toBe(false);
    // The existing expiresAt must be preserved, not recalculated
    expect(trial.expiresAt).toBe(adminExpiresAt);
    expect(mockDocRef.set).not.toHaveBeenCalled();
  });
});

// ── 3. useTrialStatus hook — expiresAt propagated from API response ───────────

describe("useTrialStatus hook — expiresAt propagated from API response (Issue #1729)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearTrialStatusCache();
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it("exposes expiresAt from API response via useTrialStatus hook", async () => {
    const expiresAt = daysFromNow(12);
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      makeApiResponse({ status: "active", remainingDays: 12, expiresAt }),
    );

    const { result } = renderHook(() => useTrialStatus(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.expiresAt).toBe(expiresAt);
  });

  it("expiresAt in hook matches admin-adjusted expiresAt from API (not recalculated)", async () => {
    // Admin extended trial 90 days from now — client must pass this through unchanged
    const adminExpiresAt = daysFromNow(90);
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      makeApiResponse({ status: "active", remainingDays: 90, expiresAt: adminExpiresAt }),
    );

    const { result } = renderHook(() => useTrialStatus(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.expiresAt).toBe(adminExpiresAt);
    expect(result.current.remainingDays).toBe(90);
  });

  it("expiresAt is undefined when API returns status:none (no trial)", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      makeApiResponse({ status: "none", remainingDays: 0, cacheVersion: 3 }),
    );

    const { result } = renderHook(() => useTrialStatus(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.expiresAt).toBeUndefined();
    expect(result.current.status).toBe("none");
  });

  it("expiresAt is present for expired trial (so UI can show when it expired)", async () => {
    const expiresAt = daysAgo(2);
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      makeApiResponse({ status: "expired", remainingDays: 0, expiresAt }),
    );

    const { result } = renderHook(() => useTrialStatus(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.status).toBe("expired");
    expect(result.current.expiresAt).toBe(expiresAt);
  });

  it("forwards expiresAt for converted trial alongside convertedDate", async () => {
    const expiresAt = daysAgo(5);
    const convertedDate = daysAgo(10);
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      makeApiResponse({ status: "converted", remainingDays: 0, expiresAt, convertedDate }),
    );

    const { result } = renderHook(() => useTrialStatus(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.status).toBe("converted");
    expect(result.current.expiresAt).toBe(expiresAt);
    expect(result.current.convertedDate).toBe(convertedDate);
  });
});
