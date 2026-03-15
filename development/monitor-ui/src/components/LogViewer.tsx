import { useEffect, useRef, useState, useCallback } from "react";

import type { LogEntry } from "../hooks/useLogStream";
import type { DisplayJob } from "../lib/types";
import { StatusBadge } from "./StatusBadge";
import { ToolBlock } from "./ToolBlock";
import { AGENT_AVATARS, AGENT_COLORS, AGENT_NAMES, AGENT_TITLES, STATUS_COLORS, STATUS_ICONS, STATUS_LABELS } from "../lib/constants";

interface Props {
  entries: LogEntry[];
  activeJob: DisplayJob | null;
  wsState: "connecting" | "open" | "closed" | "error";
  isFixture?: boolean;
  onSetSpeed?: (speed: number) => void;
}

export function LogViewer({ entries, activeJob, wsState, isFixture, onSetSpeed }: Props) {
  const termRef = useRef<HTMLDivElement>(null);
  const [fixtureSpeed, setFixtureSpeed] = useState(1);
  const [fixturePaused, setFixturePaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const programmaticScrollRef = useRef(false);

  // Auto-scroll when new entries arrive (if enabled)
  useEffect(() => {
    if (autoScroll && termRef.current) {
      programmaticScrollRef.current = true;
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [entries, autoScroll]);

  // Reset auto-scroll when switching sessions
  useEffect(() => {
    setAutoScroll(true);
    programmaticScrollRef.current = false;
  }, [activeJob?.sessionId]);

  // Detect user scroll — disable auto-scroll if they scroll up
  const handleScroll = useCallback(() => {
    // Ignore scroll events triggered by programmatic scrollTop assignment
    if (programmaticScrollRef.current) {
      programmaticScrollRef.current = false;
      return;
    }
    const el = termRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (atBottom) {
      setAutoScroll(true);
    } else {
      setAutoScroll(false);
    }
  }, []);

  const toggleAutoScroll = useCallback(() => {
    setAutoScroll((prev) => {
      if (!prev && termRef.current) {
        programmaticScrollRef.current = true;
        termRef.current.scrollTop = termRef.current.scrollHeight;
      }
      return !prev;
    });
  }, []);

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
    <main className="content" aria-label="Log viewer" style={{ position: "relative" }}>
      <div className="content-header" aria-label="Active session">
        <span className="session-title">
          {activeJob.agentName} &mdash; #{activeJob.issue} Step {activeJob.step} (
          {activeJob.sessionId})
        </span>
        <span className="header-badges">
          <span
            className={`job-status-badge${activeJob.status === "running" ? " pulse" : ""}`}
            style={{ color: STATUS_COLORS[activeJob.status] }}
            title={`Job status: ${activeJob.status}`}
            aria-label={`Job status: ${STATUS_LABELS[activeJob.status]}`}
          >
            {STATUS_ICONS[activeJob.status]} {STATUS_LABELS[activeJob.status]}
          </span>
          <StatusBadge state={wsState} />
        </span>
      </div>
      <div
        className="log-terminal"
        ref={termRef}
        role="log"
        aria-live="polite"
        aria-label="Session logs"
        onScroll={handleScroll}
      >
        {entries.map((entry) => (
          <LogLine key={entry.id} entry={entry} {...(activeJob?.agentKey ? { agentKey: activeJob.agentKey } : {})} {...(activeJob?.agentName ? { agentName: activeJob.agentName } : {})} />
        ))}
      </div>
      <div className="log-controls">
        {isFixture && (
          <div className="speed-controls">
            <button
              className={`speed-btn ${fixturePaused ? "active" : ""}`}
              onClick={() => {
                const next = !fixturePaused;
                setFixturePaused(next);
                onSetSpeed?.(next ? 0 : fixtureSpeed);
              }}
              title={fixturePaused ? "Resume" : "Pause"}
            >
              {fixturePaused ? "\u25B6" : "\u23F8"}
            </button>
            {[1, 2, 3, 5].map((s) => (
              <button
                key={s}
                className={`speed-btn ${fixtureSpeed === s && !fixturePaused ? "active" : ""}`}
                onClick={() => {
                  setFixtureSpeed(s);
                  setFixturePaused(false);
                  onSetSpeed?.(s);
                }}
                title={`${s}x speed`}
              >
                {s}x
              </button>
            ))}
          </div>
        )}
        <button
          className={`autoscroll-fab ${autoScroll ? "active" : ""}`}
          onClick={toggleAutoScroll}
          aria-label={autoScroll ? "Auto-scroll on (click to pause)" : "Auto-scroll off (click to resume)"}
          title={autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
        >
          {autoScroll ? "\u23F8" : "\u25B6"}
        </button>
      </div>
    </main>
  );
}

function LogLine({ entry, agentKey, agentName }: { entry: LogEntry; agentKey?: string; agentName?: string }) {
  switch (entry.type) {
    case "system":
      return (
        <div className="ev-system">
          <span className="ev-label">system</span> {entry.detail}
        </div>
      );
    case "turn-divider":
      return null; // legacy, unused
    case "tool-batch":
      return <ToolBatchGroup entry={entry} />;
    case "assistant-text":
      if (entry.detail === "thinking") {
        return <div className="ev-thinking">{entry.text}</div>;
      }
      return <AgentBubble text={entry.text ?? ""} {...(agentKey ? { agentKey } : {})} {...(agentName ? { agentName } : {})} />;
    case "tool-use":
      return <ToolBlock entry={entry} />;
    case "entrypoint-group":
      return <EntrypointGroup entry={entry} />;
    case "entrypoint-header":
      return <div className="ep-header">{entry.text}</div>;
    case "entrypoint-ok":
      return <div className="ep-ok"><span className="ep-ok-badge">{"\u2713"}</span> {entry.text}</div>;
    case "entrypoint-info":
      return <div className="ep-info"><span className="ep-info-key">{entry.detail}:</span> {entry.text}</div>;
    case "entrypoint-task":
      return <NorseTablet text={entry.text ?? ""} />;
    case "warning":
      return <span className="log-warning">{"\u26A0"} {entry.message}</span>;
    case "error":
      return (
        <div className="log-error-box" role="alert" aria-label="Log stream error">
          <span className="log-error-icon">{"\u26A0"}</span>
          <span className="log-error-text">{entry.message}</span>
        </div>
      );
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

function AgentBubble({ text, agentKey, agentName }: { text: string; agentKey?: string; agentName?: string }) {
  const name = agentName ?? AGENT_NAMES[agentKey ?? ""] ?? "Agent";
  const title = AGENT_TITLES[agentKey ?? ""] ?? "";
  const avatar = AGENT_AVATARS[agentKey ?? ""];
  const color = AGENT_COLORS[agentKey ?? ""] ?? "var(--gold)";

  return (
    <div className="agent-bubble">
      <div className="agent-bubble-header">
        {avatar && <img className="agent-bubble-avatar" src={avatar} alt={name} />}
        <div className="agent-bubble-identity">
          <span className="agent-bubble-name" style={{ color }}>{name}</span>
          {title && <span className="agent-bubble-title">{title}</span>}
        </div>
      </div>
      <div className="agent-bubble-text">{text}</div>
    </div>
  );
}

function ToolBatchGroup({ entry }: { entry: LogEntry }) {
  const [open, setOpen] = useState(true);
  const hasError = entry.children?.some((c) => c.toolIsError) ?? false;
  const prevCompleteRef = useRef(entry.complete);

  // Auto-collapse immediately when batch completes
  useEffect(() => {
    if (entry.complete && !prevCompleteRef.current) {
      prevCompleteRef.current = true;
      setOpen(false);
    }
  }, [entry.complete]);

  return (
    <div className={`ev-tool-batch ${open ? "open" : ""}${hasError ? " batch-error" : ""}${entry.complete ? " complete" : ""}`}>
      <div className="ev-tool-batch-header" onClick={() => setOpen(!open)}>
        <span className="ev-tool-batch-chevron">{"\u203A"}</span>
        <span className="ev-tool-batch-label">{entry.text}</span>
        {!entry.complete && <span className="ev-tool-batch-spinner" />}
        {entry.complete && <span className="ev-tool-batch-done">{"\u2713"}</span>}
      </div>
      <div className="ev-tool-batch-body-wrap">
        <div className="ev-tool-batch-body">
          {entry.children?.map((child) => (
            <LogLine key={child.id} entry={child} />
          ))}
        </div>
      </div>
    </div>
  );
}

function NorseTablet({ text }: { text: string }) {
  const [open, setOpen] = useState(true);
  // Extract agent name from "You are <Name>,"
  const agentMatch = /^You are (\w+)/.exec(text);
  const agent = agentMatch?.[1] ?? "Agent";
  // Extract issue ref
  const issueMatch = /#(\d+)/.exec(text);
  const issue = issueMatch?.[1] ?? "";

  return (
    <div className={`norse-tablet ${open ? "open" : ""}`}>
      <div className="norse-tablet-header" onClick={() => setOpen(!open)}>
        <span className="norse-tablet-rune">{"\u16A0"}</span>
        <span className="norse-tablet-title">
          The All-Father&apos;s Decree unto {agent}
          {issue ? ` \u2014 Issue #${issue}` : ""}
        </span>
        <span className="norse-tablet-rune">{"\u16A0"}</span>
        <span className="ep-group-chevron" style={{ marginLeft: "auto" }}>{"\u203A"}</span>
      </div>
      <div className="norse-tablet-body-wrap">
        <div className="norse-tablet-body">
          <div className="norse-tablet-inscription">{text}</div>
          <div className="norse-tablet-seal">
            {"\u16B1\u16A0\u16C7\u16BE\u16A0\u16B1"} &mdash; So it is written, so it shall be done &mdash; {"\u16B1\u16A0\u16C7\u16BE\u16A0\u16B1"}
          </div>
        </div>
      </div>
    </div>
  );
}

function EntrypointGroup({ entry }: { entry: LogEntry }) {
  const [open, setOpen] = useState(false);
  const okCount = entry.children?.filter((c) => c.type === "entrypoint-ok").length ?? 0;
  return (
    <div className={`ep-group ${open ? "open" : ""}`}>
      <div className="ep-group-header" onClick={() => setOpen(!open)}>
        <span className="ep-group-chevron">{"\u203A"}</span>
        <span className="ep-group-title">{entry.text}</span>
        <span className="ep-group-summary">{okCount} steps completed</span>
      </div>
      <div className="ep-group-body-wrap">
        <div className="ep-group-body">
          {entry.children?.map((child) => (
            <LogLine key={child.id} entry={child} />
          ))}
        </div>
      </div>
    </div>
  );
}
