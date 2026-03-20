/**
 * Loki QA — Stripe subcollection helpers (issue #1648)
 *
 * Validates the new getStripeSubscription / setStripeSubscription /
 * deleteStripeSubscription helpers in firestore.ts.
 *
 * Acceptance criteria covered:
 *   - FIRESTORE_PATHS.stripeSubscription builds correct path
 *   - getStripeSubscription returns null for household with no stripe doc
 *   - getStripeSubscription reads from correct subcollection path
 *   - setStripeSubscription writes to the correct subcollection path
 *   - deleteStripeSubscription hard-deletes (not nulls) the subcollection doc
 *   - Re-subscribe after cancel: setStripeSubscription is idempotent (overwrites)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FirestoreStripeSubscription } from "@/lib/firebase/firestore-types";
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

// ── FirestoreStripeSubscription type ──────────────────────────────────────────

describe("FirestoreStripeSubscription type — Stripe fields in subcollection only", () => {
  it("accepts a valid stripe subscription document", () => {
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

  it("tier field allows 'free' and 'karl' (not 'thrall')", () => {
    const freeDoc: FirestoreStripeSubscription = makeStripeDoc({ tier: "free" });
    const karlDoc: FirestoreStripeSubscription = makeStripeDoc({ tier: "karl" });
    expect(freeDoc.tier).toBe("free");
    expect(karlDoc.tier).toBe("karl");
  });

  it("cancelAtPeriodEnd defaults to false for active subscription", () => {
    const doc = makeStripeDoc({ cancelAtPeriodEnd: false });
    expect(doc.cancelAtPeriodEnd).toBe(false);
  });

  it("currentPeriodEnd is optional (absent for households that never subscribed)", () => {
    // No currentPeriodEnd — valid doc
    const doc: FirestoreStripeSubscription = {
      stripeCustomerId: "cus_x",
      stripeSubscriptionId: "sub_x",
      stripeStatus: "active",
      tier: "karl",
      active: true,
      cancelAtPeriodEnd: false,
      linkedAt: "2025-01-01T00:00:00.000Z",
      checkedAt: "2025-01-01T00:00:00.000Z",
    };
    expect(doc.currentPeriodEnd).toBeUndefined();
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
