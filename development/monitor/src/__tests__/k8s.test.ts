import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @kubernetes/client-node before importing k8s.ts
const mockListNamespacedJob = vi.fn();
const mockListNamespacedPod = vi.fn();

vi.mock("@kubernetes/client-node", () => {
  return {
    KubeConfig: vi.fn().mockImplementation(() => ({
      loadFromCluster: vi.fn(),
      loadFromDefault: vi.fn(),
      makeApiClient: vi.fn().mockImplementation((ApiClass: { name?: string }) => {
        if (ApiClass.name === "BatchV1Api") {
          return { listNamespacedJob: mockListNamespacedJob };
        }
        return { listNamespacedPod: mockListNamespacedPod };
      }),
    })),
    BatchV1Api: class BatchV1Api {},
    CoreV1Api: class CoreV1Api {},
    Log: vi.fn(),
    V1Job: class V1Job {},
    V1Pod: class V1Pod {},
  };
});

// Import after mock is set up
const { listAgentJobs, findPodForSession } = await import("../k8s.js");

describe("listAgentJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns mapped jobs from K8s API", async () => {
    // v1.0.0 API returns resource directly (no .body wrapper)
    mockListNamespacedJob.mockResolvedValue({
      items: [
        {
          metadata: {
            name: "agent-abc123",
            namespace: "fenrir-app",
            labels: { app: "odin-agent", "session-id": "abc123" },
          },
          status: { active: 1 },
        },
      ],
    });

    const jobs = await listAgentJobs("fenrir-app", "app=odin-agent");

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      name: "agent-abc123",
      namespace: "fenrir-app",
      status: "active",
    });
  });

  it("returns empty array when no jobs", async () => {
    mockListNamespacedJob.mockResolvedValue({ items: [] });
    const jobs = await listAgentJobs();
    expect(jobs).toEqual([]);
  });

  it("maps succeeded status correctly", async () => {
    mockListNamespacedJob.mockResolvedValue({
      items: [
        {
          metadata: { name: "job-done", namespace: "fenrir-app", labels: {} },
          status: { succeeded: 1 },
        },
      ],
    });
    const jobs = await listAgentJobs();
    expect(jobs[0].status).toBe("succeeded");
  });

  it("maps failed status correctly", async () => {
    mockListNamespacedJob.mockResolvedValue({
      items: [
        {
          metadata: { name: "job-fail", namespace: "fenrir-app", labels: {} },
          status: { failed: 1 },
        },
      ],
    });
    const jobs = await listAgentJobs();
    expect(jobs[0].status).toBe("failed");
  });
});

describe("findPodForSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns pod name when found", async () => {
    mockListNamespacedPod.mockResolvedValue({
      items: [{ metadata: { name: "pod-xyz" } }],
    });
    const name = await findPodForSession("abc123");
    expect(name).toBe("pod-xyz");
  });

  it("returns null when no pod found", async () => {
    mockListNamespacedPod.mockResolvedValue({ items: [] });
    const name = await findPodForSession("missing");
    expect(name).toBeNull();
  });
});
