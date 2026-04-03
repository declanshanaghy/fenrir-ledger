import * as k8s from "@kubernetes/client-node";
import { Writable } from "node:stream";

export interface AgentJob {
  name: string;
  namespace: string;
  status: "active" | "succeeded" | "failed" | "pending";
  startTime: string | null;
  completionTime: string | null;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

// ── Wire-protocol Job (shared with ws.ts) ───────────────────────────────────

export interface Job {
  sessionId: string;
  name: string;
  issueNumber: number;
  agent: string;
  step: number;
  status: "pending" | "running" | "succeeded" | "failed" | "purged";
  startedAt: string | null;
  completedAt: string | null;
  podName: string | null;
  issueTitle: string | null;
  branchName: string | null;
  fixture?: boolean;
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

/**
 * Map a K8s Pod phase to a Job status.
 * Returns null for unknown/unset phases (caller should keep existing status).
 */
export function podPhaseToStatus(phase: string | undefined): Job["status"] | null {
  switch (phase) {
    case "Pending":   return "pending";
    case "Running":   return "running";
    case "Succeeded": return "succeeded";
    case "Failed":    return "failed";
    default:          return null;
  }
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
    issueNumber: m ? parseInt(m[1] ?? "0", 10) : 0,
    agent: m ? (m[3] ?? "unknown").toLowerCase() : "unknown",
    step: m ? parseInt(m[2] ?? "0", 10) : 0,
  };
}

export function mapAgentJobToJob(j: AgentJob): Job {
  const meta = parseJobMeta(j.name, j.labels);
  // Prefer fenrir/pr-title over fenrir/issue-title (PR title is more specific)
  const prTitle = j.annotations["fenrir/pr-title"] || null;
  const issueAnnotation = j.annotations["fenrir/issue-title"] || null;
  const branchName = j.annotations["fenrir/branch"] || null;
  // "active" means the K8s job controller created the pod, but the pod may
  // still be in Pending phase (image pull, scheduling). We expose "pending"
  // here; the watch path upgrades to "running" once pod phase == "Running".
  return {
    ...meta,
    name: j.name,
    status: j.status === "active" ? "pending" : j.status,
    startedAt: j.startTime,
    completedAt: j.completionTime,
    podName: null,
    issueTitle: prTitle ?? issueAnnotation,
    branchName,
  };
}

export async function listAgentJobs(
  namespace = "fenrir-agents",
  labelSelector = "app.kubernetes.io/component=agent-sandbox"
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
    annotations: (job.metadata?.annotations as Record<string, string>) ?? {},
  }));
}

/**
 * Watch K8s batch/v1 Jobs AND core/v1 Pods for state changes.
 *
 * Jobs give us terminal states (succeeded/failed) and initial pending state.
 * Pods give us the precise phase (Pending → Running → Succeeded/Failed),
 * which allows the UI to transition from "pending" to "running" once the pod
 * is actually executing — something Job status.active alone cannot distinguish.
 *
 * Calls onUpdate with the full current job list on every status change.
 * Auto-reconnects both watchers after stream ends or errors.
 * Returns a cancel function that stops both watchers.
 */
