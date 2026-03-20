/**
 * Unit tests for kv/entitlement-store.ts — Firestore entitlement CRUD operations.
 *
 * Mocks @/lib/firebase/firestore helpers to test all get/set/delete paths,
 * the reverse lookup logic, anonymous user path, migration flow, and error handling.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { StoredStripeEntitlement } from "@/lib/stripe/types";
import type { FirestoreEntitlement, FirestoreUser } from "@/lib/firebase/firestore-types";

// ── Mock Firestore helpers ────────────────────────────────────────────────

const mockGetEntitlement = vi.fn();
const mockSetEntitlement = vi.fn();
const mockDeleteEntitlement = vi.fn();
const mockFindUserByStripeCustomerId = vi.fn();
const mockSetUserStripeCustomerId = vi.fn();

vi.mock("@/lib/firebase/firestore", () => ({
  getEntitlement: (...args: unknown[]) => mockGetEntitlement(...args),
  setEntitlement: (...args: unknown[]) => mockSetEntitlement(...args),
  deleteEntitlement: (...args: unknown[]) => mockDeleteEntitlement(...args),
  findUserByStripeCustomerId: (...args: unknown[]) => mockFindUserByStripeCustomerId(...args),
  setUserStripeCustomerId: (...args: unknown[]) => mockSetUserStripeCustomerId(...args),
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// ── Import after mocks ────────────────────────────────────────────────────

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

// ── Test data ─────────────────────────────────────────────────────────────

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

function makeFakeUser(overrides: Partial<FirestoreUser> = {}): FirestoreUser {
  return {
    clerkUserId: GOOGLE_SUB,
    email: "test@example.com",
    displayName: "Test User",
    householdId: "household-123",
    role: "owner",
    stripeCustomerId: STRIPE_CUSTOMER_ID,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
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
      expect(extractStripeCustomerIdFromReverseIndex("stripe:cus_abc")).toBe("cus_abc");
    });

    it("returns empty string for plain stripe: prefix", () => {
      expect(extractStripeCustomerIdFromReverseIndex("stripe:")).toBe("");
    });
  });

  // ── getStripeEntitlement ──────────────────────────────────────────────

  describe("getStripeEntitlement", () => {
    it("returns entitlement when found in Firestore", async () => {
      const ent = makeFakeEntitlement();
      mockGetEntitlement.mockResolvedValueOnce(ent as FirestoreEntitlement);

      const result = await getStripeEntitlement(GOOGLE_SUB);
      expect(result).toEqual(ent);
      expect(mockGetEntitlement).toHaveBeenCalledWith(GOOGLE_SUB);
    });

    it("returns null when document not found", async () => {
      mockGetEntitlement.mockResolvedValueOnce(null);

      const result = await getStripeEntitlement(GOOGLE_SUB);
      expect(result).toBeNull();
    });

    it("returns null on Firestore failure (does not throw)", async () => {
      mockGetEntitlement.mockRejectedValueOnce(new Error("Firestore unavailable"));

      const result = await getStripeEntitlement(GOOGLE_SUB);
      expect(result).toBeNull();
    });
  });

  // ── setStripeEntitlement ──────────────────────────────────────────────

  describe("setStripeEntitlement", () => {
    it("writes entitlement doc and updates user stripeCustomerId", async () => {
      const ent = makeFakeEntitlement();
      mockSetEntitlement.mockResolvedValue(undefined);
      mockSetUserStripeCustomerId.mockResolvedValue(undefined);

      await setStripeEntitlement(GOOGLE_SUB, ent);

      expect(mockSetEntitlement).toHaveBeenCalledWith(GOOGLE_SUB, ent);
      expect(mockSetUserStripeCustomerId).toHaveBeenCalledWith(
        GOOGLE_SUB,
        STRIPE_CUSTOMER_ID
      );
    });

    it("throws on Firestore write failure", async () => {
      const ent = makeFakeEntitlement();
      mockSetEntitlement.mockRejectedValueOnce(new Error("Firestore write failed"));

      await expect(setStripeEntitlement(GOOGLE_SUB, ent)).rejects.toThrow(
        "Firestore write failed"
      );
    });

    it("does NOT set a TTL (no expiry for entitlements)", async () => {
      const ent = makeFakeEntitlement();
      mockSetEntitlement.mockResolvedValue(undefined);
      mockSetUserStripeCustomerId.mockResolvedValue(undefined);

      await setStripeEntitlement(GOOGLE_SUB, ent);

      // setEntitlement is called with exactly 2 args — no TTL parameter
      expect(mockSetEntitlement).toHaveBeenCalledWith(GOOGLE_SUB, ent);
      expect(mockSetEntitlement.mock.calls[0]).toHaveLength(2);
    });
  });

  // ── deleteStripeEntitlement ───────────────────────────────────────────

  describe("deleteStripeEntitlement", () => {
    it("deletes the entitlement document", async () => {
      mockDeleteEntitlement.mockResolvedValue(undefined);

      await deleteStripeEntitlement(GOOGLE_SUB);

      expect(mockDeleteEntitlement).toHaveBeenCalledWith(GOOGLE_SUB);
    });

    it("throws on Firestore failure", async () => {
      mockDeleteEntitlement.mockRejectedValueOnce(new Error("Firestore delete failed"));

      await expect(deleteStripeEntitlement(GOOGLE_SUB)).rejects.toThrow(
        "Firestore delete failed"
      );
    });
  });

  // ── getGoogleSubByStripeCustomerId ────────────────────────────────────

  describe("getGoogleSubByStripeCustomerId", () => {
    it("returns Google sub when user has stripeCustomerId set (authenticated path)", async () => {
      const user = makeFakeUser();
      mockFindUserByStripeCustomerId.mockResolvedValueOnce(user);

      const result = await getGoogleSubByStripeCustomerId(STRIPE_CUSTOMER_ID);

      expect(result).toBe(GOOGLE_SUB);
      expect(mockFindUserByStripeCustomerId).toHaveBeenCalledWith(STRIPE_CUSTOMER_ID);
      // Should NOT check anonymous doc since user was found
      expect(mockGetEntitlement).not.toHaveBeenCalled();
    });

    it("returns stripe:{customerId} when anonymous entitlement doc exists", async () => {
      mockFindUserByStripeCustomerId.mockResolvedValueOnce(null);
      const anonEnt = makeFakeEntitlement();
      mockGetEntitlement.mockResolvedValueOnce(anonEnt as FirestoreEntitlement);

      const result = await getGoogleSubByStripeCustomerId(STRIPE_CUSTOMER_ID);

      expect(result).toBe(`stripe:${STRIPE_CUSTOMER_ID}`);
      expect(mockGetEntitlement).toHaveBeenCalledWith(`stripe:${STRIPE_CUSTOMER_ID}`);
    });

    it("returns null when no user and no anonymous doc", async () => {
      mockFindUserByStripeCustomerId.mockResolvedValueOnce(null);
      mockGetEntitlement.mockResolvedValueOnce(null);

      const result = await getGoogleSubByStripeCustomerId(STRIPE_CUSTOMER_ID);

      expect(result).toBeNull();
    });

    it("returns null on Firestore failure (does not throw)", async () => {
      mockFindUserByStripeCustomerId.mockRejectedValueOnce(new Error("Firestore error"));

      const result = await getGoogleSubByStripeCustomerId(STRIPE_CUSTOMER_ID);
      expect(result).toBeNull();
    });

    it("the returned anonymous value passes isAnonymousStripeReverseIndex", async () => {
      mockFindUserByStripeCustomerId.mockResolvedValueOnce(null);
      mockGetEntitlement.mockResolvedValueOnce(makeFakeEntitlement() as FirestoreEntitlement);

      const result = await getGoogleSubByStripeCustomerId(STRIPE_CUSTOMER_ID);

      expect(result).not.toBeNull();
      expect(isAnonymousStripeReverseIndex(result!)).toBe(true);
      expect(extractStripeCustomerIdFromReverseIndex(result!)).toBe(STRIPE_CUSTOMER_ID);
    });
  });

  // ── Anonymous entitlement operations ──────────────────────────────────

  describe("getAnonymousStripeEntitlement", () => {
    it("reads from stripe:{customerId} doc", async () => {
      const ent = makeFakeEntitlement();
      mockGetEntitlement.mockResolvedValueOnce(ent as FirestoreEntitlement);

      const result = await getAnonymousStripeEntitlement(STRIPE_CUSTOMER_ID);

      expect(result).toEqual(ent);
      expect(mockGetEntitlement).toHaveBeenCalledWith(`stripe:${STRIPE_CUSTOMER_ID}`);
    });

    it("returns null when not found", async () => {
      mockGetEntitlement.mockResolvedValueOnce(null);

      const result = await getAnonymousStripeEntitlement(STRIPE_CUSTOMER_ID);
      expect(result).toBeNull();
    });

    it("returns null on Firestore failure (does not throw)", async () => {
      mockGetEntitlement.mockRejectedValueOnce(new Error("Firestore error"));

      const result = await getAnonymousStripeEntitlement(STRIPE_CUSTOMER_ID);
      expect(result).toBeNull();
    });
  });

  describe("setAnonymousStripeEntitlement", () => {
    it("stores under stripe:{customerId} doc with no TTL", async () => {
      const ent = makeFakeEntitlement();
      mockSetEntitlement.mockResolvedValue(undefined);

      await setAnonymousStripeEntitlement(STRIPE_CUSTOMER_ID, ent);

      expect(mockSetEntitlement).toHaveBeenCalledWith(
        `stripe:${STRIPE_CUSTOMER_ID}`,
        ent
      );
      // Exactly 2 args — no TTL
      expect(mockSetEntitlement.mock.calls[0]).toHaveLength(2);
    });

    it("does NOT update user stripeCustomerId (anonymous — no user doc yet)", async () => {
      mockSetEntitlement.mockResolvedValue(undefined);
      await setAnonymousStripeEntitlement(STRIPE_CUSTOMER_ID, makeFakeEntitlement());
      expect(mockSetUserStripeCustomerId).not.toHaveBeenCalled();
    });

    it("throws on Firestore failure", async () => {
      const ent = makeFakeEntitlement();
      mockSetEntitlement.mockRejectedValueOnce(new Error("Firestore write failed"));

      await expect(
        setAnonymousStripeEntitlement(STRIPE_CUSTOMER_ID, ent)
      ).rejects.toThrow("Firestore write failed");
    });
  });

  // ── migrateStripeEntitlement ──────────────────────────────────────────

  describe("migrateStripeEntitlement", () => {
    it("returns already_migrated when Google-keyed entry exists", async () => {
      const ent = makeFakeEntitlement();
      mockGetEntitlement.mockResolvedValueOnce(ent as FirestoreEntitlement);

      const result = await migrateStripeEntitlement(STRIPE_CUSTOMER_ID, GOOGLE_SUB);

      expect(result).toEqual({
        migrated: true,
        tier: ent.tier,
        active: ent.active,
      });
      // Only one Firestore read — no write needed
      expect(mockSetEntitlement).not.toHaveBeenCalled();
    });

    it("returns not_found when anonymous entitlement does not exist", async () => {
      mockGetEntitlement.mockResolvedValueOnce(null); // googleSub doc
      mockGetEntitlement.mockResolvedValueOnce(null); // anonymous doc

      const result = await migrateStripeEntitlement(STRIPE_CUSTOMER_ID, GOOGLE_SUB);

      expect(result).toEqual({ migrated: false, reason: "not_found" });
      expect(mockSetEntitlement).not.toHaveBeenCalled();
    });

    it("migrates anonymous entitlement to Google-keyed entry", async () => {
      const ent = makeFakeEntitlement();
      mockGetEntitlement.mockResolvedValueOnce(null); // googleSub doc — not yet migrated
      mockGetEntitlement.mockResolvedValueOnce(ent as FirestoreEntitlement); // anonymous doc
      mockSetEntitlement.mockResolvedValue(undefined);
      mockSetUserStripeCustomerId.mockResolvedValue(undefined);
      mockDeleteEntitlement.mockResolvedValue(undefined);

      const result = await migrateStripeEntitlement(STRIPE_CUSTOMER_ID, GOOGLE_SUB);

      expect(result).toEqual({
        migrated: true,
        tier: ent.tier,
        active: ent.active,
      });

      // Copies to Google-keyed doc
      expect(mockSetEntitlement).toHaveBeenCalledWith(GOOGLE_SUB, ent);

      // Sets stripeCustomerId on user doc
      expect(mockSetUserStripeCustomerId).toHaveBeenCalledWith(GOOGLE_SUB, STRIPE_CUSTOMER_ID);

      // Deletes anonymous doc
      expect(mockDeleteEntitlement).toHaveBeenCalledWith(`stripe:${STRIPE_CUSTOMER_ID}`);
    });

    it("throws on Firestore failure during migration", async () => {
      mockGetEntitlement.mockRejectedValueOnce(new Error("Firestore read failed"));

      await expect(
        migrateStripeEntitlement(STRIPE_CUSTOMER_ID, GOOGLE_SUB)
      ).rejects.toThrow("Firestore read failed");
    });

    it("is idempotent — second call with existing Google doc returns migrated:true without re-writing", async () => {
      const ent = makeFakeEntitlement();
      // First call: already migrated
      mockGetEntitlement.mockResolvedValueOnce(ent as FirestoreEntitlement);

      const result = await migrateStripeEntitlement(STRIPE_CUSTOMER_ID, GOOGLE_SUB);

      expect(result.migrated).toBe(true);
      expect(mockSetEntitlement).not.toHaveBeenCalled();
      expect(mockDeleteEntitlement).not.toHaveBeenCalled();
    });
  });
});
