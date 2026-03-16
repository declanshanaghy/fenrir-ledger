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
      clerkUserId: "user_abc",
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
      clerkUserId: "user_xyz",
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
  it("accepts a valid household with free tier", () => {
    const hh: FirestoreHousehold = {
      id: "hh-uuid",
      name: "The Shanaghys",
      ownerId: "user_abc",
      memberIds: ["user_abc"],
      inviteCode: "X7K2MQ",
      inviteCodeExpiresAt: "2026-04-16T00:00:00.000Z",
      tier: "free",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(hh.tier).toBe("free");
    expect(hh.memberIds).toHaveLength(1);
  });

  it("accepts karl tier", () => {
    const hh: FirestoreHousehold = {
      id: "hh-uuid",
      name: "The Karls",
      ownerId: "user_abc",
      memberIds: ["user_abc", "user_xyz", "user_def"],
      inviteCode: "A3B4C5",
      inviteCodeExpiresAt: "2026-04-16T00:00:00.000Z",
      tier: "karl",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(hh.tier).toBe("karl");
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
      clerkUserId: "user_new",
      email: "new@example.com",
      displayName: "New User",
    });

    expect(result.created).toBe(true);
    expect(result.user.clerkUserId).toBe("user_new");
    expect(result.user.role).toBe("owner");
    expect(result.household.ownerId).toBe("user_new");
    expect(result.household.memberIds).toEqual(["user_new"]);
    expect(result.household.memberIds).toHaveLength(1);
    expect(result.household.tier).toBe("free");
    expect(result.household.name).toBe("New User's Household");
    expect(result.household.inviteCode).toHaveLength(6);

    // Atomic batch commit must have been called
    expect(mockBatch.commit).toHaveBeenCalledOnce();
    // Two set calls (household + user)
    expect(mockBatch.set).toHaveBeenCalledTimes(2);
  });

  it("returns existing user + household on subsequent sign-ins (idempotent)", async () => {
    const existingUser: FirestoreUser = {
      clerkUserId: "user_existing",
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
      tier: "free",
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
      clerkUserId: "user_existing",
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
      clerkUserId: "user_alice",
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
      clerkUserId: "user_solo",
      email: "solo@example.com",
      displayName: "Solo User",
    });

    expect(result.household.memberIds).toEqual(["user_solo"]);
    // Max 3 — starts at 1
    expect(result.household.memberIds.length).toBeLessThanOrEqual(3);
  });
});
