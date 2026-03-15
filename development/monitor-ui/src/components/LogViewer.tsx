import { useEffect, useRef } from "react";
import type { LogEntry } from "../hooks/useLogStream";
import type { DisplayJob } from "../lib/types";
import { StatusBadge } from "./StatusBadge";
import { ToolBlock } from "./ToolBlock";

interface Props {
  entries: LogEntry[];
  activeJob: DisplayJob | null;
  wsState: "connecting" | "open" | "closed" | "error";
}

export function LogViewer({ entries, activeJob, wsState }: Props) {
  const termRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [entries]);

  if (!activeJob) {
    return (
      <main className="content" aria-label="Log viewer">
        <div className="empty-state" aria-label="No session selected">
          <div className="empty-title">All Nine Worlds await</div>
          <div className="empty-sub">Select an agent session to stream its logs</div>
        </div>
      </main>
    );
  }

  return (
    <main className="content" aria-label="Log viewer">
      <div className="content-header" aria-label="Active session">
        <span className="session-title">
          {activeJob.agentName} &mdash; #{activeJob.issue} Step {activeJob.step} (
          {activeJob.sessionId})
        </span>
        <StatusBadge state={wsState} />
      </div>
      <div className="log-terminal" ref={termRef} role="log" aria-live="polite" aria-label="Session logs">
        {entries.map((entry) => (
          <LogLine key={entry.id} entry={entry} />
        ))}
      </div>
    </main>
  );
}

function LogLine({ entry }: { entry: LogEntry }) {
  switch (entry.type) {
    case "system":
      return (
        <div className="ev-system">
          <span className="ev-label">system</span> {entry.detail}
        </div>
      );
    case "turn-divider":
      return <div className="ev-turn-divider">Turn {entry.turnNum}</div>;
    case "assistant-text":
      return <div className="ev-assistant-text">{entry.text}</div>;
    case "tool-use":
      return <ToolBlock entry={entry} />;
    case "error":
      return <span className="log-error">{"\u26A0"} {entry.message}</span>;
    case "stream-end":
      return (
        <div className="log-end">
          &mdash; stream {entry.reason} &mdash;
        </div>
      );
    case "verdict": {
      const color = entry.verdictResult === "PASS" ? "#22c55e" : "#ef4444";
      return (
        <span style={{ color, fontWeight: "bold" }}>
          &mdash; Verdict: {entry.verdictResult} &mdash;
        </span>
      );
    }
    case "raw":
      return (
        <div className="log-line" style={{ color: "var(--text-void)" }}>
          {entry.text}
        </div>
      );
    default:
      return null;
  }
}
