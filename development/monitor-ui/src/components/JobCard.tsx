import type { DisplayJob } from "../lib/types";
import { AGENT_COLORS, AGENT_AVATARS, STATUS_COLORS, STATUS_ICONS, STATUS_LABELS } from "../lib/constants";
import { resolveSessionTitle } from "../lib/resolveSessionTitle";

interface Props {
  job: DisplayJob;
  isActive: boolean;
  onClick: () => void;
  onAvatarClick?: (agentKey: string) => void;
}

export function JobCard({ job, isActive, onClick, onAvatarClick }: Props) {
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
        <span
          className={`card-status${pulse}`}
          style={{ color: sColor }}
          title={sLabel}
          aria-label={`Status: ${sLabel}`}
        >
          {sIcon}
        </span>
      </div>
      <div className="card-meta-new">
        <span className="card-agent-badge" style={{ color: agentColor }}>
          {job.agentName}
        </span>
        <span>Step {job.step}</span>
        <span style={{ color: sColor }}>{sLabel}</span>
        {job.fixture && <span className="card-fixture-badge" title="Fixture (replayed log)">ᚠ</span>}
        {job.status === "cached" && <span className="card-pin-badge" title="Pinned to Odin\u2019s memory">{"\uD83D\uDCCC"}</span>}
      </div>
    </div>
  );
}
