import { useState, useCallback, useRef } from "react";
import type { ServerMessage, JsonEvent, ContentBlock } from "../lib/types";
import { parseJsonlLine } from "../lib/jsonl";
import { batchSummary } from "../lib/constants";
import { appendLogLine, getCachedLog, getLog } from "../lib/localStorageLogs";

// Ref type for cache-fallback invoke — avoids circular useCallback dependency
type ReplayFn = (sessionId: string) => void;

export interface LogEntry {
  id: string;
  type: "system" | "turn-divider" | "assistant-text" | "tool-use" | "tool-result" | "tool-batch" | "raw" | "error" | "warning" | "stream-end" | "verdict" | "entrypoint-header" | "entrypoint-ok" | "entrypoint-info" | "entrypoint-task" | "entrypoint-group" | "entrypoint-fatal";
  // system
  detail?: string;
  // turn-divider
  turnNum?: number;
  // assistant-text
  text?: string;
  // tool-use
  toolId?: string;
  toolName?: string;
  toolBadge?: string;
  toolPreview?: string;
  toolInput?: string;
  // tool-result (attached to tool-use)
  toolResult?: string;
  toolIsError?: boolean;
  // error / stream-end / verdict
  message?: string;
  verdictResult?: "PASS" | "FAIL";
  reason?: string;
  // entrypoint-group / tool-batch
  children?: LogEntry[];
  // tool-batch completion flag
  complete?: boolean;
}

let entryCounter = 0;
function nextId(): string {
  return `log-${++entryCounter}`;
}

/** Strip the kubectl log timestamp prefix (e.g. "2026-03-15T19:58:07Z ") */
export function stripTimestamp(line: string): string {
  return line.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z\s+/, "");
}

export function parseEntrypointLine(line: string): LogEntry {
  // === Headers === and --- Section Markers ---
  if (/^===.*===$/.test(line)) {
    return { id: nextId(), type: "entrypoint-header", text: line.replace(/^=+\s*|\s*=+$/g, "") };
  }
  if (/^---.*---$/.test(line)) {
    return { id: nextId(), type: "entrypoint-header", text: line.replace(/^-+\s*|\s*-+$/g, "") };
  }
  // [FATAL] errors — red, prominent
  if (line.startsWith("[FATAL]")) {
    return { id: nextId(), type: "entrypoint-fatal", text: line.slice(7).trim() };
  }
  // [WARN] lines — reuse warning type
  if (line.startsWith("[WARN]")) {
    return { id: nextId(), type: "warning", message: line.slice(6).trim() };
  }
  // [ok] lines
  if (line.startsWith("[ok]")) {
    return { id: nextId(), type: "entrypoint-ok", text: line.slice(4).trim() };
  }
  // Key: Value lines (Session:, Branch:, Model:, Working directory:)
  const kvMatch = /^(Session|Branch|Model|Working directory):\s*(.+)$/.exec(line);
  if (kvMatch) {
    return { id: nextId(), type: "entrypoint-info", detail: kvMatch[1]!, text: kvMatch[2]! };
  }
  // Noise lines (npm/git output) — grouped into noise accordion
  return { id: nextId(), type: "raw", text: line };
}

/** TTL / pod-not-found patterns emitted by friendlyK8sError */
export const TTL_ERROR_PATTERN = /TTL expired|cleaned up/i;

/** Node-unreachable / kubelet-timeout patterns emitted by friendlyK8sError */
export const NODE_UNREACHABLE_PATTERN = /Node unreachable|kubelet timeout/i;

/** HTTP 400 / pod-not-yet-ready patterns — pod is initializing, not a real error */
export const POD_NOT_READY_PATTERN = /HTTP-Code:\s*400|is not running|container.*not running/i;

