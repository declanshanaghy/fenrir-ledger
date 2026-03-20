import { useState, useCallback } from "react";
import type { Job, DisplayJob, ServerMessage } from "../lib/types";
import { AGENT_NAMES } from "../lib/constants";
import { getCachedSessionIds, getCachedSessionMeta } from "../lib/localStorageLogs";

const STATUS_PRIORITY: Record<DisplayJob["status"], number> = {
  running: 0,
  pending: 1,
  failed: 2,
  succeeded: 3,
  cached: 4,
  purged: 5,
};

function sortJobs(a: DisplayJob, b: DisplayJob): number {
  const aPriority = STATUS_PRIORITY[a.status] ?? 99;
  const bPriority = STATUS_PRIORITY[b.status] ?? 99;
  if (aPriority !== bPriority) return aPriority - bPriority;
  // Within same status group, sort by start time descending (newest first)
  const aTime = a.startTime ?? 0;
  const bTime = b.startTime ?? 0;
  return bTime - aTime;
}

function parseJob(job: Job): DisplayJob {
  const agentKey = job.agent || "unknown";
  return {
    sessionId: job.sessionId,
    name: job.name,
    issue: String(job.issueNumber || "?"),
    step: String(job.step || "?"),
    agentKey,
    agentName: AGENT_NAMES[agentKey] || agentKey,
    status: job.status,
    startTime: job.startedAt ? new Date(job.startedAt).getTime() : null,
    completionTime: job.completedAt ? new Date(job.completedAt).getTime() : null,
    issueTitle: job.issueTitle ?? null,
    branchName: job.branchName ?? null,
    fixture: job.fixture ?? false,
  };
}

/** Build DisplayJob entries for pinned sessions not present in the live list. */
function buildCachedJobs(liveIds: Set<string>): DisplayJob[] {
  const ids = getCachedSessionIds();
  const result: DisplayJob[] = [];
  for (const sessionId of ids) {
    if (liveIds.has(sessionId)) continue; // live job takes precedence
    const meta = getCachedSessionMeta(sessionId);
    if (!meta) continue;
    const agentKey = meta.agent || "unknown";
    result.push({
      sessionId,
      name: meta.name,
      issue: String(meta.issueNumber || "?"),
      step: String(meta.step || "?"),
      agentKey,
      agentName: AGENT_NAMES[agentKey] || agentKey,
      status: "cached",
      startTime: meta.startedAt ? new Date(meta.startedAt).getTime() : null,
      completionTime: meta.completedAt ? new Date(meta.completedAt).getTime() : null,
      issueTitle: meta.issueTitle ?? null,
      branchName: meta.branchName ?? null,
      fixture: false,
    });
  }
  return result;
}

export function useJobs() {
  const [jobs, setJobs] = useState<DisplayJob[]>(() => {
    // On initial load, populate with cached sessions so they appear immediately
    return buildCachedJobs(new Set());
  });

  const handleMessage = useCallback((msg: ServerMessage) => {
    if (msg.type === "jobs-snapshot" || msg.type === "jobs-updated") {
      // Exclude purged sessions — their K8s pod is gone so logs are unavailable.
      // They will be removed from the cluster by TTL shortly; no need to show them.
      const live = (msg.jobs || []).filter((j) => j.status !== "purged").map(parseJob);
      const liveIds = new Set(live.map((j) => j.sessionId));
      const cached = buildCachedJobs(liveIds);

      const all = [...live, ...cached].sort(sortJobs);
      setJobs(all);
    }
  }, []);

  /** Call after pinning/unpinning to refresh the sidebar without a server round-trip. */
  const refreshCached = useCallback(() => {
    setJobs((prev) => {
      const liveIds = new Set(
        prev.filter((j) => j.status !== "cached").map((j) => j.sessionId)
      );
      const live = prev.filter((j) => j.status !== "cached");
      const cached = buildCachedJobs(liveIds);
      return [...live, ...cached].sort(sortJobs);
    });
  }, []);

  return { jobs, handleMessage, refreshCached };
}
