import { useState, useCallback } from "react";
import type { DisplayJob } from "../lib/types";
import { useTheme } from "../hooks/useTheme";
import { JobCard } from "./JobCard";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { StatusBadge } from "./StatusBadge";

const COLLAPSE_KEY = "hlidskjalf:sidebar-collapsed";

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "true";
  } catch {
    return false;
  }
}

function saveCollapsed(value: boolean): void {
  try {
    localStorage.setItem(COLLAPSE_KEY, String(value));
  } catch {
    // private browsing — ignore
  }
}

interface Props {
  jobs: DisplayJob[];
  activeSessionId: string | null;
  quote: string;
  wsState: "connecting" | "open" | "closed" | "error";
  onSelectSession: (sessionId: string) => void;
  onAvatarClick?: (agentKey: string) => void;
  onOdinClick?: () => void;
  onTogglePinSession?: (sessionId: string) => void;
  pinnedSessionIds?: Set<string>;
  onCancelJob?: (sessionId: string) => void;
}

export function Sidebar({ jobs, activeSessionId, quote, wsState, onSelectSession, onAvatarClick, onOdinClick, onTogglePinSession, pinnedSessionIds, onCancelJob }: Props) {
  const { theme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState<boolean>(loadCollapsed);

  const handleToggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      saveCollapsed(next);
      return next;
    });
  }, []);

  return (
    <nav className={`sidebar${collapsed ? " sidebar--collapsed" : ""}`} aria-label="Agent sessions">
      <div className="sidebar-header">
        <div className="brand">
          <button
            className="odin-avatar-btn"
            onClick={onOdinClick}
            aria-label="View Odin profile"
            title="View Odin profile"
          >
            <img
              src={theme === "light" ? "/odin-light.png" : "/odin-dark.png"}
              alt="Odin"
            />
          </button>
          {!collapsed && <h1>Hlidskjalf</h1>}
          {!collapsed && (
            <span className="brand-wss-badge">
              <StatusBadge state={wsState} />
            </span>
          )}
          <button
            className="sidebar-collapse-btn"
            onClick={handleToggleCollapse}
            aria-label={collapsed ? "Expand session list" : "Collapse session list"}
            title={collapsed ? "Expand session list" : "Collapse session list"}
            aria-expanded={!collapsed}
          >
            <CollapseChevron collapsed={collapsed} />
          </button>
        </div>
        {!collapsed && (
          <>
            <div className="quote" role="note">
              &ldquo;{quote}&rdquo;
            </div>
            <div className="count-row">
              <div className="count" aria-live="polite">
                {jobs.length} session{jobs.length !== 1 ? "s" : ""}
              </div>
              <ThemeSwitcher theme={theme} setTheme={setTheme} />
            </div>
          </>
        )}
      </div>
      <div className="card-list" role="list" aria-label="Job sessions">
        {jobs.length === 0 ? (
          !collapsed && (
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
          )
        ) : (
          jobs.map((job) => (
            <JobCard
              key={job.sessionId}
              job={job}
              isActive={job.sessionId === activeSessionId}
              onClick={() => onSelectSession(job.sessionId)}
              onAvatarClick={onAvatarClick}
              isPinned={pinnedSessionIds?.has(job.sessionId) ?? false}
              onTogglePin={onTogglePinSession ? () => onTogglePinSession(job.sessionId) : undefined}
              onCancelJob={onCancelJob}
              collapsed={collapsed}
            />
          ))
        )}
      </div>
    </nav>
  );
}

function CollapseChevron({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={`collapse-chevron${collapsed ? " collapse-chevron--collapsed" : ""}`}
    >
      <polyline
        points={collapsed ? "4,2 8,6 4,10" : "8,2 4,6 8,10"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
