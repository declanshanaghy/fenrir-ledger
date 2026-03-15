import { useState, useCallback, useRef } from "react";
import type { ServerMessage, JsonEvent, ContentBlock } from "../lib/types";
import { parseJsonlLine } from "../lib/jsonl";

export interface LogEntry {
  id: string;
  type: "system" | "turn-divider" | "assistant-text" | "tool-use" | "tool-result" | "raw" | "error" | "stream-end" | "verdict";
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
}

let entryCounter = 0;
function nextId(): string {
  return `log-${++entryCounter}`;
}

export function useLogStream() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const turnNumRef = useRef(0);

  const clearEntries = useCallback(() => {
    setEntries([]);
    turnNumRef.current = 0;
    entryCounter = 0;
  }, []);

  const handleMessage = useCallback((msg: ServerMessage) => {
    if (msg.type === "log-line") {
      const line = msg.line;
      const ev = parseJsonlLine(line);
      if (!ev) {
        if (line.trim()) {
          setEntries((prev) => [...prev, { id: nextId(), type: "raw", text: line }]);
        }
        return;
      }
      processEvent(ev);
    } else if (msg.type === "stream-error") {
      setEntries((prev) => [
        ...prev,
        { id: nextId(), type: "error", message: msg.message },
      ]);
    } else if (msg.type === "stream-end") {
      setEntries((prev) => [
        ...prev,
        { id: nextId(), type: "stream-end", reason: msg.reason },
      ]);
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

    if (ev.type === "assistant" && ev.message?.content) {
      turnNumRef.current++;
      const turnNum = turnNumRef.current;
      const newEntries: LogEntry[] = [
        { id: nextId(), type: "turn-divider", turnNum },
      ];

      for (const block of ev.message.content) {
        if (block.type === "text" && block.text) {
          newEntries.push({
            id: nextId(),
            type: "assistant-text",
            text: block.text,
          });
        } else if (block.type === "tool_use" && block.name) {
          const inputJson = block.input
            ? JSON.stringify(block.input, null, 2).slice(0, 500)
            : "";
          newEntries.push({
            id: nextId(),
            type: "tool-use",
            toolId: block.id || undefined,
            toolName: block.name,
            toolInput: inputJson,
          });
        }
      }

      setEntries((prev) => [...prev, ...newEntries]);
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

            // Find the matching tool-use entry and attach result
            for (let i = updated.length - 1; i >= 0; i--) {
              if (
                updated[i].type === "tool-use" &&
                updated[i].toolId === block.tool_use_id
              ) {
                updated[i] = {
                  ...updated[i],
                  toolResult: text,
                  toolIsError: block.is_error || false,
                };
                break;
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
  };
}
