/**
 * Unit tests for kv/entitlement-store.ts — Vercel KV entitlement CRUD operations.
 *
 * Mocks @vercel/kv to test all get/set/delete paths, cache behavior, and error handling.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { StoredStripeEntitlement } from "@/lib/stripe/types";

// ── Mock @vercel/kv ───────────────────────────────────────────────────────

const mockKv = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}));

vi.mock("@vercel/kv", () => ({ kv: mockKv }));

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
    it("returns entitlement when found in KV", async () => {
      const ent = makeFakeEntitlement();
      mockKv.get.mockResolvedValueOnce(ent);

      const result = await getStripeEntitlement(GOOGLE_SUB);
      expect(result).toEqual(ent);
      expect(mockKv.get).toHaveBeenCalledWith(`entitlement:${GOOGLE_SUB}`);
    });

    it("returns null when not found", async () => {
      mockKv.get.mockResolvedValueOnce(null);

      const result = await getStripeEntitlement(GOOGLE_SUB);
      expect(result).toBeNull();
    });

    it("returns null on KV failure (does not throw)", async () => {
      mockKv.get.mockRejectedValueOnce(new Error("KV connection failed"));

      const result = await getStripeEntitlement(GOOGLE_SUB);
      expect(result).toBeNull();
    });
  });

  // ── setStripeEntitlement ──────────────────────────────────────────────

  describe("setStripeEntitlement", () => {
    it("stores entitlement with TTL and creates reverse index", async () => {
      const ent = makeFakeEntitlement();
      mockKv.set.mockResolvedValue("OK");

      await setStripeEntitlement(GOOGLE_SUB, ent);

      // Primary entitlement key
      expect(mockKv.set).toHaveBeenCalledWith(
        `entitlement:${GOOGLE_SUB}`,
        ent,
        { ex: 30 * 24 * 60 * 60 }
      );
      // Reverse index
      expect(mockKv.set).toHaveBeenCalledWith(
        `stripe-customer:${STRIPE_CUSTOMER_ID}`,
        GOOGLE_SUB,
        { ex: 30 * 24 * 60 * 60 }
      );
    });

    it("throws on KV failure", async () => {
      const ent = makeFakeEntitlement();
      mockKv.set.mockRejectedValueOnce(new Error("KV write failed"));

      await expect(setStripeEntitlement(GOOGLE_SUB, ent)).rejects.toThrow(
        "KV write failed"
      );
    });
  });

  // ── deleteStripeEntitlement ───────────────────────────────────────────

  describe("deleteStripeEntitlement", () => {
    it("deletes primary key and reverse index", async () => {
      const ent = makeFakeEntitlement();
      mockKv.get.mockResolvedValueOnce(ent);
      mockKv.del.mockResolvedValue(1);

      await deleteStripeEntitlement(GOOGLE_SUB);

      expect(mockKv.del).toHaveBeenCalledWith(`entitlement:${GOOGLE_SUB}`);
      expect(mockKv.del).toHaveBeenCalledWith(
        `stripe-customer:${STRIPE_CUSTOMER_ID}`
      );
    });

    it("only deletes primary key when no existing entitlement found", async () => {
      mockKv.get.mockResolvedValueOnce(null);
      mockKv.del.mockResolvedValue(0);

      await deleteStripeEntitlement(GOOGLE_SUB);

      expect(mockKv.del).toHaveBeenCalledTimes(1);
      expect(mockKv.del).toHaveBeenCalledWith(`entitlement:${GOOGLE_SUB}`);
    });

    it("throws on KV failure", async () => {
      mockKv.get.mockRejectedValueOnce(new Error("KV read failed"));

      await expect(deleteStripeEntitlement(GOOGLE_SUB)).rejects.toThrow(
        "KV read failed"
      );
    });
  });

  // ── getGoogleSubByStripeCustomerId ────────────────────────────────────

  describe("getGoogleSubByStripeCustomerId", () => {
    it("returns Google sub from reverse index", async () => {
      mockKv.get.mockResolvedValueOnce(GOOGLE_SUB);

      const result = await getGoogleSubByStripeCustomerId(STRIPE_CUSTOMER_ID);
      expect(result).toBe(GOOGLE_SUB);
      expect(mockKv.get).toHaveBeenCalledWith(
        `stripe-customer:${STRIPE_CUSTOMER_ID}`
      );
    });

    it("returns null when no mapping exists", async () => {
      mockKv.get.mockResolvedValueOnce(null);

      const result = await getGoogleSubByStripeCustomerId(STRIPE_CUSTOMER_ID);
      expect(result).toBeNull();
    });

    it("returns null on KV failure (does not throw)", async () => {
      mockKv.get.mockRejectedValueOnce(new Error("KV error"));

      const result = await getGoogleSubByStripeCustomerId(STRIPE_CUSTOMER_ID);
      expect(result).toBeNull();
    });
  });

  // ── Anonymous entitlement operations ──────────────────────────────────

  describe("getAnonymousStripeEntitlement", () => {
    it("reads from anonymous key", async () => {
      const ent = makeFakeEntitlement();
      mockKv.get.mockResolvedValueOnce(ent);

      const result = await getAnonymousStripeEntitlement(STRIPE_CUSTOMER_ID);
      expect(result).toEqual(ent);
      expect(mockKv.get).toHaveBeenCalledWith(
        `entitlement:stripe:${STRIPE_CUSTOMER_ID}`
      );
    });

    it("returns null when not found", async () => {
      mockKv.get.mockResolvedValueOnce(null);

      const result = await getAnonymousStripeEntitlement(STRIPE_CUSTOMER_ID);
      expect(result).toBeNull();
    });

    it("returns null on KV failure (does not throw)", async () => {
      mockKv.get.mockRejectedValueOnce(new Error("KV error"));

      const result = await getAnonymousStripeEntitlement(STRIPE_CUSTOMER_ID);
      expect(result).toBeNull();
    });
  });

  describe("setAnonymousStripeEntitlement", () => {
    it("stores under anonymous key and creates reverse index with stripe: prefix", async () => {
      const ent = makeFakeEntitlement();
      mockKv.set.mockResolvedValue("OK");

      await setAnonymousStripeEntitlement(STRIPE_CUSTOMER_ID, ent);

      expect(mockKv.set).toHaveBeenCalledWith(
        `entitlement:stripe:${STRIPE_CUSTOMER_ID}`,
        ent,
        { ex: 30 * 24 * 60 * 60 }
      );
      expect(mockKv.set).toHaveBeenCalledWith(
        `stripe-customer:${STRIPE_CUSTOMER_ID}`,
        `stripe:${STRIPE_CUSTOMER_ID}`,
        { ex: 30 * 24 * 60 * 60 }
      );
    });

    it("throws on KV failure", async () => {
      const ent = makeFakeEntitlement();
      mockKv.set.mockRejectedValueOnce(new Error("KV write failed"));

      await expect(
        setAnonymousStripeEntitlement(STRIPE_CUSTOMER_ID, ent)
      ).rejects.toThrow("KV write failed");
    });
  });

  // ── migrateStripeEntitlement ──────────────────────────────────────────

  describe("migrateStripeEntitlement", () => {
    it("returns already_migrated when Google-keyed entry exists", async () => {
      const ent = makeFakeEntitlement();
      mockKv.get.mockResolvedValueOnce(ent); // existingGoogle

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
      mockKv.get.mockResolvedValueOnce(null); // existingGoogle
      mockKv.get.mockResolvedValueOnce(null); // anonymousEntitlement

      const result = await migrateStripeEntitlement(
        STRIPE_CUSTOMER_ID,
        GOOGLE_SUB
      );
      expect(result).toEqual({ migrated: false, reason: "not_found" });
    });

    it("migrates anonymous entitlement to Google-keyed entry", async () => {
      const ent = makeFakeEntitlement();
      mockKv.get.mockResolvedValueOnce(null); // existingGoogle — not yet migrated
      mockKv.get.mockResolvedValueOnce(ent); // anonymousEntitlement
      mockKv.set.mockResolvedValue("OK");
      mockKv.del.mockResolvedValue(1);

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
      expect(mockKv.set).toHaveBeenCalledWith(
        `entitlement:${GOOGLE_SUB}`,
        ent,
        { ex: 30 * 24 * 60 * 60 }
      );
      // Updates reverse index
      expect(mockKv.set).toHaveBeenCalledWith(
        `stripe-customer:${STRIPE_CUSTOMER_ID}`,
        GOOGLE_SUB,
        { ex: 30 * 24 * 60 * 60 }
      );
      // Deletes anonymous key
      expect(mockKv.del).toHaveBeenCalledWith(
        `entitlement:stripe:${STRIPE_CUSTOMER_ID}`
      );
    });

    it("throws on KV failure during migration", async () => {
      mockKv.get.mockRejectedValueOnce(new Error("KV read failed"));

      await expect(
        migrateStripeEntitlement(STRIPE_CUSTOMER_ID, GOOGLE_SUB)
      ).rejects.toThrow("KV read failed");
    });
  });
});
