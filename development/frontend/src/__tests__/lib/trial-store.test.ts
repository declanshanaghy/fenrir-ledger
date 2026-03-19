/**
 * Unit tests for kv/trial-store.ts — Redis trial CRUD operations.
 *
 * Mocks ioredis via redis-client to test get/set paths and error handling.
 * Includes boundary condition tests merged from trial/trial-store.test.ts (issue #944).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mock Redis client ─────────────────────────────────────────────────────

const mockRedis = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}));

vi.mock("@/lib/kv/redis-client", () => ({
  getRedisClient: () => mockRedis,
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Import after mock ────────────────────────────────────────────────────

import { getTrial, initTrial, markTrialConverted, computeTrialStatus } from "@/lib/kv/trial-store";
import type { StoredTrial } from "@/lib/kv/trial-store";
import { TRIAL_DURATION_DAYS } from "@/lib/trial-utils";

// ── Test data ────────────────────────────────────────────────────────────

const FINGERPRINT = "a".repeat(64);
const TRIAL_TTL = 60 * 24 * 60 * 60;

// ── Tests ─────────────────────────────────────────────────────────────────

describe("trial-store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTrial", () => {
    it("returns trial when found in Redis", async () => {
      const trial: StoredTrial = { startDate: "2025-01-01T00:00:00.000Z" };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(trial));

      const result = await getTrial(FINGERPRINT);
      expect(result).toEqual(trial);
      expect(mockRedis.get).toHaveBeenCalledWith(`trial:${FINGERPRINT}`);
    });

    it("returns null when not found", async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      const result = await getTrial(FINGERPRINT);
      expect(result).toBeNull();
    });

    it("returns null on Redis failure (does not throw)", async () => {
      mockRedis.get.mockRejectedValueOnce(new Error("Redis connection failed"));

      const result = await getTrial(FINGERPRINT);
      expect(result).toBeNull();
    });
  });

  describe("initTrial", () => {
    it("returns existing trial if already exists (idempotent)", async () => {
      const trial: StoredTrial = { startDate: "2025-01-01T00:00:00.000Z" };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(trial));

      const result = await initTrial(FINGERPRINT);
      expect(result).toEqual(trial);
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it("creates new trial when none exists", async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockRedis.set.mockResolvedValueOnce("OK");

      const result = await initTrial(FINGERPRINT);
      expect(result.startDate).toBeDefined();
      expect(mockRedis.set).toHaveBeenCalledWith(
        `trial:${FINGERPRINT}`,
        expect.any(String),
        "EX",
        TRIAL_TTL
      );
    });

    it("throws on Redis failure during write", async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockRedis.set.mockRejectedValueOnce(new Error("Redis write failed"));

      await expect(initTrial(FINGERPRINT)).rejects.toThrow("Redis write failed");
    });
  });

  describe("markTrialConverted", () => {
    it("returns false if no trial exists", async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      const result = await markTrialConverted(FINGERPRINT);
      expect(result).toBe(false);
    });

    it("returns true if already converted", async () => {
      const trial: StoredTrial = {
        startDate: "2025-01-01T00:00:00.000Z",
        convertedDate: "2025-01-15T00:00:00.000Z",
      };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(trial));

      const result = await markTrialConverted(FINGERPRINT);
      expect(result).toBe(true);
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it("sets convertedDate on unconverted trial", async () => {
      const trial: StoredTrial = { startDate: "2025-01-01T00:00:00.000Z" };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(trial));
      mockRedis.set.mockResolvedValueOnce("OK");

      const result = await markTrialConverted(FINGERPRINT);
      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        `trial:${FINGERPRINT}`,
        expect.stringContaining("convertedDate"),
        "EX",
        TRIAL_TTL
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
// Loki boundary condition tests (merged from trial/trial-store.test.ts — issue #944)
// ---------------------------------------------------------------------------

function daysAgo(n: number): string {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

const VALID_FINGERPRINT_B = "b".repeat(64);

describe("computeTrialStatus — boundary conditions (#944 AC2)", () => {
  it("returns status:none when trial is null (no record in Redis)", () => {
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

describe("initTrial — Redis key format and TTL (#944 AC1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes trial under key `trial:{fingerprint}` with TTL 5184000 s (60 days)", async () => {
    mockRedis.get.mockResolvedValueOnce(null); // no existing trial
    mockRedis.set.mockResolvedValueOnce("OK");

    await initTrial(VALID_FINGERPRINT_B);

    expect(mockRedis.set).toHaveBeenCalledOnce();
    const [key, , exFlag, ttl] = mockRedis.set.mock.calls[0] as [string, string, string, number];
    expect(key).toBe(`trial:${VALID_FINGERPRINT_B}`);
    expect(exFlag).toBe("EX");
    // 60 days × 24 h × 60 min × 60 s = 5 184 000 s
    expect(ttl).toBe(60 * 24 * 60 * 60);
  });
});

describe("getTrial — malformed JSON error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null (not throws) when Redis contains malformed JSON", async () => {
    mockRedis.get.mockResolvedValueOnce("not-valid-json{{{");

    const result = await getTrial(VALID_FINGERPRINT_B);
    expect(result).toBeNull();
  });
});
