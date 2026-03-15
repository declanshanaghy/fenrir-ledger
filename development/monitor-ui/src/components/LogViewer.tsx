import { useEffect, useRef, useState, useCallback } from "react";

import type { LogEntry } from "../hooks/useLogStream";
import type { DisplayJob } from "../lib/types";
import { StatusBadge } from "./StatusBadge";
import { ToolBlock } from "./ToolBlock";
import { NorseErrorTablet } from "./NorseErrorTablet";
import { AGENT_AVATARS, AGENT_COLORS, AGENT_NAMES, AGENT_QUOTES, AGENT_RUNE_NAMES, AGENT_RUNE_TITLES, AGENT_TITLES, STATUS_COLORS, STATUS_ICONS, STATUS_LABELS } from "../lib/constants";
import { downloadLog } from "../lib/localStorageLogs";

interface Props {
  entries: LogEntry[];
  activeJob: DisplayJob | null;
  wsState: "connecting" | "open" | "closed" | "error";
  isFixture?: boolean;
  isTtlExpired?: boolean;
  isNodeUnreachable?: boolean;
  streamError?: string | null;
  onSetSpeed?: (speed: number) => void;
}

export function LogViewer({ entries, activeJob, wsState, isFixture, isTtlExpired, isNodeUnreachable, streamError, onSetSpeed }: Props) {
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

  // TTL-expired sessions get the full-pane Norse error tablet instead of the log terminal
  if (isTtlExpired && streamError) {
    return (
      <main className="content" aria-label="Log viewer">
        <div className="content-header" aria-label="Active session">
          <span className="session-title">
            {activeJob.agentName} &mdash; #{activeJob.issue} Step {activeJob.step} (
            {activeJob.sessionId})
          </span>
          <span className="header-badges">
            <span
              className="job-status-badge"
              style={{ color: STATUS_COLORS[activeJob.status] }}
              title={`Job status: ${activeJob.status}`}
              aria-label={`Job status: ${STATUS_LABELS[activeJob.status]}`}
            >
              {STATUS_ICONS[activeJob.status]} {STATUS_LABELS[activeJob.status]}
            </span>
            <StatusBadge state={wsState} />
            <CopySessionIdButton sessionId={activeJob.sessionId} />
            <button
              className="download-log-btn"
              onClick={() => downloadLog(activeJob.sessionId)}
              title="Download session log"
              aria-label="Download session log"
            >
              <DownloadIcon />
            </button>
          </span>
        </div>
        <NorseErrorTablet sessionId={activeJob.sessionId} message={streamError} />
      </main>
    );
  }

  // Node-unreachable / kubelet-timeout errors get the same Norse error tablet treatment
  if (isNodeUnreachable && streamError) {
    return (
      <main className="content" aria-label="Log viewer">
        <div className="content-header" aria-label="Active session">
          <span className="session-title">
            {activeJob.agentName} &mdash; #{activeJob.issue} Step {activeJob.step} (
            {activeJob.sessionId})
          </span>
          <span className="header-badges">
            <span
              className="job-status-badge"
              style={{ color: STATUS_COLORS[activeJob.status] }}
              title={`Job status: ${activeJob.status}`}
              aria-label={`Job status: ${STATUS_LABELS[activeJob.status]}`}
            >
              {STATUS_ICONS[activeJob.status]} {STATUS_LABELS[activeJob.status]}
            </span>
            <StatusBadge state={wsState} />
            <CopySessionIdButton sessionId={activeJob.sessionId} />
          </span>
        </div>
        <NorseErrorTablet sessionId={activeJob.sessionId} message={streamError} variant="node-unreachable" />
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
          <CopySessionIdButton sessionId={activeJob.sessionId} />
          <button
            className="download-log-btn"
            onClick={() => downloadLog(activeJob.sessionId)}
            title="Download session log"
            aria-label="Download session log"
          >
            <DownloadIcon />
          </button>
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
    case "entrypoint-fatal":
      return (
        <div className="ep-fatal" role="alert">
          <span className="ep-fatal-badge">{"\u2717"}</span> {entry.text}
        </div>
      );
    case "entrypoint-task":
      return <NorseTablet text={entry.text ?? ""} agentKey={agentKey} />;
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
      const color = entry.verdictResult === "PASS" ? "var(--success-strong)" : "var(--error-strong)";
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

function NorseTablet({ text, agentKey }: { text: string; agentKey?: string }) {
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
          <RuneSignatureBlock agentKey={agentKey} />
        </div>
      </div>
    </div>
  );
}

