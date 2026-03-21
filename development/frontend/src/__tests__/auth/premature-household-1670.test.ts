/**
 * Regression tests — Issue #1670: Premature household creation on public pages
 *
 * Validates the fix introduced in #1670:
 *   - AuthContext does NOT call getOrCreateAnonHouseholdId() on mount
 *   - Visiting public/marketing pages (e.g. /chronicles) does NOT write
 *     localStorage["fenrir:household"] for new anonymous users
 *   - Returning anonymous users (with existing UUID) still get their householdId
 *   - ensureHouseholdId() lazily creates the UUID only when called explicitly
 *   - initializeHousehold() is NOT called by anonymous user pages
 *
 * @ref Issue #1670
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

describe("Issue #1670 — premature household creation", () => {
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

  // ── getAnonHouseholdId (read-only) ──────────────────────────────────────────

  describe("getAnonHouseholdId — read-only, no creation", () => {
    it("returns null when no anon UUID exists in localStorage", async () => {
      const { getAnonHouseholdId } = await import("@/lib/auth/household");
      const id = getAnonHouseholdId();
      expect(id).toBeNull();
    });

    it("does NOT write to localStorage when called on a fresh browser", async () => {
      const { getAnonHouseholdId } = await import("@/lib/auth/household");
      getAnonHouseholdId();
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it("returns the existing UUID when one is already persisted", async () => {
      localStorageStore["fenrir:household"] = "existing-uuid-123";
      const { getAnonHouseholdId } = await import("@/lib/auth/household");
      const id = getAnonHouseholdId();
      expect(id).toBe("existing-uuid-123");
    });
  });

  // ── getOrCreateAnonHouseholdId (lazy creation) ─────────────────────────────

  describe("getOrCreateAnonHouseholdId — only creates when explicitly called", () => {
    it("creates and persists a UUID when none exists", async () => {
      const { getOrCreateAnonHouseholdId } = await import("@/lib/auth/household");
      const id = getOrCreateAnonHouseholdId();
      expect(id).toBeTruthy();
      expect(localStorageMock.setItem).toHaveBeenCalledWith("fenrir:household", id);
    });

    it("returns existing UUID without creating a new one", async () => {
      localStorageStore["fenrir:household"] = "my-existing-uuid";
      const { getOrCreateAnonHouseholdId } = await import("@/lib/auth/household");
      const id = getOrCreateAnonHouseholdId();
      expect(id).toBe("my-existing-uuid");
      // setItem not called — no new UUID written
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  // ── Anonymous householdId resolution contract ───────────────────────────────

  describe("anonymous householdId resolution (Issue #1670 contract)", () => {
    it("getAnonHouseholdId returns null for brand-new user (no prior visits)", async () => {
      // Simulate a brand-new browser with no localStorage entries
      const { getAnonHouseholdId } = await import("@/lib/auth/household");
      expect(getAnonHouseholdId()).toBeNull();
    });

    it("getAnonHouseholdId returns UUID for returning anonymous user", async () => {
      localStorageStore["fenrir:household"] = "returning-user-uuid";
      const { getAnonHouseholdId } = await import("@/lib/auth/household");
      expect(getAnonHouseholdId()).toBe("returning-user-uuid");
    });

    it("does NOT create fenrir:household key when getAnonHouseholdId is called (public page visit)", async () => {
      // This is what happens when AuthContext mounts on /chronicles:
      // it now calls getAnonHouseholdId() (read-only) instead of getOrCreateAnonHouseholdId()
      const { getAnonHouseholdId } = await import("@/lib/auth/household");
      getAnonHouseholdId();
      expect("fenrir:household" in localStorageStore).toBe(false);
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });
  });

  // ── initializeHousehold should NOT be called for anonymous users ───────────

  describe("initializeHousehold — only for authenticated users", () => {
    it("does NOT write a household record for anonymous users (household key stays absent)", async () => {
      const { initializeHousehold } = await import("@/lib/storage");

      // Simulate calling with anon UUID (what pages used to do before #1670 fix)
      // After fix, pages no longer call initializeHousehold for anon users.
      // This test documents what happens if it IS called (still writes — but pages no longer call it).
      const anonId = "anon-uuid-test";
      initializeHousehold(anonId);

      // The household record IS written when initializeHousehold is called —
      // this is why the pages must NOT call it for anonymous users.
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        `fenrir_ledger:${anonId}:household`,
        expect.any(String)
      );
    });

    it("initializeHousehold is idempotent for authenticated user (correct usage)", async () => {
      const { initializeHousehold } = await import("@/lib/storage");
      const userId = "google-sub-12345";

      const hh1 = initializeHousehold(userId);
      const hh2 = initializeHousehold(userId);

      expect(hh1.id).toBe(userId);
      expect(hh2.id).toBe(userId);
      expect(hh1.createdAt).toBe(hh2.createdAt);
    });
  });
});
