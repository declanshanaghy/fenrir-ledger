import { useEffect, useRef, useState, useCallback, useMemo } from "react";

import type { LogEntry } from "../hooks/useLogStream";
import type { DisplayJob } from "../lib/types";
import { StatusBadge } from "./StatusBadge";
import { ToolBlock } from "./ToolBlock";
import { NorseErrorTablet } from "./NorseErrorTablet";
import { NorseVerdictInscription, isVerdictMessage } from "./NorseVerdictInscription";
import { AGENT_AVATARS, AGENT_COLORS, AGENT_NAMES, AGENT_TITLES, STATUS_COLORS, STATUS_ICONS, STATUS_LABELS } from "../lib/constants";
import { downloadLog } from "../lib/localStorageLogs";
import { resolveSessionTitle } from "../lib/resolveSessionTitle";

interface SessionHeaderProps {
  job: DisplayJob;
  wsState: "connecting" | "open" | "closed" | "error";
  onDownload?: () => void;
  showDownload?: boolean;
}

function SessionHeader({ job, wsState, onDownload, showDownload = true }: SessionHeaderProps) {
  const displayTitle = resolveSessionTitle(job);
  // Truncate session ID to last 8 chars for display
  const shortId = job.sessionId.length > 8
    ? job.sessionId.slice(-8)
    : job.sessionId;

  return (
    <div
      className="content-header"
      aria-label={`Active session: ${displayTitle}`}
    >
      <div className="session-title-block">
        <span
          className="session-title-primary"
          title={displayTitle}
        >
          {displayTitle}
        </span>
        <div className="session-meta-row">
          <span
            className="session-agent-badge"
            aria-label={`Agent: ${job.agentName}`}
          >
            {job.agentName}
          </span>
          <span className="session-step-tag">Step {job.step}</span>
          <span
            className="session-id-chip"
            title={job.sessionId}
            role="text"
            aria-label={`Session ID: ${job.sessionId}`}
          >
            <span className="session-id-label">Session:</span> {shortId}…
          </span>
        </div>
      </div>
      <span className="header-badges">
        <span
          className={`job-status-badge${job.status === "running" ? " pulse" : ""}`}
          style={{ color: STATUS_COLORS[job.status] }}
          title={`Job status: ${job.status}`}
          aria-label={`Job status: ${STATUS_LABELS[job.status]}`}
        >
          {STATUS_ICONS[job.status]} {STATUS_LABELS[job.status]}
        </span>
        <StatusBadge state={wsState} />
        <CopySessionIdButton sessionId={job.sessionId} />
        {showDownload && onDownload && (
          <button
            className="download-log-btn"
            onClick={onDownload}
            title="Download session log"
            aria-label="Download session log"
          >
            <DownloadIcon />
          </button>
        )}
      </span>
    </div>
  );
}

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

  // Auto-scroll when new entries arrive (if enabled).
  // Depend on entry count + last entry ID, NOT the full array reference.
  // This prevents scroll resets when the array is reconstructed (e.g. entrypoint grouping).
  const lastEntryId = entries[entries.length - 1]?.id;
  useEffect(() => {
    if (autoScroll && termRef.current) {
      programmaticScrollRef.current = true;
      requestAnimationFrame(() => {
        if (termRef.current) {
          termRef.current.scrollTop = termRef.current.scrollHeight;
        }
      });
    }
  }, [entries.length, lastEntryId, autoScroll]);

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

  // Find the ID of the last non-thinking assistant-text entry to detect verdict position.
  // MUST be declared before any early returns to satisfy React's rules of hooks.
  const lastAssistantTextId = useMemo(() => {
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      if (e && e.type === "assistant-text" && e.detail !== "thinking") {
        return e.id;
      }
    }
    return null;
  }, [entries]);

  // Track the most recent tool-batch entry so we can keep it expanded during auto-scroll.
  const lastToolBatchId = useMemo(() => {
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i]?.type === "tool-batch") return entries[i]!.id;
    }
    return null;
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

  // TTL-expired sessions get the full-pane Norse error tablet instead of the log terminal
  if (isTtlExpired && streamError) {
    return (
      <main className="content" aria-label="Log viewer">
        <SessionHeader
          job={activeJob}
          wsState={wsState}
          onDownload={() => downloadLog(activeJob.sessionId)}
        />
        <NorseErrorTablet sessionId={activeJob.sessionId} message={streamError} />
      </main>
    );
  }

  // Node-unreachable / kubelet-timeout errors get the same Norse error tablet treatment
  if (isNodeUnreachable && streamError) {
    return (
      <main className="content" aria-label="Log viewer">
        <SessionHeader
          job={activeJob}
          wsState={wsState}
          showDownload={false}
        />
        <NorseErrorTablet sessionId={activeJob.sessionId} message={streamError} variant="node-unreachable" />
      </main>
    );
  }

  return (
    <main className="content" aria-label="Log viewer" style={{ position: "relative" }}>
      <SessionHeader
        job={activeJob}
        wsState={wsState}
        onDownload={() => downloadLog(activeJob.sessionId)}
      />
      <div
        className="log-terminal"
        ref={termRef}
        role="log"
        aria-live="polite"
        aria-label="Session logs"
        onScroll={handleScroll}
      >
        {entries.map((entry) => (
          <LogLine
            key={entry.id}
            entry={entry}
            {...(activeJob?.agentKey ? { agentKey: activeJob.agentKey } : {})}
            {...(activeJob?.agentName ? { agentName: activeJob.agentName } : {})}
            isLastAssistantText={entry.id === lastAssistantTextId}
            autoScroll={autoScroll}
            isLatestBatch={entry.type === "tool-batch" && entry.id === lastToolBatchId}
          />
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

function LogLine({ entry, agentKey, agentName, isLastAssistantText, autoScroll, isLatestBatch }: { entry: LogEntry; agentKey?: string; agentName?: string; isLastAssistantText?: boolean; autoScroll?: boolean; isLatestBatch?: boolean }) {
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
      return <ToolBatchGroup entry={entry} {...(autoScroll !== undefined ? { autoScroll } : {})} {...(isLatestBatch !== undefined ? { isLatestBatch } : {})} />;
    case "assistant-text":
      if (entry.detail === "thinking") {
        return <div className="ev-thinking">{entry.text}</div>;
      }
      return (
        <AgentBubble
          text={entry.text ?? ""}
          {...(agentKey ? { agentKey } : {})}
          {...(agentName ? { agentName } : {})}
          {...(isLastAssistantText ? { isLastAssistantText } : {})}
        />
      );
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

function AgentBubble({
  text,
  agentKey,
  agentName,
  isLastAssistantText,
}: {
  text: string;
  agentKey?: string;
  agentName?: string;
  isLastAssistantText?: boolean;
}) {
  // Render the last assistant text as a Norse verdict inscription if it matches
  if (isLastAssistantText && isVerdictMessage(text)) {
    return (
      <NorseVerdictInscription
        text={text}
        {...(agentKey ? { agentKey } : {})}
        {...(agentName ? { agentName } : {})}
      />
    );
  }

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

function ToolBatchGroup({ entry, autoScroll, isLatestBatch }: { entry: LogEntry; autoScroll?: boolean; isLatestBatch?: boolean }) {
  // Start collapsed if auto-scroll is on and this is not the latest batch (handles initial render
  // with multiple historical batches already in the list).
  const [open, setOpen] = useState(() => !autoScroll || !!isLatestBatch);
  const hasError = entry.children?.some((c) => c.toolIsError) ?? false;
  const prevCompleteRef = useRef(entry.complete);
  const prevIsLatestRef = useRef(isLatestBatch);
  const prevAutoScrollRef = useRef(autoScroll);

  // Auto-collapse immediately when batch completes
  useEffect(() => {
    if (entry.complete && !prevCompleteRef.current) {
      prevCompleteRef.current = true;
      setOpen(false);
    }
  }, [entry.complete]);

  // Auto-collapse when this batch is superseded by a newer one (auto-scroll must be on)
  useEffect(() => {
    const wasLatest = prevIsLatestRef.current;
    prevIsLatestRef.current = isLatestBatch;
    if (wasLatest && !isLatestBatch && autoScroll) {
      setOpen(false);
    }
  }, [isLatestBatch, autoScroll]);

  // Auto-collapse non-latest batches when auto-scroll is re-enabled
  useEffect(() => {
    const wasAutoScroll = prevAutoScrollRef.current;
    prevAutoScrollRef.current = autoScroll;
    if (!wasAutoScroll && autoScroll && !isLatestBatch) {
      setOpen(false);
    }
  }, [autoScroll, isLatestBatch]);

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

/** Parse decree text into collapsible sections with Norse headings */
function parseDecreeSections(text: string): Array<{ glyph: string; title: string; body: string; defaultOpen: boolean }> {
  const SECTION_MAP: Array<{ pattern: RegExp; glyph: string; title: string; defaultOpen?: boolean }> = [
    { pattern: /^You are \w+/m, glyph: "ᛁ", title: "Hear Me, Agent", defaultOpen: true },
    { pattern: /SANDBOX RULES/m, glyph: "ᚺ", title: "The Sacred Ground", defaultOpen: true },
    { pattern: /\*\*Step 1/m, glyph: "ᚲ", title: "Consecrate Thy Forge", defaultOpen: true },
    { pattern: /TODO TRACKING/m, glyph: "ᚾ", title: "The Norns\u2019 Ledger", defaultOpen: true },
    { pattern: /INCREMENTAL COMMIT/m, glyph: "ᚷ", title: "The Chain of Gleipnir", defaultOpen: true },
    { pattern: /VERIFY.*tsc.*build/m, glyph: "ᛗ", title: "Trial by Fire", defaultOpen: true },
    { pattern: /STRICT SCOPE/m, glyph: "ᛏ", title: "The Gjallarhorn Boundary", defaultOpen: true },
    { pattern: /\*\*Step 2/m, glyph: "ᚱ", title: "Consult the Runes", defaultOpen: true },
    { pattern: /\*\*Issue details/m, glyph: "ᛃ", title: "The Wound in Yggdrasil", defaultOpen: true },
    { pattern: /\*\*Step 3[^b]/m, glyph: "ᚠ", title: "Take Up Mj\u00F6lnir", defaultOpen: true },
    { pattern: /\*\*Step 3b/m, glyph: "ᛊ", title: "Forge the Tests", defaultOpen: true },
    { pattern: /\*\*Step 4/m, glyph: "ᛒ", title: "Walk the Bifr\u00F6st", defaultOpen: true },
    { pattern: /\*\*Step 5/m, glyph: "ᛚ", title: "Align with the World Tree", defaultOpen: true },
    { pattern: /\*\*Step 6/m, glyph: "ᛖ", title: "Present Thy Offering", defaultOpen: true },
    { pattern: /\*\*Step 7/m, glyph: "ᛞ", title: "Pass the Torch", defaultOpen: true },
  ];

  // Find section boundaries
  const boundaries: Array<{ idx: number; glyph: string; title: string; defaultOpen: boolean }> = [];
  for (const sec of SECTION_MAP) {
    const match = sec.pattern.exec(text);
    if (match) boundaries.push({ idx: match.index, glyph: sec.glyph, title: sec.title, defaultOpen: sec.defaultOpen ?? false });
  }
  boundaries.sort((a, b) => a.idx - b.idx);

  if (boundaries.length === 0) {
    return [{ glyph: "ᛟ", title: "The Decree", body: text, defaultOpen: true }];
  }

  const sections: Array<{ glyph: string; title: string; body: string; defaultOpen: boolean }> = [];
  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i]!.idx;
    const end = i + 1 < boundaries.length ? boundaries[i + 1]!.idx : text.length;
    sections.push({
      glyph: boundaries[i]!.glyph,
      title: boundaries[i]!.title,
      body: text.slice(start, end).trim(),
      defaultOpen: boundaries[i]!.defaultOpen,
    });
  }
  return sections;
}

function DecreeSection({ glyph, title, body, defaultOpen, wide }: { glyph: string; title: string; body: string; defaultOpen: boolean; wide?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`decree-section ${open ? "open" : ""}${wide ? " decree-wide" : ""}`}>
      <div className="decree-section-header" onClick={() => setOpen(o => !o)}>
        <span className="decree-section-glyph">{glyph}</span>
        <span className="decree-section-title">{title}</span>
        <span className="ep-group-chevron" style={{ marginLeft: "auto" }}>{"\u203A"}</span>
      </div>
      {open && <div className="decree-section-body">{body}</div>}
    </div>
  );
}

function NorseTablet({ text }: { text: string }) {
  const [open, setOpen] = useState(true);
  const agentMatch = /^You are (\w+)/.exec(text);
  const agent = agentMatch?.[1] ?? "Agent";
  const issueMatch = /#(\d+)/.exec(text);
  const issue = issueMatch?.[1] ?? "";
  const sections = parseDecreeSections(text);

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
          <div className="decree-grid">
            {sections.map((sec, i) => (
              <DecreeSection
                key={i}
                glyph={sec.glyph}
                title={sec.title}
                body={sec.body}
                defaultOpen={sec.defaultOpen}
                wide={sec.title === "Hear Me, Agent" || sec.title === "The Wound in Yggdrasil"}
              />
            ))}
          </div>
          <div className="nt-rune-sig" role="complementary" aria-label="Odin's seal">
            <div className="nt-rune-sig-agent-runes" aria-hidden="true">ᛟᛞᛁᚾ</div>
            <div className="nt-rune-sig-divider" aria-hidden="true">&mdash; ᚨ &mdash;</div>
            <div className="nt-rune-sig-quote">
              &ldquo;By mine eye that sees all Nine Realms — I command thee to this task. Fail not. Fenrir hungers.&rdquo;
            </div>
            <div className="nt-rune-sig-label">Odin &middot; All-Father</div>
          </div>
        </div>
      </div>
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
