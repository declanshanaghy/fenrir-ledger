/**
 * Unit tests for kv/entitlement-store.ts — stripe subcollection-based Stripe entitlement operations.
 *
 * Mocks @/lib/firebase/firestore helpers to test all get/set/delete paths.
 * Stripe state is now stored at /households/{id}/stripe/subscription (issue #1648),
 * not directly on the household document.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { StoredStripeEntitlement } from "@/lib/stripe/types";
import type { FirestoreUser, FirestoreStripeSubscription } from "@/lib/firebase/firestore-types";

// ── Mock Firestore helpers ────────────────────────────────────────────────

const mockGetUser = vi.hoisted(() => vi.fn());
const mockFindUserByStripeCustomerId = vi.hoisted(() => vi.fn());
const mockSetUserStripeCustomerId = vi.hoisted(() => vi.fn());
const mockGetStripeSubscription = vi.hoisted(() => vi.fn());
const mockSetStripeSubscription = vi.hoisted(() => vi.fn());
const mockDeleteStripeSubscription = vi.hoisted(() => vi.fn());

vi.mock("@/lib/firebase/firestore", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  findUserByStripeCustomerId: (...args: unknown[]) => mockFindUserByStripeCustomerId(...args),
  setUserStripeCustomerId: (...args: unknown[]) => mockSetUserStripeCustomerId(...args),
  getStripeSubscription: (...args: unknown[]) => mockGetStripeSubscription(...args),
  setStripeSubscription: (...args: unknown[]) => mockSetStripeSubscription(...args),
  deleteStripeSubscription: (...args: unknown[]) => mockDeleteStripeSubscription(...args),
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
  isAnonymousStripeReverseIndex,
  extractStripeCustomerIdFromReverseIndex,
} from "@/lib/kv/entitlement-store";

// ── Test data ─────────────────────────────────────────────────────────────

const GOOGLE_SUB = "google-sub-123";
const HOUSEHOLD_ID = "google-sub-123"; // householdId == userId
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
    userId: GOOGLE_SUB,
    email: "test@example.com",
    displayName: "Test User",
    householdId: HOUSEHOLD_ID,
    role: "owner",
    stripeCustomerId: STRIPE_CUSTOMER_ID,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeFakeStripeDoc(
  overrides: Partial<FirestoreStripeSubscription> = {}
): FirestoreStripeSubscription {
  return {
    stripeCustomerId: STRIPE_CUSTOMER_ID,
    stripeSubscriptionId: STRIPE_SUBSCRIPTION_ID,
    stripeStatus: "active",
    tier: "karl",
    active: true,
    cancelAtPeriodEnd: false,
    linkedAt: "2025-01-01T00:00:00.000Z",
    checkedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("entitlement-store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetStripeSubscription.mockResolvedValue(undefined);
    mockDeleteStripeSubscription.mockResolvedValue(undefined);
    mockSetUserStripeCustomerId.mockResolvedValue(undefined);
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
    it("returns entitlement when stripe subcollection doc exists", async () => {
      const user = makeFakeUser();
      const stripeDoc = makeFakeStripeDoc();
      mockGetUser.mockResolvedValueOnce(user);
      mockGetStripeSubscription.mockResolvedValueOnce(stripeDoc);

      const result = await getStripeEntitlement(GOOGLE_SUB);

      expect(result).not.toBeNull();
      expect(result!.tier).toBe("karl");
      expect(result!.active).toBe(true);
      expect(result!.stripeCustomerId).toBe(STRIPE_CUSTOMER_ID);
      expect(result!.stripeSubscriptionId).toBe(STRIPE_SUBSCRIPTION_ID);
      expect(result!.stripeStatus).toBe("active");
      expect(mockGetUser).toHaveBeenCalledWith(GOOGLE_SUB);
      expect(mockGetStripeSubscription).toHaveBeenCalledWith(HOUSEHOLD_ID);
    });

    it("returns null when user not found", async () => {
      mockGetUser.mockResolvedValueOnce(null);

      const result = await getStripeEntitlement(GOOGLE_SUB);
      expect(result).toBeNull();
      expect(mockGetStripeSubscription).not.toHaveBeenCalled();
    });

    it("returns null when stripe subcollection doc not found", async () => {
      mockGetUser.mockResolvedValueOnce(makeFakeUser());
      mockGetStripeSubscription.mockResolvedValueOnce(null);

      const result = await getStripeEntitlement(GOOGLE_SUB);
      expect(result).toBeNull();
    });

    it("returns thrall tier when stripe doc has free tier", async () => {
      mockGetUser.mockResolvedValueOnce(makeFakeUser());
      mockGetStripeSubscription.mockResolvedValueOnce(makeFakeStripeDoc({
        tier: "free",
        active: false,
        stripeStatus: "canceled",
      }));

      const result = await getStripeEntitlement(GOOGLE_SUB);
      expect(result).not.toBeNull();
      expect(result!.tier).toBe("thrall");
      expect(result!.active).toBe(false);
    });

    it("returns null on Firestore failure (does not throw)", async () => {
      mockGetUser.mockRejectedValueOnce(new Error("Firestore unavailable"));

      const result = await getStripeEntitlement(GOOGLE_SUB);
      expect(result).toBeNull();
    });
  });

  // ── setStripeEntitlement ──────────────────────────────────────────────

  describe("setStripeEntitlement", () => {
    it("writes to stripe subcollection and updates user stripeCustomerId", async () => {
      const ent = makeFakeEntitlement();
      mockGetUser.mockResolvedValueOnce(makeFakeUser());

      await setStripeEntitlement(GOOGLE_SUB, ent);

      expect(mockGetUser).toHaveBeenCalledWith(GOOGLE_SUB);
      expect(mockSetStripeSubscription).toHaveBeenCalledWith(
        HOUSEHOLD_ID,
        expect.objectContaining({
          stripeCustomerId: STRIPE_CUSTOMER_ID,
          stripeSubscriptionId: STRIPE_SUBSCRIPTION_ID,
          stripeStatus: "active",
          tier: "karl",
          active: true,
        })
      );
      expect(mockSetUserStripeCustomerId).toHaveBeenCalledWith(GOOGLE_SUB, STRIPE_CUSTOMER_ID);
    });

    it("writes tier 'free' to stripe subcollection when entitlement tier is 'thrall'", async () => {
      const ent = makeFakeEntitlement({ tier: "thrall", active: false });
      mockGetUser.mockResolvedValueOnce(makeFakeUser());

      await setStripeEntitlement(GOOGLE_SUB, ent);

      expect(mockSetStripeSubscription).toHaveBeenCalledWith(
        HOUSEHOLD_ID,
        expect.objectContaining({ tier: "free", active: false })
      );
    });

    it("throws when user not found", async () => {
      mockGetUser.mockResolvedValueOnce(null);

      await expect(setStripeEntitlement(GOOGLE_SUB, makeFakeEntitlement())).rejects.toThrow(
        `User ${GOOGLE_SUB} not found`
      );
    });

    it("throws on Firestore write failure", async () => {
      mockGetUser.mockResolvedValueOnce(makeFakeUser());
      mockSetStripeSubscription.mockRejectedValueOnce(new Error("Firestore write failed"));

      await expect(setStripeEntitlement(GOOGLE_SUB, makeFakeEntitlement())).rejects.toThrow(
        "Firestore write failed"
      );
    });
  });

  // ── deleteStripeEntitlement ───────────────────────────────────────────

  describe("deleteStripeEntitlement", () => {
    it("deletes the stripe subcollection doc", async () => {
      mockGetUser.mockResolvedValueOnce(makeFakeUser());

      await deleteStripeEntitlement(GOOGLE_SUB);

      expect(mockDeleteStripeSubscription).toHaveBeenCalledWith(HOUSEHOLD_ID);
    });

    it("returns silently when user not found (nothing to clear)", async () => {
      mockGetUser.mockResolvedValueOnce(null);

      await expect(deleteStripeEntitlement(GOOGLE_SUB)).resolves.toBeUndefined();
      expect(mockDeleteStripeSubscription).not.toHaveBeenCalled();
    });

    it("throws on Firestore failure", async () => {
      mockGetUser.mockResolvedValueOnce(makeFakeUser());
      mockDeleteStripeSubscription.mockRejectedValueOnce(new Error("Firestore delete failed"));

      await expect(deleteStripeEntitlement(GOOGLE_SUB)).rejects.toThrow(
        "Firestore delete failed"
      );
    });
  });

  // ── getGoogleSubByStripeCustomerId ────────────────────────────────────

  describe("getGoogleSubByStripeCustomerId", () => {
    it("returns Google sub when user has stripeCustomerId set", async () => {
      const user = makeFakeUser();
      mockFindUserByStripeCustomerId.mockResolvedValueOnce(user);

      const result = await getGoogleSubByStripeCustomerId(STRIPE_CUSTOMER_ID);

      expect(result).toBe(GOOGLE_SUB);
      expect(mockFindUserByStripeCustomerId).toHaveBeenCalledWith(STRIPE_CUSTOMER_ID);
    });

    it("returns null when no user found for this stripeCustomerId", async () => {
      mockFindUserByStripeCustomerId.mockResolvedValueOnce(null);

      const result = await getGoogleSubByStripeCustomerId(STRIPE_CUSTOMER_ID);

      expect(result).toBeNull();
    });

    it("returns null on Firestore failure (does not throw)", async () => {
      mockFindUserByStripeCustomerId.mockRejectedValueOnce(new Error("Firestore error"));

      const result = await getGoogleSubByStripeCustomerId(STRIPE_CUSTOMER_ID);
      expect(result).toBeNull();
    });

    it("returned value does NOT pass isAnonymousStripeReverseIndex (authenticated only now)", async () => {
      const user = makeFakeUser();
      mockFindUserByStripeCustomerId.mockResolvedValueOnce(user);

      const result = await getGoogleSubByStripeCustomerId(STRIPE_CUSTOMER_ID);

      expect(result).not.toBeNull();
      expect(isAnonymousStripeReverseIndex(result!)).toBe(false);
    });
  });

  // ── Anonymous stubs (deprecated) ──────────────────────────────────────

  describe("getAnonymousStripeEntitlement", () => {
    it("always returns null (anonymous subscriptions not supported)", async () => {
      const result = await getAnonymousStripeEntitlement(STRIPE_CUSTOMER_ID);
      expect(result).toBeNull();
    });
  });

  describe("setAnonymousStripeEntitlement", () => {
    it("is a no-op (does not throw)", async () => {
      await expect(
        setAnonymousStripeEntitlement(STRIPE_CUSTOMER_ID, makeFakeEntitlement())
      ).resolves.toBeUndefined();
    });
  });
});
