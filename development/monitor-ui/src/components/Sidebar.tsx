import type { DisplayJob } from "../lib/types";
import { JobCard } from "./JobCard";

interface Props {
  jobs: DisplayJob[];
  activeSessionId: string | null;
  quote: string;
  onSelectSession: (sessionId: string) => void;
}

export function Sidebar({ jobs, activeSessionId, quote, onSelectSession }: Props) {
  return (
    <nav className="sidebar" aria-label="Agent sessions">
      <div className="sidebar-header">
        <div className="brand">
          <img src="/odin-dark.png" alt="Odin" aria-hidden="true" />
          <h1>Hlidskjalf</h1>
        </div>
        <div className="quote" role="note">
          &ldquo;{quote}&rdquo;
        </div>
        <div className="count" aria-live="polite">
          {jobs.length} session{jobs.length !== 1 ? "s" : ""}
        </div>
      </div>
      <div className="card-list" role="list" aria-label="Job sessions">
        {jobs.length === 0 ? (
          <div
            style={{
              padding: "1rem",
              fontSize: "0.8rem",
              color: "var(--text-void)",
              fontStyle: "italic",
            }}
          >
            No agent jobs found
          </div>
        ) : (
          jobs.map((job) => (
            <JobCard
              key={job.sessionId}
              job={job}
              isActive={job.sessionId === activeSessionId}
              onClick={() => onSelectSession(job.sessionId)}
            />
          ))
        )}
      </div>
    </nav>
  );
}
