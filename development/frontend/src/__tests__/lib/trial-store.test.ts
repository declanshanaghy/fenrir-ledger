/**
 * Unit tests for kv/trial-store.ts — Redis trial CRUD operations.
 *
 * Mocks ioredis via redis-client to test get/set paths and error handling.
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

// ── Import after mock ────────────────────────────────────────────────────

import { getTrial, initTrial, markTrialConverted, computeTrialStatus } from "@/lib/kv/trial-store";
import type { StoredTrial } from "@/lib/kv/trial-store";

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