export function watchAgentJobs(
  namespace = "fenrir-agents",
  labelSelector = "app.kubernetes.io/component=agent-sandbox",
  onUpdate: (jobs: Job[]) => void,
  onError: (err: Error) => void
): () => void {
  let stopped = false;
  const jobMap = new Map<string, Job>();
  let currentJobReq: { abort(): void } | null = null;
  let currentPodReq: { abort(): void } | null = null;

  function sortedJobs(): Job[] {
    return Array.from(jobMap.values()).sort((a, b) => {
      const aTime = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const bTime = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return bTime - aTime;
    });
  }

  // Seed jobMap from both a job list and a pod list so initial state is accurate.
  // Pod phases refine job statuses: a job with status.active=1 could have a
  // pod that is still Pending (scheduling) or already Running (executing).
  const seedFromList = async (): Promise<void> => {
    try {
      const jobs = await listAgentJobs(namespace, labelSelector);
      for (const j of jobs) {
        const mapped = mapAgentJobToJob(j);
        jobMap.set(j.name, mapped);
      }

      // Refine status using live pod phases
      try {
        const coreApi = getCoreApi();
        // Pods created by K8s Jobs inherit the job's pod-template labels.
        // We watch all pods in the namespace and filter by job-name label.
        const podList = await coreApi.listNamespacedPod({ namespace });
        for (const pod of podList.items) {
          const podLabels =
            (pod.metadata?.labels as Record<string, string>) ?? {};
          const jobName = podLabels["batch.kubernetes.io/job-name"];
          if (!jobName) continue;
          const existing = jobMap.get(jobName);
          if (!existing) continue;
          const phase = pod.status?.phase;
          const status = podPhaseToStatus(phase);
          if (status) {
            jobMap.set(jobName, {
              ...existing,
              status,
              podName: pod.metadata?.name ?? existing.podName,
            });
          }
        }
      } catch {
        // Pod list failure is non-fatal — job-only status is better than nothing
      }

      // After reconciling with live pod list: any terminal job with no pod found
      // has had its pod reaped → mark as purged so UI shows correct state on load.
      for (const [jobName, job] of jobMap.entries()) {
        if (
          (job.status === "succeeded" || job.status === "failed") &&
          job.podName === null &&
          job.startedAt !== null
        ) {
          jobMap.set(jobName, { ...job, status: "purged" });
        }
      }

      if (jobMap.size > 0) onUpdate(sortedJobs());
    } catch {
      // Non-fatal — watch will populate
    }
  };

  // ── Job watcher ────────────────────────────────────────────────────────────

  const doJobWatch = async (): Promise<void> => {
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

          if (type === "DELETED") {
            jobMap.delete(name);
          } else {
            const s = obj.status;
            // Map job-level terminal/active status. Pod watch will refine
            // active → pending or running based on pod phase.
            let status: Job["status"] = "pending";
            if (s?.active && s.active > 0) status = "running";
            else if (s?.succeeded && s.succeeded > 0) status = "succeeded";
            else if (s?.failed && s.failed > 0) status = "failed";

            const existing = jobMap.get(name);
            const meta = parseJobMeta(name, labels);
            const annotations = (obj.metadata?.annotations as Record<string, string>) ?? {};
            const prTitle = annotations["fenrir/pr-title"] || null;
            const issueAnnotation = annotations["fenrir/issue-title"] || null;
            jobMap.set(name, {
              ...meta,
              name,
              // Preserve pod-derived status when job status is "active/running"
              // because pod phase is more granular (pending vs running).
              // Terminal states (succeeded/failed) always come from job status.
              // Do not downgrade a "purged" job back to a non-terminal status.
              status:
                existing?.status === "purged"
                  ? "purged"
                  : status === "running" && existing?.status === "pending"
                    ? "pending"
                    : status,
              startedAt: obj.status?.startTime?.toISOString() ?? null,
              completedAt: obj.status?.completionTime?.toISOString() ?? null,
              podName: existing?.podName ?? null,
              issueTitle: prTitle ?? issueAnnotation ?? existing?.issueTitle ?? null,
              branchName: annotations["fenrir/branch"] || (existing?.branchName ?? null),
            });
          }
          onUpdate(sortedJobs());
        },
        (err: Error | null) => {
          currentJobReq = null;
          if (!stopped) {
            if (err) onError(err);
            // Re-seed on reconnect to catch jobs missed during disconnect gap.
            // seedFromList() has internal error handling — failure is non-fatal.
            setTimeout(async () => {
              if (!stopped) {
                await seedFromList();
                void doJobWatch();
              }
            }, 5000);
          }
        }
      );
      currentJobReq = req as unknown as { abort(): void };
    } catch (err) {
      currentJobReq = null;
      if (!stopped) {
        onError(err instanceof Error ? err : new Error(String(err)));
        setTimeout(() => void doJobWatch(), 5000);
      }
    }
  };

  // ── Pod watcher ────────────────────────────────────────────────────────────
  // Watches all pods in the namespace. Pods created by K8s Jobs automatically
  // get a `batch.kubernetes.io/job-name` label. We use this to correlate pods
  // back to their parent job in jobMap and update the status from pod phase.

  const doPodWatch = async (): Promise<void> => {
    if (stopped) return;
    try {
      const kc = getKubeConfig();
      const watch = new k8s.Watch(kc);
      const req = await watch.watch(
        `/api/v1/namespaces/${namespace}/pods`,
        {}, // no label selector — filter in handler via batch.kubernetes.io/job-name
        (type: string, pod: k8s.V1Pod) => {
          const podLabels =
            (pod.metadata?.labels as Record<string, string>) ?? {};
          const jobName = podLabels["batch.kubernetes.io/job-name"];
          if (!jobName) return; // not a job-managed pod

          if (type === "DELETED") {
            // When a pod is reaped (garbage collected after TTL), transition
            // terminal jobs to "purged" so the UI can show that kubectl logs
            // are no longer available. Previously-saved JSONL remains viewable.
            const existing = jobMap.get(jobName);
            if (
              existing &&
              (existing.status === "succeeded" || existing.status === "failed")
            ) {
              jobMap.set(jobName, { ...existing, status: "purged", podName: null });
              onUpdate(sortedJobs());
            }
            return;
          }

          const podName = pod.metadata?.name ?? null;
          const phase = pod.status?.phase;
          const newStatus = podPhaseToStatus(phase);
          if (!newStatus) return; // unknown phase — no update

          const existing = jobMap.get(jobName);
          if (!existing) return; // job not in map yet (race — job watch will add it)

          // Only update if something changed to avoid redundant broadcasts
          if (existing.status === newStatus && existing.podName === podName) return;

          // Terminal states (succeeded/failed) set by pod phase are also valid,
          // but we let job-watch be authoritative for those to avoid flapping.
          // For active states (pending/running), pod phase is the source of truth.
          if (newStatus === "succeeded" || newStatus === "failed") {
            // Only accept terminal pod phases if job hasn't already reported terminal
            if (existing.status === "succeeded" || existing.status === "failed") return;
          }

          jobMap.set(jobName, { ...existing, status: newStatus, podName });
          onUpdate(sortedJobs());
        },
        (err: Error | null) => {
          currentPodReq = null;
          if (!stopped) {
            if (err) onError(err);
            // Re-seed on reconnect to catch jobs missed during disconnect gap.
            // seedFromList() has internal error handling — failure is non-fatal.
            setTimeout(async () => {
              if (!stopped) {
                await seedFromList();
                void doPodWatch();
              }
            }, 5000);
          }
        }
      );
      currentPodReq = req as unknown as { abort(): void };
    } catch (err) {
      currentPodReq = null;
      if (!stopped) {
        // Pod watch failure is non-fatal — degrade gracefully, job watch still runs
        console.warn("[k8s] Pod watch error (degraded mode):", String(err));
        setTimeout(() => void doPodWatch(), 10000);
      }
    }
  };

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  const doWatch = async (): Promise<void> => {
    if (stopped) return;
    // Always seed on startup with accurate job + pod status
    await seedFromList();
    void doJobWatch();
    void doPodWatch();
  };

  void doWatch();

  return () => {
    stopped = true;
    currentJobReq?.abort();
    currentPodReq?.abort();
  };
}

