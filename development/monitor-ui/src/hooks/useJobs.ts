import { useState, useCallback } from "react";
import type { Job, DisplayJob, ServerMessage } from "../lib/types";
import { AGENT_NAMES } from "../lib/constants";

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
  };
}

export function useJobs() {
  const [jobs, setJobs] = useState<DisplayJob[]>([]);

  const handleMessage = useCallback((msg: ServerMessage) => {
    if (msg.type === "jobs-snapshot" || msg.type === "jobs-updated") {
      const parsed = (msg.jobs || [])
        .map(parseJob)
        .sort((a, b) => {
          const aTime = a.startTime ?? Number.MAX_SAFE_INTEGER;
          const bTime = b.startTime ?? Number.MAX_SAFE_INTEGER;
          return bTime - aTime;
        });
      setJobs(parsed);
    }
  }, []);

  return { jobs, handleMessage };
}
