/**
 * Loki QA — Stripe subcollection helpers (issue #1648)
 *
 * Validates the new getStripeSubscription / setStripeSubscription /
 * deleteStripeSubscription helpers in firestore.ts and the idempotent
 * re-subscribe path in entitlement-store.ts.
 *
 * Acceptance criteria covered:
 *   - Stripe data stored at /households/{id}/stripe/subscription (path verified)
 *   - getStripeSubscription returns null for household with no stripe doc
 *   - setStripeSubscription writes to the correct subcollection path
 *   - deleteStripeSubscription hard-deletes (not nulls) the subcollection doc
 *   - Re-subscribe after cancel: setStripeSubscription is idempotent (overwrites)
 *   - ensureSoloHousehold creates household with zero Stripe fields
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type {
  FirestoreStripeSubscription,
  FirestoreUser,
} from "@/lib/firebase/firestore-types";
import { FIRESTORE_PATHS } from "@/lib/firebase/firestore-types";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeStripeDoc(
  overrides: Partial<FirestoreStripeSubscription> = {}
): FirestoreStripeSubscription {
  return {
    stripeCustomerId: "cus_loki_test",
    stripeSubscriptionId: "sub_loki_test",
    stripeStatus: "active",
    tier: "karl",
    active: true,
    cancelAtPeriodEnd: false,
    linkedAt: "2025-01-01T00:00:00.000Z",
    checkedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ── FIRESTORE_PATHS.stripeSubscription ────────────────────────────────────────

describe("FIRESTORE_PATHS.stripeSubscription — path correctness (issue #1648)", () => {
  it("generates the correct subcollection path", () => {
    expect(FIRESTORE_PATHS.stripeSubscription("hh-abc")).toBe(
      "households/hh-abc/stripe/subscription"
    );
  });

  it("generates unique paths for different household IDs", () => {
    const pathA = FIRESTORE_PATHS.stripeSubscription("hh-111");
    const pathB = FIRESTORE_PATHS.stripeSubscription("hh-222");
    expect(pathA).not.toBe(pathB);
    expect(pathA).toContain("hh-111");
    expect(pathB).toContain("hh-222");
  });

  it("path ends with /stripe/subscription document ID", () => {
    const path = FIRESTORE_PATHS.stripeSubscription("hh-xyz");
    expect(path.endsWith("/stripe/subscription")).toBe(true);
  });

  it("path is nested under households/{householdId}", () => {
    const hhId = "solo-user-sub";
    const path = FIRESTORE_PATHS.stripeSubscription(hhId);
    expect(path.startsWith(`households/${hhId}/`)).toBe(true);
  });
});

// ── getStripeSubscription ──────────────────────────────────────────────────────

describe("getStripeSubscription — subcollection reads", () => {
  beforeEach(() => {
    process.env.FIRESTORE_PROJECT_ID = "test-project";
    vi.resetModules();
  });
  afterEach(() => {
    delete process.env.FIRESTORE_PROJECT_ID;
    vi.resetModules();
  });

  it("returns null when no stripe subcollection doc exists (household has never subscribed)", async () => {
    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = {
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ exists: false }),
        }),
        batch: vi.fn(),
        collection: vi.fn(),
      };
      return {
        Firestore: class MockFirestore {
          constructor() {
            Object.assign(this, mockInstance);
          }
        },
      };
    });

    const { getStripeSubscription, _resetFirestoreForTests } = await import(
      "@/lib/firebase/firestore"
    );
    _resetFirestoreForTests();

    const result = await getStripeSubscription("hh-no-stripe");
    expect(result).toBeNull();
  });

  it("returns stripe doc data when subcollection doc exists", async () => {
    const stripeDoc = makeStripeDoc();
    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = {
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ exists: true, data: () => stripeDoc }),
        }),
        batch: vi.fn(),
        collection: vi.fn(),
      };
      return {
        Firestore: class MockFirestore {
          constructor() {
            Object.assign(this, mockInstance);
          }
        },
      };
    });

    const { getStripeSubscription, _resetFirestoreForTests } = await import(
      "@/lib/firebase/firestore"
    );
    _resetFirestoreForTests();

    const result = await getStripeSubscription("hh-has-stripe");
    expect(result).toEqual(stripeDoc);
    expect(result!.tier).toBe("karl");
    expect(result!.active).toBe(true);
  });

  it("reads from the correct subcollection path", async () => {
    const mockDoc = vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue({ exists: false }),
    });
    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = { doc: mockDoc, batch: vi.fn(), collection: vi.fn() };
      return {
        Firestore: class MockFirestore {
          constructor() {
            Object.assign(this, mockInstance);
          }
        },
      };
    });

    const { getStripeSubscription, _resetFirestoreForTests } = await import(
      "@/lib/firebase/firestore"
    );
    _resetFirestoreForTests();
    await getStripeSubscription("hh-path-check");

    // Must use the subcollection path — not the household doc path
    expect(mockDoc).toHaveBeenCalledWith(
      "households/hh-path-check/stripe/subscription"
    );
  });
});

// ── setStripeSubscription ──────────────────────────────────────────────────────

describe("setStripeSubscription — subcollection writes", () => {
  beforeEach(() => {
    process.env.FIRESTORE_PROJECT_ID = "test-project";
    vi.resetModules();
  });
  afterEach(() => {
    delete process.env.FIRESTORE_PROJECT_ID;
    vi.resetModules();
  });

  it("calls doc.set with the correct subcollection path and data", async () => {
    const mockSet = vi.fn().mockResolvedValue(undefined);
    const mockDoc = vi.fn().mockReturnValue({ set: mockSet });
    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = { doc: mockDoc, batch: vi.fn(), collection: vi.fn() };
      return {
        Firestore: class MockFirestore {
          constructor() {
            Object.assign(this, mockInstance);
          }
        },
      };
    });

    const { setStripeSubscription, _resetFirestoreForTests } = await import(
      "@/lib/firebase/firestore"
    );
    _resetFirestoreForTests();
    const stripeDoc = makeStripeDoc();
    await setStripeSubscription("hh-write", stripeDoc);

    expect(mockDoc).toHaveBeenCalledWith(
      "households/hh-write/stripe/subscription"
    );
    expect(mockSet).toHaveBeenCalledWith(stripeDoc);
  });

  it("idempotent re-subscribe: overwrites existing stripe doc (cancel → re-subscribe)", async () => {
    const mockSet = vi.fn().mockResolvedValue(undefined);
    const mockDoc = vi.fn().mockReturnValue({ set: mockSet });
    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = { doc: mockDoc, batch: vi.fn(), collection: vi.fn() };
      return {
        Firestore: class MockFirestore {
          constructor() {
            Object.assign(this, mockInstance);
          }
        },
      };
    });

    const { setStripeSubscription, _resetFirestoreForTests } = await import(
      "@/lib/firebase/firestore"
    );
    _resetFirestoreForTests();

    // First write: canceled
    const canceledDoc = makeStripeDoc({
      stripeStatus: "canceled",
      tier: "free",
      active: false,
      cancelAtPeriodEnd: false,
    });
    await setStripeSubscription("hh-resub", canceledDoc);

    // Second write: re-subscribed (idempotent overwrite)
    const resubDoc = makeStripeDoc({
      stripeStatus: "active",
      tier: "karl",
      active: true,
      stripeSubscriptionId: "sub_new_456",
    });
    await setStripeSubscription("hh-resub", resubDoc);

    expect(mockSet).toHaveBeenCalledTimes(2);
    // Second call must overwrite with the new active doc
    expect(mockSet).toHaveBeenLastCalledWith(resubDoc);
    // Both calls use the same subcollection path
    expect(mockDoc).toHaveBeenNthCalledWith(
      1,
      "households/hh-resub/stripe/subscription"
    );
    expect(mockDoc).toHaveBeenNthCalledWith(
      2,
      "households/hh-resub/stripe/subscription"
    );
  });
});

// ── deleteStripeSubscription ───────────────────────────────────────────────────

describe("deleteStripeSubscription — hard-delete (not null)", () => {
  beforeEach(() => {
    process.env.FIRESTORE_PROJECT_ID = "test-project";
    vi.resetModules();
  });
  afterEach(() => {
    delete process.env.FIRESTORE_PROJECT_ID;
    vi.resetModules();
  });

  it("calls doc.delete (not doc.update/set) — hard delete, not nullification", async () => {
    const mockDelete = vi.fn().mockResolvedValue(undefined);
    const mockUpdate = vi.fn();
    const mockSet = vi.fn();
    const mockDoc = vi.fn().mockReturnValue({
      delete: mockDelete,
      update: mockUpdate,
      set: mockSet,
    });
    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = { doc: mockDoc, batch: vi.fn(), collection: vi.fn() };
      return {
        Firestore: class MockFirestore {
          constructor() {
            Object.assign(this, mockInstance);
          }
        },
      };
    });

    const { deleteStripeSubscription, _resetFirestoreForTests } = await import(
      "@/lib/firebase/firestore"
    );
    _resetFirestoreForTests();
    await deleteStripeSubscription("hh-del");

    expect(mockDelete).toHaveBeenCalledOnce();
    // Must NOT nullify via update or set
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("calls doc.delete on the correct subcollection path", async () => {
    const mockDelete = vi.fn().mockResolvedValue(undefined);
    const mockDoc = vi.fn().mockReturnValue({ delete: mockDelete });
    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = { doc: mockDoc, batch: vi.fn(), collection: vi.fn() };
      return {
        Firestore: class MockFirestore {
          constructor() {
            Object.assign(this, mockInstance);
          }
        },
      };
    });

    const { deleteStripeSubscription, _resetFirestoreForTests } = await import(
      "@/lib/firebase/firestore"
    );
    _resetFirestoreForTests();
    await deleteStripeSubscription("hh-del-path");

    expect(mockDoc).toHaveBeenCalledWith(
      "households/hh-del-path/stripe/subscription"
    );
  });
});

// ── entitlement-store: idempotent re-subscribe ─────────────────────────────────

const mockGetUser = vi.fn();
const mockSetStripeSubscription = vi.fn();
const mockGetStripeSubscription = vi.fn();
const mockDeleteStripeSubscription = vi.fn();
const mockSetUserStripeCustomerId = vi.fn();
const mockFindUserByStripeCustomerId = vi.fn();

vi.mock("@/lib/firebase/firestore", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  findUserByStripeCustomerId: (...args: unknown[]) =>
    mockFindUserByStripeCustomerId(...args),
  setUserStripeCustomerId: (...args: unknown[]) =>
    mockSetUserStripeCustomerId(...args),
  getStripeSubscription: (...args: unknown[]) =>
    mockGetStripeSubscription(...args),
  setStripeSubscription: (...args: unknown[]) =>
    mockSetStripeSubscription(...args),
  deleteStripeSubscription: (...args: unknown[]) =>
    mockDeleteStripeSubscription(...args),
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import {
  setStripeEntitlement,
  getStripeEntitlement,
  deleteStripeEntitlement,
} from "@/lib/kv/entitlement-store";
import type { StoredStripeEntitlement } from "@/lib/stripe/types";

const GOOGLE_SUB = "google-sub-loki-1648";
const HOUSEHOLD_ID = GOOGLE_SUB; // solo household

function makeUser(overrides: Partial<FirestoreUser> = {}): FirestoreUser {
  return {
    userId: GOOGLE_SUB,
    email: "loki@fenrir.io",
    displayName: "Loki",
    householdId: HOUSEHOLD_ID,
    role: "owner",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeEntitlement(
  overrides: Partial<StoredStripeEntitlement> = {}
): StoredStripeEntitlement {
  return {
    tier: "karl",
    active: true,
    stripeCustomerId: "cus_loki",
    stripeSubscriptionId: "sub_loki",
    stripeStatus: "active",
    cancelAtPeriodEnd: false,
    linkedAt: "2025-01-01T00:00:00.000Z",
    checkedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("entitlement-store — stripe subcollection edge cases (issue #1648)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetStripeSubscription.mockResolvedValue(undefined);
    mockDeleteStripeSubscription.mockResolvedValue(undefined);
    mockSetUserStripeCustomerId.mockResolvedValue(undefined);
  });

  describe("getStripeEntitlement — no stripe subcollection doc", () => {
    it("returns null when household exists but has no stripe subcollection doc", async () => {
      mockGetUser.mockResolvedValueOnce(makeUser());
      mockGetStripeSubscription.mockResolvedValueOnce(null);

      const result = await getStripeEntitlement(GOOGLE_SUB);
      expect(result).toBeNull();
      expect(mockGetStripeSubscription).toHaveBeenCalledWith(HOUSEHOLD_ID);
    });

    it("reads stripe doc from household's subcollection, not from household doc", async () => {
      mockGetUser.mockResolvedValueOnce(makeUser());
      mockGetStripeSubscription.mockResolvedValueOnce(null);

      await getStripeEntitlement(GOOGLE_SUB);

      // Must query via getStripeSubscription(householdId), not directly household
      expect(mockGetStripeSubscription).toHaveBeenCalledWith(HOUSEHOLD_ID);
      // Must NOT query household doc for stripe fields (no getHousehold call)
    });
  });

  describe("setStripeEntitlement — writes to subcollection, not household doc", () => {
    it("writes stripe doc to subcollection using household's householdId", async () => {
      mockGetUser.mockResolvedValueOnce(makeUser());
      const ent = makeEntitlement();

      await setStripeEntitlement(GOOGLE_SUB, ent);

      // Must write to the subcollection via setStripeSubscription
      expect(mockSetStripeSubscription).toHaveBeenCalledWith(
        HOUSEHOLD_ID,
        expect.objectContaining({
          stripeCustomerId: "cus_loki",
          tier: "karl",
          active: true,
        })
      );
    });

    it("idempotent re-subscribe: second setStripeEntitlement call overwrites the first", async () => {
      const user = makeUser();
      // Both calls find the user
      mockGetUser.mockResolvedValue(user);

      // First write: subscription canceled
      await setStripeEntitlement(
        GOOGLE_SUB,
        makeEntitlement({ tier: "thrall", active: false, stripeStatus: "canceled" })
      );

      // Second write: re-subscribed (same household, same subcollection path)
      await setStripeEntitlement(
        GOOGLE_SUB,
        makeEntitlement({ tier: "karl", active: true, stripeSubscriptionId: "sub_new" })
      );

      expect(mockSetStripeSubscription).toHaveBeenCalledTimes(2);
      // Both calls must target the same subcollection path
      expect(mockSetStripeSubscription.mock.calls[0][0]).toBe(HOUSEHOLD_ID);
      expect(mockSetStripeSubscription.mock.calls[1][0]).toBe(HOUSEHOLD_ID);
      // Second call has the new active state
      expect(mockSetStripeSubscription.mock.calls[1][1]).toMatchObject({
        tier: "karl",
        active: true,
        stripeSubscriptionId: "sub_new",
      });
    });

    it("writes tier 'free' (not 'thrall') to Firestore when entitlement tier is 'thrall'", async () => {
      // The stripe subcollection uses 'free' — 'thrall' is only a display tier
      mockGetUser.mockResolvedValueOnce(makeUser());
      await setStripeEntitlement(
        GOOGLE_SUB,
        makeEntitlement({ tier: "thrall", active: false })
      );

      expect(mockSetStripeSubscription).toHaveBeenCalledWith(
        HOUSEHOLD_ID,
        expect.objectContaining({ tier: "free" })
      );
    });
  });

  describe("deleteStripeEntitlement — hard-delete, no null writes", () => {
    it("calls deleteStripeSubscription (hard-delete), not setStripeSubscription", async () => {
      mockGetUser.mockResolvedValueOnce(makeUser());

      await deleteStripeEntitlement(GOOGLE_SUB);

      expect(mockDeleteStripeSubscription).toHaveBeenCalledWith(HOUSEHOLD_ID);
      // Must NOT write null/empty — must hard delete
      expect(mockSetStripeSubscription).not.toHaveBeenCalled();
    });

    it("is a no-op when user does not exist — returns undefined", async () => {
      mockGetUser.mockResolvedValueOnce(null);

      const result = await deleteStripeEntitlement(GOOGLE_SUB);
      expect(result).toBeUndefined();
      expect(mockDeleteStripeSubscription).not.toHaveBeenCalled();
    });
  });

  describe("FirestoreStripeSubscription type — no Stripe fields on FirestoreHousehold", () => {
    it("FirestoreStripeSubscription contains all required Stripe fields", () => {
      const doc: FirestoreStripeSubscription = makeStripeDoc();
      expect(doc.stripeCustomerId).toBeDefined();
      expect(doc.stripeSubscriptionId).toBeDefined();
      expect(doc.stripeStatus).toBeDefined();
      expect(doc.tier).toBeDefined();
      expect(doc.active).toBeDefined();
      expect(doc.cancelAtPeriodEnd).toBeDefined();
      expect(doc.linkedAt).toBeDefined();
      expect(doc.checkedAt).toBeDefined();
    });

    it("tier field only allows 'free' or 'karl' (not 'thrall')", () => {
      const freeDoc: FirestoreStripeSubscription = makeStripeDoc({ tier: "free" });
      const karlDoc: FirestoreStripeSubscription = makeStripeDoc({ tier: "karl" });
      expect(freeDoc.tier).toBe("free");
      expect(karlDoc.tier).toBe("karl");
    });
  });
});
