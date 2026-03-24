/**
 * Shared storage and library mock factories for component tests.
 *
 * Usage inside vi.mock() factories:
 *
 *   vi.mock("@/lib/storage", () => require("../mocks/storage-mocks").storageMockBasic);
 *   vi.mock("@/lib/analytics/track", () => require("../mocks/storage-mocks").analyticsMock);
 *   vi.mock("sonner", () => require("../mocks/storage-mocks").sonnerMock);
 */

import { vi } from "vitest";

// ── @/lib/storage ─────────────────────────────────────────────────────────────

/** @/lib/storage — CRUD operations (CardForm tests) */
export const storageMockBasic = {
  saveCard: vi.fn().mockResolvedValue(undefined),
  deleteCard: vi.fn().mockResolvedValue(undefined),
  closeCard: vi.fn().mockResolvedValue(undefined),
  getCards: vi.fn().mockResolvedValue([]),
};

/** @/lib/storage — trash/restore operations (Dashboard tests) */
export const storageMockTrash = {
  restoreCard: vi.fn(),
  expungeCard: vi.fn(),
  expungeAllCards: vi.fn(),
};

// ── @/lib/analytics/track ─────────────────────────────────────────────────────

/** @/lib/analytics/track — no-op tracker */
export const analyticsMock = {
  track: vi.fn(),
};

// ── @/lib/auth ────────────────────────────────────────────────────────────────

/** @/lib/auth/refresh-session */
export const refreshSessionMock = {
  ensureFreshToken: vi.fn().mockResolvedValue(undefined),
};

/** @/lib/auth/sign-in-url */
export const signInUrlMock = {
  buildSignInUrl: (returnTo: string) => `/ledger/sign-in?returnTo=${returnTo}`,
};

// ── @/lib/milestone-utils ─────────────────────────────────────────────────────

/** @/lib/milestone-utils */
export const milestoneMock = {
  checkMilestone: vi.fn().mockResolvedValue(undefined),
};

// ── @/lib/issuer-utils ────────────────────────────────────────────────────────

/** @/lib/issuer-utils */
export const issuerUtilsMock = {
  getIssuerRune: vi.fn().mockReturnValue("ᚠ"),
  getIssuerMeta: vi.fn().mockReturnValue(null),
  getIssuerName: vi.fn().mockImplementation((id: string) => id),
  getIssuerInitials: vi.fn().mockReturnValue("CK"),
  getIssuerBadgeChar: vi.fn().mockReturnValue("ᚠ"),
  getIssuerLogoPath: vi.fn().mockReturnValue(null),
};

// ── @/lib/entitlement ─────────────────────────────────────────────────────────

/** @/lib/entitlement/card-limit — allows adding cards */
export const cardLimitMockAllowed = {
  canAddCard: vi.fn().mockReturnValue({ allowed: true }),
};

/** @/lib/entitlement/cache — empty cache */
export const entitlementCacheMock = {
  getEntitlementCache: () => null,
  clearEntitlementCache: vi.fn(),
};

// ── @/lib/trial-utils ─────────────────────────────────────────────────────────

/** @/lib/trial-utils — card limit constant (Dashboard) */
export const trialUtilsMockLimit = {
  THRALL_CARD_LIMIT: 5,
};

/** @/lib/trial-utils — LS toast key (CardForm) */
export const trialUtilsMockToastKey = {
  LS_TRIAL_START_TOAST_SHOWN: "fenrir:trial-start-toast-shown",
};

// ── sonner ────────────────────────────────────────────────────────────────────

/** sonner — toast with error/success methods */
export const sonnerMock = {
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  }),
};

/** sonner — Toaster component stub */
export const sonnerToasterMock = {
  Toaster: () => null,
};