function RuneSignatureBlock({ agentKey }: { agentKey?: string }) {
  const key = agentKey && AGENT_RUNE_NAMES[agentKey] ? agentKey : "_fallback";
  const name       = AGENT_NAMES[key]       ?? "The All-Father's Council";
  const title      = AGENT_TITLES[key]      ?? "";
  const runeNames  = AGENT_RUNE_NAMES[key]  ?? AGENT_RUNE_NAMES["_fallback"] ?? "";
  const runeTitles = AGENT_RUNE_TITLES[key] ?? "";
  const quote      = AGENT_QUOTES[key]      ?? AGENT_QUOTES["_fallback"] ?? "";

  return (
    <div
      className="nt-rune-sig"
      role="complementary"
      aria-label={`${name} rune signature`}
    >
      <div className="nt-rune-sig-agent-runes" aria-hidden="true">{runeNames}</div>
      {runeTitles && (
        <div className="nt-rune-sig-title-runes" aria-hidden="true">{runeTitles}</div>
      )}
      <div className="nt-rune-sig-divider" aria-hidden="true">— ᚠ ᚢ ᚦ —</div>
      <div className="nt-rune-sig-quote">&ldquo;{quote}&rdquo;</div>
      <div className="nt-rune-sig-label">{name}{title ? ` · ${title}` : ""}</div>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 1v8M4 6l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="4" y="3" width="7" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 4H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 3V2h3v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CopySessionIdButton({ sessionId }: { sessionId: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
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
      {copied ? <CheckIcon /> : <ClipboardIcon />}
    </button>
  );
}

function EntrypointGroup({ entry }: { entry: LogEntry }) {
  const [open, setOpen] = useState(false);
  const [noiseOpen, setNoiseOpen] = useState(false);

  const children = entry.children ?? [];
  const infoItems = children.filter((c) => c.type === "entrypoint-info");
  const okItems = children.filter((c) => c.type === "entrypoint-ok");
  const fatalItems = children.filter((c) => c.type === "entrypoint-fatal");
  const noiseItems = children.filter((c) => c.type === "raw" || c.type === "warning");
  const hasFatal = fatalItems.length > 0;

  return (
    <div className={`ep-group ${open ? "open" : ""}${hasFatal ? " ep-group-error" : ""}`}>
      <div className="ep-group-header" onClick={() => setOpen(!open)}>
        <span className="ep-group-chevron">{"\u203A"}</span>
        <span className="ep-group-title">{entry.text}</span>
        {infoItems.length > 0 && (
          <span className="ep-group-meta">
            {infoItems.map((i) => (
              <span key={i.id} className="ep-group-meta-item">
                <span className="ep-group-meta-key">{i.detail}:</span> {i.text}
              </span>
            ))}
          </span>
        )}
        <span className="ep-group-summary">
          {hasFatal ? "\u26A0 setup failed" : `${okItems.length} steps \u2713`}
        </span>
      </div>
      <div className="ep-group-body-wrap">
        <div className="ep-group-body">
          {/* Compact info card */}
          {infoItems.length > 0 && (
            <div className="ep-info-card">
              {infoItems.map((i) => (
                <div key={i.id} className="ep-info">
                  <span className="ep-info-key">{i.detail}:</span> {i.text}
                </div>
              ))}
            </div>
          )}
          {/* Fatal errors — prominent red */}
          {fatalItems.map((c) => (
            <LogLine key={c.id} entry={c} />
          ))}
          {/* [ok] steps with green checkmarks */}
          {okItems.map((c) => (
            <LogLine key={c.id} entry={c} />
          ))}
          {/* npm/git noise — collapsed sub-accordion */}
          {noiseItems.length > 0 && (
            <div className={`ep-noise-group ${noiseOpen ? "open" : ""}`}>
              <div className="ep-noise-header" onClick={(e) => { e.stopPropagation(); setNoiseOpen((v) => !v); }}>
                <span className="ep-group-chevron">{"\u203A"}</span>
                <span className="ep-noise-title">Setup details</span>
                <span className="ep-group-summary">{noiseItems.length} lines</span>
              </div>
              <div className="ep-group-body-wrap">
                <div className="ep-group-body">
                  {noiseItems.map((c) => (
                    <LogLine key={c.id} entry={c} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
