/**
 * Loki QA tests for Issue #1627 — Trial auto-starts on status query
 *
 * Validates the core acceptance criteria:
 *  1. /api/trial/status is read-only — never creates a trial (no Firestore writes)
 *  2. handleConfirmImport calls /api/trial/init on first card import
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
// Section 1: /api/trial/status read-only contract
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

import { POST as statusPOST } from "@/app/api/trial/status/route";

const VALID_FP = "a".repeat(64);
const missingSnap = { exists: false, data: () => null };

function makeStatusRequest(fp: string = VALID_FP): NextRequest {
  return new NextRequest("http://localhost/api/trial/status", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "1.2.3.4" },
    body: JSON.stringify({ fingerprint: fp }),
  });
}

describe("Issue #1627 — /api/trial/status read-only contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDocRef.get.mockResolvedValue(missingSnap);
    mockDocRef.set.mockResolvedValue(undefined);
    mockDocRef.update.mockResolvedValue(undefined);
    mockCollectionRef.get.mockResolvedValue({ empty: true, docs: [] });
  });

  it("returns status:none for a new fingerprint — does not write to Firestore", async () => {
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

  it("returns status:none for each query when no trial exists", async () => {
    const [r1, r2] = await Promise.all([
      statusPOST(makeStatusRequest()),
      statusPOST(makeStatusRequest()),
    ]);

    expect((await r1.json()).status).toBe("none");
    expect((await r2.json()).status).toBe("none");
    expect(mockDocRef.set).not.toHaveBeenCalled();
  });

  it("returns status:active for an existing trial without writing", async () => {
    const startDate = new Date().toISOString();
    mockDocRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ startDate, expiresAt: {} }),
    });

    const res = await statusPOST(makeStatusRequest());
    const body = await res.json();

    expect(body.status).toBe("active");
    // Still no write — it's purely a read
    expect(mockDocRef.set).not.toHaveBeenCalled();
  });

  it("Firestore error on status query returns none, never 500, never writes", async () => {
    mockDocRef.get.mockRejectedValueOnce(new Error("quota exceeded"));

    const res = await statusPOST(makeStatusRequest());
    const body = await res.json();

    // Must not surface 500 — returns none gracefully
    expect(res.status).toBe(200);
    expect(body.status).toBe("none");
    expect(mockDocRef.set).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Section 2: DashboardPage handleConfirmImport trial init guard
// ══════════════════════════════════════════════════════════════════════════════

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn() }),
}));

vi.mock("@/lib/trial-utils", () => ({
  LS_TRIAL_START_TOAST_SHOWN: "fenrir:trial-start-toast-shown",
  computeFingerprint: vi.fn().mockResolvedValue("a".repeat(64)),
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

// Capture the onConfirmImport prop so we can call it in tests
let capturedOnConfirmImport: ((cards: unknown[]) => void) | null = null;

vi.mock("@/components/sheets/ImportWizard", () => ({
  ImportWizard: (props: { onConfirmImport?: (cards: unknown[]) => void; [key: string]: unknown }) => {
    capturedOnConfirmImport = props.onConfirmImport ?? null;
    return <div data-testid="import-wizard" />;
  },
}));

import DashboardPage from "@/app/ledger/page";

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

describe("Issue #1627 — handleConfirmImport trial init guard", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnConfirmImport = null;
    localStorage.clear();

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

  it("calls /api/trial/init when first card is imported (guard flag not set)", async () => {
    render(<DashboardPage />);

    await waitFor(() => expect(capturedOnConfirmImport).not.toBeNull());

    await act(async () => {
      capturedOnConfirmImport!([FAKE_CARD]);
    });

    // Allow async init to flush
    await waitFor(() => {
      const trialInitCalls = fetchSpy.mock.calls.filter(([url]) =>
        String(url).includes("/api/trial/init"),
      );
      expect(trialInitCalls.length).toBeGreaterThan(0);
    });
  });

  it("does NOT call /api/trial/init when guard flag is already set", async () => {
    // Pre-set the toast guard — trial already started previously
    localStorage.setItem("fenrir:trial-start-toast-shown", "true");

    render(<DashboardPage />);

    await waitFor(() => expect(capturedOnConfirmImport).not.toBeNull());

    await act(async () => {
      capturedOnConfirmImport!([FAKE_CARD]);
    });

    // Give time for any async calls to fire
    await new Promise((r) => setTimeout(r, 100));

    const trialInitCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes("/api/trial/init"),
    );
    expect(trialInitCalls).toHaveLength(0);
  });

  it("sets the guard flag in localStorage on first import", async () => {
    render(<DashboardPage />);

    await waitFor(() => expect(capturedOnConfirmImport).not.toBeNull());

    await act(async () => {
      capturedOnConfirmImport!([FAKE_CARD]);
    });

    expect(localStorage.getItem("fenrir:trial-start-toast-shown")).toBe("true");
  });

  it("does NOT call /api/trial/init when import has zero cards", async () => {
    render(<DashboardPage />);

    await waitFor(() => expect(capturedOnConfirmImport).not.toBeNull());

    await act(async () => {
      capturedOnConfirmImport!([]);
    });

    await new Promise((r) => setTimeout(r, 100));

    const trialInitCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes("/api/trial/init"),
    );
    expect(trialInitCalls).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Section 3: Auth callback page does NOT call /api/trial/init
// ══════════════════════════════════════════════════════════════════════════════

const mockSearchParamsGet = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: mockSearchParamsGet }),
}));

vi.mock("@/lib/auth/session", () => ({
  setSession: vi.fn(),
}));

vi.mock("@/lib/auth/sign-in-url", () => ({
  validateReturnTo: vi.fn((url: string | null) => url ?? "/ledger"),
}));

vi.mock("@/lib/analytics/track", () => ({
  track: vi.fn(),
}));

import AuthCallbackPage from "@/app/ledger/auth/callback/page";

describe("Issue #1627 — AuthCallbackPage does not call /api/trial/init", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();

    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "no_calls_expected" }), { status: 200 }),
    );

    mockSearchParamsGet.mockImplementation((key: string) => {
      if (key === "error") return "access_denied";
      return null;
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    sessionStorage.clear();
  });

  it("does not call /api/trial/init when Google returns an error", async () => {
    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(screen.getByText(/the bifröst trembled/i)).toBeInTheDocument();
    });

    const trialInitCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes("/api/trial/init"),
    );
    expect(trialInitCalls).toHaveLength(0);
  });

  it("does not call /api/trial/init on missing code or state", async () => {
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
});
