/**
 * Fenrir Ledger — Firestore Client & Schema Tests
 *
 * Unit tests for:
 *   - firestore-types.ts: invite code helpers, path helpers, type shapes
 *   - firestore.ts: client initialization guard, ensureSoloHousehold logic
 *
 * The Firestore Admin SDK is mocked — no real GCP connection required.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateInviteCode,
  generateInviteCodeExpiry,
  isInviteCodeValid,
  FIRESTORE_PATHS,
  type FirestoreUser,
  type FirestoreHousehold,
  type FirestoreCard,
} from "@/lib/firebase/firestore-types";

// ─── firestore-types.ts ───────────────────────────────────────────────────────

describe("FIRESTORE_PATHS", () => {
  it("builds /users/{id} path", () => {
    expect(FIRESTORE_PATHS.user("user_abc123")).toBe("users/user_abc123");
  });

  it("builds /households/{id} path", () => {
    expect(FIRESTORE_PATHS.household("hh-uuid")).toBe("households/hh-uuid");
  });

  it("builds /households/{id}/cards collection path", () => {
    expect(FIRESTORE_PATHS.cards("hh-uuid")).toBe("households/hh-uuid/cards");
  });

  it("builds /households/{id}/cards/{cardId} path", () => {
    expect(FIRESTORE_PATHS.card("hh-uuid", "card-123")).toBe(
      "households/hh-uuid/cards/card-123"
    );
  });
});

describe("generateInviteCode", () => {
  it("returns exactly 6 characters", () => {
    expect(generateInviteCode()).toHaveLength(6);
  });

  it("uses only unambiguous alphanumeric characters", () => {
    // Must not contain O, 0, 1, I (easy-to-confuse chars)
    const forbidden = /[O0oI1l]/;
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode();
      expect(forbidden.test(code)).toBe(false);
    }
  });

  it("generates unique codes each time", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateInviteCode()));
    // All 20 should be unique (collision would be astronomically unlikely)
    expect(codes.size).toBe(20);
  });

  it("returns only uppercase letters and digits", () => {
    for (let i = 0; i < 20; i++) {
      const code = generateInviteCode();
      expect(/^[A-Z0-9]+$/.test(code)).toBe(true);
    }
  });
});

describe("generateInviteCodeExpiry", () => {
  it("returns an ISO 8601 timestamp roughly 30 days from now", () => {
    const before = Date.now();
    const expiry = generateInviteCodeExpiry();
    const after = Date.now();

    const expiryMs = new Date(expiry).getTime();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    expect(expiryMs).toBeGreaterThanOrEqual(before + thirtyDays);
    expect(expiryMs).toBeLessThanOrEqual(after + thirtyDays);
  });

  it("returns a valid ISO 8601 string", () => {
    const expiry = generateInviteCodeExpiry();
    expect(new Date(expiry).toISOString()).toBe(expiry);
  });
});

describe("isInviteCodeValid", () => {
  it("returns true for a future expiry", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60).toISOString();
    expect(isInviteCodeValid(future)).toBe(true);
  });

  it("returns false for a past expiry", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isInviteCodeValid(past)).toBe(false);
  });
});

// ─── FirestoreUser type shape ─────────────────────────────────────────────────

describe("FirestoreUser shape", () => {
  it("accepts a valid user object", () => {
    const user: FirestoreUser = {
      userId: "user_abc",
      email: "test@example.com",
      displayName: "Test User",
      householdId: "hh-uuid",
      role: "owner",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    // Type compile check — if this compiles, the shape is correct
    expect(user.role).toBe("owner");
    expect(user.householdId).toBe("hh-uuid");
  });

  it("accepts member role", () => {
    const user: FirestoreUser = {
      userId: "user_xyz",
      email: "member@example.com",
      displayName: "Member",
      householdId: "hh-uuid",
      role: "member",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(user.role).toBe("member");
  });
});

// ─── FirestoreHousehold type shape ────────────────────────────────────────────

describe("FirestoreHousehold shape", () => {
  it("accepts a valid household (no Stripe fields — they live in subcollection)", () => {
    const hh: FirestoreHousehold = {
      id: "hh-uuid",
      name: "The Shanaghys",
      ownerId: "user_abc",
      memberIds: ["user_abc"],
      inviteCode: "X7K2MQ",
      inviteCodeExpiresAt: "2026-04-16T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(hh.memberIds).toHaveLength(1);
    // tier lives in /households/{id}/stripe/subscription now (issue #1648)
    expect((hh as Record<string, unknown>).tier).toBeUndefined();
  });

  it("accepts a multi-member household", () => {
    const hh: FirestoreHousehold = {
      id: "hh-uuid",
      name: "The Karls",
      ownerId: "user_abc",
      memberIds: ["user_abc", "user_xyz", "user_def"],
      inviteCode: "A3B4C5",
      inviteCodeExpiresAt: "2026-04-16T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(hh.memberIds).toHaveLength(3);
  });
});

// ─── Firestore client: initialization guard ───────────────────────────────────

describe("getFirestore initialization", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.FIRESTORE_PROJECT_ID;
    // Reset the singleton between tests
    vi.resetModules();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.FIRESTORE_PROJECT_ID = originalEnv;
    } else {
      delete process.env.FIRESTORE_PROJECT_ID;
    }
    vi.resetModules();
  });

  it("throws when FIRESTORE_PROJECT_ID is not set", async () => {
    delete process.env.FIRESTORE_PROJECT_ID;

    // Fresh import after resetModules so singleton is cleared
    const { getFirestore, _resetFirestoreForTests } = await import(
      "@/lib/firebase/firestore"
    );
    _resetFirestoreForTests();

    expect(() => getFirestore()).toThrow("FIRESTORE_PROJECT_ID");
  });

  it("returns a Firestore instance when project ID is set", async () => {
    process.env.FIRESTORE_PROJECT_ID = "test-project";

    const { getFirestore, _resetFirestoreForTests } = await import(
      "@/lib/firebase/firestore"
    );
    _resetFirestoreForTests();

    // Should not throw
    const db = getFirestore();
    expect(db).toBeTruthy();
  });
});

// ─── CRUD operations: getUser / setUser / getHousehold / getCards / setCard / softDeleteCard / setCards ───

describe("getUser", () => {
  beforeEach(() => {
    process.env.FIRESTORE_PROJECT_ID = "test-project";
    vi.resetModules();
  });
  afterEach(() => {
    delete process.env.FIRESTORE_PROJECT_ID;
    vi.resetModules();
  });

  it("returns null when the user document does not exist", async () => {
    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = {
        doc: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ exists: false }) }),
        batch: vi.fn(),
        collection: vi.fn(),
      };
      return { Firestore: class MockFirestore { constructor() { Object.assign(this, mockInstance); } } };
    });

    const { getUser, _resetFirestoreForTests } = await import("@/lib/firebase/firestore");
    _resetFirestoreForTests();
    const result = await getUser("user_missing");
    expect(result).toBeNull();
  });

  it("returns user data when the user document exists", async () => {
    const mockUser: FirestoreUser = {
      userId: "user_found",
      email: "found@example.com",
      displayName: "Found User",
      householdId: "hh-1",
      role: "owner",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = {
        doc: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ exists: true, data: () => mockUser }) }),
        batch: vi.fn(),
        collection: vi.fn(),
      };
      return { Firestore: class MockFirestore { constructor() { Object.assign(this, mockInstance); } } };
    });

    const { getUser, _resetFirestoreForTests } = await import("@/lib/firebase/firestore");
    _resetFirestoreForTests();
    const result = await getUser("user_found");
    expect(result).toEqual(mockUser);
  });
});

describe("setUser", () => {
  beforeEach(() => {
    process.env.FIRESTORE_PROJECT_ID = "test-project";
    vi.resetModules();
  });
  afterEach(() => {
    delete process.env.FIRESTORE_PROJECT_ID;
    vi.resetModules();
  });

  it("calls doc.set with the correct path and user data", async () => {
    const mockSet = vi.fn().mockResolvedValue(undefined);
    const mockDoc = vi.fn().mockReturnValue({ set: mockSet });
    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = { doc: mockDoc, batch: vi.fn(), collection: vi.fn() };
      return { Firestore: class MockFirestore { constructor() { Object.assign(this, mockInstance); } } };
    });

    const { setUser, _resetFirestoreForTests } = await import("@/lib/firebase/firestore");
    _resetFirestoreForTests();
    const user: FirestoreUser = {
      userId: "user_write",
      email: "write@example.com",
      displayName: "Write User",
      householdId: "hh-write",
      role: "member",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    await setUser(user);
    expect(mockDoc).toHaveBeenCalledWith("users/user_write");
    expect(mockSet).toHaveBeenCalledWith(user);
  });
});

describe("getHousehold", () => {
  beforeEach(() => {
    process.env.FIRESTORE_PROJECT_ID = "test-project";
    vi.resetModules();
  });
  afterEach(() => {
    delete process.env.FIRESTORE_PROJECT_ID;
    vi.resetModules();
  });

  it("returns null when household does not exist", async () => {
    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = {
        doc: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ exists: false }) }),
        batch: vi.fn(),
        collection: vi.fn(),
      };
      return { Firestore: class MockFirestore { constructor() { Object.assign(this, mockInstance); } } };
    });

    const { getHousehold, _resetFirestoreForTests } = await import("@/lib/firebase/firestore");
    _resetFirestoreForTests();
    const result = await getHousehold("hh-missing");
    expect(result).toBeNull();
  });

  it("returns household data when document exists", async () => {
    const mockHH: FirestoreHousehold = {
      id: "hh-found",
      name: "Found HH",
      ownerId: "user_abc",
      memberIds: ["user_abc"],
      inviteCode: "X7K2MQ",
      inviteCodeExpiresAt: "2026-04-16T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = {
        doc: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ exists: true, data: () => mockHH }) }),
        batch: vi.fn(),
        collection: vi.fn(),
      };
      return { Firestore: class MockFirestore { constructor() { Object.assign(this, mockInstance); } } };
    });

    const { getHousehold, _resetFirestoreForTests } = await import("@/lib/firebase/firestore");
    _resetFirestoreForTests();
    const result = await getHousehold("hh-found");
    expect(result).toEqual(mockHH);
  });
});

describe("getCards", () => {
  beforeEach(() => {
    process.env.FIRESTORE_PROJECT_ID = "test-project";
    vi.resetModules();
  });
  afterEach(() => {
    delete process.env.FIRESTORE_PROJECT_ID;
    vi.resetModules();
  });

  it("returns only non-deleted cards ordered by createdAt", async () => {
    const activeCard = { id: "card-1", householdId: "hh-1", createdAt: "2026-01-01T00:00:00.000Z" };
    const deletedCard = { id: "card-2", householdId: "hh-1", createdAt: "2026-01-02T00:00:00.000Z", deletedAt: "2026-02-01T00:00:00.000Z" };
    const mockGet = vi.fn().mockResolvedValue({
      docs: [
        { data: () => activeCard },
        { data: () => deletedCard },
      ],
    });
    const mockOrderBy = vi.fn().mockReturnValue({ get: mockGet });
    const mockCollection = vi.fn().mockReturnValue({ orderBy: mockOrderBy });

    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = { doc: vi.fn(), batch: vi.fn(), collection: mockCollection };
      return { Firestore: class MockFirestore { constructor() { Object.assign(this, mockInstance); } } };
    });

    const { getCards, _resetFirestoreForTests } = await import("@/lib/firebase/firestore");
    _resetFirestoreForTests();
    const result = await getCards("hh-1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("card-1");
  });

  it("returns empty array when no cards exist", async () => {
    const mockGet = vi.fn().mockResolvedValue({ docs: [] });
    const mockOrderBy = vi.fn().mockReturnValue({ get: mockGet });
    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = { doc: vi.fn(), batch: vi.fn(), collection: vi.fn().mockReturnValue({ orderBy: mockOrderBy }) };
      return { Firestore: class MockFirestore { constructor() { Object.assign(this, mockInstance); } } };
    });

    const { getCards, _resetFirestoreForTests } = await import("@/lib/firebase/firestore");
    _resetFirestoreForTests();
    const result = await getCards("hh-empty");
    expect(result).toEqual([]);
  });
});

describe("softDeleteCard", () => {
  beforeEach(() => {
    process.env.FIRESTORE_PROJECT_ID = "test-project";
    vi.resetModules();
  });
  afterEach(() => {
    delete process.env.FIRESTORE_PROJECT_ID;
    vi.resetModules();
  });

  it("calls doc.update with deletedAt set to an ISO string", async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockDoc = vi.fn().mockReturnValue({ update: mockUpdate });
    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = { doc: mockDoc, batch: vi.fn(), collection: vi.fn() };
      return { Firestore: class MockFirestore { constructor() { Object.assign(this, mockInstance); } } };
    });

    const { softDeleteCard, _resetFirestoreForTests } = await import("@/lib/firebase/firestore");
    _resetFirestoreForTests();
    await softDeleteCard("hh-1", "card-1");
    expect(mockDoc).toHaveBeenCalledWith("households/hh-1/cards/card-1");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ deletedAt: expect.any(String) })
    );
    // deletedAt must be a valid ISO 8601 timestamp
    const { deletedAt } = mockUpdate.mock.calls[0][0] as { deletedAt: string };
    expect(new Date(deletedAt).toISOString()).toBe(deletedAt);
  });
});

describe("setCards (batch write)", () => {
  beforeEach(() => {
    process.env.FIRESTORE_PROJECT_ID = "test-project";
    vi.resetModules();
  });
  afterEach(() => {
    delete process.env.FIRESTORE_PROJECT_ID;
    vi.resetModules();
  });

  it("is a no-op for an empty cards array", async () => {
    const mockBatch = { set: vi.fn(), commit: vi.fn() };
    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = { doc: vi.fn(), batch: vi.fn().mockReturnValue(mockBatch), collection: vi.fn() };
      return { Firestore: class MockFirestore { constructor() { Object.assign(this, mockInstance); } } };
    });

    const { setCards, _resetFirestoreForTests } = await import("@/lib/firebase/firestore");
    _resetFirestoreForTests();
    await setCards([]);
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });

  it("writes all cards in a single batch for <= 500 items", async () => {
    const mockBatch = { set: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
    const mockDoc = vi.fn().mockReturnValue({});
    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = { doc: mockDoc, batch: vi.fn().mockReturnValue(mockBatch), collection: vi.fn() };
      return { Firestore: class MockFirestore { constructor() { Object.assign(this, mockInstance); } } };
    });

    const { setCards, _resetFirestoreForTests } = await import("@/lib/firebase/firestore");
    _resetFirestoreForTests();
    const cards = Array.from({ length: 3 }, (_, i) => ({
      id: `card-${i}`,
      householdId: "hh-1",
    })) as Parameters<typeof setCards>[0];
    await setCards(cards);
    expect(mockBatch.commit).toHaveBeenCalledOnce();
    expect(mockBatch.set).toHaveBeenCalledTimes(3);
  });
});

describe("ensureSoloHousehold — data integrity guard", () => {
  beforeEach(() => {
    process.env.FIRESTORE_PROJECT_ID = "test-project";
    vi.resetModules();
  });
  afterEach(() => {
    delete process.env.FIRESTORE_PROJECT_ID;
    vi.resetModules();
  });

  it("throws a data integrity error when user exists but household is missing", async () => {
    const existingUser: FirestoreUser = {
      userId: "user_orphan",
      email: "orphan@example.com",
      displayName: "Orphan",
      householdId: "hh-gone",
      role: "owner",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    // First doc.get → user exists; second → household missing
    const mockDocGet = vi.fn()
      .mockResolvedValueOnce({ exists: true, data: () => existingUser })
      .mockResolvedValueOnce({ exists: false });

    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = {
        doc: vi.fn().mockReturnValue({ get: mockDocGet, set: vi.fn() }),
        batch: vi.fn().mockReturnValue({ set: vi.fn(), commit: vi.fn() }),
        collection: vi.fn(),
      };
      return { Firestore: class MockFirestore { constructor() { Object.assign(this, mockInstance); } } };
    });

    const { ensureSoloHousehold, _resetFirestoreForTests } = await import("@/lib/firebase/firestore");
    _resetFirestoreForTests();
    await expect(
      ensureSoloHousehold({ userId: "user_orphan", email: "orphan@example.com", displayName: "Orphan" })
    ).rejects.toThrow("Data integrity error");
  });
});

// ─── ensureSoloHousehold logic ────────────────────────────────────────────────

describe("ensureSoloHousehold", () => {
  beforeEach(() => {
    process.env.FIRESTORE_PROJECT_ID = "test-project";
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.FIRESTORE_PROJECT_ID;
    vi.resetModules();
  });

  it("creates user and household on first sign-in", async () => {
    // Mock the Firestore module so no real network calls happen
    const mockBatch = {
      set: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    };
    const mockDocGet = vi
      .fn()
      .mockResolvedValueOnce({ exists: false }); // user doc does not exist

    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = {
        doc: vi.fn().mockReturnValue({ get: mockDocGet, set: vi.fn() }),
        batch: vi.fn().mockReturnValue(mockBatch),
        collection: vi.fn(),
      };
      return { Firestore: class MockFirestore { constructor() { Object.assign(this, mockInstance); } } };
    });

    const { ensureSoloHousehold, _resetFirestoreForTests } = await import(
      "@/lib/firebase/firestore"
    );
    _resetFirestoreForTests();

    const result = await ensureSoloHousehold({
      userId: "user_new",
      email: "new@example.com",
      displayName: "New User",
    });

    expect(result.created).toBe(true);
    expect(result.user.userId).toBe("user_new");
    expect(result.user.role).toBe("owner");
    expect(result.household.ownerId).toBe("user_new");
    expect(result.household.memberIds).toEqual(["user_new"]);
    expect(result.household.memberIds).toHaveLength(1);
    // tier lives in /households/{id}/stripe/subscription now (issue #1648)
    expect((result.household as Record<string, unknown>).tier).toBeUndefined();
    expect(result.household.name).toBe("New User's Household");
    expect(result.household.inviteCode).toHaveLength(6);

    // Atomic batch commit must have been called
    expect(mockBatch.commit).toHaveBeenCalledOnce();
    // Two set calls (household + user)
    expect(mockBatch.set).toHaveBeenCalledTimes(2);
  });

  it("returns existing user + household on subsequent sign-ins (idempotent)", async () => {
    const existingUser: FirestoreUser = {
      userId: "user_existing",
      email: "existing@example.com",
      displayName: "Existing User",
      householdId: "hh-existing",
      role: "owner",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const existingHousehold: FirestoreHousehold = {
      id: "hh-existing",
      name: "Existing User's Household",
      ownerId: "user_existing",
      memberIds: ["user_existing"],
      inviteCode: "ABCDEF",
      inviteCodeExpiresAt: "2026-04-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const mockBatch = { set: vi.fn(), commit: vi.fn() };
    const mockDocGet = vi
      .fn()
      .mockResolvedValueOnce({ exists: true, data: () => existingUser })
      .mockResolvedValueOnce({ exists: true, data: () => existingHousehold });

    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = {
        doc: vi.fn().mockReturnValue({ get: mockDocGet, set: vi.fn() }),
        batch: vi.fn().mockReturnValue(mockBatch),
        collection: vi.fn(),
      };
      return { Firestore: class MockFirestore { constructor() { Object.assign(this, mockInstance); } } };
    });

    const { ensureSoloHousehold, _resetFirestoreForTests } = await import(
      "@/lib/firebase/firestore"
    );
    _resetFirestoreForTests();

    const result = await ensureSoloHousehold({
      userId: "user_existing",
      email: "existing@example.com",
      displayName: "Existing User",
    });

    expect(result.created).toBe(false);
    expect(result.user).toEqual(existingUser);
    expect(result.household).toEqual(existingHousehold);
    // No batch write on subsequent calls
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });

  it("household name defaults to '{displayName}'s Household'", async () => {
    const mockBatch = {
      set: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    };

    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = {
        doc: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ exists: false }), set: vi.fn() }),
        batch: vi.fn().mockReturnValue(mockBatch),
        collection: vi.fn(),
      };
      return { Firestore: class MockFirestore { constructor() { Object.assign(this, mockInstance); } } };
    });

    const { ensureSoloHousehold, _resetFirestoreForTests } = await import(
      "@/lib/firebase/firestore"
    );
    _resetFirestoreForTests();

    const result = await ensureSoloHousehold({
      userId: "user_alice",
      email: "alice@example.com",
      displayName: "Alice",
    });

    expect(result.household.name).toBe("Alice's Household");
  });

  it("user is always the sole initial member", async () => {
    const mockBatch = {
      set: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    };

    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = {
        doc: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ exists: false }), set: vi.fn() }),
        batch: vi.fn().mockReturnValue(mockBatch),
        collection: vi.fn(),
      };
      return { Firestore: class MockFirestore { constructor() { Object.assign(this, mockInstance); } } };
    });

    const { ensureSoloHousehold, _resetFirestoreForTests } = await import(
      "@/lib/firebase/firestore"
    );
    _resetFirestoreForTests();

    const result = await ensureSoloHousehold({
      userId: "user_solo",
      email: "solo@example.com",
      displayName: "Solo User",
    });

    expect(result.household.memberIds).toEqual(["user_solo"]);
    // Max 3 — starts at 1
    expect(result.household.memberIds.length).toBeLessThanOrEqual(3);
  });

  // ── Issue #1633: householdId = userId (Google sub) ──────────────────────────

  it("household.id equals userId — householdId is Google sub, not random UUID", async () => {
    const mockBatch = {
      set: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    };

    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = {
        doc: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ exists: false }), set: vi.fn() }),
        batch: vi.fn().mockReturnValue(mockBatch),
        collection: vi.fn(),
      };
      return { Firestore: class MockFirestore { constructor() { Object.assign(this, mockInstance); } } };
    });

    const { ensureSoloHousehold, _resetFirestoreForTests } = await import(
      "@/lib/firebase/firestore"
    );
    _resetFirestoreForTests();

    const userId = "google-sub-abc123";
    const result = await ensureSoloHousehold({
      userId,
      email: "user@example.com",
      displayName: "Test User",
    });

    // Core AC: household document ID equals the userId (Google sub)
    expect(result.household.id).toBe(userId);
    expect(result.household.id).toBe(result.user.userId);
  });

  it("user.householdId equals userId — solo household is self-referential", async () => {
    const mockBatch = {
      set: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    };

    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = {
        doc: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ exists: false }), set: vi.fn() }),
        batch: vi.fn().mockReturnValue(mockBatch),
        collection: vi.fn(),
      };
      return { Firestore: class MockFirestore { constructor() { Object.assign(this, mockInstance); } } };
    });

    const { ensureSoloHousehold, _resetFirestoreForTests } = await import(
      "@/lib/firebase/firestore"
    );
    _resetFirestoreForTests();

    const userId = "google-sub-xyz789";
    const result = await ensureSoloHousehold({
      userId,
      email: "another@example.com",
      displayName: "Another User",
    });

    // User's householdId must equal their own userId for solo households
    expect(result.user.householdId).toBe(userId);
    expect(result.user.householdId).toBe(result.household.id);
  });

  it("household has no Stripe fields — they live in stripe subcollection (issue #1648)", async () => {
    const mockBatch = {
      set: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    };

    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = {
        doc: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ exists: false }), set: vi.fn() }),
        batch: vi.fn().mockReturnValue(mockBatch),
        collection: vi.fn(),
      };
      return { Firestore: class MockFirestore { constructor() { Object.assign(this, mockInstance); } } };
    });

    const { ensureSoloHousehold, _resetFirestoreForTests } = await import(
      "@/lib/firebase/firestore"
    );
    _resetFirestoreForTests();

    const result = await ensureSoloHousehold({
      userId: "google-sub-new",
      email: "new@example.com",
      displayName: "New User",
    });

    // Household has no Stripe fields — they live in /households/{id}/stripe/subscription (issue #1648)
    expect((result.household as Record<string, unknown>).tier).toBeUndefined();
    expect((result.household as Record<string, unknown>).stripeCustomerId).toBeUndefined();
    expect((result.household as Record<string, unknown>).stripeSubscriptionId).toBeUndefined();
    expect((result.household as Record<string, unknown>).stripeStatus).toBeUndefined();
  });
});

// ── Issue #1633: FIRESTORE_PATHS has no entitlement path ──────────────────────

describe("FIRESTORE_PATHS — no entitlement path (issue #1633)", () => {
  it("does not have an entitlement() method — /entitlements/ collection removed", () => {
    // After schema v2, there is no separate /entitlements/ collection.
    // The FIRESTORE_PATHS object must not expose an entitlement() helper.
    expect((FIRESTORE_PATHS as Record<string, unknown>).entitlement).toBeUndefined();
  });

  it("has the expected path builders including stripeSubscription (issue #1648) and trial (issue #1634)", () => {
    const keys = Object.keys(FIRESTORE_PATHS).sort();
    expect(keys).toEqual(["card", "cards", "household", "stripeSubscription", "trial", "user"]);
  });

  it("builds stripe subcollection path correctly", () => {
    expect(FIRESTORE_PATHS.stripeSubscription("hh-abc")).toBe(
      "households/hh-abc/stripe/subscription"
    );
  });

  it("builds trial subcollection path correctly (issue #1634)", () => {
    expect(FIRESTORE_PATHS.trial("user-abc")).toBe("households/user-abc/trial");
  });
});
