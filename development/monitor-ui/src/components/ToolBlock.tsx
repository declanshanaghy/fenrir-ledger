import { useState } from "react";
import type { LogEntry } from "../hooks/useLogStream";
import { toolBadgeClass, toolPreview } from "../lib/constants";

interface Props {
  entry: LogEntry;
}

export function ToolBlock({ entry }: Props) {
  const [open, setOpen] = useState(false);
  const cls = toolBadgeClass(entry.toolName || "");
  let parsedInput: Record<string, unknown> | undefined;
  try {
    parsedInput = entry.toolInput ? JSON.parse(entry.toolInput) : undefined;
  } catch {
    // Truncated JSON — skip preview extraction
  }
  const preview = entry.toolName
    ? toolPreview(entry.toolName, parsedInput)
    : "";

  return (
    <div className={`ev-tool${open ? " open" : ""}${entry.toolIsError ? " ev-tool-error" : ""}`}>
      <div className="ev-tool-header" onClick={() => setOpen(!open)}>
        <span className={`ev-tool-badge ${cls}`}>{entry.toolName}</span>
        <span className="ev-tool-preview">{preview}</span>
        <span className="ev-tool-chevron">{"\u203A"}</span>
      </div>
      <div className="ev-tool-body-wrap">
        <div className="ev-tool-body">
          <div className="ev-tool-input">{entry.toolInput}</div>
          {entry.toolResult != null && (
            <div className="ev-tool-result">{entry.toolResult}</div>
          )}
        </div>
      </div>
    </div>
  );
}
