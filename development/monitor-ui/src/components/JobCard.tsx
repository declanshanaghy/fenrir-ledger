import { useState, useEffect } from "react";
import type { DisplayJob } from "../lib/types";
import { AGENT_COLORS, AGENT_AVATARS, STATUS_COLORS, STATUS_ICONS, STATUS_LABELS } from "../lib/constants";
import { resolveSessionTitle } from "../lib/resolveSessionTitle";

interface Props {
  job: DisplayJob;
  isActive: boolean;
  onClick: () => void;
  onAvatarClick?: (agentKey: string) => void;
  isPinned?: boolean;
  onTogglePin?: () => void;
  onCancelJob?: (sessionId: string) => void;
}

export function JobCard({ job, isActive, onClick, onAvatarClick, isPinned = false, onTogglePin, onCancelJob }: Props) {
  const agentColor = AGENT_COLORS[job.agentKey ?? ""] || "#c9920a";
  const avatar = AGENT_AVATARS[job.agentKey ?? ""];
  const sColor = STATUS_COLORS[job.status] || "#606070";
  const sIcon = STATUS_ICONS[job.status] || "\u2014";
  const sLabel = STATUS_LABELS[job.status] || job.status;
  const pulse = job.status === "running" ? " pulse" : "";
  const displayTitle = resolveSessionTitle(job);
  // Shorten to issue + short title for card (trim trailing "– Step N" from full title)
  const cardTitle = job.issueTitle
    ? `#${job.issue} \u2013 ${job.issueTitle}`
    : displayTitle;

  return (
    <div
      className={`card${isActive ? " active" : ""}`}
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
        {job.status === "running" && onCancelJob ? (
          <button
            className={`card-status card-status--clickable${pulse}`}
            style={{ color: sColor }}
            title="Invoke Ragnarök — click to cancel this job"
            aria-label="Cancel running job"
            onClick={(e) => {
              e.stopPropagation();
              onCancelJob(job.sessionId);
            }}
          >
            {sIcon}
          </button>
        ) : (
          <span
            className={`card-status${pulse}`}
            style={{ color: sColor }}
            title={sLabel}
            aria-label={`Status: ${sLabel}`}
          >
            {sIcon}
          </span>
        )}
      </div>
      <div className="card-meta-new">
        <span className="card-agent-badge" style={{ color: agentColor }}>
          {job.agentName}
        </span>
        <span>Step {job.step}</span>
        <span style={{ color: sColor }}>{sLabel}</span>
        {job.fixture && <span className="card-fixture-badge" title="Fixture (replayed log)">ᚠ</span>}
        {onTogglePin && (
          <CardPinButton isPinned={isPinned} onTogglePin={onTogglePin} />
        )}
      </div>
    </div>
  );
}

function CardPinButton({ isPinned, onTogglePin }: { isPinned: boolean; onTogglePin: () => void }) {
  const [confirming, setConfirming] = useState(false);

  // Reset confirmation state whenever pin state changes externally
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
