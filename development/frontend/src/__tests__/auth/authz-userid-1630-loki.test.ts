/**
 * Loki QA — authz userId contract (issue #1630)
 *
 * Validates the semantic invariant introduced by the clerkUserId → userId rename:
 *   - requireAuthz() resolves the Firestore user by `user.sub` (Google OAuth sub)
 *   - The returned `firestoreUser.userId` equals `user.sub`
 *   - ensureSoloHousehold() creates a user doc with `userId` matching its input
 *
 * These tests guard the rename contract at the behavior layer, not the type layer.
 * All external dependencies are mocked — no real GCP / Firestore connection needed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireAuthz } from "@/lib/auth/authz";
import type { NextRequest } from "next/server";
import type { VerifiedUser } from "@/lib/auth/verify-id-token";
import type { FirestoreUser } from "@/lib/firebase/firestore-types";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/firebase/firestore", () => ({
  getUser: vi.fn(),
}));

vi.mock("@/lib/kv/entitlement-store", () => ({
  getStripeEntitlement: vi.fn(),
}));

vi.mock("@/lib/kv/trial-store", () => ({
  getTrial: vi.fn(),
  initTrial: vi.fn(),
  computeTrialStatus: vi.fn(),
}));

vi.mock("@/lib/trial-utils", () => ({
  isValidFingerprint: vi.fn(() => false),
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { requireAuth } from "@/lib/auth/require-auth";
import { getUser } from "@/lib/firebase/firestore";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const GOOGLE_SUB = "google-oauth-sub-1630";

const VERIFIED_USER: VerifiedUser = {
  sub: GOOGLE_SUB,
  email: "user1630@fenrir.dev",
  name: "User 1630",
  picture: "https://example.com/1630.jpg",
};

const FIRESTORE_USER: FirestoreUser = {
  userId: GOOGLE_SUB, // must equal user.sub — this is the rename contract
  email: "user1630@fenrir.dev",
  displayName: "User 1630",
  householdId: "hh-1630",
  role: "owner",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function makeRequest(): NextRequest {
  return {
    headers: { get: (_: string) => null },
    nextUrl: new URL("http://localhost:3000/api/test"),
  } as unknown as NextRequest;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("authz userId contract — issue #1630", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls getUser with user.sub (Google OAuth sub) — not any other identifier", async () => {
    vi.mocked(requireAuth).mockReturnValue(
      Promise.resolve({ ok: true as const, user: VERIFIED_USER }),
    );
    vi.mocked(getUser).mockResolvedValue(FIRESTORE_USER);

    await requireAuthz(makeRequest());

    // The critical post-rename invariant: userId lookup uses the OAuth sub
    expect(getUser).toHaveBeenCalledOnce();
    expect(getUser).toHaveBeenCalledWith(GOOGLE_SUB);
  });

  it("firestoreUser.userId equals user.sub in authorized context", async () => {
    vi.mocked(requireAuth).mockReturnValue(
      Promise.resolve({ ok: true as const, user: VERIFIED_USER }),
    );
    vi.mocked(getUser).mockResolvedValue(FIRESTORE_USER);

    const result = await requireAuthz(makeRequest());

    expect(result.ok).toBe(true);
    if (result.ok) {
      // firestoreUser.userId must equal the Google OAuth sub — the renamed field
      expect(result.firestoreUser.userId).toBe(result.user.sub);
      expect(result.firestoreUser.userId).toBe(GOOGLE_SUB);
    }
  });

  it("does not call getUser when authentication fails", async () => {
    const { NextResponse } = await import("next/server");
    vi.mocked(requireAuth).mockReturnValue(
      Promise.resolve({
        ok: false as const,
        response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
      }),
    );

    const result = await requireAuthz(makeRequest());

    expect(result.ok).toBe(false);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("getUser is not called with clerkUserId (legacy field must be absent)", async () => {
    vi.mocked(requireAuth).mockReturnValue(
      Promise.resolve({ ok: true as const, user: VERIFIED_USER }),
    );
    vi.mocked(getUser).mockResolvedValue(FIRESTORE_USER);

    await requireAuthz(makeRequest());

    // Regression guard: getUser must not receive any argument containing 'clerk'
    const callArg = vi.mocked(getUser).mock.calls[0]?.[0] ?? "";
    expect(callArg).not.toContain("clerk");
    expect(callArg).toBe(GOOGLE_SUB);
  });
});

// ─── ensureSoloHousehold userId field integrity ───────────────────────────────

describe("ensureSoloHousehold userId field — issue #1630", () => {
  beforeEach(() => {
    process.env.FIRESTORE_PROJECT_ID = "test-project-1630";
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.FIRESTORE_PROJECT_ID;
    vi.resetModules();
  });

  it("user doc created with userId matching the input userId (not clerkUserId)", async () => {
    const capturedBatchSets: Array<[unknown, unknown]> = [];
    const mockBatch = {
      set: vi.fn().mockImplementation((ref: unknown, data: unknown) => {
        capturedBatchSets.push([ref, data]);
      }),
      commit: vi.fn().mockResolvedValue(undefined),
    };

    vi.doMock("@google-cloud/firestore", () => {
      const mockInstance = {
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ exists: false }),
          set: vi.fn(),
        }),
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
      userId: "sub-1630-test",
      email: "1630@example.com",
      displayName: "Test User 1630",
    });

    // The returned user doc must have userId = input userId
    expect(result.user.userId).toBe("sub-1630-test");

    // The returned user doc must NOT have a clerkUserId field
    expect((result.user as Record<string, unknown>).clerkUserId).toBeUndefined();

    // created: true because this was first sign-in
    expect(result.created).toBe(true);
  });
});