export async function streamPodLogs(
  podName: string,
  namespace = "fenrir-agents",
  onLine: (line: string) => void,
  onEnd: () => void,
  onError: (err: Error) => void,
  options: { follow?: boolean } = {}
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

  try {
    const abortController = await log.log(
      namespace,
      podName,
      "", // container — empty = first container
      writable,
      { follow: options.follow ?? true, timestamps: true }
    );
    return () => abortController.abort();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // HTTP 204 = pod exists but logs are empty/evicted
    if (msg.includes("204")) {
      onEnd();
      return () => {};
    }
    throw err;
  }
}

export async function deleteAgentJob(
  sessionId: string,
  namespace = "fenrir-agents"
): Promise<void> {
  const api = getBatchApi();
  const jobName = `agent-${sessionId}`;
  await api.deleteNamespacedJob({
    name: jobName,
    namespace,
    body: { propagationPolicy: "Background" },
  });
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
  const firstPod = podList.items[0];
  if (firstPod) {
    return firstPod.metadata?.name ?? null;
  }
  // Fallback: try job-name label (auto-set by K8s on job pods)
  const jobName = `agent-${sessionId}`;
  const byJob = await api.listNamespacedPod({
    namespace,
    labelSelector: `batch.kubernetes.io/job-name=${jobName}`,
  });
  return byJob.items[0]?.metadata?.name ?? null;
}
