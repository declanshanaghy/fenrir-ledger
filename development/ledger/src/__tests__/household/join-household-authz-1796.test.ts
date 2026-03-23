/**
 * Issue #1796 — joinHouseholdTransaction authz guard.
 *
 * Verifies that the old household document is deleted if and only if:
 *   - the joining user is the owner of the old household, AND
 *   - the old household is solo (exactly 1 member).
 *
 * The transaction mock executes the real joinHouseholdTransaction code path
 * so the conditional delete logic is exercised directly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { FirestoreUser, FirestoreHousehold } from "@/lib/firebase/firestore-types";
import { FIRESTORE_PATHS } from "@/lib/firebase/firestore-types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USER_ID = "user_joiner";
const OLD_HH_ID = "hh_solo_old";
const TARGET_HH_ID = "hh_target";

const FUTURE_EXPIRY = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

const baseTargetHousehold: FirestoreHousehold = {
  id: TARGET_HH_ID,
  name: "Target Household",
  ownerId: "user_owner",
  memberIds: ["user_owner"],
  inviteCode: "X7K2NP",
  inviteCodeExpiresAt: FUTURE_EXPIRY,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function makeUser(role: "owner" | "member"): FirestoreUser {
  return {
    userId: USER_ID,
    email: "joiner@example.com",
    displayName: "Joiner",
    householdId: OLD_HH_ID,
    role,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeOldHousehold(memberCount: number): FirestoreHousehold {
  return {
    id: OLD_HH_ID,
    name: "Solo Household",
    ownerId: USER_ID,
    memberIds: Array.from({ length: memberCount }, (_, i) =>
      i === 0 ? USER_ID : `user_other_${i}`
    ),
    inviteCode: "AAABBB",
    inviteCodeExpiresAt: FUTURE_EXPIRY,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

// ── Mock factory ──────────────────────────────────────────────────────────────

function buildFirestoreMock({
  user,
  oldHousehold,
}: {
  user: FirestoreUser;
  oldHousehold: FirestoreHousehold | null;
}) {
  const mockTxDelete = vi.fn();
  const mockTxSet = vi.fn();
  const mockTxUpdate = vi.fn();

  const mockTxGet = vi.fn().mockImplementation((ref: { _path: string }) => {
    if (ref._path === FIRESTORE_PATHS.user(USER_ID)) {
      return Promise.resolve({ exists: true, data: () => user });
    }
    if (ref._path === FIRESTORE_PATHS.household(OLD_HH_ID)) {
      return Promise.resolve({
        exists: oldHousehold !== null,
        data: () => oldHousehold,
      });
    }
    return Promise.resolve({ exists: false, data: () => null });
  });

  const tx = {
    get: mockTxGet,
    set: mockTxSet,
    delete: mockTxDelete,
    update: mockTxUpdate,
  };

  // invite-code collection query (target household lookup)
  const inviteLookupGet = vi.fn().mockResolvedValue({
    empty: false,
    docs: [
      {
        ref: { _path: FIRESTORE_PATHS.household(TARGET_HH_ID) },
        data: () => baseTargetHousehold,
      },
    ],
  });

  // old household cards query (returns no cards for simplicity)
  const cardsGet = vi.fn().mockResolvedValue({ docs: [] });

  const mockCollection = vi.fn().mockImplementation((path: string) => {
    if (path === "households") {
      return {
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({ get: inviteLookupGet }),
        }),
      };
    }
    // cards sub-collection
    return { get: cardsGet };
  });

  const mockDoc = vi.fn().mockImplementation((path: string) => ({ _path: path }));

  const mockInstance = {
    doc: mockDoc,
    collection: mockCollection,
    runTransaction: vi.fn().mockImplementation(
      async (fn: (tx: typeof tx) => Promise<unknown>) => fn(tx)
    ),
    batch: vi.fn(),
  };

  return { mockInstance, mockTxDelete };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("joinHouseholdTransaction — old household delete authz (#1796)", () => {
  beforeEach(() => {
    process.env.FIRESTORE_PROJECT_ID = "test-project";
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.FIRESTORE_PROJECT_ID;
    vi.resetModules();
  });

  it("deletes old household when user is owner and it is solo (1 member)", async () => {
    const { mockInstance, mockTxDelete } = buildFirestoreMock({
      user: makeUser("owner"),
      oldHousehold: makeOldHousehold(1),
    });

    vi.doMock("@google-cloud/firestore", () => ({
      Firestore: class { constructor() { Object.assign(this, mockInstance); } },
    }));

    const { joinHouseholdTransaction, _resetFirestoreForTests } = await import(
      "@/lib/firebase/firestore"
    );
    _resetFirestoreForTests();

    await joinHouseholdTransaction(USER_ID, "X7K2NP");

    expect(mockTxDelete).toHaveBeenCalledOnce();
    expect(mockTxDelete).toHaveBeenCalledWith(
      expect.objectContaining({ _path: FIRESTORE_PATHS.household(OLD_HH_ID) })
    );
  });

  it("does NOT delete old household when user role is member", async () => {
    const { mockInstance, mockTxDelete } = buildFirestoreMock({
      user: makeUser("member"),
      oldHousehold: makeOldHousehold(1),
    });

    vi.doMock("@google-cloud/firestore", () => ({
      Firestore: class { constructor() { Object.assign(this, mockInstance); } },
    }));

    const { joinHouseholdTransaction, _resetFirestoreForTests } = await import(
      "@/lib/firebase/firestore"
    );
    _resetFirestoreForTests();

    await joinHouseholdTransaction(USER_ID, "X7K2NP");

    expect(mockTxDelete).not.toHaveBeenCalled();
  });

  it("does NOT delete old household when it has multiple members", async () => {
    const { mockInstance, mockTxDelete } = buildFirestoreMock({
      user: makeUser("owner"),
      oldHousehold: makeOldHousehold(2),
    });

    vi.doMock("@google-cloud/firestore", () => ({
      Firestore: class { constructor() { Object.assign(this, mockInstance); } },
    }));

    const { joinHouseholdTransaction, _resetFirestoreForTests } = await import(
      "@/lib/firebase/firestore"
    );
    _resetFirestoreForTests();

    await joinHouseholdTransaction(USER_ID, "X7K2NP");

    expect(mockTxDelete).not.toHaveBeenCalled();
  });

  it("does NOT delete old household when old household doc is missing", async () => {
    const { mockInstance, mockTxDelete } = buildFirestoreMock({
      user: makeUser("owner"),
      oldHousehold: null,
    });

    vi.doMock("@google-cloud/firestore", () => ({
      Firestore: class { constructor() { Object.assign(this, mockInstance); } },
    }));

    const { joinHouseholdTransaction, _resetFirestoreForTests } = await import(
      "@/lib/firebase/firestore"
    );
    _resetFirestoreForTests();

    await joinHouseholdTransaction(USER_ID, "X7K2NP");

    expect(mockTxDelete).not.toHaveBeenCalled();
  });
});
