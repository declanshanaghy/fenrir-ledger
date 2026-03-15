import type { DisplayJob } from "../lib/types";
import { useTheme } from "../hooks/useTheme";
import { JobCard } from "./JobCard";
import { ThemeSwitcher } from "./ThemeSwitcher";

interface Props {
  jobs: DisplayJob[];
  activeSessionId: string | null;
  quote: string;
  onSelectSession: (sessionId: string) => void;
}

export function Sidebar({ jobs, activeSessionId, quote, onSelectSession }: Props) {
  const { theme, setTheme } = useTheme();

  return (
    <nav className="sidebar" aria-label="Agent sessions">
      <div className="sidebar-header">
        <div className="brand">
          <img
            src={theme === "light" ? "/odin-light.png" : "/odin-dark.png"}
            alt="Odin"
            aria-hidden="true"
          />
          <h1>Hlidskjalf</h1>
        </div>
        <div className="quote" role="note">
          &ldquo;{quote}&rdquo;
        </div>
        <div className="count-row">
          <div className="count" aria-live="polite">
            {jobs.length} session{jobs.length !== 1 ? "s" : ""}
          </div>
          <ThemeSwitcher theme={theme} setTheme={setTheme} />
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
