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

import { listAgentJobs } from "../k8s.js";
import { app } from "../index.js";

const mockListAgentJobs = vi.mocked(listAgentJobs);

describe("GET /healthz", () => {
  it("returns 200 with status ok", async () => {
    const req = new Request("http://localhost:3001/healthz");
    const res = await app.fetch(req);

    expect(res.status).toBe(200);
    const body = await res.json() as { status: string; service: string };
    expect(body.status).toBe("ok");
    expect(body.service).toBe("odin-throne-monitor");
  });
});

describe("GET /api/jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    const req = new Request("http://localhost:3001/api/jobs");
    const res = await app.fetch(req);

    expect(res.status).toBe(200);
    const body = await res.json() as { jobs: unknown[]; count: number };
    expect(body.count).toBe(1);
    expect(body.jobs).toHaveLength(1);
  });

  it("returns empty jobs with error message on K8s failure", async () => {
    mockListAgentJobs.mockRejectedValue(new Error("No cluster available"));

    const req = new Request("http://localhost:3001/api/jobs");
    const res = await app.fetch(req);

    expect(res.status).toBe(200);
    const body = await res.json() as { jobs: unknown[]; count: number; error: string };
    expect(body.jobs).toEqual([]);
    expect(body.count).toBe(0);
    expect(body.error).toContain("No cluster");
  });

  it("returns empty array on cluster unavailable", async () => {
    mockListAgentJobs.mockResolvedValue([]);

    const req = new Request("http://localhost:3001/api/jobs");
    const res = await app.fetch(req);

    const body = await res.json() as { jobs: unknown[]; count: number };
    expect(body.jobs).toEqual([]);
    expect(body.count).toBe(0);
  });
});

describe("GET /", () => {
  it("returns HTML page", async () => {
    const req = new Request("http://localhost:3001/");
    const res = await app.fetch(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const text = await res.text();
    expect(text).toContain("Odin");
  });
});
