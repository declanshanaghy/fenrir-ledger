import { useState, useCallback, useRef } from "react";
import type { ServerMessage, JsonEvent, ContentBlock } from "../lib/types";
import { parseJsonlLine } from "../lib/jsonl";
import { batchSummary } from "../lib/constants";

export interface LogEntry {
  id: string;
  type: "system" | "turn-divider" | "assistant-text" | "tool-use" | "tool-result" | "tool-batch" | "raw" | "error" | "warning" | "stream-end" | "verdict" | "entrypoint-header" | "entrypoint-ok" | "entrypoint-info" | "entrypoint-task" | "entrypoint-group";
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

function parseEntrypointLine(line: string): LogEntry {
  // === Headers ===
  if (/^===.*===$/.test(line)) {
    return { id: nextId(), type: "entrypoint-header", text: line.replace(/^=+\s*|\s*=+$/g, "") };
  }
  // [ok] lines
  if (line.startsWith("[ok]")) {
    return { id: nextId(), type: "entrypoint-ok", text: line.slice(5) };
  }
  // Key: Value lines (Session:, Branch:, Model:)
  const kvMatch = /^(Session|Branch|Model|Working directory):\s*(.+)$/.exec(line);
  if (kvMatch) {
    return { id: nextId(), type: "entrypoint-info", detail: kvMatch[1]!, text: kvMatch[2]! };
  }
  // --- TASK PROMPT --- / --- END PROMPT ---
  if (/^---\s*(TASK PROMPT|END PROMPT)\s*---$/.test(line)) {
    return { id: nextId(), type: "entrypoint-header", text: line.replace(/^-+\s*|\s*-+$/g, "") };
  }
  // Task prompt content (between TASK PROMPT and END PROMPT)
  if (line.startsWith("You are ")) {
    return { id: nextId(), type: "entrypoint-task", text: line };
  }
  // Noise lines we can dim
  if (/^(Cloning|Switched to|branch '|From |Already|Current branch|added \d|Run |Some issues|\d+ (packages|high))/.test(line)) {
    return { id: nextId(), type: "raw", text: line };
  }
  // Status lines (Waiting for DNS, etc)
  if (/^(Waiting|remote:)/.test(line)) {
    return { id: nextId(), type: "raw", text: line };
  }
  return { id: nextId(), type: "raw", text: line };
}

export function useLogStream() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [terminalError, setTerminalError] = useState<string | null>(null);
  const taskPromptBuffer = useRef<string[]>([]);
  const inTaskPrompt = useRef(false);

  const clearEntries = useCallback(() => {
    setEntries([]);
    setTerminalError(null);
    entryCounter = 0;
    taskPromptBuffer.current = [];
    inTaskPrompt.current = false;
  }, []);

  const handleMessage = useCallback((msg: ServerMessage) => {
    if (msg.type === "log-line") {
      const line = msg.line;
      const ev = parseJsonlLine(line);
      if (!ev) {
        if (line.trim()) {
          const trimmed = line.trim();

          // Task prompt buffering
          if (/^---\s*TASK PROMPT\s*---$/.test(trimmed)) {
            inTaskPrompt.current = true;
            taskPromptBuffer.current = [];
            return;
          }
          if (/^---\s*END PROMPT\s*---$/.test(trimmed)) {
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
            taskPromptBuffer.current.push(trimmed);
            return;
          }

          // When "Starting Claude Code" appears, collapse all prior entries into a group
          if (/^===\s*Starting Claude Code\s*===/.test(trimmed)) {
            setEntries((prev) => {
              const group: LogEntry = {
                id: nextId(),
                type: "entrypoint-group",
                text: "Agent Sandbox Setup",
                children: [...prev],
              };
              return [group, parseEntrypointLine(trimmed)];
            });
          } else {
            const entry = parseEntrypointLine(trimmed);
            setEntries((prev) => [...prev, entry]);
          }
        }
        return;
      }
      processEvent(ev);
    } else if (msg.type === "stream-error") {
      setTerminalError(msg.message);
      setEntries((prev) => [
        ...prev,
        { id: nextId(), type: "error", message: msg.message },
      ]);
    } else if (msg.type === "stream-end") {
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

  return {
    entries,
    activeSessionId,
    setActiveSessionId,
    clearEntries,
    handleMessage,
    terminalError,
  };
}
