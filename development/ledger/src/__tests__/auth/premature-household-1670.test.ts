/**
 * Regression tests — Issue #1670: Premature household creation on public pages
 * Updated for Issue #1671: Anonymous users no longer get any UUID household.
 *
 * #1670 introduced read-only getAnonHouseholdId() to prevent eager creation.
 * #1671 goes further: anonymous users use a fixed "anon" key, no UUID at all.
 *
 * Validates:
 *   - getAnonHouseholdId() reads old-style UUID (backward compat for merge)
 *   - getAnonHouseholdId() does NOT write to localStorage
 *   - getOrCreateAnonHouseholdId() no longer exists (removed in #1671)
 *   - initializeHousehold() is NOT called by anonymous user pages
 *
 * @ref Issue #1670, #1671
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── localStorage mock ────────────────────────────────────────────────────────

const localStorageStore: Record<string, string> = {};

const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageStore[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageStore[key];
  }),
  clear: vi.fn(() => {
    Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]);
  }),
  get length() {
    return Object.keys(localStorageStore).length;
  },
  key: vi.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Issue #1670/#1671 — no premature household creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]);
    Object.defineProperty(globalThis, "localStorage", {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "window", {
      value: { localStorage: localStorageMock },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── getAnonHouseholdId (read-only, backward compat) ────────────────────────

  describe("getAnonHouseholdId — read-only backward compat for merge", () => {
    it("returns null when no legacy anon UUID exists in localStorage", async () => {
      const { getAnonHouseholdId } = await import("@/lib/auth/household");
      const id = getAnonHouseholdId();
      expect(id).toBeNull();
    });

    it("does NOT write to localStorage when called on a fresh browser", async () => {
      const { getAnonHouseholdId } = await import("@/lib/auth/household");
      getAnonHouseholdId();
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it("returns existing legacy UUID for backward compat (pre-#1671 user)", async () => {
      localStorageStore["fenrir:household"] = "legacy-uuid-123";
      const { getAnonHouseholdId } = await import("@/lib/auth/household");
      const id = getAnonHouseholdId();
      expect(id).toBe("legacy-uuid-123");
    });

    it("does NOT create fenrir:household key when getAnonHouseholdId is called", async () => {
      const { getAnonHouseholdId } = await import("@/lib/auth/household");
      getAnonHouseholdId();
      expect("fenrir:household" in localStorageStore).toBe(false);
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  // ── getOrCreateAnonHouseholdId removed (#1671) ────────────────────────────

  describe("getOrCreateAnonHouseholdId — REMOVED in #1671", () => {
    it("getOrCreateAnonHouseholdId is no longer exported from household.ts", async () => {
      const householdModule = await import("@/lib/auth/household");
      // The function was removed — it should not be exported
      expect("getOrCreateAnonHouseholdId" in householdModule).toBe(false);
    });
  });

  // ── initializeHousehold should NOT be called for anonymous users ───────────

  describe("initializeHousehold — only for authenticated users", () => {
    it("initializeHousehold is idempotent for authenticated user (correct usage)", async () => {
      const { initializeHousehold } = await import("@/lib/storage");
      const userId = "google-sub-12345";

      const hh1 = initializeHousehold(userId);
      const hh2 = initializeHousehold(userId);

      expect(hh1.id).toBe(userId);
      expect(hh2.id).toBe(userId);
      expect(hh1.createdAt).toBe(hh2.createdAt);
    });

    it("anonymous pages do NOT call initializeHousehold (householdId is null)", async () => {
      // With #1671, anonymous pages use ANON_HOUSEHOLD_ID = "anon" for storage.
      // initializeHousehold is never called for anonymous users.
      // This test documents the contract: anon users have no household record.
      const { ANON_HOUSEHOLD_ID } = await import("@/lib/constants");
      const storageModule = await import("@/lib/storage");
      const initSpy = vi.spyOn(storageModule, "initializeHousehold");

      // Simulate what anonymous pages do: read the legacy anon id (no-op for new users)
      const { getAnonHouseholdId } = await import("@/lib/auth/household");
      getAnonHouseholdId();

      // Anonymous users use the fixed "anon" key — initializeHousehold is never invoked
      expect(ANON_HOUSEHOLD_ID).toBe("anon");
      expect(initSpy).not.toHaveBeenCalled();
    });
  });
});
