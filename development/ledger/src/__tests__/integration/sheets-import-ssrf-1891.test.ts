/**
 * /api/sheets/import — SSRF prevention integration tests (issue #1891 / MEDIUM-002)
 *
 * Verifies that the route rejects private IPs, non-HTTPS schemes, and localhost
 * before forwarding to the import pipeline.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRequireAuthz = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/authz", () => ({
  requireAuthz: (...args: unknown[]) => mockRequireAuthz(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => ({ success: true, remaining: 4 })),
}));

const mockImportFromSheet = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sheets/import-pipeline", () => ({
  importFromSheet: (...args: unknown[]) => mockImportFromSheet(...args),
}));
vi.mock("@/lib/sheets/csv-import-pipeline", () => ({
  importFromCsv: vi.fn(),
}));
vi.mock("@/lib/sheets/file-import-pipeline", () => ({
  importFromFile: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(url: string): NextRequest {
  return new NextRequest("http://localhost:9653/api/sheets/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

const MOCK_USER = { sub: "user-1891", email: "test@fenrir.test" };
const MOCK_FIRESTORE_USER = {
  userId: MOCK_USER.sub,
  email: MOCK_USER.email,
  displayName: "Test User",
  householdId: "hh-1891",
  role: "owner" as const,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

let POST: typeof import("@/app/api/sheets/import/route").POST;

beforeEach(async () => {
  mockRequireAuthz.mockResolvedValue({ ok: true, user: MOCK_USER, firestoreUser: MOCK_FIRESTORE_USER });
  const mod = await import("@/app/api/sheets/import/route");
  POST = mod.POST;
});

// ── SSRF rejection tests ──────────────────────────────────────────────────────

describe("/api/sheets/import — SSRF prevention (issue #1891)", () => {
  it("rejects http:// URL with 400 INVALID_URL", async () => {
    const res = await POST(makeRequest("http://docs.google.com/spreadsheets/d/abc"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("INVALID_URL");
  });

  it("rejects file:// URL with 400 INVALID_URL", async () => {
    const res = await POST(makeRequest("file:///etc/passwd"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("INVALID_URL");
  });

  it("rejects localhost with 400 INVALID_URL", async () => {
    const res = await POST(makeRequest("https://localhost/spreadsheets/d/abc"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("INVALID_URL");
  });

  it("rejects 127.0.0.1 (loopback) with 400 INVALID_URL", async () => {
    const res = await POST(makeRequest("https://127.0.0.1/spreadsheets/d/abc"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("INVALID_URL");
  });

  it("rejects 169.254.169.254 (GCP metadata) with 400 INVALID_URL", async () => {
    const res = await POST(makeRequest("https://169.254.169.254/computeMetadata/v1/"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("INVALID_URL");
  });

  it("rejects 10.0.0.1 (RFC-1918) with 400 INVALID_URL", async () => {
    const res = await POST(makeRequest("https://10.0.0.1/internal-api"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("INVALID_URL");
  });

  it("rejects 192.168.1.1 (RFC-1918) with 400 INVALID_URL", async () => {
    const res = await POST(makeRequest("https://192.168.1.1/internal-api"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("INVALID_URL");
  });

  it("rejects 172.16.0.1 (RFC-1918) with 400 INVALID_URL", async () => {
    const res = await POST(makeRequest("https://172.16.0.1/internal"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("INVALID_URL");
  });

  it("does not call importFromSheet for rejected SSRF URLs", async () => {
    await POST(makeRequest("https://169.254.169.254/computeMetadata/v1/"));
    expect(mockImportFromSheet).not.toHaveBeenCalled();
  });
});

// ── Public HTTPS URLs still dispatched to pipeline ────────────────────────────

describe("/api/sheets/import — valid public URL still dispatched", () => {
  it("dispatches a valid Google Sheets HTTPS URL to the pipeline", async () => {
    mockImportFromSheet.mockResolvedValueOnce({ cards: [{ cardName: "Test" }] });

    const res = await POST(makeRequest("https://docs.google.com/spreadsheets/d/abc123"));
    expect(res.status).toBe(200);
    expect(mockImportFromSheet).toHaveBeenCalledWith("https://docs.google.com/spreadsheets/d/abc123");
  });
});
