/**
 * Shared hook and context mock factories for component tests.
 *
 * Usage inside vi.mock() factories — require() is evaluated lazily after hoisting:
 *
 *   vi.mock("@/hooks/useAuth", () => require("../mocks/hook-mocks").authMockAuthenticated);
 *   vi.mock("@/contexts/RagnarokContext", () => require("../mocks/hook-mocks").ragnarokContextMock);
 *
 * For next/navigation, export references (e.g. nextNavigationMock) are available
 * for tests that do not assert on router.push. Tests that capture mockPush should
 * continue to define their navigation mock inline.
 */

import { vi } from "vitest";

// ── useAuth ──────────────────────────────────────────────────────────────────

/** useAuth — authenticated user (householdId: "hh-test") */
export const authMockAuthenticated = {
  useAuth: () => ({
    status: "authenticated" as const,
    householdId: "hh-test",
    data: null as null,
    signOut: vi.fn(),
    ensureHouseholdId: () => "hh-test",
  }),
};

/** useAuth — authenticated user (householdId: "hh-1") — used by dashboard tests */
export const authMockAuthenticatedHh1 = {
  useAuth: () => ({
    status: "authenticated" as const,
    householdId: "hh-1",
    data: null as null,
    signOut: vi.fn(),
    ensureHouseholdId: () => "hh-1",
  }),
};

/** useAuth — anonymous user */
export const authMockAnonymous = {
  useAuth: () => ({
    status: "anonymous" as const,
    householdId: "test-household",
    data: null as null,
    signOut: vi.fn(),
  }),
};

// ── useEntitlement ────────────────────────────────────────────────────────────

/** useEntitlement — Karl (paid) tier */
export const entitlementMockKarl = {
  useEntitlement: () => ({ tier: "karl" as const }),
};

/** useEntitlement — Thrall (free) tier */
export const entitlementMockThrall = {
  useEntitlement: () => ({ tier: "thrall" as const }),
};

// ── useIsKarlOrTrial ──────────────────────────────────────────────────────────

/** useIsKarlOrTrial — paid or trial user */
export const isKarlOrTrialMockTrue = {
  useIsKarlOrTrial: () => true,
};

/** useIsKarlOrTrial — free user */
export const isKarlOrTrialMockFalse = {
  useIsKarlOrTrial: () => false,
};

// ── useTrialStatus ────────────────────────────────────────────────────────────

/** useTrialStatus — no active trial */
export const trialStatusMockNone = {
  clearTrialStatusCache: vi.fn(),
  useTrialStatus: () => ({ status: "none" as const }),
};

// ── useCloudSync ──────────────────────────────────────────────────────────────

/** useCloudSync — idle, no sync in progress */
export const cloudSyncMockIdle = {
  useCloudSync: () => ({
    syncState: "idle" as const,
    lastSyncTime: null as null,
    triggerSync: vi.fn(),
    isSyncing: false,
  }),
};

// ── Contexts ──────────────────────────────────────────────────────────────────

/** @/contexts/RagnarokContext — Ragnarok inactive */
export const ragnarokContextMock = {
  useRagnarok: () => ({ ragnarokActive: false }),
};

/** @/contexts/AuthContext — anonymous session */
export const authContextMockAnon = {
  useAuthContext: () => ({
    status: "anonymous" as const,
    session: null as null,
    householdId: "",
    signOut: vi.fn(),
  }),
};

// ── next/navigation ───────────────────────────────────────────────────────────

/** next/navigation — root "/" pathname */
export const nextNavigationMock = {
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
};

/** next/navigation — "/ledger" pathname */
export const nextNavigationLedgerMock = {
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/ledger",
  useSearchParams: () => new URLSearchParams(),
};

// ── next-themes ───────────────────────────────────────────────────────────────

/** next-themes — dark theme */
export const nextThemesMock = {
  useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
};
