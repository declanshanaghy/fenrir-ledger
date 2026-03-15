import * as k8s from "@kubernetes/client-node";
import { Writable } from "node:stream";

export interface AgentJob {
  name: string;
  namespace: string;
  status: "active" | "succeeded" | "failed" | "pending";
  startTime: string | null;
  completionTime: string | null;
  labels: Record<string, string>;
}

// ── Wire-protocol Job (shared with ws.ts) ───────────────────────────────────

export interface Job {
  sessionId: string;
  name: string;
  issueNumber: number;
  agent: string;
  step: number;
  status: "pending" | "running" | "succeeded" | "failed";
  startedAt: string | null;
  completedAt: string | null;
  podName: string | null;
}

let _kc: k8s.KubeConfig | null = null;
let _batchApi: k8s.BatchV1Api | null = null;
let _coreApi: k8s.CoreV1Api | null = null;

function getKubeConfig(): k8s.KubeConfig {
  if (_kc) return _kc;
  _kc = new k8s.KubeConfig();
  if (process.env.KUBERNETES_SERVICE_HOST) {
    // Running inside a K8s pod — use in-cluster config
    _kc.loadFromCluster();
  } else {
    // Local dev — use ~/.kube/config
    _kc.loadFromDefault();
  }
  return _kc;
}

function getBatchApi(): k8s.BatchV1Api {
  if (_batchApi) return _batchApi;
  _batchApi = getKubeConfig().makeApiClient(k8s.BatchV1Api);
  return _batchApi;
}

function getCoreApi(): k8s.CoreV1Api {
  if (_coreApi) return _coreApi;
  _coreApi = getKubeConfig().makeApiClient(k8s.CoreV1Api);
  return _coreApi;
}

function jobStatus(job: k8s.V1Job): AgentJob["status"] {
  const s = job.status;
  if (!s) return "pending";
  if (s.active && s.active > 0) return "active";
  if (s.succeeded && s.succeeded > 0) return "succeeded";
  if (s.failed && s.failed > 0) return "failed";
  return "pending";
}

function parseJobMeta(
  name: string,
  labels: Record<string, string>
): Pick<Job, "sessionId" | "issueNumber" | "agent" | "step"> {
  const sessionId =
    labels["fenrir.dev/session-id"] || name.replace(/^agent-/, "");
  const m = sessionId.match(/issue-(\d+)-step(\d+)-([a-z]+)/i);
  return {
    sessionId,
    issueNumber: m ? parseInt(m[1], 10) : 0,
    agent: m ? m[3].toLowerCase() : "unknown",
    step: m ? parseInt(m[2], 10) : 0,
  };
}

export function mapAgentJobToJob(j: AgentJob): Job {
  const meta = parseJobMeta(j.name, j.labels);
  return {
    ...meta,
    name: j.name,
    status: j.status === "active" ? "running" : j.status,
    startedAt: j.startTime,
    completedAt: j.completionTime,
    podName: null,
  };
}

export async function listAgentJobs(
  namespace = "fenrir-app",
  labelSelector = "app=odin-agent"
): Promise<AgentJob[]> {
  const api = getBatchApi();
  // v1.0.0 ObjectParamAPI: methods take a request object, return the resource directly
  const jobList = await api.listNamespacedJob({ namespace, labelSelector });
  return jobList.items.map((job) => ({
    name: job.metadata?.name ?? "unknown",
    namespace: job.metadata?.namespace ?? namespace,
    status: jobStatus(job),
    startTime: job.status?.startTime?.toISOString() ?? null,
    completionTime: job.status?.completionTime?.toISOString() ?? null,
    labels: (job.metadata?.labels as Record<string, string>) ?? {},
  }));
}

/**
 * Watch K8s batch/v1 Jobs for state changes. Calls onUpdate with the full
 * current job list on every ADDED/MODIFIED/DELETED event. Auto-reconnects
 * after the watch stream ends or errors. Returns a cancel function.
 */
export function watchAgentJobs(
  namespace = "fenrir-app",
  labelSelector = "app=odin-agent",
  onUpdate: (jobs: Job[]) => void,
  onError: (err: Error) => void
): () => void {
  let stopped = false;
  const jobMap = new Map<string, Job>();
  let currentReq: { abort(): void } | null = null;

  const doWatch = async (): Promise<void> => {
    if (stopped) return;
    try {
      const kc = getKubeConfig();
      const watch = new k8s.Watch(kc);
      const req = await watch.watch(
        `/apis/batch/v1/namespaces/${namespace}/jobs`,
        { labelSelector },
        (type: string, obj: k8s.V1Job) => {
          const name = obj.metadata?.name ?? "unknown";
          const labels =
            (obj.metadata?.labels as Record<string, string>) ?? {};
          const s = obj.status;
          let status: Job["status"] = "pending";
          if (s?.active && s.active > 0) status = "running";
          else if (s?.succeeded && s.succeeded > 0) status = "succeeded";
          else if (s?.failed && s.failed > 0) status = "failed";

          if (type === "DELETED") {
            jobMap.delete(name);
          } else {
            const meta = parseJobMeta(name, labels);
            jobMap.set(name, {
              ...meta,
              name,
              status,
              startedAt: obj.status?.startTime?.toISOString() ?? null,
              completedAt: obj.status?.completionTime?.toISOString() ?? null,
              podName: null,
            });
          }
          onUpdate(Array.from(jobMap.values()));
        },
        (err: Error | null) => {
          // Watch stream ended (naturally or via error)
          currentReq = null;
          if (!stopped) {
            if (err) onError(err);
            // Reconnect after a short delay
            setTimeout(() => void doWatch(), 5000);
          }
        }
      );
      currentReq = req as unknown as { abort(): void };
    } catch (err) {
      currentReq = null;
      if (!stopped) {
        onError(err instanceof Error ? err : new Error(String(err)));
        setTimeout(() => void doWatch(), 5000);
      }
    }
  };

  void doWatch();

  return () => {
    stopped = true;
    currentReq?.abort();
  };
}

export async function streamPodLogs(
  podName: string,
  namespace = "fenrir-agents",
  onLine: (line: string) => void,
  onEnd: () => void,
  onError: (err: Error) => void
): Promise<() => void> {
  const kc = getKubeConfig();
  const log = new k8s.Log(kc);

  let buf = "";
  const writable = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      buf += chunk.toString();
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (line) onLine(line);
      }
      callback();
    },
    final(callback) {
      if (buf) onLine(buf);
      onEnd();
      callback();
    },
  });

  writable.on("error", onError);

  const abortController = await log.log(
    namespace,
    podName,
    "", // container — empty = first container
    writable,
    { follow: true, timestamps: true }
  );

  return () => abortController.abort();
}

export async function findPodForSession(
  sessionId: string,
  namespace = "fenrir-agents"
): Promise<string | null> {
  const api = getCoreApi();
  // Try session-id label first (set on pod template)
  const podList = await api.listNamespacedPod({
    namespace,
    labelSelector: `fenrir.dev/session-id=${sessionId}`,
  });
  if (podList.items.length > 0) {
    return podList.items[0].metadata?.name ?? null;
  }
  // Fallback: try job-name label (auto-set by K8s on job pods)
  const jobName = `agent-${sessionId}`;
  const byJob = await api.listNamespacedPod({
    namespace,
    labelSelector: `batch.kubernetes.io/job-name=${jobName}`,
  });
  return byJob.items[0]?.metadata?.name ?? null;
}