export function useLogStream() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [activeSessionId, _setActiveSessionId] = useState<string | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [streamEnded, setStreamEnded] = useState(false);
  const [replayedFromCache, setReplayedFromCache] = useState(false);
  // isConnecting: true from the moment clearEntries() is called (session selected)
  // until the first WS data arrives or cache replay begins. Used to suppress
  // the error tablet during the brief connection window (prevents red flash).
  const [isConnecting, _setIsConnecting] = useState(false);
  const isConnectingRef = useRef(false);
  // isPodStarting: true when HTTP 400 is received (pod not yet ready).
  // Keeps isConnecting=true and triggers the auto-retry loop in App.tsx.
  const [isPodStarting, _setIsPodStarting] = useState(false);
  const isPodStartingRef = useRef(false);
  const replayFromCacheRef = useRef<ReplayFn | null>(null);
  const taskPromptBuffer = useRef<string[]>([]);
  const inTaskPrompt = useRef(false);
  const inEntrypoint = useRef(false);
  // Tracks how many live log-line messages to skip after a cache replay.
  // Set to N after replaying N cached lines so the re-streamed duplicates are ignored.
  const liveSkipRef = useRef(0);

  const setIsConnecting = useCallback((v: boolean) => {
    isConnectingRef.current = v;
    _setIsConnecting(v);
  }, []);

  const setIsPodStarting = useCallback((v: boolean) => {
    isPodStartingRef.current = v;
    _setIsPodStarting(v);
  }, []);

  const setActiveSessionId = useCallback((id: string | null) => {
    activeSessionIdRef.current = id;
    _setActiveSessionId(id);
  }, []);

  const clearEntries = useCallback(() => {
    setEntries([]);
    entryCounter = 0;
    liveSkipRef.current = 0;
    taskPromptBuffer.current = [];
    inTaskPrompt.current = false;
    inEntrypoint.current = false;
    setStreamError(null);
    setStreamEnded(false);
    setReplayedFromCache(false);
    setIsPodStarting(false);
    setIsConnecting(true);
  }, [setIsConnecting, setIsPodStarting]);

  /** Expose liveSkipRef setter so callers can set the skip count after replaying cache. */
  const setLiveSkipCount = useCallback((n: number) => {
    liveSkipRef.current = n;
  }, []);

  const processEvent = useCallback((ev: JsonEvent) => {
    if (ev.type === "system") {
      let detail = ev.subtype || "";
      if (ev.subtype === "init") {
        if (ev.model) detail = `init \u2014 model: ${ev.model}`;
        if (ev.cwd) detail += ` \u2014 cwd: ${ev.cwd}`;
      }
      setEntries((prev) => [
        ...prev,
        { id: nextId(), type: "system", detail },
      ]);
      return;
    }

    if (ev.type === "rate_limit_event") {
      const info = ev.rate_limit_info as Record<string, unknown> | undefined;
      const status = String(info?.status ?? "unknown");
      const limitType = String(info?.rateLimitType ?? "");
      const resetsAt = info?.resetsAt ? new Date(Number(info.resetsAt) * 1000).toLocaleTimeString() : "";
      const detail = `rate limit: ${status} (${limitType})${resetsAt ? ` \u2014 resets ${resetsAt}` : ""}`;
      setEntries((prev) => [
        ...prev,
        { id: nextId(), type: "warning", message: detail },
      ]);
      return;
    }

    if (ev.type === "result") {
      const isError = ev.is_error === true;
      const duration = ev.duration_ms ? `${Math.round(Number(ev.duration_ms) / 1000)}s` : "";
      const turns = ev.num_turns ? `${ev.num_turns} turns` : "";
      const resultText = typeof ev.result === "string" ? ev.result : "";
      const verdictMatch = resultText.match(/Verdict:\s*(PASS|FAIL)/i);
      if (verdictMatch) {
        setEntries((prev) => [
          ...prev,
          { id: nextId(), type: "verdict", verdictResult: verdictMatch[1]?.toUpperCase() === "PASS" ? "PASS" : "FAIL" },
        ]);
      }
      const detail = `session ${isError ? "failed" : "completed"} (${[duration, turns].filter(Boolean).join(", ")})`;
      setEntries((prev) => [
        ...prev,
        { id: nextId(), type: "system", detail },
      ]);
      return;
    }

    if (ev.type === "assistant" && ev.message?.content) {
      const newTools: LogEntry[] = [];
      const newEntries: LogEntry[] = [];
      let hasText = false;

      for (const block of ev.message.content) {
        if (block.type === "thinking" && block.text) {
          newEntries.push({
            id: nextId(),
            type: "assistant-text",
            text: block.text,
            detail: "thinking",
          });
        } else if (block.type === "text" && block.text) {
          hasText = true;
          newEntries.push({
            id: nextId(),
            type: "assistant-text",
            text: block.text,
          });
        } else if (block.type === "tool_use" && block.name) {
          const inputJson = block.input
            ? JSON.stringify(block.input, null, 2).slice(0, 500)
            : "";
          newTools.push({
            id: nextId(),
            type: "tool-use",
            toolId: block.id ?? "",
            toolName: block.name,
            toolInput: inputJson,
          });
        }
      }

      if (newEntries.length === 0 && newTools.length === 0) return;

      setEntries((prev) => {
        const updated = [...prev];

        // If we have text/thinking, mark the last open tool-batch as complete
        if (hasText) {
          for (let i = updated.length - 1; i >= 0; i--) {
            const e = updated[i];
            if (e && e.type === "tool-batch" && !e.complete) {
              updated[i] = { ...e, complete: true };
              break;
            }
          }
        }

        // Add text/thinking entries directly
        updated.push(...newEntries);

        // Add tools to existing open batch or create new one
        if (newTools.length > 0) {
          let batchIdx = -1;
          for (let i = updated.length - 1; i >= 0; i--) {
            const e = updated[i];
            if (e && e.type === "tool-batch" && !e.complete) {
              batchIdx = i;
              break;
            }
            // Stop searching if we hit non-batch, non-tool content
            if (e && e.type !== "tool-batch") break;
          }

          if (batchIdx >= 0) {
            const batch = updated[batchIdx]!;
            const allChildren = [...(batch.children ?? []), ...newTools];
            updated[batchIdx] = {
              ...batch,
              children: allChildren,
              text: batchSummary(allChildren.filter((c) => c.type === "tool-use")),
            };
          } else {
            updated.push({
              id: nextId(),
              type: "tool-batch",
              text: batchSummary(newTools),
              children: newTools,
            });
          }
        }

        return updated;
      });
      return;
    }

    if (ev.type === "user" && ev.message?.content) {
      setEntries((prev) => {
        const updated = [...prev];
        for (const block of ev.message!.content!) {
          if (block.type === "tool_result" && block.tool_use_id) {
            const raw = block.content;
            let text = "";
            if (typeof raw === "string") text = raw;
            else if (Array.isArray(raw))
              text = (raw as ContentBlock[])
                .filter((b) => b.type === "text")
                .map((b) => b.text || "")
                .join("");
            if (text.length > 800) text = text.slice(0, 800) + "\n\u2026(truncated)";

            // Search tool-batch children for the matching tool-use
            for (let i = updated.length - 1; i >= 0; i--) {
              const entry = updated[i];
              if (entry && entry.type === "tool-batch" && entry.children) {
                const children = [...entry.children];
                let found = false;
                for (let j = children.length - 1; j >= 0; j--) {
                  const child = children[j];
                  if (child && child.type === "tool-use" && child.toolId === block.tool_use_id) {
                    children[j] = { ...child, toolResult: text, toolIsError: block.is_error || false };
                    found = true;
                    break;
                  }
                }
                if (found) {
                  updated[i] = { ...entry, children };
                  break;
                }
              }
            }
          }
        }
        return updated;
      });
      return;
    }

    // Fallback
    setEntries((prev) => [
      ...prev,
      { id: nextId(), type: "raw", text: JSON.stringify(ev).slice(0, 200) },
    ]);
  }, []);

  /**
   * Process a single raw log line through the parser pipeline.
   * Used by both the live handleMessage path and the cache replay paths.
   * Does NOT call appendLogLine — callers handle persistence separately.
   */
  const processRawLogLine = useCallback((line: string) => {
    const ev = parseJsonlLine(line);
    if (!ev) {
      if (line.trim()) {
        // Strip kubectl timestamp prefix (e.g. "2026-03-15T19:58:07Z ")
        const stripped = stripTimestamp(line.trim());

        // Task prompt buffering (happens after "Starting Claude Code")
        if (/^---\s*TASK PROMPT\s*---$/.test(stripped)) {
          inTaskPrompt.current = true;
          taskPromptBuffer.current = [];
          return;
        }
        if (/^---\s*END PROMPT\s*---$/.test(stripped)) {
          inTaskPrompt.current = false;
          const fullPrompt = taskPromptBuffer.current.join("\n");
          taskPromptBuffer.current = [];
          setEntries((prev) => [
            ...prev,
            { id: nextId(), type: "entrypoint-task", text: fullPrompt },
          ]);
          return;
        }
        if (inTaskPrompt.current) {
          taskPromptBuffer.current.push(stripped);
          return;
        }

        // Entrypoint section start marker
        if (/^===\s*Agent Sandbox Entrypoint\s*===/.test(stripped)) {
          inEntrypoint.current = true;
          setEntries((prev) => [...prev, parseEntrypointLine(stripped)]);
          return;
        }

        // Entrypoint section end marker — collapse all pre-Claude entries into a group.
        if (/^===\s*Starting Claude Code\s*===/.test(stripped)) {
          inEntrypoint.current = false;
          setEntries((prev) => {
            const groupTypes = new Set(["entrypoint-header", "entrypoint-ok", "entrypoint-info", "entrypoint-fatal", "raw"]);
            const epChildren: LogEntry[] = [];
            const rest: LogEntry[] = [];
            for (const e of prev) {
              if (groupTypes.has(e.type)) epChildren.push(e);
              else rest.push(e);
            }
            const group: LogEntry = {
              id: nextId(),
              type: "entrypoint-group",
              text: "Agent Sandbox Setup",
              children: epChildren,
            };
            return [...rest, group, parseEntrypointLine(stripped)];
          });
          return;
        }

        // Inside entrypoint section — parse with structured types
        if (inEntrypoint.current) {
          setEntries((prev) => [...prev, parseEntrypointLine(stripped)]);
          return;
        }

        // Outside entrypoint — render as raw (dimmed) text
        setEntries((prev) => [...prev, { id: nextId(), type: "raw", text: stripped }]);
      }
      return;
    }
    processEvent(ev);
  }, [processEvent]);

  const handleMessage = useCallback((msg: ServerMessage) => {
    if (msg.type === "log-line") {
      const line = msg.line;
      // If we recently replayed from cache, skip lines that were already shown.
      // The server re-streams from the beginning after subscribe, so the first N
      // live lines are duplicates of what we displayed from the temp log.
      if (liveSkipRef.current > 0) {
        liveSkipRef.current--;
        return;
      }
      // First live log-line clears connecting + pod-starting state
      if (isConnectingRef.current) {
        setIsConnecting(false);
      }
      if (isPodStartingRef.current) {
        setIsPodStarting(false);
      }
      // Persist raw line to localStorage for download / future revisits
      if (activeSessionIdRef.current) {
        appendLogLine(activeSessionIdRef.current, line);
      }
      processRawLogLine(line);
    } else if (msg.type === "stream-error") {
      liveSkipRef.current = 0; // stop skipping on error
      // If the session has cached data in localStorage, fall back to it immediately
      // rather than showing the error tablet. This handles pinned sessions whose
      // pods have been cleaned up (TTL expired).
      const sessionId = activeSessionIdRef.current;
      if (sessionId && getCachedLog(sessionId)) {
        if (isConnectingRef.current) {
          setIsConnecting(false);
        }
        replayFromCacheRef.current?.(sessionId);
        return;
      }
      // HTTP 400: pod is not yet ready — stay in connecting state so the
      // waiting indicator stays visible. App.tsx will auto-retry the subscribe.
      if (POD_NOT_READY_PATTERN.test(msg.message)) {
        // Keep isConnecting=true (don't clear it) so the spinner remains
        setIsPodStarting(true);
        return;
      }
      // Clear connecting state — we now know the stream status (real error)
      if (isConnectingRef.current) {
        setIsConnecting(false);
      }
      setStreamError(msg.message);
      setEntries((prev) => [
        ...prev,
        { id: nextId(), type: "error", message: msg.message },
      ]);
    } else if (msg.type === "stream-end") {
      liveSkipRef.current = 0; // stop skipping on end
      // Clear connecting state on stream end
      if (isConnectingRef.current) {
        setIsConnecting(false);
      }
      setStreamEnded(true);
      setEntries((prev) => {
        // Mark any open batch as complete before adding stream-end
        const updated = prev.map((e) =>
          e.type === "tool-batch" && !e.complete ? { ...e, complete: true } : e
        );
        return [...updated, { id: nextId(), type: "stream-end", reason: msg.reason }];
      });
    } else if (msg.type === "verdict") {
      setEntries((prev) => [
        ...prev,
        { id: nextId(), type: "verdict", verdictResult: msg.result },
      ]);
    }
  }, [processRawLogLine, setIsConnecting, setIsPodStarting]);

  /**
   * Called by App.tsx after the 2-minute pod-starting timeout.
   * Clears the waiting state and shows a permanent error.
   */
  const showPodStartTimeout = useCallback(() => {
    setIsPodStarting(false);
    setIsConnecting(false);
    const msg = "Agent pod failed to start \u2014 check cluster status";
    setStreamError(msg);
    setEntries((prev) => [
      ...prev,
      { id: nextId(), type: "error", message: msg },
    ]);
  }, [setIsConnecting, setIsPodStarting]);

  /**
   * Replay cached JSONL from localStorage for a pinned session (CACHE_PREFIX).
   * Processes every stored line through the same pipeline as live log-lines,
   * but skips re-persisting to localStorage.
   * Call AFTER clearEntries() and INSTEAD OF subscribing to the server.
   */
  const replayFromCache = useCallback((sessionId: string) => {
    const content = getCachedLog(sessionId);
    if (!content) return;
    // Cache replay provides content immediately — clear connecting state
    if (isConnectingRef.current) {
      setIsConnecting(false);
    }
    setReplayedFromCache(true);
    const lines = content.split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;
      processRawLogLine(line);
    }
    // System marker at end of replay
    setEntries((prev) => [
      ...prev,
      { id: nextId(), type: "system", detail: "replayed from Odin\u2019s memory (pinned cache)" },
    ]);
  }, [processRawLogLine, setIsConnecting]);

  // Keep ref in sync so handleMessage can invoke replayFromCache without
  // a circular useCallback dependency.
  replayFromCacheRef.current = replayFromCache;

  /**
   * Replay the non-pinned temp log (LOG_PREFIX) for a session.
   * Returns the number of lines replayed so the caller can set the live skip count.
   * Call AFTER clearEntries() and BEFORE subscribing to the server for instant display.
   */
  const replayFromTempLog = useCallback((sessionId: string): number => {
    const content = getLog(sessionId);
    if (!content) return 0;
    const lines = content.split("\n").filter((l) => l.trim());
    for (const line of lines) {
      processRawLogLine(line);
    }
    return lines.length;
  }, [processRawLogLine]);

  const isTtlExpired = streamEnded && streamError !== null && TTL_ERROR_PATTERN.test(streamError);
  const isNodeUnreachable = streamEnded && streamError !== null && NODE_UNREACHABLE_PATTERN.test(streamError);

  return {
    entries,
    activeSessionId,
    setActiveSessionId,
    clearEntries,
    handleMessage,
    replayFromCache,
    replayFromTempLog,
    setLiveSkipCount,
    streamError,
    streamEnded,
    isTtlExpired,
    isNodeUnreachable,
    replayedFromCache,
    isConnecting,
    isPodStarting,
    showPodStartTimeout,
  };
}
