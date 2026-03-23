/**
 * /api/sheets/import — API route handler integration tests
 *
 * Tests the import route against mock requests.
 * Validates auth, Karl tier gating, input validation, and pipeline dispatch.
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock requireAuthz
const mockRequireAuthz = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/authz", () => ({
  requireAuthz: (...args: unknown[]) => mockRequireAuthz(...args),
}));

// Mock rate limiter
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, remaining: 4 })),
}));

// Mock import pipelines
const mockImportFromSheet = vi.hoisted(() => vi.fn());
const mockImportFromCsv = vi.hoisted(() => vi.fn());
const mockImportFromFile = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sheets/import-pipeline", () => ({
  importFromSheet: (...args: unknown[]) => mockImportFromSheet(...args),
}));
vi.mock("@/lib/sheets/csv-import-pipeline", () => ({
  importFromCsv: (...args: unknown[]) => mockImportFromCsv(...args),
}));
vi.mock("@/lib/sheets/file-import-pipeline", () => ({
  importFromFile: (...args: unknown[]) => mockImportFromFile(...args),
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:9653/api/sheets/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const MOCK_USER = { sub: "user-123", email: "test@test.com" };

// Import route module after mocks are set up
let POST: typeof import("@/app/api/sheets/import/route").POST;

// ── Setup ────────────────────────────────────────────────────────────────────

const MOCK_FIRESTORE_USER = {
  userId: MOCK_USER.sub,
  email: MOCK_USER.email,
  displayName: "Test User",
  householdId: "hh-test",
  role: "owner" as const,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

beforeAll(async () => {
  // Dynamic import so mocks are in place
  const mod = await import("@/app/api/sheets/import/route");
  POST = mod.POST;
});

beforeEach(() => {
  // Auth + tier pass by default
  mockRequireAuthz.mockResolvedValue({ ok: true, user: MOCK_USER, firestoreUser: MOCK_FIRESTORE_USER });
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("/api/sheets/import — Auth & tier gating", () => {
  it("returns 401 when auth fails", async () => {
    mockRequireAuthz.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json(
        { error: "missing_token", error_description: "Missing auth token" },
        { status: 401 }
      ),
    });

    const res = await POST(makeRequest({ url: "https://docs.google.com/spreadsheets/d/abc" }));
    expect(res.status).toBe(401);
  });

  it("returns 402 when Karl/trial check fails", async () => {
    mockRequireAuthz.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json(
        { error: "subscription_required", required_tier: "karl", current_tier: "thrall", message: "Upgrade to Karl or start a free trial." },
        { status: 402 }
      ),
    });

    const res = await POST(makeRequest({ url: "https://docs.google.com/spreadsheets/d/abc" }));
    expect(res.status).toBe(402);
  });
});

describe("/api/sheets/import — Input validation", () => {
  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost:9653/api/sheets/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("INVALID_URL");
  });

  it("returns 400 when no url, csv, or file is provided", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("INVALID_URL");
    expect(data.error.message).toContain("url");
  });

  it("returns 400 when multiple modes are provided", async () => {
    const res = await POST(
      makeRequest({ url: "https://docs.google.com/spreadsheets/d/abc", csv: "a,b\n1,2" })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.message).toContain("exactly one");
  });

  it("returns 400 for unsupported file format", async () => {
    const res = await POST(
      makeRequest({ file: "base64data", filename: "test.pdf", format: "pdf" })
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("INVALID_CSV");
    expect(data.error.message).toContain("Unsupported");
  });
});

describe("/api/sheets/import — Pipeline dispatch", () => {
  it("calls importFromSheet for URL mode", async () => {
    mockImportFromSheet.mockResolvedValueOnce({
      cards: [{ cardName: "Test Card" }],
    });

    const res = await POST(
      makeRequest({ url: "https://docs.google.com/spreadsheets/d/abc" })
    );
    expect(res.status).toBe(200);
    expect(mockImportFromSheet).toHaveBeenCalledWith(
      "https://docs.google.com/spreadsheets/d/abc"
    );
  });

  it("calls importFromCsv for CSV mode", async () => {
    mockImportFromCsv.mockResolvedValueOnce({
      cards: [{ cardName: "CSV Card" }],
    });

    const res = await POST(makeRequest({ csv: "name,fee\nTest,100" }));
    expect(res.status).toBe(200);
    expect(mockImportFromCsv).toHaveBeenCalledWith("name,fee\nTest,100");
  });

  it("calls importFromFile for file mode", async () => {
    mockImportFromFile.mockResolvedValueOnce({
      cards: [{ cardName: "File Card" }],
    });

    const res = await POST(
      makeRequest({ file: "base64data", filename: "test.xlsx", format: "xlsx" })
    );
    expect(res.status).toBe(200);
    expect(mockImportFromFile).toHaveBeenCalledWith("base64data", "test.xlsx", "xlsx");
  });

  it("returns pipeline error with correct status code", async () => {
    mockImportFromSheet.mockResolvedValueOnce({
      error: { code: "SHEET_NOT_PUBLIC", message: "Sheet is not public" },
    });

    const res = await POST(
      makeRequest({ url: "https://docs.google.com/spreadsheets/d/private" })
    );
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe("SHEET_NOT_PUBLIC");
  });
});
