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

let _kc: k8s.KubeConfig | null = null;
let _batchApi: k8s.BatchV1Api | null = null;
let _coreApi: k8s.CoreV1Api | null = null;

function getKubeConfig(): k8s.KubeConfig {
  if (_kc) return _kc;
  _kc = new k8s.KubeConfig();
  try {
    _kc.loadFromCluster();
  } catch {
    try {
      _kc.loadFromDefault();
    } catch {
      // No cluster available — will fail gracefully on API calls
    }
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

export async function streamPodLogs(
  podName: string,
  namespace = "fenrir-app",
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
  namespace = "fenrir-app"
): Promise<string | null> {
  const api = getCoreApi();
  // v1.0.0 ObjectParamAPI: takes request object
  const podList = await api.listNamespacedPod({
    namespace,
    labelSelector: `session-id=${sessionId}`,
  });
  const pod = podList.items[0];
  return pod?.metadata?.name ?? null;
}
