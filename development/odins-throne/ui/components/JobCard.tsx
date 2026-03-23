import { useState, useEffect } from "react";
import type { DisplayJob } from "../lib/types";
import { AGENT_COLORS, AGENT_AVATARS, AGENT_LIGHT_AVATARS, STATUS_COLORS, STATUS_LABELS } from "../lib/constants";
import { StatusIconSvg } from "./StatusIcon";
import { resolveSessionTitle } from "../lib/resolveSessionTitle";
import type { DisplayMode } from "./Sidebar";
import { downloadLogFile } from "../lib/localStorageLogs";
import { useTheme } from "../hooks/useTheme";

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
  const { theme } = useTheme();
  const agentColor = AGENT_COLORS[job.agentKey ?? ""] || "#c9920a";
  const avatarMap = theme === "light" ? AGENT_LIGHT_AVATARS : AGENT_AVATARS;
  const avatar = avatarMap[job.agentKey ?? ""];
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

  const isExtended = displayMode === "extended";

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
        {isExtended && (
          <span className="card-extended-issue-badge" aria-label={`Issue ${job.issue}`}>
            #{job.issue}
          </span>
        )}
        <span className="card-issue-title" title={isExtended ? (job.issueTitle ?? displayTitle) : cardTitle}>
          {isExtended ? (job.issueTitle ?? displayTitle) : cardTitle}
        </span>
      </div>
      <div className="card-meta-new">
        <span className="card-agent-badge" style={{ color: agentColor }}>
          {job.agentName}
        </span>
        <span>Step {job.step}</span>
        {job.fixture && <span className="card-fixture-badge" title="Fixture (replayed log)">ᚠ</span>}
        {isExtended ? (
          <>
            {job.status === "running" && onCancelJob ? (
              <button
                className={`card-extended-action-btn card-extended-action-btn--cancel card-extended-action-first${pulse}`}
                style={{ color: sColor }}
                title="Invoke Ragnarök — click to cancel this job"
                aria-label="Cancel running job"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelJob(job.sessionId);
                }}
              >
                <StatusIconSvg status={job.status} />
                <span>{sLabel}</span>
              </button>
            ) : (
              <span
                className={`card-extended-status-label card-extended-action-first${pulse}`}
                style={{ color: sColor }}
                aria-label={`Status: ${sLabel}`}
                title={sLabel}
              >
                <StatusIconSvg status={job.status} />
                <span>{sLabel}</span>
              </span>
            )}
            <CardCopySessionIdButton sessionId={job.sessionId} labeled />
            {onTogglePin && (
              <CardPinButtonLabeled isPinned={isPinned} onTogglePin={onTogglePin} />
            )}
            {job.status === "succeeded" && (
              <CardDownloadButtonLabeled sessionId={job.sessionId} />
            )}
          </>
        ) : (
          <>
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
            {job.status === "succeeded" && (
              <CardDownloadButton sessionId={job.sessionId} />
            )}
            <CardCopySessionIdButton sessionId={job.sessionId} />
          </>
        )}
      </div>
      {isExtended && (job.startTime || job.completionTime) && (
        <div className="card-extended-meta">
          <span className="card-extended-elapsed" title="Elapsed time">
            {formatElapsed(job.startTime, job.completionTime)}
          </span>
          <span className="card-extended-timestamp" title="Last activity">
            {formatTimestamp(job.completionTime ?? job.startTime)}
          </span>
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

function CardPinButtonLabeled({ isPinned, onTogglePin }: { isPinned: boolean; onTogglePin: () => void }) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setConfirming(false);
  }, [isPinned]);

  if (confirming) {
    return (
      <button
        className="card-extended-action-btn card-extended-action-btn--confirm"
        onClick={(e) => {
          e.stopPropagation();
          onTogglePin();
          setConfirming(false);
        }}
        onBlur={() => setConfirming(false)}
        title="Confirm: remove from Odin\u2019s memory"
        aria-label="Confirm unpin"
      >
        ✕ Unpin?
      </button>
    );
  }

  return (
    <button
      className={`card-extended-action-btn${isPinned ? " card-extended-action-btn--pinned" : ""}`}
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
      <span>Pin Session</span>
    </button>
  );
}

function CardCopySessionIdButton({ sessionId, labeled }: { sessionId: string; labeled?: boolean }) {
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

  if (labeled) {
    return (
      <button
        className={`card-extended-action-btn${copied ? " card-extended-action-btn--copied" : ""}`}
        onClick={handleCopy}
        title={copied ? "Copied!" : `Copy session ID: ${sessionId}`}
        aria-label={copied ? "Session ID copied" : "Copy Session ID"}
      >
        {copied ? <CardCheckIcon /> : <CardClipboardIcon />}
        <span>{copied ? "Copied!" : "Copy Session ID"}</span>
      </button>
    );
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

function CardDownloadIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 2v7M4 6l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CardDownloadButton({ sessionId }: { sessionId: string }) {
  return (
    <button
      className="card-pin-btn"
      onClick={(e) => {
        e.stopPropagation();
        void downloadLogFile(sessionId);
      }}
      title="Download session log"
      aria-label="Download session log"
    >
      <CardDownloadIcon />
    </button>
  );
}

function CardDownloadButtonLabeled({ sessionId }: { sessionId: string }) {
  return (
    <button
      className="card-extended-action-btn"
      onClick={(e) => {
        e.stopPropagation();
        void downloadLogFile(sessionId);
      }}
      title="Download session log"
      aria-label="Download session log"
    >
      <CardDownloadIcon />
      <span>Download Log</span>
    </button>
  );
}
