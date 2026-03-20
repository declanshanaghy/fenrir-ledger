/**
 * Unit tests for kv/entitlement-store.ts — household-based Stripe entitlement operations.
 *
 * Mocks @/lib/firebase/firestore helpers to test all get/set/delete paths.
 * Stripe state is now stored on the household document, not in a separate
 * /entitlements/ collection.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { StoredStripeEntitlement } from "@/lib/stripe/types";
import type { FirestoreUser, FirestoreHousehold } from "@/lib/firebase/firestore-types";

// ── Mock Firestore helpers ────────────────────────────────────────────────

const mockGetUser = vi.fn();
const mockGetHousehold = vi.fn();
const mockFindUserByStripeCustomerId = vi.fn();
const mockSetUserStripeCustomerId = vi.fn();
const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockDoc = vi.fn().mockReturnValue({ update: mockUpdate });
const mockGetFirestore = vi.fn().mockReturnValue({ doc: mockDoc });

vi.mock("@/lib/firebase/firestore", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  getHousehold: (...args: unknown[]) => mockGetHousehold(...args),
  findUserByStripeCustomerId: (...args: unknown[]) => mockFindUserByStripeCustomerId(...args),
  setUserStripeCustomerId: (...args: unknown[]) => mockSetUserStripeCustomerId(...args),
  getFirestore: () => mockGetFirestore(),
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

function makeFakeHousehold(overrides: Partial<FirestoreHousehold> = {}): FirestoreHousehold {
  return {
    id: HOUSEHOLD_ID,
    name: "Test Household",
    ownerId: GOOGLE_SUB,
    memberIds: [GOOGLE_SUB],
    inviteCode: "ABCDEF",
    inviteCodeExpiresAt: "2026-01-01T00:00:00.000Z",
    tier: "karl",
    stripeCustomerId: STRIPE_CUSTOMER_ID,
    stripeSubscriptionId: STRIPE_SUBSCRIPTION_ID,
    stripeStatus: "active",
    stripeLinkedAt: "2025-01-01T00:00:00.000Z",
    stripeCheckedAt: "2025-01-01T00:00:00.000Z",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("entitlement-store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFirestore.mockReturnValue({ doc: mockDoc });
    mockDoc.mockReturnValue({ update: mockUpdate });
    mockUpdate.mockResolvedValue(undefined);
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
    it("returns entitlement when household has Stripe fields", async () => {
      const user = makeFakeUser();
      const household = makeFakeHousehold();
      mockGetUser.mockResolvedValueOnce(user);
      mockGetHousehold.mockResolvedValueOnce(household);

      const result = await getStripeEntitlement(GOOGLE_SUB);

      expect(result).not.toBeNull();
      expect(result!.tier).toBe("karl");
      expect(result!.active).toBe(true);
      expect(result!.stripeCustomerId).toBe(STRIPE_CUSTOMER_ID);
      expect(result!.stripeSubscriptionId).toBe(STRIPE_SUBSCRIPTION_ID);
      expect(result!.stripeStatus).toBe("active");
      expect(mockGetUser).toHaveBeenCalledWith(GOOGLE_SUB);
      expect(mockGetHousehold).toHaveBeenCalledWith(HOUSEHOLD_ID);
    });

    it("returns null when user not found", async () => {
      mockGetUser.mockResolvedValueOnce(null);

      const result = await getStripeEntitlement(GOOGLE_SUB);
      expect(result).toBeNull();
      expect(mockGetHousehold).not.toHaveBeenCalled();
    });

    it("returns null when household not found", async () => {
      mockGetUser.mockResolvedValueOnce(makeFakeUser());
      mockGetHousehold.mockResolvedValueOnce(null);

      const result = await getStripeEntitlement(GOOGLE_SUB);
      expect(result).toBeNull();
    });

    it("returns null when household has no Stripe subscription", async () => {
      mockGetUser.mockResolvedValueOnce(makeFakeUser());
      mockGetHousehold.mockResolvedValueOnce(makeFakeHousehold({
        stripeCustomerId: undefined,
        stripeSubscriptionId: undefined,
        stripeStatus: undefined,
      }));

      const result = await getStripeEntitlement(GOOGLE_SUB);
      expect(result).toBeNull();
    });

    it("returns thrall tier when household is on free tier with Stripe fields", async () => {
      mockGetUser.mockResolvedValueOnce(makeFakeUser());
      mockGetHousehold.mockResolvedValueOnce(makeFakeHousehold({
        tier: "free",
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
    it("updates household doc and user stripeCustomerId", async () => {
      const ent = makeFakeEntitlement();
      mockGetUser.mockResolvedValueOnce(makeFakeUser());

      await setStripeEntitlement(GOOGLE_SUB, ent);

      expect(mockGetUser).toHaveBeenCalledWith(GOOGLE_SUB);
      expect(mockDoc).toHaveBeenCalledWith(`households/${HOUSEHOLD_ID}`);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeCustomerId: STRIPE_CUSTOMER_ID,
          stripeSubscriptionId: STRIPE_SUBSCRIPTION_ID,
          stripeStatus: "active",
          tier: "karl",
        })
      );
      expect(mockSetUserStripeCustomerId).toHaveBeenCalledWith(GOOGLE_SUB, STRIPE_CUSTOMER_ID);
    });

    it("writes tier 'free' to household when entitlement tier is 'thrall'", async () => {
      const ent = makeFakeEntitlement({ tier: "thrall", active: false });
      mockGetUser.mockResolvedValueOnce(makeFakeUser());

      await setStripeEntitlement(GOOGLE_SUB, ent);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ tier: "free" })
      );
    });

    it("throws when user not found", async () => {
      mockGetUser.mockResolvedValueOnce(null);

      await expect(setStripeEntitlement(GOOGLE_SUB, makeFakeEntitlement())).rejects.toThrow(
        `User ${GOOGLE_SUB} not found`
      );
    });

    it("throws on Firestore update failure", async () => {
      mockGetUser.mockResolvedValueOnce(makeFakeUser());
      mockUpdate.mockRejectedValueOnce(new Error("Firestore write failed"));

      await expect(setStripeEntitlement(GOOGLE_SUB, makeFakeEntitlement())).rejects.toThrow(
        "Firestore write failed"
      );
    });
  });

  // ── deleteStripeEntitlement ───────────────────────────────────────────

  describe("deleteStripeEntitlement", () => {
    it("clears Stripe fields on household doc and sets tier to free", async () => {
      mockGetUser.mockResolvedValueOnce(makeFakeUser());

      await deleteStripeEntitlement(GOOGLE_SUB);

      expect(mockDoc).toHaveBeenCalledWith(`households/${HOUSEHOLD_ID}`);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          stripeStatus: null,
          tier: "free",
          cancelAtPeriodEnd: false,
          currentPeriodEnd: null,
        })
      );
    });

    it("returns silently when user not found (nothing to clear)", async () => {
      mockGetUser.mockResolvedValueOnce(null);

      await expect(deleteStripeEntitlement(GOOGLE_SUB)).resolves.toBeUndefined();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("throws on Firestore failure", async () => {
      mockGetUser.mockResolvedValueOnce(makeFakeUser());
      mockUpdate.mockRejectedValueOnce(new Error("Firestore delete failed"));

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
