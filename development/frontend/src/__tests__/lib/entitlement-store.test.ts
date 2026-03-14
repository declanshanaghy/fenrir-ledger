/**
 * Unit tests for kv/entitlement-store.ts — Redis entitlement CRUD operations.
 *
 * Mocks ioredis via redis-client to test all get/set/delete paths, cache behavior, and error handling.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { StoredStripeEntitlement } from "@/lib/stripe/types";

// ── Mock Redis client ─────────────────────────────────────────────────────

const mockRedis = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}));

vi.mock("@/lib/kv/redis-client", () => ({
  getRedisClient: () => mockRedis,
}));

// ── Import after mock ────────────────────────────────────────────────────

import {
  getStripeEntitlement,
  setStripeEntitlement,
  deleteStripeEntitlement,
  getGoogleSubByStripeCustomerId,
  getAnonymousStripeEntitlement,
  setAnonymousStripeEntitlement,
  migrateStripeEntitlement,
  isAnonymousStripeReverseIndex,
  extractStripeCustomerIdFromReverseIndex,
} from "@/lib/kv/entitlement-store";

// ── Test data ────────────────────────────────────────────────────────────

const GOOGLE_SUB = "google-sub-123";
const STRIPE_CUSTOMER_ID = "cus_test456";
const STRIPE_SUBSCRIPTION_ID = "sub_test789";

function makeFakeEntitlement(
  overrides: Partial<StoredStripeEntitlement> = {}
): StoredStripeEntitlement {
  return {
    tier: "karl",
    active: true,
    stripeCustomerId: STRIPE_CUSTOMER_ID,
    stripeSubscriptionId: STRIPE_SUBSCRIPTION_ID,
    stripeStatus: "active",
    linkedAt: "2025-01-01T00:00:00.000Z",
    checkedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("entitlement-store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Pure helpers ──────────────────────────────────────────────────────

  describe("isAnonymousStripeReverseIndex", () => {
    it('returns true for values starting with "stripe:"', () => {
      expect(isAnonymousStripeReverseIndex("stripe:cus_abc")).toBe(true);
    });

    it("returns false for plain Google sub values", () => {
      expect(isAnonymousStripeReverseIndex("google-sub-123")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isAnonymousStripeReverseIndex("")).toBe(false);
    });
  });

  describe("extractStripeCustomerIdFromReverseIndex", () => {
    it("extracts customer ID from anonymous reverse index value", () => {
      expect(extractStripeCustomerIdFromReverseIndex("stripe:cus_abc")).toBe(
        "cus_abc"
      );
    });

    it("returns empty string for plain stripe: prefix", () => {
      expect(extractStripeCustomerIdFromReverseIndex("stripe:")).toBe("");
    });
  });

  // ── getStripeEntitlement ──────────────────────────────────────────────

  describe("getStripeEntitlement", () => {
    it("returns entitlement when found in Redis", async () => {
      const ent = makeFakeEntitlement();
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(ent));

      const result = await getStripeEntitlement(GOOGLE_SUB);
      expect(result).toEqual(ent);
      expect(mockRedis.get).toHaveBeenCalledWith(`entitlement:${GOOGLE_SUB}`);
    });

    it("returns null when not found", async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      const result = await getStripeEntitlement(GOOGLE_SUB);
      expect(result).toBeNull();
    });

    it("returns null on Redis failure (does not throw)", async () => {
      mockRedis.get.mockRejectedValueOnce(new Error("Redis connection failed"));

      const result = await getStripeEntitlement(GOOGLE_SUB);
      expect(result).toBeNull();
    });
  });

  // ── setStripeEntitlement ──────────────────────────────────────────────

  describe("setStripeEntitlement", () => {
    it("stores entitlement with TTL and creates reverse index", async () => {
      const ent = makeFakeEntitlement();
      mockRedis.set.mockResolvedValue("OK");

      await setStripeEntitlement(GOOGLE_SUB, ent);

      // Primary entitlement key
      expect(mockRedis.set).toHaveBeenCalledWith(
        `entitlement:${GOOGLE_SUB}`,
        JSON.stringify(ent),
        "EX",
        30 * 24 * 60 * 60
      );
      // Reverse index
      expect(mockRedis.set).toHaveBeenCalledWith(
        `stripe-customer:${STRIPE_CUSTOMER_ID}`,
        JSON.stringify(GOOGLE_SUB),
        "EX",
        30 * 24 * 60 * 60
      );
    });

    it("throws on Redis failure", async () => {
      const ent = makeFakeEntitlement();
      mockRedis.set.mockRejectedValueOnce(new Error("Redis write failed"));

      await expect(setStripeEntitlement(GOOGLE_SUB, ent)).rejects.toThrow(
        "Redis write failed"
      );
    });
  });

  // ── deleteStripeEntitlement ───────────────────────────────────────────

  describe("deleteStripeEntitlement", () => {
    it("deletes primary key and reverse index", async () => {
      const ent = makeFakeEntitlement();
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(ent));
      mockRedis.del.mockResolvedValue(1);

      await deleteStripeEntitlement(GOOGLE_SUB);

      expect(mockRedis.del).toHaveBeenCalledWith(`entitlement:${GOOGLE_SUB}`);
      expect(mockRedis.del).toHaveBeenCalledWith(
        `stripe-customer:${STRIPE_CUSTOMER_ID}`
      );
    });

    it("only deletes primary key when no existing entitlement found", async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockRedis.del.mockResolvedValue(0);

      await deleteStripeEntitlement(GOOGLE_SUB);

      expect(mockRedis.del).toHaveBeenCalledTimes(1);
      expect(mockRedis.del).toHaveBeenCalledWith(`entitlement:${GOOGLE_SUB}`);
    });

    it("throws on Redis failure", async () => {
      mockRedis.get.mockRejectedValueOnce(new Error("Redis read failed"));

      await expect(deleteStripeEntitlement(GOOGLE_SUB)).rejects.toThrow(
        "Redis read failed"
      );
    });
  });

  // ── getGoogleSubByStripeCustomerId ────────────────────────────────────

  describe("getGoogleSubByStripeCustomerId", () => {
    it("returns Google sub from reverse index", async () => {
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(GOOGLE_SUB));

      const result = await getGoogleSubByStripeCustomerId(STRIPE_CUSTOMER_ID);
      expect(result).toBe(GOOGLE_SUB);
      expect(mockRedis.get).toHaveBeenCalledWith(
        `stripe-customer:${STRIPE_CUSTOMER_ID}`
      );
    });

    it("returns null when no mapping exists", async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      const result = await getGoogleSubByStripeCustomerId(STRIPE_CUSTOMER_ID);
      expect(result).toBeNull();
    });

    it("returns null on Redis failure (does not throw)", async () => {
      mockRedis.get.mockRejectedValueOnce(new Error("Redis error"));

      const result = await getGoogleSubByStripeCustomerId(STRIPE_CUSTOMER_ID);
      expect(result).toBeNull();
    });
  });

  // ── Anonymous entitlement operations ──────────────────────────────────

  describe("getAnonymousStripeEntitlement", () => {
    it("reads from anonymous key", async () => {
      const ent = makeFakeEntitlement();
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(ent));

      const result = await getAnonymousStripeEntitlement(STRIPE_CUSTOMER_ID);
      expect(result).toEqual(ent);
      expect(mockRedis.get).toHaveBeenCalledWith(
        `entitlement:stripe:${STRIPE_CUSTOMER_ID}`
      );
    });

    it("returns null when not found", async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      const result = await getAnonymousStripeEntitlement(STRIPE_CUSTOMER_ID);
      expect(result).toBeNull();
    });

    it("returns null on Redis failure (does not throw)", async () => {
      mockRedis.get.mockRejectedValueOnce(new Error("Redis error"));

      const result = await getAnonymousStripeEntitlement(STRIPE_CUSTOMER_ID);
      expect(result).toBeNull();
    });
  });

  describe("setAnonymousStripeEntitlement", () => {
    it("stores under anonymous key and creates reverse index with stripe: prefix", async () => {
      const ent = makeFakeEntitlement();
      mockRedis.set.mockResolvedValue("OK");

      await setAnonymousStripeEntitlement(STRIPE_CUSTOMER_ID, ent);

      expect(mockRedis.set).toHaveBeenCalledWith(
        `entitlement:stripe:${STRIPE_CUSTOMER_ID}`,
        JSON.stringify(ent),
        "EX",
        30 * 24 * 60 * 60
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        `stripe-customer:${STRIPE_CUSTOMER_ID}`,
        JSON.stringify(`stripe:${STRIPE_CUSTOMER_ID}`),
        "EX",
        30 * 24 * 60 * 60
      );
    });

    it("throws on Redis failure", async () => {
      const ent = makeFakeEntitlement();
      mockRedis.set.mockRejectedValueOnce(new Error("Redis write failed"));

      await expect(
        setAnonymousStripeEntitlement(STRIPE_CUSTOMER_ID, ent)
      ).rejects.toThrow("Redis write failed");
    });
  });

  // ── migrateStripeEntitlement ──────────────────────────────────────────

  describe("migrateStripeEntitlement", () => {
    it("returns already_migrated when Google-keyed entry exists", async () => {
      const ent = makeFakeEntitlement();
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(ent)); // existingGoogle

      const result = await migrateStripeEntitlement(
        STRIPE_CUSTOMER_ID,
        GOOGLE_SUB
      );
      expect(result).toEqual({
        migrated: true,
        tier: ent.tier,
        active: ent.active,
      });
    });

    it("returns not_found when anonymous entitlement does not exist", async () => {
      mockRedis.get.mockResolvedValueOnce(null); // existingGoogle
      mockRedis.get.mockResolvedValueOnce(null); // anonymousEntitlement

      const result = await migrateStripeEntitlement(
        STRIPE_CUSTOMER_ID,
        GOOGLE_SUB
      );
      expect(result).toEqual({ migrated: false, reason: "not_found" });
    });

    it("migrates anonymous entitlement to Google-keyed entry", async () => {
      const ent = makeFakeEntitlement();
      mockRedis.get.mockResolvedValueOnce(null); // existingGoogle — not yet migrated
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(ent)); // anonymousEntitlement
      mockRedis.set.mockResolvedValue("OK");
      mockRedis.del.mockResolvedValue(1);

      const result = await migrateStripeEntitlement(
        STRIPE_CUSTOMER_ID,
        GOOGLE_SUB
      );

      expect(result).toEqual({
        migrated: true,
        tier: ent.tier,
        active: ent.active,
      });

      // Copies to Google key
      expect(mockRedis.set).toHaveBeenCalledWith(
        `entitlement:${GOOGLE_SUB}`,
        JSON.stringify(ent),
        "EX",
        30 * 24 * 60 * 60
      );
      // Updates reverse index
      expect(mockRedis.set).toHaveBeenCalledWith(
        `stripe-customer:${STRIPE_CUSTOMER_ID}`,
        JSON.stringify(GOOGLE_SUB),
        "EX",
        30 * 24 * 60 * 60
      );
      // Deletes anonymous key
      expect(mockRedis.del).toHaveBeenCalledWith(
        `entitlement:stripe:${STRIPE_CUSTOMER_ID}`
      );
    });

    it("throws on Redis failure during migration", async () => {
      mockRedis.get.mockRejectedValueOnce(new Error("Redis read failed"));

      await expect(
        migrateStripeEntitlement(STRIPE_CUSTOMER_ID, GOOGLE_SUB)
      ).rejects.toThrow("Redis read failed");
    });
  });
});
