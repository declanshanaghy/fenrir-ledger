/**
 * Odin's Throne Monitor — Route handler tests
 *
 * Issue #933: Migrate auth from custom Hono OAuth to oauth2-proxy sidecar.
 * Validates that:
 *   - Custom auth middleware is removed (no /auth/* routes)
 *   - /healthz is public and returns expected shape
 *   - /api/jobs returns correct structure (auth is sidecar's responsibility)
 *   - Auth enforcement is NOT present in app code (it's in the proxy layer)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the k8s module before importing app — avoids real kubeconfig discovery
vi.mock("../k8s.js", () => ({
  listAgentJobs: vi.fn(),
  deleteAgentJob: vi.fn(),
}));

// Mock ws.ts to avoid side effects (ws server binding)
vi.mock("../ws.js", () => ({
  attachWebSocketServer: vi.fn(),
}));

// Mock @hono/node-server to prevent actual TCP bind
vi.mock("@hono/node-server", () => ({
  serve: vi.fn((_opts: unknown, cb?: (info: { port: number }) => void) => {
    cb?.({ port: 3001 });
    return {};
  }),
}));

import { app } from "../index.js";
import { listAgentJobs } from "../k8s.js";

const mockListAgentJobs = vi.mocked(listAgentJobs);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── /healthz ─────────────────────────────────────────────────────────────────

describe("GET /healthz", () => {
  it("returns 200 with status ok", async () => {
    const res = await app.request("/healthz");
    expect(res.status).toBe(200);
  });

  it("returns service name and timestamp", async () => {
    const res = await app.request("/healthz");
    const body = await res.json() as { status: string; service: string; ts: number };
    expect(body.status).toBe("ok");
    expect(body.service).toBe("odin-throne-monitor");
    expect(typeof body.ts).toBe("number");
  });

  it("does not require any Authorization header", async () => {
    // oauth2-proxy skips /healthz — app must respond without auth
    const res = await app.request("/healthz", {
      headers: {},
    });
    expect(res.status).toBe(200);
  });
});

// ── /api/jobs ─────────────────────────────────────────────────────────────────

describe("GET /api/jobs", () => {
  it("returns jobs array and count on success", async () => {
    const fakeJobs = [
      {
        name: "agent-job-1",
        namespace: "fenrir-agents",
        status: "running" as const,
        startTime: "2026-03-15T00:00:00Z",
        completionTime: null,
        labels: {},
      },
    ];
    mockListAgentJobs.mockResolvedValueOnce(fakeJobs);

    const res = await app.request("/api/jobs");
    expect(res.status).toBe(200);
    const body = await res.json() as { jobs: unknown[]; count: number };
    expect(body.count).toBe(1);
    expect(body.jobs).toHaveLength(1);
  });

  it("returns empty jobs with error message when k8s throws", async () => {
    mockListAgentJobs.mockRejectedValueOnce(new Error("k8s unreachable"));

    const res = await app.request("/api/jobs");
    expect(res.status).toBe(200);
    const body = await res.json() as { jobs: unknown[]; count: number; error: string };
    expect(body.jobs).toEqual([]);
    expect(body.count).toBe(0);
    expect(body.error).toBe("k8s unreachable");
  });

  it("returns empty jobs with generic error for non-Error throws", async () => {
    mockListAgentJobs.mockRejectedValueOnce("string error");

    const res = await app.request("/api/jobs");
    expect(res.status).toBe(200);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Unknown error");
  });
});

// ── Auth route removal (AC: no custom OAuth routes) ──────────────────────────

describe("Auth routes removed (oauth2-proxy handles auth at sidecar level)", () => {
  it("does not expose /auth/login — removed in #933", async () => {
    const res = await app.request("/auth/login");
    expect(res.status).toBe(404);
  });

  it("does not expose /auth/callback — removed in #933", async () => {
    const res = await app.request("/auth/callback");
    expect(res.status).toBe(404);
  });

  it("does not expose /auth/logout — removed in #933", async () => {
    const res = await app.request("/auth/logout");
    expect(res.status).toBe(404);
  });

  it("does not expose /auth/session — removed in #933", async () => {
    const res = await app.request("/auth/session");
    expect(res.status).toBe(404);
  });
});

// ── No session-gate middleware ────────────────────────────────────────────────

describe("Session gate middleware removed", () => {
  it("app does not redirect unauthenticated requests to /auth/login", async () => {
    // Pre-#933: protected routes would 302 to /auth/login without a valid session cookie.
    // Post-#933: app itself has no session gate; oauth2-proxy enforces auth upstream.
    // Calling /api/jobs without session cookie must NOT return 302 → /auth/login.
    mockListAgentJobs.mockResolvedValueOnce([]);
    const res = await app.request("/api/jobs");
    expect(res.status).not.toBe(302);
    const location = res.headers.get("location");
    // null (no redirect) or a string that is not /auth/login — both are acceptable
    if (location !== null) {
      expect(location).not.toContain("/auth/login");
    }
  });

  it("no Set-Cookie header for session tokens on any route", async () => {
    // oauth2-proxy owns cookie management; app should not issue session cookies.
    mockListAgentJobs.mockResolvedValueOnce([]);
    const jobs = await app.request("/api/jobs");
    const health = await app.request("/healthz");
    expect(jobs.headers.get("set-cookie")).toBeNull();
    expect(health.headers.get("set-cookie")).toBeNull();
  });
});

// ── DELETE /api/jobs/:sessionId — Ragnarök cancel endpoint (#1404) ────────────

import { deleteAgentJob } from "../k8s.js";

const mockDeleteAgentJob = vi.mocked(deleteAgentJob);

describe("DELETE /api/jobs/:sessionId", () => {
  it("returns 200 with ok:true on successful deletion", async () => {
    mockDeleteAgentJob.mockResolvedValueOnce(undefined);

    const res = await app.request("/api/jobs/issue-1404-step1-fireman", {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; sessionId: string };
    expect(body.ok).toBe(true);
    expect(body.sessionId).toBe("issue-1404-step1-fireman");
  });

  it("calls deleteAgentJob with the session ID from the URL", async () => {
    mockDeleteAgentJob.mockResolvedValueOnce(undefined);

    await app.request("/api/jobs/issue-42-step2-loki", { method: "DELETE" });

    expect(mockDeleteAgentJob).toHaveBeenCalledOnce();
    expect(mockDeleteAgentJob).toHaveBeenCalledWith(
      "issue-42-step2-loki",
      expect.any(String)
    );
  });

  it("returns 500 with ok:false and error message when k8s throws", async () => {
    mockDeleteAgentJob.mockRejectedValueOnce(new Error("Job not found"));

    const res = await app.request("/api/jobs/issue-1404-step1-fireman", {
      method: "DELETE",
    });
    expect(res.status).toBe(500);
    const body = await res.json() as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Job not found");
  });

  it("returns 500 with 'Unknown error' for non-Error throws", async () => {
    mockDeleteAgentJob.mockRejectedValueOnce("string-error");

    const res = await app.request("/api/jobs/issue-1404-step1-fireman", {
      method: "DELETE",
    });
    expect(res.status).toBe(500);
    const body = await res.json() as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Unknown error");
  });

  it("does not call listAgentJobs — uses deleteAgentJob exclusively", async () => {
    mockDeleteAgentJob.mockResolvedValueOnce(undefined);

    await app.request("/api/jobs/some-session", { method: "DELETE" });

    expect(mockListAgentJobs).not.toHaveBeenCalled();
  });
});
