/**
 * Loki QA — Issue #1856: Dynamic imports hoisted to beforeAll
 *
 * Validates that module caching works correctly after the refactor:
 * - Modules imported in beforeAll are accessible and stable across all it() blocks
 * - The same module reference is returned on repeated imports (Node module cache)
 * - Destructured functions from beforeAll-imported modules behave identically to
 *   functions from in-test imports (correctness parity)
 *
 * This file DOES NOT read source files or assert on code structure.
 * It validates observable runtime behavior per AC:
 *   ✓ Module cache is hit (not bypassed) for subsequent tests
 *   ✓ All tests continue to pass with hoisted imports
 */

import { describe, it, expect, beforeAll, vi } from "vitest";

// ── Mock localStorage for migration module ───────────────────────────────────

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((k: string) => store[k] ?? null),
  setItem: vi.fn((k: string, v: string) => { store[k] = v; }),
  removeItem: vi.fn((k: string) => { delete store[k]; }),
  clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
};
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

vi.mock("@/lib/storage", () => ({
  getRawAllCards: vi.fn(() => []),
  setAllCards: vi.fn(),
}));

globalThis.fetch = vi.fn() as unknown as typeof fetch;

// ── Module references populated by beforeAll ─────────────────────────────────

let migrationMod: typeof import("@/lib/sync/migration");

beforeAll(async () => {
  migrationMod = await import("@/lib/sync/migration");
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Issue #1856 — beforeAll import caching: migration module", () => {
  it("module reference is defined after beforeAll executes", () => {
    expect(migrationMod).toBeDefined();
  });

  it("hasMigrated is a callable function", () => {
    expect(typeof migrationMod.hasMigrated).toBe("function");
  });

  it("markMigrated is a callable function", () => {
    expect(typeof migrationMod.markMigrated).toBe("function");
  });

  it("runMigration is a callable function", () => {
    expect(typeof migrationMod.runMigration).toBe("function");
  });

  it("MIGRATION_FLAG is exported as a string constant", () => {
    expect(typeof migrationMod.MIGRATION_FLAG).toBe("string");
    expect(migrationMod.MIGRATION_FLAG.length).toBeGreaterThan(0);
  });

  it("module reference is identical across multiple it() blocks (cache hit)", async () => {
    // Importing again should return the same cached module object
    const secondImport = await import("@/lib/sync/migration");
    expect(secondImport).toBe(migrationMod);
  });

  it("destructured function from beforeAll ref returns correct result (hasMigrated=false initially)", () => {
    localStorageMock.clear();
    const { hasMigrated } = migrationMod;
    expect(hasMigrated()).toBe(false);
  });

  it("markMigrated sets flag, hasMigrated returns true — functions work after hoisting", () => {
    localStorageMock.clear();
    const { hasMigrated, markMigrated } = migrationMod;
    expect(hasMigrated()).toBe(false);
    markMigrated();
    expect(hasMigrated()).toBe(true);
  });
});

describe("Issue #1856 — beforeAll import caching: second describe block reuses same ref", () => {
  it("migrationMod is still the same object reference as in first describe block", async () => {
    const ref = await import("@/lib/sync/migration");
    // All three should be the same cached module
    expect(ref).toBe(migrationMod);
  });

  it("MIGRATION_FLAG value is stable across describe blocks", () => {
    expect(migrationMod.MIGRATION_FLAG).toBe("fenrir:migrated");
  });
});
