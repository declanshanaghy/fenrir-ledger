import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";

import type { LogEntry } from "../hooks/useLogStream";
import type { DisplayJob } from "../lib/types";
import { StatusBadge } from "./StatusBadge";
import { ToolBlock } from "./ToolBlock";
import { NorseErrorTablet } from "./NorseErrorTablet";
import { NorseVerdictInscription, isVerdictMessage } from "./NorseVerdictInscription";
import { AGENT_AVATARS, AGENT_COLORS, AGENT_NAMES, AGENT_RUNE_NAMES, AGENT_TITLES, STATUS_COLORS, STATUS_ICONS, STATUS_LABELS, WIKI_LINKS } from "../lib/constants";

import { resolveSessionTitle } from "../lib/resolveSessionTitle";

interface SessionHeaderProps {
  job: DisplayJob;
  wsState: "connecting" | "open" | "closed" | "error";
  isPinned?: boolean;
  onTogglePin?: () => void;
  showPin?: boolean;
}

function SessionHeader({ job, wsState, isPinned = false, onTogglePin, showPin = true }: SessionHeaderProps) {
  const displayTitle = resolveSessionTitle(job);
  // Truncate session ID to last 8 chars for display
  const shortId = job.sessionId.length > 8
    ? job.sessionId.slice(-8)
    : job.sessionId;
  const [confirmingUnpin, setConfirmingUnpin] = useState(false);

  // Reset confirmation state when pin state changes externally
  useEffect(() => {
    setConfirmingUnpin(false);
  }, [isPinned]);

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
        {showPin && onTogglePin && (
          confirmingUnpin ? (
            <button
              className="pin-btn pin-btn-confirming"
              onClick={() => { onTogglePin(); setConfirmingUnpin(false); }}
              onBlur={() => setConfirmingUnpin(false)}
              title="Confirm: remove from Odin\u2019s memory"
              aria-label="Confirm unpin"
            >
              <span className="pin-confirm-label">✕ unpin?</span>
            </button>
          ) : (
            <button
              className={`pin-btn${isPinned ? " pinned" : ""}`}
              onClick={() => {
                if (isPinned) {
                  setConfirmingUnpin(true);
                } else {
                  onTogglePin();
                }
              }}
              title={isPinned ? "Unpin from Odin\u2019s memory" : "Pin to Odin\u2019s memory"}
              aria-label={isPinned ? "Unpin from Odin\u2019s memory" : "Pin to Odin\u2019s memory"}
              aria-pressed={isPinned}
            >
              <PinIcon filled={isPinned} />
            </button>
          )
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
  isPinned?: boolean;
  onTogglePin?: () => void;
  onAvatarClick?: (agentKey: string) => void;
}

export function LogViewer({ entries, activeJob, wsState, isFixture, isTtlExpired, isNodeUnreachable, streamError, onSetSpeed, isPinned, onTogglePin, onAvatarClick }: Props) {
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
          isPinned={isPinned}
          onTogglePin={onTogglePin}
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
          isPinned={isPinned}
          onTogglePin={onTogglePin}
          showPin={false}
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
        isPinned={isPinned}
        onTogglePin={onTogglePin}
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
            onAvatarClick={onAvatarClick}
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

function LogLine({ entry, agentKey, agentName, isLastAssistantText, autoScroll, isLatestBatch, onAvatarClick }: { entry: LogEntry; agentKey?: string; agentName?: string; isLastAssistantText?: boolean; autoScroll?: boolean; isLatestBatch?: boolean; onAvatarClick?: (agentKey: string) => void }) {
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
          onAvatarClick={onAvatarClick}
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
      return <NorseTablet text={entry.text ?? ""} {...(autoScroll !== undefined ? { autoScroll } : {})} />;
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
  onAvatarClick,
}: {
  text: string;
  agentKey?: string;
  agentName?: string;
  isLastAssistantText?: boolean;
  onAvatarClick?: (agentKey: string) => void;
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
    <div className="agent-bubble" style={{ "--agent-accent": color, borderLeftColor: color } as React.CSSProperties}>
      <div className="agent-bubble-header">
        {avatar && (
          <button
            className="agent-bubble-avatar-btn"
            onClick={() => onAvatarClick?.(agentKey ?? "")}
            aria-label={`View ${name} profile`}
            title={`View ${name} profile`}
          >
            <img className="agent-bubble-avatar" src={avatar} alt={name} style={{ borderColor: color }} />
          </button>
        )}
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
function parseDecreeSections(text: string): Array<{ glyph: string; title: string; body: string; defaultOpen: boolean; wide: boolean }> {
  const SECTION_MAP: Array<{ pattern: RegExp; glyph: string; title: string; defaultOpen?: boolean; wide?: boolean }> = [
    { pattern: /^You are \w+/m, glyph: "ᛁ", title: "Hear Me, Agent" },
    { pattern: /SANDBOX RULES/m, glyph: "ᚺ", title: "The Sacred Ground" },
    { pattern: /\*\*Step 1/m, glyph: "ᚲ", title: "Consecrate Thy Forge" },
    { pattern: /TODO TRACKING/m, glyph: "ᚾ", title: "The Norns\u2019 Ledger" },
    { pattern: /INCREMENTAL COMMIT/m, glyph: "ᚷ", title: "The Chain of Gleipnir" },
    { pattern: /VERIFY.*tsc.*build/m, glyph: "ᛗ", title: "Trial by Fire" },
    { pattern: /STRICT SCOPE/m, glyph: "ᛏ", title: "The Gjallarhorn Boundary" },
    { pattern: /\*\*Step 2/m, glyph: "ᚱ", title: "Consult the Runes" },
    { pattern: /\*\*Issue details/m, glyph: "ᛃ", title: "The Wound in Yggdrasil", defaultOpen: true, wide: true },
    { pattern: /\*\*Step 3[^b]/m, glyph: "ᚠ", title: "Take Up Mj\u00F6lnir" },
    { pattern: /\*\*Step 3b/m, glyph: "ᛊ", title: "Forge the Tests" },
    { pattern: /\*\*Step 4/m, glyph: "ᛒ", title: "Walk the Bifr\u00F6st" },
    { pattern: /\*\*Step 5/m, glyph: "ᛚ", title: "Align with the World Tree" },
    { pattern: /\*\*Step 6/m, glyph: "ᛖ", title: "Present Thy Offering" },
    { pattern: /\*\*Step 7/m, glyph: "ᛞ", title: "Pass the Torch" },
  ];

  // Find section boundaries
  const boundaries: Array<{ idx: number; glyph: string; title: string; defaultOpen: boolean; wide: boolean }> = [];
  for (const sec of SECTION_MAP) {
    const match = sec.pattern.exec(text);
    if (match) boundaries.push({ idx: match.index, glyph: sec.glyph, title: sec.title, defaultOpen: sec.defaultOpen ?? false, wide: sec.wide ?? false });
  }
  boundaries.sort((a, b) => a.idx - b.idx);

  if (boundaries.length === 0) {
    return [{ glyph: "ᛟ", title: "The Decree", body: text, defaultOpen: true, wide: false }];
  }

  const sections: Array<{ glyph: string; title: string; body: string; defaultOpen: boolean; wide: boolean }> = [];
  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i]!.idx;
    const end = i + 1 < boundaries.length ? boundaries[i + 1]!.idx : text.length;
    sections.push({
      glyph: boundaries[i]!.glyph,
      title: boundaries[i]!.title,
      body: text.slice(start, end).trim(),
      defaultOpen: boundaries[i]!.defaultOpen,
      wide: boundaries[i]!.wide,
    });
  }
  return sections;
}

/** Apply Wikipedia gold links to an array of React nodes (strings + existing elements) */
function applyWikiLinksToNodes(nodes: Array<string | React.ReactElement>): Array<string | React.ReactElement> {
  let current = nodes;
  let keyIdx = 0;
  for (const [term, url] of Object.entries(WIKI_LINKS)) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(\\b${escaped}\\b)`, "g");
    const next: Array<string | React.ReactElement> = [];
    for (const node of current) {
      if (typeof node !== "string") {
        next.push(node);
        continue;
      }
      const parts = node.split(regex);
      for (const part of parts) {
        if (part === term) {
          next.push(
            <a
              key={`wiki-${term}-${keyIdx++}`}
              className="decree-body-link"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              title={`Wikipedia: ${term}`}
            >
              {term}
            </a>
          );
        } else if (part) {
          next.push(part);
        }
      }
    }
    current = next;
  }
  return current;
}

/** Apply backtick code spans and Wikipedia links to a prose line */
function processInline(text: string): Array<string | React.ReactElement> {
  // Split on backtick spans: odd indices are code content
  const btParts = text.split(/`([^`]+)`/);
  const nodes: Array<string | React.ReactElement> = [];
  for (let i = 0; i < btParts.length; i++) {
    const part = btParts[i] ?? "";
    if (i % 2 === 1) {
      nodes.push(<code key={`bc-${i}`} className="decree-body-code">{part}</code>);
    } else if (part) {
      nodes.push(part);
    }
  }
  // Apply WIKI_LINKS only to string segments (not code spans)
  return applyWikiLinksToNodes(nodes);
}

/** Render raw decree section body with inline formatting and Wikipedia links */
function DecreeSectionBody({ body }: { body: string }) {
  const lines = body.split("\n");
  const elements: Array<React.ReactElement> = [];
  const listBuffer: string[] = [];
  const codeBuffer: string[] = [];
  let keyIdx = 0;

  const isCodeLine = (line: string) =>
    /^(cd |git |gh |bash |npm |node |```)/.test(line.trimStart()) || /^ {2,}/.test(line);
  const isListLine = (line: string) => /^[-*] /.test(line.trimStart());
  const isHeadingLine = (line: string) => /^##\s+/.test(line.trimStart()) || /^\*\*/.test(line.trimStart());

  const flushList = () => {
    if (listBuffer.length === 0) return;
    elements.push(
      <ul key={`ul-${keyIdx++}`}>
        {listBuffer.map((item, i) => {
          const content = item.trimStart().replace(/^[-*]\s+/, "");
          return <li key={i}>{processInline(content)}</li>;
        })}
      </ul>
    );
    listBuffer.length = 0;
  };

  const flushCode = () => {
    if (codeBuffer.length === 0) return;
    elements.push(
      <code key={`blk-${keyIdx++}`} className="decree-body-block">
        {codeBuffer.join("\n")}
      </code>
    );
    codeBuffer.length = 0;
  };

  for (const line of lines) {
    if (isCodeLine(line)) {
      flushList();
      codeBuffer.push(line);
    } else if (isListLine(line)) {
      flushCode();
      listBuffer.push(line);
    } else {
      flushCode();
      flushList();
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (isHeadingLine(line)) {
        const content = trimmed.replace(/^##\s+/, "").replace(/^\*\*/, "").replace(/\*\*$/, "");
        elements.push(<strong key={`h-${keyIdx++}`}>{processInline(content)}</strong>);
      } else {
        elements.push(<p key={`p-${keyIdx++}`}>{processInline(trimmed)}</p>);
      }
    }
  }
  flushCode();
  flushList();

  return <>{elements}</>;
}

function DecreeSection({ glyph, title, body, defaultOpen, wide }: { glyph: string; title: string; body: string; defaultOpen: boolean; wide?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`decree-section ${open ? "open" : ""}${wide ? " decree-wide" : ""}`}>
      <div
        className="decree-section-header"
        onClick={() => setOpen((o) => !o)}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); }
        }}
      >
        <span className="decree-section-glyph" aria-hidden="true">{glyph}</span>
        <span className="decree-section-title">{title}</span>
        <span className="ep-group-chevron" style={{ marginLeft: "auto" }}>{"\u203A"}</span>
      </div>
      {open && <div className="decree-section-body"><DecreeSectionBody body={body} /></div>}
    </div>
  );
}

function NorseTablet({ text, autoScroll }: { text: string; autoScroll?: boolean }) {
  const [open, setOpen] = useState(true);
  const [hasBeenCollapsed, setHasBeenCollapsed] = useState(false);
  const agentMatch = /^You are (\w+)/m.exec(text);
  const agent = agentMatch?.[1] ?? "Agent";
  const agentKey = agent.toLowerCase();
  const issueMatch = /#(\d+)/.exec(text);
  const issue = issueMatch?.[1] ?? "";
  const sections = parseDecreeSections(text);

  // Agent-specific constants
  const agentRunes = AGENT_RUNE_NAMES[agentKey] ?? AGENT_RUNE_NAMES._fallback ?? "ᚨᛊᚷᚨᚱᛞ";
  // Use spread to correctly handle SMP code points (Elder Futhark is U+16A0–U+16FF)
  const firstRune = [...agentRunes][0] ?? "ᛟ";
  const agentColor = AGENT_COLORS[agentKey] ?? "#888";
  const agentTitle = AGENT_TITLES[agentKey] ?? "Agent";
  const agentDisplayName = AGENT_NAMES[agentKey] ?? agent;

  // Auto-collapse the decree once when auto-scroll is on and the agent starts working
  useEffect(() => {
    if (!autoScroll || hasBeenCollapsed) return;
    const timer = setTimeout(() => {
      setOpen(false);
      setHasBeenCollapsed(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [autoScroll, hasBeenCollapsed]);

  return (
    <div
      className={`norse-tablet ${open ? "open" : ""}`}
      style={{ borderLeft: `3px solid ${agentColor}` }}
    >
      <div
        className="norse-tablet-header"
        onClick={() => setOpen(!open)}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); }
        }}
      >
        <span className="norse-tablet-rune" aria-hidden="true">{firstRune}</span>
        <div className="norse-tablet-title-block">
          <div className="norse-tablet-title">
            THE ALL-FATHER&apos;S DECREE UNTO {agentDisplayName.toUpperCase()}
          </div>
          <div className="norse-tablet-subtitle">
            {issue ? `Issue #${issue} \u00B7 ` : ""}{agentTitle}
            {agentRunes && <span className="norse-tablet-rune-name" aria-hidden="true"> \u00B7 {agentRunes}</span>}
          </div>
        </div>
        <span className="norse-tablet-rune" aria-hidden="true">{firstRune}</span>
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
                wide={sec.wide}
              />
            ))}
          </div>
          <div className="decree-seal" role="complementary" aria-label="Odin's royal seal">
            <div className="decree-seal-runic-band" aria-hidden="true">ᛟ ᛞ ᛁ ᚾ · ᚨ ᛚ ᛚ ᚠ ᚨ ᚦ ᛖ ᚱ · ᚢ ᛏ ᚷ ᚨ ᚱ ᛞ</div>
            <div className="decree-seal-medallion" role="img" aria-label="Odin's rune — Othalan">ᛟ</div>
            <div className="decree-seal-divider" aria-hidden="true">— ᚨ —</div>
            <div className="decree-seal-command">
              &ldquo;By mine eye that sees all{" "}
              <a
                className="wiki-link decree-body-link"
                href="https://en.wikipedia.org/wiki/Norse_cosmology#Nine_worlds"
                target="_blank"
                rel="noopener noreferrer"
                title="Wikipedia: Nine Worlds"
                aria-label="Wikipedia: Nine Worlds"
              >Nine Realms</a>
              {" "}— I command thee to this task. Fail not.{" "}
              <a
                className="wiki-link decree-body-link"
                href="https://en.wikipedia.org/wiki/Fenrir"
                target="_blank"
                rel="noopener noreferrer"
                title="Wikipedia: Fenrir"
                aria-label="Wikipedia: Fenrir"
              >Fenrir</a>
              {" "}hungers.&rdquo;
            </div>
            <div className="decree-seal-attribution">Odin &middot; All-Father</div>
            <div className="decree-seal-title-runes" aria-hidden="true">ᛟᛞᛁᚾ ᚨᛚᛚᚠᚨᚦᛖᚱ</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PinIcon({ filled }: { filled: boolean }) {
  // Hollow pin (unpinned) vs filled/gold pin (pinned) — Norse aesthetic
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      {filled ? (
        // Filled tack (pinned state — gold)
        <>
          <path d="M10 2L14 6L10.5 9.5L8.5 14L7 12.5L9 8.5L5.5 5L2 3.5L6.5 1.5L10 2Z" fill="currentColor" />
          <line x1="5" y1="11" x2="2" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : (
        // Hollow tack (unpinned state — dim)
        <>
          <path d="M10 2L14 6L10.5 9.5L8.5 14L7 12.5L9 8.5L5.5 5L2 3.5L6.5 1.5L10 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <line x1="5" y1="11" x2="2" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
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
