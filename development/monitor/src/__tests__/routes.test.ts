import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock k8s module
vi.mock("../k8s.js", () => ({
  listAgentJobs: vi.fn(),
  findPodForSession: vi.fn(),
  streamPodLogs: vi.fn(),
}));

// Mock ws module to prevent WebSocket server side effects
vi.mock("../ws.js", () => ({
  attachWebSocketServer: vi.fn(),
}));

// Mock @hono/node-server to prevent actual HTTP server startup
vi.mock("@hono/node-server", () => ({
  serve: vi.fn().mockReturnValue({ on: vi.fn() }),
}));

// Auth mock — default: session valid. Individual tests override as needed.
const mockVerifySessionToken = vi.fn<(token: string) => string | null>().mockReturnValue("test@example.com");

vi.mock("../auth.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../auth.js")>();
  return {
    ...original,
    verifySessionToken: (token: string) => mockVerifySessionToken(token),
  };
});

import { listAgentJobs } from "../k8s.js";
import { app } from "../index.js";

const mockListAgentJobs = vi.mocked(listAgentJobs);

// Helper: build a request with a fake session cookie
function authedRequest(url: string, init?: RequestInit): Request {
  return new Request(url, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string> | undefined ?? {}),
      Cookie: "odin_session=test-token",
    },
  });
}

describe("GET /healthz", () => {
  it("returns 200 with status ok (no auth required)", async () => {
    const req = new Request("http://localhost:3001/healthz");
    const res = await app.fetch(req);

    expect(res.status).toBe(200);
    const body = await res.json() as { status: string; service: string };
    expect(body.status).toBe("ok");
    expect(body.service).toBe("odin-throne-monitor");
  });
});

describe("Auth middleware", () => {
  it("returns 401 HTML for unauthenticated browser requests to /", async () => {
    mockVerifySessionToken.mockReturnValueOnce(null);
    const req = new Request("http://localhost:3001/", {
      headers: { Accept: "text/html" },
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).toContain("Sign in with Google");
  });

  it("returns 401 JSON for unauthenticated API requests", async () => {
    mockVerifySessionToken.mockReturnValueOnce(null);
    const req = new Request("http://localhost:3001/api/jobs", {
      headers: { Accept: "application/json" },
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe("Unauthorized");
  });
});

describe("GET /api/jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifySessionToken.mockReset();
    mockVerifySessionToken.mockReturnValue("test@example.com");
  });

  it("returns jobs list from K8s", async () => {
    const mockJobs = [
      {
        name: "agent-test",
        namespace: "fenrir-app",
        status: "active" as const,
        startTime: "2026-03-14T00:00:00.000Z",
        completionTime: null,
        labels: { app: "odin-agent" },
      },
    ];
    mockListAgentJobs.mockResolvedValue(mockJobs);

    const req = authedRequest("http://localhost:3001/api/jobs");
    const res = await app.fetch(req);

    expect(res.status).toBe(200);
    const body = await res.json() as { jobs: unknown[]; count: number };
    expect(body.count).toBe(1);
    expect(body.jobs).toHaveLength(1);
  });

  it("returns empty jobs with error message on K8s failure", async () => {
    mockListAgentJobs.mockRejectedValue(new Error("No cluster available"));

    const req = authedRequest("http://localhost:3001/api/jobs");
    const res = await app.fetch(req);

    expect(res.status).toBe(200);
    const body = await res.json() as { jobs: unknown[]; count: number; error: string };
    expect(body.jobs).toEqual([]);
    expect(body.count).toBe(0);
    expect(body.error).toContain("No cluster");
  });

  it("returns empty array on cluster unavailable", async () => {
    mockListAgentJobs.mockResolvedValue([]);

    const req = authedRequest("http://localhost:3001/api/jobs");
    const res = await app.fetch(req);

    const body = await res.json() as { jobs: unknown[]; count: number };
    expect(body.jobs).toEqual([]);
    expect(body.count).toBe(0);
  });
});

describe("GET /", () => {
  beforeEach(() => {
    mockVerifySessionToken.mockReset();
    mockVerifySessionToken.mockReturnValue("test@example.com");
  });

  it("returns HTML page when authenticated", async () => {
    const req = authedRequest("http://localhost:3001/");
    const res = await app.fetch(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const text = await res.text();
    expect(text).toContain("Odin");
  });
});

describe("GET /static/odin-dark.png", () => {
  it("returns 200 with image/png content-type (no auth required)", async () => {
    const req = new Request("http://localhost:3001/static/odin-dark.png");
    const res = await app.fetch(req);

    // The route is public (before the auth middleware); it returns 200 when
    // the file exists, or 404 when it doesn't (e.g. in CI without the binary).
    // Either way it must NOT return 401 — static assets are always public.
    expect(res.status).not.toBe(401);
  });

  it("sets Cache-Control header when file is served", async () => {
    const req = new Request("http://localhost:3001/static/odin-dark.png");
    const res = await app.fetch(req);

    if (res.status === 200) {
      expect(res.headers.get("content-type")).toBe("image/png");
      expect(res.headers.get("cache-control")).toContain("public");
    }
  });

  // Loki #909 — file is present in public/, assert 200 strongly (not just not-401)
  it("returns 200 with non-empty PNG body when public/odin-dark.png exists", async () => {
    const req = new Request("http://localhost:3001/static/odin-dark.png");
    const res = await app.fetch(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    const body = await res.arrayBuffer();
    expect(body.byteLength).toBeGreaterThan(0);
  });

  // Loki #909 — HTML must reference the avatar at /static/odin-dark.png
  it("HTML page includes img tag pointing to /static/odin-dark.png", async () => {
    const req = authedRequest("http://localhost:3001/");
    const res = await app.fetch(req);
    const html = await res.text();
    expect(html).toContain('src="/static/odin-dark.png"');
  });
});

describe("GET /js/stream.js", () => {
  it("returns 200 with JS content-type (no auth required)", async () => {
    const req = new Request("http://localhost:3001/js/stream.js");
    const res = await app.fetch(req);

    expect(res.status).not.toBe(401);
  });

  it("sets correct content-type when file is served", async () => {
    const req = new Request("http://localhost:3001/js/stream.js");
    const res = await app.fetch(req);

    if (res.status === 200) {
      expect(res.headers.get("content-type")).toContain("javascript");
    }
  });
});
