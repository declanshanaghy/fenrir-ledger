import { describe, it, expect, vi, beforeEach } from "vitest";
import { Writable } from "node:stream";

// ── Mock @kubernetes/client-node ─────────────────────────────────────────────

const mockListNamespacedJob = vi.fn();
const mockListNamespacedPod = vi.fn();
let capturedWritable: Writable | null = null;
let capturedLogOptions: Record<string, unknown> = {};
const mockAbortController = { abort: vi.fn() };
const mockLogFn = vi.fn();

vi.mock("@kubernetes/client-node", () => {
  return {
    KubeConfig: vi.fn().mockImplementation(() => ({
      loadFromCluster: vi.fn(),
      loadFromDefault: vi.fn(),
      makeApiClient: vi.fn().mockImplementation((ApiClass: { name?: string }) => {
        if (ApiClass?.name === "BatchV1Api") {
          return { listNamespacedJob: mockListNamespacedJob };
        }
        return { listNamespacedPod: mockListNamespacedPod };
      }),
    })),
    BatchV1Api: class BatchV1Api {},
    CoreV1Api: class CoreV1Api {},
    Log: vi.fn().mockImplementation(() => ({
      log: mockLogFn,
    })),
    V1Job: class V1Job {},
    V1Pod: class V1Pod {},
  };
});

// ── Import after mock ────────────────────────────────────────────────────────

const { streamPodLogs } = await import("../k8s.js");

// ── Helpers ──────────────────────────────────────────────────────────────────

function setupLogMock(
  lines: string[] = [],
  endWithFinal = true
): void {
  mockLogFn.mockImplementation(
    async (
      _namespace: string,
      _pod: string,
      _container: string,
      writable: Writable,
      opts: Record<string, unknown>
    ) => {
      capturedWritable = writable;
      capturedLogOptions = opts;

      // Simulate writing lines asynchronously
      setImmediate(() => {
        for (const line of lines) {
          writable.write(Buffer.from(line + "\n"));
        }
        if (endWithFinal) {
          (writable as Writable & { end: () => void }).end();
        }
      });

      return mockAbortController;
    }
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("streamPodLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedWritable = null;
    capturedLogOptions = {};
    mockAbortController.abort.mockReset();
  });

  it("calls k8s Log.log with correct namespace and podName", async () => {
    setupLogMock([]);
    await new Promise<void>((resolve) => {
      void streamPodLogs("pod-xyz", "my-namespace", vi.fn(), resolve, vi.fn());
    });
    expect(mockLogFn).toHaveBeenCalledWith(
      "my-namespace",
      "pod-xyz",
      "", // empty container = first container
      expect.any(Writable),
      expect.objectContaining({ follow: true, timestamps: true })
    );
  });

  it("uses default namespace when not provided", async () => {
    setupLogMock([]);
    await new Promise<void>((resolve) => {
      void streamPodLogs("pod-xyz", undefined, vi.fn(), resolve, vi.fn());
    });
    expect(mockLogFn).toHaveBeenCalledWith(
      "fenrir-app",
      "pod-xyz",
      "",
      expect.any(Writable),
      expect.any(Object)
    );
  });

  it("delivers individual lines to onLine callback", async () => {
    const received: string[] = [];
    setupLogMock(["line one", "line two", "line three"]);

    await new Promise<void>((resolve) => {
      void streamPodLogs("pod-abc", "ns", (line) => received.push(line), resolve, vi.fn());
    });

    expect(received).toEqual(["line one", "line two", "line three"]);
  });

  it("calls onEnd when stream completes", async () => {
    const onEnd = vi.fn();
    setupLogMock(["hello"]);

    await new Promise<void>((resolve) => {
      void streamPodLogs("pod-abc", "ns", vi.fn(), () => { onEnd(); resolve(); }, vi.fn());
    });

    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("returns a cancel function that aborts the stream", async () => {
    setupLogMock([]);

    const cancel = await new Promise<() => void>((resolve) => {
      void streamPodLogs("pod-abc", "ns", vi.fn(), () => {}, vi.fn()).then(resolve);
    });

    expect(typeof cancel).toBe("function");
    cancel();
    expect(mockAbortController.abort).toHaveBeenCalledTimes(1);
  });

  it("handles partial last line (no trailing newline) via stream final", async () => {
    const received: string[] = [];
    mockLogFn.mockImplementation(
      async (_ns: string, _pod: string, _container: string, writable: Writable) => {
        setImmediate(() => {
          // Write chunk without trailing newline
          writable.write(Buffer.from("partial line without newline"));
          (writable as Writable & { end: () => void }).end();
        });
        return mockAbortController;
      }
    );

    await new Promise<void>((resolve) => {
      void streamPodLogs("pod-abc", "ns", (l) => received.push(l), resolve, vi.fn());
    });

    expect(received).toContain("partial line without newline");
  });

  it("handles multi-chunk delivery — lines split across writes", async () => {
    const received: string[] = [];
    mockLogFn.mockImplementation(
      async (_ns: string, _pod: string, _container: string, writable: Writable) => {
        setImmediate(() => {
          writable.write(Buffer.from("first li"));
          writable.write(Buffer.from("ne\nsecond line\n"));
          (writable as Writable & { end: () => void }).end();
        });
        return mockAbortController;
      }
    );

    await new Promise<void>((resolve) => {
      void streamPodLogs("pod-abc", "ns", (l) => received.push(l), resolve, vi.fn());
    });

    expect(received).toEqual(["first line", "second line"]);
  });

  it("calls onError when writable emits an error", async () => {
    const onError = vi.fn<[Error], void>();
    mockLogFn.mockImplementation(
      async (_ns: string, _pod: string, _container: string, writable: Writable) => {
        setImmediate(() => {
          writable.destroy(new Error("stream destroyed"));
        });
        return mockAbortController;
      }
    );

    await new Promise<void>((resolve) => {
      void streamPodLogs(
        "pod-abc",
        "ns",
        vi.fn(),
        vi.fn(),
        (err) => { onError(err); resolve(); }
      );
    });

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "stream destroyed" }));
  });
});
