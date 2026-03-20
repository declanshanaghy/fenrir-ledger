import { useState, useEffect } from "react";
import type { DisplayJob } from "../lib/types";
import { AGENT_COLORS, AGENT_AVATARS, STATUS_COLORS, STATUS_LABELS } from "../lib/constants";
import { StatusIconSvg } from "./StatusIcon";
import { resolveSessionTitle } from "../lib/resolveSessionTitle";
import type { DisplayMode } from "./Sidebar";

interface Props {
  job: DisplayJob;
  isActive: boolean;
  onClick: () => void;
  onAvatarClick?: (agentKey: string) => void;
  isPinned?: boolean;
  onTogglePin?: () => void;
  onCancelJob?: (sessionId: string) => void;
  displayMode?: DisplayMode;
  isTerminating?: boolean;
}

function formatElapsed(startTime: number | null, completionTime: number | null): string {
  if (!startTime) return "—";
  const end = completionTime ?? Date.now();
  const ms = end - startTime;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function formatTimestamp(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function JobCard({ job, isActive, onClick, onAvatarClick, isPinned = false, onTogglePin, onCancelJob, displayMode = "normal", isTerminating = false }: Props) {
  const agentColor = AGENT_COLORS[job.agentKey ?? ""] || "#c9920a";
  const avatar = AGENT_AVATARS[job.agentKey ?? ""];
  const sColor = STATUS_COLORS[job.status] || "#606070";
  const sLabel = STATUS_LABELS[job.status] || job.status;
  const pulse = job.status === "running" ? " pulse" : "";
  const displayTitle = resolveSessionTitle(job);
  const cardTitle = job.issueTitle
    ? `#${job.issue} \u2013 ${job.issueTitle}`
    : displayTitle;

  if (displayMode === "compact") {
    return (
      <div
        className={`card card--minimal${isActive ? " active" : ""}${isTerminating ? " card--terminating" : ""}`}
        role="listitem"
        aria-label={`Job: Issue ${job.issue} – ${job.agentName} – ${sLabel}`}
        onClick={onClick}
        title={cardTitle}
      >
        <span className={`card-status${pulse}`} style={{ color: sColor }} aria-hidden="true">
          <StatusIconSvg status={job.status} />
        </span>
        <span className="card-minimal-issue" aria-label={`Issue ${job.issue}`}>
          #{job.issue}
        </span>
        {avatar ? (
          <button
            className="card-avatar-btn card-avatar-btn--minimal"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            aria-label={`Open session log for ${job.agentName} – Issue ${job.issue}`}
            title={cardTitle}
          >
            <img className="card-avatar card-avatar--minimal" src={avatar} alt={job.agentName} />
          </button>
        ) : (
          <span className="card-minimal-agent-initial" style={{ color: agentColor }} aria-label={job.agentName}>
            {job.agentName?.[0] ?? "?"}
          </span>
        )}
        {isTerminating && <span className="card-terminated-overlay" aria-label="Terminating">✕</span>}
      </div>
    );
  }

  const shortSessionId = job.sessionId.length > 8 ? job.sessionId.slice(0, 8) + "…" : job.sessionId;

  return (
    <div
      className={`card${isActive ? " active" : ""}${isTerminating ? " card--terminating" : ""}`}
      role="listitem"
      aria-label={`Job: Issue ${job.issue} – ${displayTitle} – Step ${job.step} – ${job.agentName} – ${sLabel}`}
      onClick={onClick}
    >
      <div className="card-top">
        {avatar && (
          <button
            className="card-avatar-btn"
            onClick={(e) => {
              e.stopPropagation();
              onAvatarClick?.(job.agentKey ?? "");
            }}
            aria-label={`View ${job.agentName} profile`}
            title={`View ${job.agentName} profile`}
          >
            <img className="card-avatar" src={avatar} alt={job.agentName} />
          </button>
        )}
        <span className="card-issue-title" title={cardTitle}>
          {cardTitle}
        </span>
      </div>
      <div className="card-meta-new">
        <span className="card-agent-badge" style={{ color: agentColor }}>
          {job.agentName}
        </span>
        <span>Step {job.step}</span>
        {job.fixture && <span className="card-fixture-badge" title="Fixture (replayed log)">ᚠ</span>}
        {job.status === "running" && onCancelJob ? (
          <button
            className={`card-status-icon-btn card-status-icon-btn--cancel${pulse}`}
            style={{ color: sColor }}
            title="Invoke Ragnarök — click to cancel this job"
            aria-label="Cancel running job"
            onClick={(e) => {
              e.stopPropagation();
              onCancelJob(job.sessionId);
            }}
          >
            <StatusIconSvg status={job.status} />
          </button>
        ) : (
          <span
            className={`card-status-icon-btn${pulse}`}
            style={{ color: sColor }}
            title={sLabel}
            aria-label={`Status: ${sLabel}`}
          >
            <StatusIconSvg status={job.status} />
          </span>
        )}
        {onTogglePin && (
          <CardPinButton isPinned={isPinned} onTogglePin={onTogglePin} />
        )}
        <CardCopySessionIdButton sessionId={job.sessionId} />
      </div>
      {displayMode === "extended" && (
        <div className="card-extended-meta">
          <span className="card-extended-session-id" title={job.sessionId}>
            {shortSessionId}
          </span>
          <span className="card-extended-elapsed" title="Elapsed time">
            {formatElapsed(job.startTime, job.completionTime)}
          </span>
          {(job.startTime || job.completionTime) && (
            <span className="card-extended-timestamp" title="Last activity">
              {formatTimestamp(job.completionTime ?? job.startTime)}
            </span>
          )}
        </div>
      )}
      {isTerminating && (
        <span className="card-terminated-overlay" aria-label="Terminating">
          TERMINATED
        </span>
      )}
    </div>
  );
}

function CardPinButton({ isPinned, onTogglePin }: { isPinned: boolean; onTogglePin: () => void }) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setConfirming(false);
  }, [isPinned]);

  if (confirming) {
    return (
      <button
        className="card-pin-btn confirming"
        onClick={(e) => {
          e.stopPropagation();
          onTogglePin();
          setConfirming(false);
        }}
        onBlur={() => setConfirming(false)}
        title="Confirm: remove from Odin\u2019s memory"
        aria-label="Confirm unpin"
      >
        <span className="card-pin-confirm-text">✕ unpin?</span>
      </button>
    );
  }

  return (
    <button
      className={`card-pin-btn${isPinned ? " pinned" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        if (isPinned) {
          setConfirming(true);
        } else {
          onTogglePin();
        }
      }}
      title={isPinned ? "Unpin from Odin\u2019s memory" : "Pin to Odin\u2019s memory"}
      aria-label={isPinned ? "Unpin from Odin\u2019s memory" : "Pin to Odin\u2019s memory"}
      aria-pressed={isPinned}
    >
      <CardPinIcon filled={isPinned} />
    </button>
  );
}

function CardCopySessionIdButton({ sessionId }: { sessionId: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(sessionId);
      setCopied(true);
      setTimeout(() => { setCopied(false); }, 2000);
    } catch {
      // Clipboard API unavailable — no-op
    }
  }

  return (
    <button
      className={`copy-session-btn${copied ? " copied" : ""}`}
      onClick={handleCopy}
      title={copied ? "Copied!" : "Copy session ID"}
      aria-label={copied ? "Session ID copied" : "Copy session ID"}
    >
      {copied ? <CardCheckIcon /> : <CardClipboardIcon />}
    </button>
  );
}

function CardClipboardIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="4" y="3" width="7" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 4H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 3V2h3v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CardCheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CardPinIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      {filled ? (
        <>
          <path d="M10 2L14 6L10.5 9.5L8.5 14L7 12.5L9 8.5L5.5 5L2 3.5L6.5 1.5L10 2Z" fill="currentColor" />
          <line x1="5" y1="11" x2="2" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M10 2L14 6L10.5 9.5L8.5 14L7 12.5L9 8.5L5.5 5L2 3.5L6.5 1.5L10 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <line x1="5" y1="11" x2="2" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
