import type { DisplayJob } from "../lib/types";
import { AGENT_COLORS, AGENT_AVATARS, STATUS_COLORS, STATUS_ICONS, STATUS_LABELS } from "../lib/constants";
import { timeAgo, fmtTime } from "../lib/time";

interface Props {
  job: DisplayJob;
  isActive: boolean;
  onClick: () => void;
}

export function JobCard({ job, isActive, onClick }: Props) {
  const color = AGENT_COLORS[job.agentKey] || "#c9920a";
  const avatar = AGENT_AVATARS[job.agentKey];
  const sColor = STATUS_COLORS[job.status] || "#606070";
  const sIcon = STATUS_ICONS[job.status] || "\u2014";
  const sLabel = STATUS_LABELS[job.status] || job.status;
  const pulse = job.status === "running" ? " pulse" : "";
  const ts = job.startTime || job.completionTime;

  return (
    <div
      className={`card${isActive ? " active" : ""}`}
      role="listitem"
      aria-label={`Job: ${job.agentName} issue ${job.issue} step ${job.step}`}
      onClick={onClick}
    >
      <div className="card-top">
        {avatar && <img className="card-avatar" src={avatar} alt={job.agentName} />}
        <span className="card-agent" style={{ color }}>
          {job.agentName}
        </span>
        <span
          className={`card-status${pulse}`}
          style={{ color: sColor }}
          title={job.status}
        >
          {sIcon}
        </span>
      </div>
      <div className="card-meta">
        #{job.issue} &middot; Step {job.step} &middot;{" "}
        <span style={{ color: sColor }}>{sLabel}</span>
      </div>
      <div className="card-date">
        {ts ? fmtTime(ts) : ""}{" "}
        {ts ? <span style={{ color: "var(--teal-asgard)" }}>{timeAgo(ts)}</span> : ""}
      </div>
    </div>
  );
}
