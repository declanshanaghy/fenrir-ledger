/**
 * Unit tests for kv/trial-store.ts — Firestore trial CRUD operations.
 *
 * Mocks the Firestore client to test get/set paths and error handling.
 * Includes boundary condition tests merged from trial/trial-store.test.ts (issue #944).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mock Firestore client ──────────────────────────────────────────────────

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

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Import after mock ────────────────────────────────────────────────────

import { getTrial, initTrial, markTrialConverted, computeTrialStatus, linkTrialToUser, getFingerprintByUserId } from "@/lib/kv/trial-store";
import type { StoredTrial } from "@/lib/kv/trial-store";
import { TRIAL_DURATION_DAYS } from "@/lib/trial-utils";

// ── Test data ────────────────────────────────────────────────────────────

const FINGERPRINT = "a".repeat(64);

/** Helper: snapshot that returns an existing trial. */
function existingSnap(trial: StoredTrial) {
  return { exists: true, data: () => ({ ...trial, expiresAt: {} }) };
}

/** Helper: snapshot for a missing document. */
const missingSnap = { exists: false, data: () => null };

// ── Tests ─────────────────────────────────────────────────────────────────

describe("trial-store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: doc not found
    mockDocRef.get.mockResolvedValue(missingSnap);
    mockDocRef.set.mockResolvedValue(undefined);
    mockDocRef.update.mockResolvedValue(undefined);
    mockCollectionRef.get.mockResolvedValue({ empty: true, docs: [] });
  });

  describe("getTrial", () => {
    it("returns trial when found in Firestore", async () => {
      const trial: StoredTrial = { startDate: "2025-01-01T00:00:00.000Z" };
      mockDocRef.get.mockResolvedValueOnce(existingSnap(trial));

      const result = await getTrial(FINGERPRINT);
      expect(result).toEqual(trial);
      expect(mockDb.doc).toHaveBeenCalledWith(`trials/${FINGERPRINT}`);
    });

    it("returns null when not found", async () => {
      mockDocRef.get.mockResolvedValueOnce(missingSnap);

      const result = await getTrial(FINGERPRINT);
      expect(result).toBeNull();
    });

    it("returns null on Firestore failure (does not throw)", async () => {
      mockDocRef.get.mockRejectedValueOnce(new Error("Firestore connection failed"));

      const result = await getTrial(FINGERPRINT);
      expect(result).toBeNull();
    });

    it("strips expiresAt from returned trial", async () => {
      const trial: StoredTrial = { startDate: "2025-01-01T00:00:00.000Z" };
      mockDocRef.get.mockResolvedValueOnce(existingSnap(trial));

      const result = await getTrial(FINGERPRINT);
      expect(result).not.toHaveProperty("expiresAt");
    });
  });

  describe("initTrial", () => {
    it("returns existing trial if already exists (idempotent)", async () => {
      const trial: StoredTrial = { startDate: "2025-01-01T00:00:00.000Z" };
      mockDocRef.get.mockResolvedValueOnce(existingSnap(trial));

      const result = await initTrial(FINGERPRINT);
      expect(result).toEqual(trial);
      expect(mockDocRef.set).not.toHaveBeenCalled();
    });

    it("creates new trial when none exists", async () => {
      mockDocRef.get.mockResolvedValueOnce(missingSnap);

      const result = await initTrial(FINGERPRINT);
      expect(result.startDate).toBeDefined();
      expect(mockDocRef.set).toHaveBeenCalledOnce();
      const written = mockDocRef.set.mock.calls[0]![0] as Record<string, unknown>;
      expect(written).toMatchObject({ startDate: expect.any(String) });
      expect(written).toHaveProperty("expiresAt");
    });

    it("stores document at trials/{fingerprint}", async () => {
      mockDocRef.get.mockResolvedValueOnce(missingSnap);

      await initTrial(FINGERPRINT);

      expect(mockDb.doc).toHaveBeenCalledWith(`trials/${FINGERPRINT}`);
    });

    it("includes userId when provided", async () => {
      mockDocRef.get.mockResolvedValueOnce(missingSnap);

      const result = await initTrial(FINGERPRINT, "user-123");
      expect(result.userId).toBe("user-123");
      const written = mockDocRef.set.mock.calls[0]![0] as Record<string, unknown>;
      expect(written).toMatchObject({ userId: "user-123" });
    });

    it("throws on Firestore failure during write", async () => {
      mockDocRef.get.mockResolvedValueOnce(missingSnap);
      mockDocRef.set.mockRejectedValueOnce(new Error("Firestore write failed"));

      await expect(initTrial(FINGERPRINT)).rejects.toThrow("Firestore write failed");
    });
  });

  describe("linkTrialToUser", () => {
    it("updates userId on existing trial", async () => {
      const trial: StoredTrial = { startDate: "2025-01-01T00:00:00.000Z" };
      mockDocRef.get.mockResolvedValueOnce(existingSnap(trial));

      await linkTrialToUser(FINGERPRINT, "user-456");

      expect(mockDocRef.update).toHaveBeenCalledWith({ userId: "user-456" });
    });

    it("no-ops when trial not found", async () => {
      mockDocRef.get.mockResolvedValueOnce(missingSnap);

      await linkTrialToUser(FINGERPRINT, "user-456");

      expect(mockDocRef.update).not.toHaveBeenCalled();
    });

    it("no-ops when trial already linked to same userId", async () => {
      const trial: StoredTrial = { startDate: "2025-01-01T00:00:00.000Z", userId: "user-456" };
      mockDocRef.get.mockResolvedValueOnce(existingSnap(trial));

      await linkTrialToUser(FINGERPRINT, "user-456");

      expect(mockDocRef.update).not.toHaveBeenCalled();
    });
  });

  describe("getFingerprintByUserId", () => {
    it("returns fingerprint when userId found", async () => {
      const fp = FINGERPRINT;
      mockCollectionRef.get.mockResolvedValueOnce({
        empty: false,
        docs: [{ id: fp }],
      });

      const result = await getFingerprintByUserId("user-123");
      expect(result).toBe(fp);
      expect(mockDb.collection).toHaveBeenCalledWith("trials");
    });

    it("returns null when userId not found", async () => {
      mockCollectionRef.get.mockResolvedValueOnce({ empty: true, docs: [] });

      const result = await getFingerprintByUserId("user-unknown");
      expect(result).toBeNull();
    });

    it("returns null on Firestore failure", async () => {
      mockCollectionRef.get.mockRejectedValueOnce(new Error("Firestore error"));

      const result = await getFingerprintByUserId("user-123");
      expect(result).toBeNull();
    });
  });

  describe("markTrialConverted", () => {
    it("returns false if no trial exists", async () => {
      mockDocRef.get.mockResolvedValueOnce(missingSnap);

      const result = await markTrialConverted(FINGERPRINT);
      expect(result).toBe(false);
    });

    it("returns true if already converted", async () => {
      const trial: StoredTrial = {
        startDate: "2025-01-01T00:00:00.000Z",
        convertedDate: "2025-01-15T00:00:00.000Z",
      };
      mockDocRef.get.mockResolvedValueOnce(existingSnap(trial));

      const result = await markTrialConverted(FINGERPRINT);
      expect(result).toBe(true);
      expect(mockDocRef.update).not.toHaveBeenCalled();
    });

    it("sets convertedDate on unconverted trial via update", async () => {
      const trial: StoredTrial = { startDate: "2025-01-01T00:00:00.000Z" };
      mockDocRef.get.mockResolvedValueOnce(existingSnap(trial));

      const result = await markTrialConverted(FINGERPRINT);
      expect(result).toBe(true);
      expect(mockDocRef.update).toHaveBeenCalledWith(
        expect.objectContaining({ convertedDate: expect.any(String) })
      );
    });
  });

  describe("computeTrialStatus", () => {
    it("returns none for null trial", () => {
      const result = computeTrialStatus(null);
      expect(result).toEqual({ remainingDays: 0, status: "none" });
    });

    it("returns converted for trial with convertedDate", () => {
      const trial: StoredTrial = {
        startDate: "2025-01-01T00:00:00.000Z",
        convertedDate: "2025-01-15T00:00:00.000Z",
      };
      const result = computeTrialStatus(trial);
      expect(result.status).toBe("converted");
      expect(result.convertedDate).toBe("2025-01-15T00:00:00.000Z");
    });

    it("returns expired for trial older than trial duration", () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 60);
      const trial: StoredTrial = { startDate: oldDate.toISOString() };
      const result = computeTrialStatus(trial);
      expect(result.status).toBe("expired");
      expect(result.remainingDays).toBe(0);
    });

    it("returns active for recent trial", () => {
      const trial: StoredTrial = { startDate: new Date().toISOString() };
      const result = computeTrialStatus(trial);
      expect(result.status).toBe("active");
      expect(result.remainingDays).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Boundary condition tests (merged from trial/trial-store.test.ts — issue #944)
// ---------------------------------------------------------------------------

function daysAgo(n: number): string {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

const VALID_FINGERPRINT_B = "b".repeat(64);

describe("computeTrialStatus — boundary conditions (#944 AC2)", () => {
  it("returns status:none when trial is null (no record in Firestore)", () => {
    const result = computeTrialStatus(null);
    expect(result.status).toBe("none");
    expect(result.remainingDays).toBe(0);
  });

  it(`returns active with 1 remaining day when exactly ${TRIAL_DURATION_DAYS - 1} days have elapsed`, () => {
    const startDate = daysAgo(TRIAL_DURATION_DAYS - 1); // day 29
    const result = computeTrialStatus({ startDate });
    expect(result.status).toBe("active");
    expect(result.remainingDays).toBe(1);
  });

  it(`returns expired with 0 days when exactly ${TRIAL_DURATION_DAYS} days have elapsed`, () => {
    const startDate = daysAgo(TRIAL_DURATION_DAYS); // day 30 — trial is over
    const result = computeTrialStatus({ startDate });
    expect(result.status).toBe("expired");
    expect(result.remainingDays).toBe(0);
  });

  it("returns converted (overriding expiry) when convertedDate is set (#944 AC3)", () => {
    const startDate = daysAgo(TRIAL_DURATION_DAYS + 5); // well past expiry
    const convertedDate = daysAgo(TRIAL_DURATION_DAYS - 20);
    const result = computeTrialStatus({ startDate, convertedDate });
    expect(result.status).toBe("converted");
    expect(result.remainingDays).toBe(0);
    expect(result.convertedDate).toBe(convertedDate);
  });
});

describe("initTrial — Firestore document path and expiresAt field (#944 AC1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDocRef.get.mockResolvedValue(missingSnap);
    mockDocRef.set.mockResolvedValue(undefined);
  });

  it("writes trial under trials/{fingerprint} with expiresAt set to ~60 days from now", async () => {
    await initTrial(VALID_FINGERPRINT_B);

    expect(mockDb.doc).toHaveBeenCalledWith(`trials/${VALID_FINGERPRINT_B}`);
    expect(mockDocRef.set).toHaveBeenCalledOnce();

    const written = mockDocRef.set.mock.calls[0]![0] as Record<string, unknown>;
    expect(written).toHaveProperty("expiresAt");
    expect(written).toHaveProperty("startDate");
    // expiresAt should be a Firestore Timestamp object (not a string)
    const expiresAt = written["expiresAt"] as { seconds?: number };
    expect(typeof expiresAt).toBe("object");
  });
});

describe("getTrial — malformed/missing data error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null (not throws) when Firestore throws an error", async () => {
    mockDocRef.get.mockRejectedValueOnce(new Error("network error"));

    const result = await getTrial(VALID_FINGERPRINT_B);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Migration tests — issue #1624 dual-format UUID ↔ SHA-256 fallback
// ---------------------------------------------------------------------------

import { createHash } from "crypto";

const UUID_FP = "a3f4e891-bc12-4d9a-87c3-1f5e209b3d7a"; // UUID v4 format (new)
const UUID_LEGACY_KEY = createHash("sha256").update(UUID_FP).digest("hex"); // SHA-256 of UUID

describe("migration — UUID fingerprint falls back to legacy SHA-256 key (#1624)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDocRef.get.mockResolvedValue(missingSnap);
    mockDocRef.set.mockResolvedValue(undefined);
    mockDocRef.update.mockResolvedValue(undefined);
  });

  describe("getTrial", () => {
    it("returns null when not found at either UUID or legacy SHA-256 key", async () => {
      // Both lookups return missing
      mockDocRef.get
        .mockResolvedValueOnce(missingSnap) // UUID key
        .mockResolvedValueOnce(missingSnap); // legacy SHA-256 key

      const result = await getTrial(UUID_FP);
      expect(result).toBeNull();
      // Both keys were tried
      expect(mockDocRef.get).toHaveBeenCalledTimes(2);
    });

    it("returns trial found at legacy SHA-256 key when UUID key is empty", async () => {
      const trial: StoredTrial = { startDate: "2025-01-01T00:00:00.000Z" };
      mockDocRef.get
        .mockResolvedValueOnce(missingSnap)       // UUID key: not found
        .mockResolvedValueOnce(existingSnap(trial)); // legacy SHA-256 key: found

      const result = await getTrial(UUID_FP);
      expect(result).toEqual(trial);

      // First lookup: UUID key; second: legacy SHA-256 key
      expect(mockDb.doc).toHaveBeenNthCalledWith(1, `trials/${UUID_FP}`);
      expect(mockDb.doc).toHaveBeenNthCalledWith(2, `trials/${UUID_LEGACY_KEY}`);
    });

    it("returns trial found at UUID key without trying legacy key", async () => {
      const trial: StoredTrial = { startDate: "2025-02-01T00:00:00.000Z" };
      mockDocRef.get.mockResolvedValueOnce(existingSnap(trial)); // UUID key: found

      const result = await getTrial(UUID_FP);
      expect(result).toEqual(trial);
      // Only one get — no legacy fallback needed
      expect(mockDocRef.get).toHaveBeenCalledTimes(1);
    });

    it("does NOT attempt legacy fallback for 64-char hex fingerprints", async () => {
      mockDocRef.get.mockResolvedValueOnce(missingSnap);

      const result = await getTrial(FINGERPRINT); // 64-char hex
      expect(result).toBeNull();
      // Only one get — no UUID pattern match, so no legacy fallback
      expect(mockDocRef.get).toHaveBeenCalledTimes(1);
    });
  });

  describe("markTrialConverted", () => {
    it("updates doc at legacy SHA-256 key when UUID fingerprint resolves there", async () => {
      const trial: StoredTrial = { startDate: "2025-01-01T00:00:00.000Z" };
      mockDocRef.get
        .mockResolvedValueOnce(missingSnap)       // UUID key: not found
        .mockResolvedValueOnce(existingSnap(trial)); // legacy SHA-256 key: found

      const result = await markTrialConverted(UUID_FP);
      expect(result).toBe(true);
      expect(mockDocRef.update).toHaveBeenCalledWith(
        expect.objectContaining({ convertedDate: expect.any(String) }),
      );
      // Update should target the legacy key doc
      const docCalls = mockDb.doc.mock.calls.map((c) => c[0] as string);
      expect(docCalls).toContain(`trials/${UUID_LEGACY_KEY}`);
    });
  });

  describe("linkTrialToUser", () => {
    it("updates doc at legacy SHA-256 key when UUID fingerprint resolves there", async () => {
      const trial: StoredTrial = { startDate: "2025-01-01T00:00:00.000Z" };
      mockDocRef.get
        .mockResolvedValueOnce(missingSnap)       // UUID key: not found
        .mockResolvedValueOnce(existingSnap(trial)); // legacy SHA-256 key: found

      await linkTrialToUser(UUID_FP, "user-789");
      expect(mockDocRef.update).toHaveBeenCalledWith({ userId: "user-789" });

      // Update should target the legacy key doc
      const docCalls = mockDb.doc.mock.calls.map((c) => c[0] as string);
      expect(docCalls).toContain(`trials/${UUID_LEGACY_KEY}`);
    });
  });
});
