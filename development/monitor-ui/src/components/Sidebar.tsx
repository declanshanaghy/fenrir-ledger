import { useState, useCallback, useRef, useEffect } from "react";
import type { DisplayJob } from "../lib/types";
import { useTheme } from "../hooks/useTheme";
import { JobCard } from "./JobCard";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { StatusBadge } from "./StatusBadge";

const WIDTH_KEY = "hlidskjalf:sidebar-width";
const DEFAULT_WIDTH = 300;
const MIN_WIDTH = 150;
const MAX_WIDTH = 600;

function loadWidth(): number {
  try {
    const v = localStorage.getItem(WIDTH_KEY);
    if (v !== null) {
      const n = parseInt(v, 10);
      if (!isNaN(n)) return Math.min(Math.max(n, MIN_WIDTH), MAX_WIDTH);
    }
  } catch {
    // private browsing — ignore
  }
  return DEFAULT_WIDTH;
}

function saveWidth(value: number): void {
  try {
    localStorage.setItem(WIDTH_KEY, String(value));
  } catch {
    // private browsing — ignore
  }
}

export type DisplayMode = "compact" | "normal" | "extended";

function getDisplayMode(width: number): DisplayMode {
  if (width < 240) return "compact";
  if (width <= 400) return "normal";
  return "extended";
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
  const [width, setWidth] = useState<number>(loadWidth);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const displayMode = getDisplayMode(width);
  const isCompact = displayMode === "compact";

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [width]);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isDraggingRef.current) return;
      const delta = e.clientX - startXRef.current;
      const newWidth = Math.min(Math.max(startWidthRef.current + delta, MIN_WIDTH), MAX_WIDTH);
      setWidth(newWidth);
    }

    function onMouseUp() {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setWidth((w) => {
        saveWidth(w);
        return w;
      });
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return (
    <nav
      className="sidebar"
      aria-label="Agent sessions"
      style={{ width, minWidth: width, maxWidth: width }}
    >
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
          {!isCompact && <h1>Hlidskjalf</h1>}
          {!isCompact && (
            <span className="brand-wss-badge">
              <StatusBadge state={wsState} />
            </span>
          )}
        </div>
        {!isCompact && (
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
          !isCompact && (
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
              displayMode={displayMode}
            />
          ))
        )}
      </div>
      <div
        className="sidebar-resize-handle"
        onMouseDown={handleMouseDown}
        aria-hidden="true"
        title="Drag to resize sidebar"
      />
    </nav>
  );
}
