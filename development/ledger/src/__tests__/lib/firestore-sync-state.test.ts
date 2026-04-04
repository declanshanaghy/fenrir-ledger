/**
 * Unit tests for sync state CRUD functions in firestore.ts
 *
 * Validates:
 *   - getMemberSyncState returns null when doc doesn't exist
 *   - getMemberSyncState returns doc data when it exists
 *   - getHouseholdSyncVersion returns 0 when household absent
 *   - getHouseholdSyncVersion returns 0 when syncVersion field absent
 *   - getHouseholdSyncVersion returns current syncVersion
 *   - updateSyncStateAfterPush increments syncVersion and flags other members
 *   - updateSyncStateAfterPush does not flag the pushing member (needsDownload=false)
 *   - updateSyncStateAfterPush throws when household not found
 *   - updateSyncStateAfterPull sets needsDownload=false with current syncVersion
 *
 * Issue #2001
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { FirestoreMemberSyncState, FirestoreHousehold } from "@/lib/firebase/firestore-types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeHousehold(overrides: Partial<FirestoreHousehold> = {}): FirestoreHousehold {
  return {
    id: "hh-test",
    name: "Test Household",
    ownerId: "user-owner",
    memberIds: ["user-owner", "user-member"],
    inviteCode: "ABC123",
    inviteCodeExpiresAt: "2027-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    syncVersion: 5,
    ...overrides,
  };
}

function makeSyncState(overrides: Partial<FirestoreMemberSyncState> = {}): FirestoreMemberSyncState {
  return {
    userId: "user-owner",
    lastSyncedVersion: 5,
    needsDownload: false,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ─── getMemberSyncState ───────────────────────────────────────────────────────

describe("getMemberSyncState", () => {
  beforeEach(() => {
    process.env.FIRESTORE_PROJECT_ID = "test-project";
    vi.resetModules();
  });
  afterEach(() => {
    delete process.env.FIRESTORE_PROJECT_ID;
    vi.resetModules();
  });

  it("returns null when sync state doc does not exist", async () => {
    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = {
        doc: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ exists: false }) }),
      };
      return { Firestore: class { constructor() { Object.assign(this, mockInstance); } } };
    });

    const { getMemberSyncState, _resetFirestoreForTests } = await import("@/lib/firebase/firestore");
    _resetFirestoreForTests();
    const result = await getMemberSyncState("hh-test", "user-owner");
    expect(result).toBeNull();
  });

  it("returns sync state data when doc exists", async () => {
    const syncState = makeSyncState({ userId: "user-owner", lastSyncedVersion: 3, needsDownload: true });
    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = {
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ exists: true, data: () => syncState }),
        }),
      };
      return { Firestore: class { constructor() { Object.assign(this, mockInstance); } } };
    });

    const { getMemberSyncState, _resetFirestoreForTests } = await import("@/lib/firebase/firestore");
    _resetFirestoreForTests();
    const result = await getMemberSyncState("hh-test", "user-owner");
    expect(result).toEqual(syncState);
  });
});

// ─── getHouseholdSyncVersion ──────────────────────────────────────────────────

describe("getHouseholdSyncVersion", () => {
  beforeEach(() => {
    process.env.FIRESTORE_PROJECT_ID = "test-project";
    vi.resetModules();
  });
  afterEach(() => {
    delete process.env.FIRESTORE_PROJECT_ID;
    vi.resetModules();
  });

  it("returns 0 when household doc does not exist", async () => {
    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = {
        doc: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ exists: false }) }),
      };
      return { Firestore: class { constructor() { Object.assign(this, mockInstance); } } };
    });

    const { getHouseholdSyncVersion, _resetFirestoreForTests } = await import("@/lib/firebase/firestore");
    _resetFirestoreForTests();
    const result = await getHouseholdSyncVersion("hh-missing");
    expect(result).toBe(0);
  });

  it("returns 0 when syncVersion field is absent (legacy household)", async () => {
    const household = makeHousehold({ syncVersion: undefined });
    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = {
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ exists: true, data: () => household }),
        }),
      };
      return { Firestore: class { constructor() { Object.assign(this, mockInstance); } } };
    });

    const { getHouseholdSyncVersion, _resetFirestoreForTests } = await import("@/lib/firebase/firestore");
    _resetFirestoreForTests();
    const result = await getHouseholdSyncVersion("hh-test");
    expect(result).toBe(0);
  });

  it("returns the syncVersion when present", async () => {
    const household = makeHousehold({ syncVersion: 7 });
    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = {
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ exists: true, data: () => household }),
        }),
      };
      return { Firestore: class { constructor() { Object.assign(this, mockInstance); } } };
    });

    const { getHouseholdSyncVersion, _resetFirestoreForTests } = await import("@/lib/firebase/firestore");
    _resetFirestoreForTests();
    const result = await getHouseholdSyncVersion("hh-test");
    expect(result).toBe(7);
  });
});

// ─── updateSyncStateAfterPush ─────────────────────────────────────────────────

describe("updateSyncStateAfterPush", () => {
  beforeEach(() => {
    process.env.FIRESTORE_PROJECT_ID = "test-project";
    vi.resetModules();
  });
  afterEach(() => {
    delete process.env.FIRESTORE_PROJECT_ID;
    vi.resetModules();
  });

  it("throws household_not_found when household doc missing", async () => {
    const mockTx = {
      get: vi.fn().mockResolvedValue({ exists: false }),
      update: vi.fn(),
      set: vi.fn(),
    };
    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = {
        doc: vi.fn().mockReturnValue({}),
        runTransaction: vi.fn().mockImplementation((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
      };
      return { Firestore: class { constructor() { Object.assign(this, mockInstance); } } };
    });

    const { updateSyncStateAfterPush, _resetFirestoreForTests } = await import("@/lib/firebase/firestore");
    _resetFirestoreForTests();
    await expect(updateSyncStateAfterPush("hh-missing", "user-owner")).rejects.toThrow("household_not_found");
  });

  it("increments syncVersion and returns new version", async () => {
    const household = makeHousehold({ syncVersion: 5, memberIds: ["user-owner", "user-member"] });
    const writtenDocs: Record<string, unknown> = {};
    const updatedDocs: Record<string, unknown> = {};
    let docRefKey = 0;

    const mockHouseholdRef = { _key: "household" };
    const mockMemberRef1 = { _key: "syncState/user-owner" };
    const mockMemberRef2 = { _key: "syncState/user-member" };

    const mockTx = {
      get: vi.fn().mockResolvedValue({ exists: true, data: () => household }),
      update: vi.fn().mockImplementation((ref: { _key: string }, data: unknown) => {
        updatedDocs[ref._key] = data;
      }),
      set: vi.fn().mockImplementation((ref: { _key: string }, data: unknown) => {
        writtenDocs[ref._key] = data;
      }),
    };

    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = {
        doc: vi.fn().mockImplementation((path: string) => {
          if (path.includes("syncState/user-owner")) return mockMemberRef1;
          if (path.includes("syncState/user-member")) return mockMemberRef2;
          return mockHouseholdRef;
        }),
        runTransaction: vi.fn().mockImplementation((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
      };
      return { Firestore: class { constructor() { Object.assign(this, mockInstance); } } };
    });

    const { updateSyncStateAfterPush, _resetFirestoreForTests } = await import("@/lib/firebase/firestore");
    _resetFirestoreForTests();
    const newVersion = await updateSyncStateAfterPush("hh-test", "user-owner");

    expect(newVersion).toBe(6);
    // household doc updated with new version
    expect(mockTx.update).toHaveBeenCalledWith(
      mockHouseholdRef,
      expect.objectContaining({ syncVersion: 6 }),
    );
  });

  it("sets needsDownload=false for the pushing member", async () => {
    const household = makeHousehold({ syncVersion: 3, memberIds: ["user-owner", "user-member"] });
    const writtenDocs = new Map<unknown, FirestoreMemberSyncState>();

    const mockHouseholdRef = { _key: "household" };
    const mockOwnerRef = { _key: "syncState/user-owner" };
    const mockMemberRef = { _key: "syncState/user-member" };

    const mockTx = {
      get: vi.fn().mockResolvedValue({ exists: true, data: () => household }),
      update: vi.fn(),
      set: vi.fn().mockImplementation((ref: unknown, data: FirestoreMemberSyncState) => {
        writtenDocs.set(ref, data);
      }),
    };

    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = {
        doc: vi.fn().mockImplementation((path: string) => {
          if (path.includes("syncState/user-owner")) return mockOwnerRef;
          if (path.includes("syncState/user-member")) return mockMemberRef;
          return mockHouseholdRef;
        }),
        runTransaction: vi.fn().mockImplementation((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
      };
      return { Firestore: class { constructor() { Object.assign(this, mockInstance); } } };
    });

    const { updateSyncStateAfterPush, _resetFirestoreForTests } = await import("@/lib/firebase/firestore");
    _resetFirestoreForTests();
    await updateSyncStateAfterPush("hh-test", "user-owner");

    const ownerState = writtenDocs.get(mockOwnerRef);
    const memberState = writtenDocs.get(mockMemberRef);

    expect(ownerState?.needsDownload).toBe(false);
    expect(memberState?.needsDownload).toBe(true);
  });
});

// ─── updateSyncStateAfterPull ─────────────────────────────────────────────────

describe("updateSyncStateAfterPull", () => {
  beforeEach(() => {
    process.env.FIRESTORE_PROJECT_ID = "test-project";
    vi.resetModules();
  });
  afterEach(() => {
    delete process.env.FIRESTORE_PROJECT_ID;
    vi.resetModules();
  });

  it("writes needsDownload=false with current syncVersion", async () => {
    const household = makeHousehold({ syncVersion: 9 });
    let writtenData: unknown = null;

    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = {
        doc: vi.fn().mockImplementation(() => ({
          get: vi.fn().mockResolvedValue({ exists: true, data: () => household }),
          set: vi.fn().mockImplementation((data: unknown) => { writtenData = data; }),
        })),
      };
      return { Firestore: class { constructor() { Object.assign(this, mockInstance); } } };
    });

    const { updateSyncStateAfterPull, _resetFirestoreForTests } = await import("@/lib/firebase/firestore");
    _resetFirestoreForTests();
    await updateSyncStateAfterPull("hh-test", "user-owner");

    expect(writtenData).toMatchObject({
      userId: "user-owner",
      lastSyncedVersion: 9,
      needsDownload: false,
    });
  });

  it("uses syncVersion=0 when household has no syncVersion", async () => {
    const household = makeHousehold({ syncVersion: undefined });
    let writtenData: unknown = null;

    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = {
        doc: vi.fn().mockImplementation(() => ({
          get: vi.fn().mockResolvedValue({ exists: true, data: () => household }),
          set: vi.fn().mockImplementation((data: unknown) => { writtenData = data; }),
        })),
      };
      return { Firestore: class { constructor() { Object.assign(this, mockInstance); } } };
    });

    const { updateSyncStateAfterPull, _resetFirestoreForTests } = await import("@/lib/firebase/firestore");
    _resetFirestoreForTests();
    await updateSyncStateAfterPull("hh-test", "user-owner");

    expect(writtenData).toMatchObject({
      userId: "user-owner",
      lastSyncedVersion: 0,
      needsDownload: false,
    });
  });
});

// ─── FIRESTORE_PATHS sync state helpers ───────────────────────────────────────

describe("FIRESTORE_PATHS sync state helpers", () => {
  it("builds /households/{id}/syncState collection path", async () => {
    const { FIRESTORE_PATHS } = await import("@/lib/firebase/firestore-types");
    expect(FIRESTORE_PATHS.syncStates("hh-abc")).toBe("households/hh-abc/syncState");
  });

  it("builds /households/{id}/syncState/{userId} document path", async () => {
    const { FIRESTORE_PATHS } = await import("@/lib/firebase/firestore-types");
    expect(FIRESTORE_PATHS.syncState("hh-abc", "user-xyz")).toBe("households/hh-abc/syncState/user-xyz");
  });
});

// ─── FirestoreMemberSyncState type shape ──────────────────────────────────────

describe("FirestoreMemberSyncState type shape", () => {
  it("accepts a valid sync state", async () => {
    const { type: _type } = await import("@/lib/firebase/firestore-types") as { type?: unknown };
    const state: FirestoreMemberSyncState = {
      userId: "user-abc",
      lastSyncedVersion: 3,
      needsDownload: true,
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(state.needsDownload).toBe(true);
    expect(state.lastSyncedVersion).toBe(3);
  });
});

// ─── FirestoreHousehold syncVersion field ─────────────────────────────────────

describe("FirestoreHousehold syncVersion", () => {
  it("accepts household with syncVersion", async () => {
    const hh: FirestoreHousehold = {
      id: "hh-uuid",
      name: "Test Household",
      ownerId: "user_abc",
      memberIds: ["user_abc"],
      inviteCode: "X7K2MQ",
      inviteCodeExpiresAt: "2027-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      syncVersion: 42,
    };
    expect(hh.syncVersion).toBe(42);
  });

  it("accepts household without syncVersion (optional field)", async () => {
    const hh: FirestoreHousehold = {
      id: "hh-uuid",
      name: "Legacy Household",
      ownerId: "user_abc",
      memberIds: ["user_abc"],
      inviteCode: "X7K2MQ",
      inviteCodeExpiresAt: "2027-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(hh.syncVersion).toBeUndefined();
  });
});
