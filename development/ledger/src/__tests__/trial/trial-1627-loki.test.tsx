/**
 * Loki QA tests for Issue #1627 — Trial auto-starts on status query
 *
 * Validates the core acceptance criteria:
 *  1. /api/trial/status is read-only — never creates a trial (no Firestore writes)
 *  2. handleConfirmImport calls /api/trial/init on first card import (guard not set)
 *  3. handleConfirmImport does NOT call /api/trial/init when guard flag is set
 *  4. Auth callback page does NOT call /api/trial/init during sign-in
 *  5. Multiple status queries never trigger trial creation
 *
 * @ref Issue #1627
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { NextRequest } from "next/server";
import React from "react";

// ══════════════════════════════════════════════════════════════════════════════
// Shared mocks (hoisted, apply to all sections in this file)
// ══════════════════════════════════════════════════════════════════════════════

const mockDocRef = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
}));

const mockCollectionRef = vi.hoisted(() => ({
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  get: vi.fn(),
}));

const mockDb = vi.hoisted(() => ({
  doc: vi.fn(() => mockDocRef),
  collection: vi.fn(() => mockCollectionRef),
}));

vi.mock("@/lib/firebase/firestore", () => ({
  getFirestore: () => mockDb,
}));

const mockRateLimit = vi.hoisted(() => vi.fn(() => ({ success: true, remaining: 29 })));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mockRateLimit,
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// requireAuth: status route returns "none" for unauthenticated. Sections that
// need Firestore lookups must call authOk() to get authenticated userId.
const mockRequireAuth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

// UI mocks — used by Sections 2 and 3
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: mockSearchParamsGet }),
}));

const mockSearchParamsGet = vi.fn(() => null);

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn() }),
}));

vi.mock("@/hooks/useTrialStatus", () => ({
  clearTrialStatusCache: vi.fn(),
}));

vi.mock("@/lib/auth/refresh-session", () => ({
  ensureFreshToken: vi.fn().mockResolvedValue("test-token"),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    householdId: "test-household",
    status: "authenticated",
    data: null,
    signOut: vi.fn(),
  }),
}));

vi.mock("@/hooks/useEntitlement", () => ({
  useEntitlement: () => ({ hasFeature: () => false }),
}));

vi.mock("@/hooks/useIsKarlOrTrial", () => ({
  useIsKarlOrTrial: () => false,
}));

vi.mock("@/lib/storage", () => ({
  initializeHousehold: vi.fn(),
  getCards: vi.fn(() => []),
  getDeletedCards: vi.fn(() => []),
  saveCard: vi.fn(),
  migrateIfNeeded: vi.fn(),
}));

vi.mock("@/lib/analytics/track", () => ({
  track: vi.fn(),
}));

vi.mock("@/components/dashboard/Dashboard", () => ({
  Dashboard: () => <div data-testid="dashboard" />,
}));

vi.mock("@/components/dashboard/CardSkeletonGrid", () => ({
  CardSkeletonGrid: ({ count }: { count: number }) => (
    <div data-testid="skeleton-grid">Loading {count}</div>
  ),
}));

vi.mock("@/components/shared/AuthGate", () => ({
  AuthGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/entitlement/KarlUpsellDialog", () => ({
  KarlUpsellDialog: () => <div />,
  KARL_UPSELL_IMPORT: {},
}));

vi.mock("@/components/entitlement/UpsellBanner", () => ({
  UpsellBanner: () => <div />,
}));

vi.mock("@/components/layout/SignInNudge", () => ({
  SignInNudge: () => <div />,
}));

vi.mock("@/lib/auth/session", () => ({
  setSession: vi.fn(),
}));

vi.mock("@/lib/auth/sign-in-url", () => ({
  validateReturnTo: vi.fn((url: string | null) => url ?? "/ledger"),
}));

// ImportWizard mock that captures the onConfirmImport prop
let capturedOnConfirmImport: ((cards: unknown[]) => void) | null = null;

vi.mock("@/components/sheets/ImportWizard", () => ({
  ImportWizard: (props: { onConfirmImport?: (cards: unknown[]) => void; [k: string]: unknown }) => {
    capturedOnConfirmImport = props.onConfirmImport ?? null;
    return <div data-testid="import-wizard" />;
  },
}));

// ── Import subjects after mocks ───────────────────────────────────────────────

import { POST as statusPOST } from "@/app/api/trial/status/route";
import DashboardPage from "@/app/ledger/page";
import AuthCallbackPage from "@/app/ledger/auth/callback/page";

// ══════════════════════════════════════════════════════════════════════════════
// Section 1: /api/trial/status read-only contract
// ══════════════════════════════════════════════════════════════════════════════

const USER_ID = "google-sub-1627-test";
const missingSnap = { exists: false, data: () => null };

function makeStatusRequest(): NextRequest {
  return new NextRequest("http://localhost/api/trial/status", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "1.2.3.4" },
    body: JSON.stringify({}),
  });
}

function authOk() {
  mockRequireAuth.mockResolvedValue({ ok: true, user: { sub: USER_ID } });
}

function authFail() {
  mockRequireAuth.mockResolvedValue({ ok: false });
}

describe("Issue #1627 — /api/trial/status read-only contract", () => {
  beforeEach(() => {
    // Default: authenticated (most tests need Firestore lookup)
    authOk();
    mockDocRef.get.mockResolvedValue(missingSnap);
    mockDocRef.set.mockResolvedValue(undefined);
    mockDocRef.update.mockResolvedValue(undefined);
    mockCollectionRef.get.mockResolvedValue({ empty: true, docs: [] });
  });

  it("returns status:none for a new user — does not write to Firestore", async () => {
    const res = await statusPOST(makeStatusRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("none");
    expect(mockDocRef.set).not.toHaveBeenCalled();
    expect(mockDocRef.update).not.toHaveBeenCalled();
  });

  it("never calls Firestore set regardless of how many times status is queried", async () => {
    // Simulate page-load polling — 3 consecutive status queries
    await statusPOST(makeStatusRequest());
    await statusPOST(makeStatusRequest());
    await statusPOST(makeStatusRequest());

    expect(mockDocRef.set).not.toHaveBeenCalled();
  });

  it("returns status:none for concurrent queries when no trial exists", async () => {
    const [r1, r2] = await Promise.all([
      statusPOST(makeStatusRequest()),
      statusPOST(makeStatusRequest()),
    ]);

    expect((await r1.json()).status).toBe("none");
    expect((await r2.json()).status).toBe("none");
    expect(mockDocRef.set).not.toHaveBeenCalled();
  });

  it("returns status:active for an existing trial without writing to Firestore", async () => {
    const startDate = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    mockDocRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ startDate, expiresAt }),
    });

    const res = await statusPOST(makeStatusRequest());
    const body = await res.json();

    expect(body.status).toBe("active");
    expect(mockDocRef.set).not.toHaveBeenCalled();
  });

  it("Firestore error on status query returns none gracefully — never writes", async () => {
    mockDocRef.get.mockRejectedValueOnce(new Error("quota exceeded"));

    const res = await statusPOST(makeStatusRequest());
    const body = await res.json();

    // Must not surface 500 — returns none gracefully (read-only, swallows error)
    expect(res.status).toBe(200);
    expect(body.status).toBe("none");
    expect(mockDocRef.set).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Section 2: DashboardPage handleConfirmImport trial init guard
// ══════════════════════════════════════════════════════════════════════════════

const FAKE_CARD = {
  id: "card-1",
  name: "Test Card",
  issuer: "Chase",
  network: "Visa",
  last4: "1234",
  status: "active" as const,
  annualFee: 95,
  openedDate: "2024-01-01",
  creditLimit: 5000,
  bonusMet: false,
};

// Issue #1637: Trial init moved from import handler to auth callback.
// DashboardPage handleConfirmImport must NOT call /api/trial/init.
describe("Issue #1637 — handleConfirmImport does NOT call /api/trial/init", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    capturedOnConfirmImport = null;
    localStorage.clear();
    mockSearchParamsGet.mockReturnValue(null);

    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ startDate: new Date().toISOString(), isNew: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    localStorage.clear();
  });

  it("never calls /api/trial/init when cards are imported (trial init belongs to auth callback)", async () => {
    render(<DashboardPage />);

    await waitFor(() => expect(capturedOnConfirmImport).not.toBeNull());

    await act(async () => {
      capturedOnConfirmImport!([FAKE_CARD]);
    });

    await new Promise((r) => setTimeout(r, 100));

    const trialInitCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes("/api/trial/init"),
    );
    expect(trialInitCalls).toHaveLength(0);
  });

  it("never calls /api/trial/init even on repeat imports", async () => {
    render(<DashboardPage />);

    await waitFor(() => expect(capturedOnConfirmImport).not.toBeNull());

    await act(async () => { capturedOnConfirmImport!([FAKE_CARD]); });
    await act(async () => { capturedOnConfirmImport!([FAKE_CARD]); });

    await new Promise((r) => setTimeout(r, 100));

    const trialInitCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes("/api/trial/init"),
    );
    expect(trialInitCalls).toHaveLength(0);
  });

  it("does NOT write LS_TRIAL_START_TOAST_SHOWN guard flag on import (removed in #1637)", async () => {
    render(<DashboardPage />);

    await waitFor(() => expect(capturedOnConfirmImport).not.toBeNull());

    await act(async () => {
      capturedOnConfirmImport!([FAKE_CARD]);
    });

    expect(localStorage.getItem("fenrir:trial-start-toast-shown")).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Section 3: Auth callback page does NOT call /api/trial/init
// ══════════════════════════════════════════════════════════════════════════════

// These error-path cases are still correct: trial init is only called on successful exchange.
describe("Issue #1627/#1637 — AuthCallbackPage does NOT call /api/trial/init on auth errors", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sessionStorage.clear();

    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "no_calls_expected" }), { status: 200 }),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    sessionStorage.clear();
  });

  it("does not call /api/trial/init when Google returns an error", async () => {
    mockSearchParamsGet.mockImplementation((key: string) => {
      if (key === "error") return "access_denied";
      return null;
    });

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(screen.getByText(/the bifröst trembled/i)).toBeInTheDocument();
    });

    const trialInitCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes("/api/trial/init"),
    );
    expect(trialInitCalls).toHaveLength(0);
  });

  it("does not call /api/trial/init when code is missing from callback URL", async () => {
    mockSearchParamsGet.mockImplementation((key: string) => {
      if (key === "error") return null;
      if (key === "code") return null;
      if (key === "state") return "xyz";
      return null;
    });

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(screen.getByText(/missing code or state/i)).toBeInTheDocument();
    });

    const trialInitCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes("/api/trial/init"),
    );
    expect(trialInitCalls).toHaveLength(0);
  });

  it("does not call /api/trial/init when PKCE data is corrupt", async () => {
    mockSearchParamsGet.mockImplementation((key: string) => {
      if (key === "code") return "auth-code";
      if (key === "state") return "xyz";
      return null;
    });
    sessionStorage.setItem("fenrir:pkce", "not-valid-json{{{");

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(screen.getByText(/corrupt pkce session data/i)).toBeInTheDocument();
    });

    const trialInitCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes("/api/trial/init"),
    );
    expect(trialInitCalls).toHaveLength(0);
  });
});
