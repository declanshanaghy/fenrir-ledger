/**
 * Unit tests for kv/trial-store.ts — household subcollection trial CRUD.
 *
 * Covers:
 *  - getTrial(userId) reads from /households/{userId}/trial
 *  - initTrial(userId) creates at /households/{userId}/trial
 *  - initTrial is idempotent for active/converted trials
 *  - initTrial throws TrialRestartError for expired trials
 *  - markTrialConverted(userId) sets convertedDate
 *  - computeTrialStatus boundary conditions
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mock Firestore client ────────────────────────────────────────────────────

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

// ── Import after mock ────────────────────────────────────────────────────────

import {
  getTrial,
  initTrial,
  markTrialConverted,
  computeTrialStatus,
  TrialRestartError,
} from "@/lib/kv/trial-store";
import type { StoredTrial } from "@/lib/kv/trial-store";
import { TRIAL_DURATION_DAYS } from "@/lib/trial-utils";

// ── Test data ────────────────────────────────────────────────────────────────

const USER_ID = "google-sub-abc123";
const TRIAL_PATH = `households/${USER_ID}/trial/status`;

function activeTrialSnap(overrides: Partial<StoredTrial> = {}) {
  const trial: StoredTrial = {
    startDate: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
  return { exists: true, data: () => trial };
}

function expiredTrialSnap() {
  const start = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  return {
    exists: true,
    data: () => ({
      startDate: start.toISOString(),
      expiresAt: new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }),
  };
}

const missingSnap = { exists: false, data: () => null };

// ── Tests ────────────────────────────────────────────────────────────────────

describe("getTrial", () => {
  beforeEach(() => {
    mockDocRef.get.mockResolvedValue(missingSnap);
  });

  it("reads from /households/{userId}/trial/status path", async () => {
    mockDocRef.get.mockResolvedValueOnce(activeTrialSnap());

    await getTrial(USER_ID);

    expect(mockDb.doc).toHaveBeenCalledWith(TRIAL_PATH);
  });

  it("returns StoredTrial when document exists", async () => {
    const snap = activeTrialSnap();
    mockDocRef.get.mockResolvedValueOnce(snap);

    const result = await getTrial(USER_ID);

    expect(result).not.toBeNull();
    expect(result!.startDate).toBe(snap.data().startDate);
    expect(result!.expiresAt).toBe(snap.data().expiresAt);
  });

  it("returns null when document does not exist", async () => {
    mockDocRef.get.mockResolvedValueOnce(missingSnap);

    const result = await getTrial(USER_ID);

    expect(result).toBeNull();
  });

  it("returns null (does not throw) on Firestore failure", async () => {
    mockDocRef.get.mockRejectedValueOnce(new Error("network error"));

    const result = await getTrial(USER_ID);

    expect(result).toBeNull();
  });

  it("includes convertedDate when set", async () => {
    const convertedDate = "2026-01-15T00:00:00.000Z";
    mockDocRef.get.mockResolvedValueOnce(
      activeTrialSnap({ convertedDate }),
    );

    const result = await getTrial(USER_ID);

    expect(result!.convertedDate).toBe(convertedDate);
  });

  it("omits convertedDate when not set", async () => {
    mockDocRef.get.mockResolvedValueOnce(activeTrialSnap());

    const result = await getTrial(USER_ID);

    expect(result).not.toHaveProperty("convertedDate");
  });
});

describe("initTrial", () => {
  beforeEach(() => {
    mockDocRef.get.mockResolvedValue(missingSnap);
    mockDocRef.set.mockResolvedValue(undefined);
  });

  it("writes to /households/{userId}/trial on first call", async () => {
    await initTrial(USER_ID);

    expect(mockDb.doc).toHaveBeenCalledWith(TRIAL_PATH);
    expect(mockDocRef.set).toHaveBeenCalledOnce();
  });

  it("returns isNew:true and a trial with startDate and expiresAt on first call", async () => {
    const before = Date.now();
    const { trial, isNew } = await initTrial(USER_ID);
    const after = Date.now();

    expect(isNew).toBe(true);
    expect(trial.startDate).toBeDefined();
    expect(trial.expiresAt).toBeDefined();

    const startMs = new Date(trial.startDate).getTime();
    expect(startMs).toBeGreaterThanOrEqual(before);
    expect(startMs).toBeLessThanOrEqual(after);
  });

  it("expiresAt is startDate + TRIAL_DURATION_DAYS", async () => {
    const { trial } = await initTrial(USER_ID);

    const startMs = new Date(trial.startDate).getTime();
    const expiresMs = new Date(trial.expiresAt).getTime();
    const diffDays = (expiresMs - startMs) / (24 * 60 * 60 * 1000);

    expect(diffDays).toBeCloseTo(TRIAL_DURATION_DAYS, 0);
  });

  it("returns isNew:false and existing trial when active trial already exists", async () => {
    const existingStart = "2026-03-01T00:00:00.000Z";
    mockDocRef.get.mockResolvedValueOnce(
      activeTrialSnap({ startDate: existingStart }),
    );

    const { trial, isNew } = await initTrial(USER_ID);

    expect(isNew).toBe(false);
    expect(trial.startDate).toBe(existingStart);
    expect(mockDocRef.set).not.toHaveBeenCalled();
  });

  it("returns isNew:false for converted trial (idempotent)", async () => {
    mockDocRef.get.mockResolvedValueOnce(
      activeTrialSnap({ convertedDate: "2026-02-01T00:00:00.000Z" }),
    );

    const { isNew } = await initTrial(USER_ID);

    expect(isNew).toBe(false);
    expect(mockDocRef.set).not.toHaveBeenCalled();
  });

  it("throws TrialRestartError when trial is expired", async () => {
    mockDocRef.get.mockResolvedValueOnce(expiredTrialSnap());

    await expect(initTrial(USER_ID)).rejects.toThrow(TrialRestartError);
    expect(mockDocRef.set).not.toHaveBeenCalled();
  });

  it("TrialRestartError message includes userId", async () => {
    mockDocRef.get.mockResolvedValueOnce(expiredTrialSnap());

    await expect(initTrial(USER_ID)).rejects.toThrow(USER_ID);
  });

  it("throws (does not swallow) Firestore write failures", async () => {
    mockDocRef.set.mockRejectedValueOnce(new Error("Firestore write failed"));

    await expect(initTrial(USER_ID)).rejects.toThrow("Firestore write failed");
  });
});

describe("markTrialConverted", () => {
  beforeEach(() => {
    mockDocRef.get.mockResolvedValue(missingSnap);
    mockDocRef.update.mockResolvedValue(undefined);
  });

  it("returns false when no trial exists", async () => {
    mockDocRef.get.mockResolvedValueOnce(missingSnap);

    const result = await markTrialConverted(USER_ID);

    expect(result).toBe(false);
    expect(mockDocRef.update).not.toHaveBeenCalled();
  });

  it("returns true and sets convertedDate on unconverted trial", async () => {
    mockDocRef.get.mockResolvedValueOnce(activeTrialSnap());

    const result = await markTrialConverted(USER_ID);

    expect(result).toBe(true);
    expect(mockDocRef.update).toHaveBeenCalledWith(
      expect.objectContaining({ convertedDate: expect.any(String) }),
    );
  });

  it("returns true without re-writing when already converted", async () => {
    mockDocRef.get.mockResolvedValueOnce(
      activeTrialSnap({ convertedDate: "2026-01-15T00:00:00.000Z" }),
    );

    const result = await markTrialConverted(USER_ID);

    expect(result).toBe(true);
    expect(mockDocRef.update).not.toHaveBeenCalled();
  });

  it("reads from correct path", async () => {
    mockDocRef.get.mockResolvedValueOnce(activeTrialSnap());

    await markTrialConverted(USER_ID);

    expect(mockDb.doc).toHaveBeenCalledWith(TRIAL_PATH);
  });
});

// ── computeTrialStatus ───────────────────────────────────────────────────────

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

describe("computeTrialStatus", () => {
  it("returns { status: 'none', remainingDays: 0 } for null", () => {
    expect(computeTrialStatus(null)).toEqual({ remainingDays: 0, status: "none" });
  });

  it("returns 'converted' for trial with convertedDate", () => {
    const trial: StoredTrial = {
      startDate: "2025-01-01T00:00:00.000Z",
      expiresAt: "2025-01-31T00:00:00.000Z",
      convertedDate: "2025-01-15T00:00:00.000Z",
    };
    const result = computeTrialStatus(trial);
    expect(result.status).toBe("converted");
    expect(result.convertedDate).toBe("2025-01-15T00:00:00.000Z");
    expect(result.remainingDays).toBe(0);
    expect(result.expiresAt).toBe("2025-01-31T00:00:00.000Z");
  });

  it("returns 'converted' even if trial is past expiry when convertedDate is set", () => {
    const trial: StoredTrial = {
      startDate: daysAgo(60),
      expiresAt: daysAgo(30),
      convertedDate: daysAgo(50),
    };
    expect(computeTrialStatus(trial).status).toBe("converted");
  });

  it("uses expiresAt directly — ignores startDate for expiration", () => {
    // expiresAt is 1 day in the future; startDate is arbitrarily old.
    // Result must be based on expiresAt, not startDate + TRIAL_DURATION_DAYS.
    const trial: StoredTrial = {
      startDate: daysAgo(365),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    const result = computeTrialStatus(trial);
    expect(result.status).toBe("active");
    expect(result.remainingDays).toBe(1);
  });

  it(`returns 'active' with 1 remaining day when expiresAt is 24h from now`, () => {
    const trial: StoredTrial = {
      startDate: daysAgo(TRIAL_DURATION_DAYS - 1),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    const result = computeTrialStatus(trial);
    expect(result.status).toBe("active");
    expect(result.remainingDays).toBe(1);
    expect(result.expiresAt).toBe(trial.expiresAt);
  });

  it("returns 'expired' when expiresAt is in the past", () => {
    const expiresAt = new Date(Date.now() - 1000).toISOString();
    const trial: StoredTrial = {
      startDate: daysAgo(TRIAL_DURATION_DAYS),
      expiresAt,
    };
    const result = computeTrialStatus(trial);
    expect(result.status).toBe("expired");
    expect(result.remainingDays).toBe(0);
    expect(result.expiresAt).toBe(expiresAt);
  });

  it("returns 'active' with positive remainingDays for recent trial", () => {
    const trial: StoredTrial = {
      startDate: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const result = computeTrialStatus(trial);
    expect(result.status).toBe("active");
    expect(result.remainingDays).toBeGreaterThan(0);
    expect(result.expiresAt).toBe(trial.expiresAt);
  });

  it("returns 'expired' for trial with expiresAt 30 days in the past", () => {
    const trial: StoredTrial = {
      startDate: daysAgo(60),
      expiresAt: daysAgo(30),
    };
    const result = computeTrialStatus(trial);
    expect(result.status).toBe("expired");
    expect(result.remainingDays).toBe(0);
  });

  it("uses expiresAt not startDate+duration — custom expiresAt is honoured", () => {
    // Simulate an admin-adjusted trial: expiresAt extended beyond the standard 30 days
    const trial: StoredTrial = {
      startDate: daysAgo(40),
      expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const result = computeTrialStatus(trial);
    // startDate-based calc would say expired (40 days > 30), but expiresAt says active
    expect(result.status).toBe("active");
    expect(result.remainingDays).toBe(5);
  });
});
