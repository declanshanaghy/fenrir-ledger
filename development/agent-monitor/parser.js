/**
 * Log Parser — Extract JSONL log parsing logic from agent-logs.mjs
 * Parses Claude Code stream-json into readable format
 */

export const COLORS = {
  reset: "#e0e0e0",
  bold: "#fff",
  dim: "#666",
  italic: "#999",
  agent: "#cb6d5d",
  agentLabel: "#e74c3c",
  tool: "#72a272",
  toolLabel: "#27ae60",
  result: "#41a241",
  think: "#8d7dd9",
  system: "#626262",
  error: "#c4403c",
  header: "#dca547",
  done: "#dfd463",
};

/**
 * Truncate a string to a maximum length
 */
export function trunc(s, n = 200) {
  if (!s) return "";
  s = String(s);
  return s.length > n ? s.slice(0, n) + "…" : s;
}

/**
 * Strip Markdown formatting for terminal/plain text display
 */
export function stripMd(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")     // bold
    .replace(/\*(.+?)\*/g, "$1")         // italic
    .replace(/`([^`]+)`/g, "$1")         // inline code
    .replace(/^#{1,6}\s+/gm, "")         // headings
    .replace(/^\s*[-*]\s+/gm, "  • ")    // list items
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); // links
}

/**
 * Extract a human-friendly summary from a tool_use block
 */
export function toolSummary(block) {
  const name = block.name;
  const input = block.input || {};

  switch (name) {
    case "Bash":
      return input.description || trunc(input.command, 60);
    case "Read":
      return (input.file_path || "").replace(/^\/workspace\/repo\//, "");
    case "Write":
      return (input.file_path || "").replace(/^\/workspace\/repo\//, "");
    case "Edit":
      return (input.file_path || "").replace(/^\/workspace\/repo\//, "");
    case "Glob":
      return input.pattern || "";
    case "Grep":
      return `/${input.pattern || ""}/ ${input.glob || input.path || ""}`.trim();
    case "Agent":
      return input.description || input.subagent_type || "";
    case "TodoWrite":
      return `${(input.todos || []).length} todos`;
    case "Skill":
      return input.skill || "";
    default:
      const vals = Object.values(input).filter(v => typeof v === "string" && v.length > 0);
      return trunc(vals[0] || "", 60);
  }
}

/**
 * Parse a session ID from a job name
 * Format: agent-issue-{num}-step{num}-{agent}-{uuid}
 */
export function parseSessionId(jobName) {
  const sid = jobName.replace(/^agent-/, "");
  const m = sid.match(/^issue-(\d+)-step(\d+)-([a-z]+)-/);
  return m ? { issue: m[1], step: m[2], agent: m[3] } : { issue: "?", step: "?", agent: "?" };
}

/**
 * Format a single JSONL line into display fragments
 * Returns an array of { type, icon, label, content, color } objects
 */
export function formatLine(obj) {
  const fragments = [];

  if (obj.type === "system") {
    if (obj.subtype === "init" && obj.model) {
      fragments.push({
        type: "system",
        icon: "⚙",
        label: "System",
        content: [obj.model + " connected"],
        color: COLORS.system,
      });
    }
  }

  else if (obj.type === "assistant" && obj.message?.content) {
    for (const block of obj.message.content) {
      if (block.type === "text" && block.text?.trim()) {
        const clean = stripMd(block.text.trim());
        const lines = clean.split("\n").filter(l => l.trim());
        fragments.push({
          type: "agent",
          icon: "🤖",
          label: "Agent",
          content: lines,
          color: COLORS.agent,
        });
      } else if (block.type === "tool_use") {
        const summary = toolSummary(block);
        const label = summary ? `${block.name}: ${summary}` : block.name;
        fragments.push({
          type: "tool",
          icon: "🔧",
          label: "Tools",
          content: [label],
          color: COLORS.tool,
        });
      } else if (block.type === "thinking") {
        const text = trunc(block.thinking || "(signed)", 300);
        fragments.push({
          type: "thinking",
          icon: "💭",
          label: "Thinking",
          content: [text],
          color: COLORS.think,
        });
      }
    }
  }

  else if (obj.type === "tool_result") {
    const content = trunc(typeof obj.content === "string" ? obj.content : JSON.stringify(obj.content), 150);
    fragments.push({
      type: "result",
      icon: "←",
      label: "Result",
      content: [content],
      color: COLORS.result,
    });
  }

  else if (obj.type === "result") {
    const cost = obj.cost_usd != null ? `$${Number(obj.cost_usd).toFixed(2)}` : "?";
    const dur = obj.duration_seconds != null ? `${Math.round(obj.duration_seconds / 60)}m` : "?";
    const turns = obj.num_turns ?? "?";
    fragments.push({
      type: "session_complete",
      icon: "🏁",
      label: "Session Complete",
      content: [`Cost: ${cost}  Duration: ${dur}  Turns: ${turns}`],
      color: COLORS.done,
    });
  }

  return fragments;
}

/**
 * Process a single JSONL log line and return formatted fragments
 */
export function processLogLine(line) {
  if (!line.startsWith("{")) {
    // Non-JSON line — return as plain text
    return { type: "plain", content: line };
  }

  try {
    const obj = JSON.parse(line);
    const formatted = formatLine(obj);
    return { type: "formatted", fragments: formatted };
  } catch (err) {
    // Malformed JSON — skip
    return { type: "error", content: `Failed to parse: ${err.message}` };
  }
}
