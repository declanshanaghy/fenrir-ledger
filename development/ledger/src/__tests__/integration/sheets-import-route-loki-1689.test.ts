/**
 * /api/sheets/import — Loki QA tests for issue #1689
 *
 * Covers gaps not in the existing sheets-import-route.test.ts:
 * - Rate limiting (429)
 * - Pipeline throws → 500 FETCH_ERROR
 * - Unknown error code → 500 status
 * - Valid xls file format
 * - File mode with missing filename → invalid (no file/filename = no hasFile)
 * - NO_CARDS_FOUND → 404
 * - INVALID_CSV pipeline error → 400
 * - Empty string fields treated as absent
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRequireAuthz = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/authz", () => ({
  requireAuthz: (...args: unknown[]) => mockRequireAuthz(...args),
}));

const mockRateLimit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

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

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:9653/api/sheets/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const MOCK_USER = { sub: "user-loki-1689", email: "loki@fenrir.test" };
const MOCK_FIRESTORE_USER = {
  userId: MOCK_USER.sub,
  email: MOCK_USER.email,
  displayName: "Loki Tester",
  householdId: "hh-loki",
  role: "owner" as const,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

let POST: typeof import("@/app/api/sheets/import/route").POST;

beforeEach(async () => {
  mockRequireAuthz.mockResolvedValue({ ok: true, user: MOCK_USER, firestoreUser: MOCK_FIRESTORE_USER });
  mockRateLimit.mockReturnValue({ success: true, remaining: 4 });

  const mod = await import("@/app/api/sheets/import/route");
  POST = mod.POST;
});

// ── Rate limiting ─────────────────────────────────────────────────────────────

describe("/api/sheets/import — Rate limiting", () => {
  it("returns 429 when rate limit is exceeded", async () => {
    mockRateLimit.mockReturnValueOnce({ success: false, remaining: 0 });

    const res = await POST(makeRequest({ url: "https://docs.google.com/spreadsheets/d/abc" }));
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error.code).toBe("RATE_LIMITED");
    expect(data.error.message).toContain("exceeded");
  });

  it("passes rate limit key scoped to user sub", async () => {
    mockImportFromSheet.mockResolvedValueOnce({ cards: [] });

    await POST(makeRequest({ url: "https://docs.google.com/spreadsheets/d/abc" }));
    expect(mockRateLimit).toHaveBeenCalledWith(
      `sheets:import:${MOCK_USER.sub}`,
      expect.objectContaining({ limit: 5 })
    );
  });
});

// ── Pipeline error codes → HTTP status ───────────────────────────────────────

describe("/api/sheets/import — Error code to HTTP status mapping", () => {
  it("maps NO_CARDS_FOUND → 404", async () => {
    mockImportFromSheet.mockResolvedValueOnce({
      error: { code: "NO_CARDS_FOUND", message: "No cards found" },
    });

    const res = await POST(makeRequest({ url: "https://docs.google.com/spreadsheets/d/abc" }));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error.code).toBe("NO_CARDS_FOUND");
  });

  it("maps INVALID_CSV → 400", async () => {
    mockImportFromCsv.mockResolvedValueOnce({
      error: { code: "INVALID_CSV", message: "Bad CSV" },
    });

    const res = await POST(makeRequest({ csv: "garbage,data" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("INVALID_CSV");
  });

  it("maps unknown error code → 500", async () => {
    mockImportFromSheet.mockResolvedValueOnce({
      error: { code: "FETCH_ERROR", message: "Network failure" },
    });

    const res = await POST(makeRequest({ url: "https://docs.google.com/spreadsheets/d/abc" }));
    expect(res.status).toBe(500);
  });
});

// ── Pipeline exception handling ───────────────────────────────────────────────

describe("/api/sheets/import — Exception handling", () => {
  it("returns 500 FETCH_ERROR when pipeline throws", async () => {
    mockImportFromSheet.mockRejectedValueOnce(new Error("Unexpected upstream failure"));

    const res = await POST(makeRequest({ url: "https://docs.google.com/spreadsheets/d/abc" }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error.code).toBe("FETCH_ERROR");
  });
});

// ── File format validation ────────────────────────────────────────────────────

describe("/api/sheets/import — File format validation", () => {
  it("accepts xls format", async () => {
    mockImportFromFile.mockResolvedValueOnce({ cards: [{ cardName: "XLS Card" }] });

    const res = await POST(makeRequest({ file: "base64data", filename: "test.xls", format: "xls" }));
    expect(res.status).toBe(200);
    expect(mockImportFromFile).toHaveBeenCalledWith("base64data", "test.xls", "xls");
  });

  it("rejects missing filename even when file is present", async () => {
    // file provided but no filename → hasFile is false → falls to modeCount 1 with only file being truthy
    // Actually file provided but filename empty → isNonEmptyString(body.filename) false → hasFile false
    // With only file (no url, no csv, no valid hasFile) → modeCount 0 → 400 INVALID_URL
    const res = await POST(makeRequest({ file: "base64data", filename: "", format: "xlsx" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("INVALID_URL");
  });

  it("rejects csv format as unsupported file format", async () => {
    const res = await POST(makeRequest({ file: "base64data", filename: "test.csv", format: "csv" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("INVALID_CSV");
    expect(data.error.message).toContain("Unsupported");
  });
});

// ── Empty string field handling ───────────────────────────────────────────────

describe("/api/sheets/import — Empty string field handling", () => {
  it("treats empty url string as absent", async () => {
    // empty url + empty csv + empty file → modeCount 0 → 400
    const res = await POST(makeRequest({ url: "" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("INVALID_URL");
  });

  it("treats empty csv string as absent", async () => {
    const res = await POST(makeRequest({ csv: "" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("INVALID_URL");
  });
});
