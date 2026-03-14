/**
 * report.ts — Server-side JSONL parsing and HTML report generation for Odin's Throne.
 *
 * Parses Claude Code stream-json JSONL events, detects verdicts, and generates
 * a brandified HTML report using the Fenrir Ledger theme.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JsonEvent {
  type: string;
  subtype?: string;
  message?: {
    id?: string;
    role?: string;
    content?: ContentBlock[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input?: Record<string, any>;
  tool_use_id?: string;
  content?: string | ContentBlock[];
  is_error?: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: Record<string, any>;
  result?: string;
  isError?: boolean;
}

export interface Turn {
  turnNum: number;
  texts: string[];
  tools: ToolCall[];
}

export interface Verdict {
  pass: boolean;
  text: string;
}

export interface ReportMeta {
  sessionId: string;
  model?: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  startTime?: number;
  endTime?: number;
}

// ---------------------------------------------------------------------------
// JSONL parsing
// ---------------------------------------------------------------------------

/**
 * Strip a Kubernetes log timestamp prefix if present.
 * Format: "2024-01-01T00:00:00.000000000Z <json>"
 */
function stripK8sTimestamp(line: string): string {
  const match = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s+(.*)$/.exec(line);
  return match ? match[1] : line;
}

/** Parse a single raw log line into a JsonEvent, or null if not valid JSON. */
export function parseJsonlLine(rawLine: string): JsonEvent | null {
  const line = stripK8sTimestamp(rawLine.trim());
  if (!line || !line.startsWith("{")) return null;
  try {
    return JSON.parse(line) as JsonEvent;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Turn extraction
// ---------------------------------------------------------------------------

/** Build Turn objects from a list of JsonEvents. */
export function extractTurns(events: JsonEvent[]): Turn[] {
  const toolResults = new Map<string, { content: string; isError: boolean }>();

  // Collect tool results from user messages
  for (const ev of events) {
    if (ev.type !== "user" || !ev.message?.content) continue;
    for (const block of ev.message.content) {
      if (block.type === "tool_result" && block.tool_use_id) {
        const raw = block.content;
        const content =
          typeof raw === "string"
            ? raw
            : Array.isArray(raw)
              ? raw
                  .filter((b: ContentBlock) => b.type === "text")
                  .map((b: ContentBlock) => b.text ?? "")
                  .join("")
              : "";
        toolResults.set(block.tool_use_id, {
          content,
          isError: block.is_error ?? false,
        });
      }
    }
  }

  const turns: Turn[] = [];
  let turnNum = 0;

  for (const ev of events) {
    if (ev.type !== "assistant" || !ev.message?.content) continue;
    turnNum++;
    const turn: Turn = { turnNum, texts: [], tools: [] };

    for (const block of ev.message.content) {
      if (block.type === "text" && block.text) {
        turn.texts.push(block.text);
      } else if (block.type === "tool_use" && block.id && block.name) {
        const res = toolResults.get(block.id);
        turn.tools.push({
          id: block.id,
          name: block.name,
          input: block.input ?? {},
          result: res?.content,
          isError: res?.isError,
        });
      }
    }

    turns.push(turn);
  }

  return turns;
}

// ---------------------------------------------------------------------------
// Verdict detection
// ---------------------------------------------------------------------------

/** Detect PASS/FAIL verdict from turns, mirroring generate-agent-report.mjs logic. */
export function detectVerdict(events: JsonEvent[]): Verdict | null {
  const turns = extractTurns(events);
  let verdict: Verdict | null = null;

  for (const t of turns) {
    for (const text of t.texts) {
      if (/Loki QA Verdict/i.test(text) || /\*\*Verdict:\*\*/i.test(text)) {
        verdict = { text, pass: /PASS/i.test(text) };
      }
    }
    for (const tool of t.tools) {
      if (tool.name === "Bash" && tool.input?.command) {
        const cmd = String(tool.input.command);
        if (/Loki QA Verdict/i.test(cmd)) {
          const bodyMatch = cmd.match(/--body\s+["']?([\s\S]*?)(?:["']?\s*$)/);
          const body = bodyMatch ? bodyMatch[1] : cmd;
          verdict = { text: body, pass: /PASS/i.test(cmd) };
        }
      }
    }
  }

  return verdict;
}

// ---------------------------------------------------------------------------
// Report metadata extraction
// ---------------------------------------------------------------------------

export function extractMeta(events: JsonEvent[], sessionId: string): ReportMeta {
  const meta: ReportMeta = {
    sessionId,
    totalInputTokens: 0,
    totalOutputTokens: 0,
  };

  for (const ev of events) {
    if (ev.type === "system" && ev.subtype === "init" && ev.model) {
      meta.model = String(ev.model);
    }
    if (ev.type === "assistant" && ev.message?.usage) {
      meta.totalInputTokens += ev.message.usage.input_tokens ?? 0;
      meta.totalOutputTokens += ev.message.usage.output_tokens ?? 0;
    }
  }

  // Timestamps from system events
  const systemEv = events.find((e) => e.type === "system");
  const lastEv = [...events].reverse().find((e) => e.type === "assistant");
  if (systemEv?.timestamp) meta.startTime = new Date(systemEv.timestamp as string).getTime();
  if (lastEv?.timestamp) meta.endTime = new Date(lastEv.timestamp as string).getTime();

  return meta;
}

// ---------------------------------------------------------------------------
// HTML escaping
// ---------------------------------------------------------------------------

function esc(s: unknown): string {
  const str = typeof s === "string" ? s : JSON.stringify(s, null, 2) ?? "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Tool input preview
// ---------------------------------------------------------------------------

function toolInputPreview(tool: ToolCall): string {
  if (tool.name === "Bash" && tool.input?.command) {
    return esc(String(tool.input.command).slice(0, 160));
  }
  if (tool.name === "Read" && tool.input?.file_path) {
    return esc(String(tool.input.file_path));
  }
  if ((tool.name === "Edit" || tool.name === "Write") && tool.input?.file_path) {
    return esc(String(tool.input.file_path));
  }
  if (tool.name === "Grep" && tool.input?.pattern) {
    return esc(String(tool.input.pattern));
  }
  if (tool.name === "Glob" && tool.input?.pattern) {
    return esc(String(tool.input.pattern));
  }
  const keys = Object.keys(tool.input ?? {});
  if (keys.length > 0) {
    const first = tool.input[keys[0]];
    return esc(String(first).slice(0, 100));
  }
  return "";
}

function toolBadgeClass(name: string): string {
  const n = name.toLowerCase();
  if (n === "bash") return "bash";
  if (n === "read" || n === "grep" || n === "glob") return "read";
  if (n === "edit" || n === "multiedit") return "edit";
  if (n === "write") return "write";
  if (n === "todowrite" || n === "todoupdate") return "todo";
  return "";
}

// ---------------------------------------------------------------------------
// HTML report generation
// ---------------------------------------------------------------------------

/** Generate a complete brandified HTML report from accumulated JSONL events. */
export function generateReportHtml(events: JsonEvent[], sessionId: string): string {
  const turns = extractTurns(events);
  const verdict = detectVerdict(events);
  const meta = extractMeta(events, sessionId);

  const totalTurns = turns.length;
  const totalTools = turns.reduce((s, t) => s + t.tools.length, 0);

  function renderTurn(t: Turn): string {
    const toolsHtml = t.tools
      .map((tool) => {
        const badgeClass = toolBadgeClass(tool.name);
        const preview = toolInputPreview(tool);
        const resultSnippet = tool.result
          ? esc(tool.result.slice(0, 300)) + (tool.result.length > 300 ? "…" : "")
          : "";
        return `<div class="tool-block${tool.isError ? " tool-error" : ""}">
  <div class="tool-header">
    <span class="tool-badge${badgeClass ? " " + badgeClass : ""}">${esc(tool.name)}</span>
    <span class="tool-preview">${preview}</span>
  </div>
  ${resultSnippet ? `<div class="tool-result">${resultSnippet}</div>` : ""}
</div>`;
      })
      .join("");

    const textsHtml = t.texts
      .map(
        (text) =>
          `<div class="turn-text"><pre>${esc(text.slice(0, 2000))}${text.length > 2000 ? "\n…" : ""}</pre></div>`
      )
      .join("");

    return `<div class="turn">
  <div class="turn-header" aria-label="Turn ${t.turnNum}">
    <span class="turn-num">${t.turnNum}</span>
    <span class="turn-tools-count">${t.tools.length} tool${t.tools.length !== 1 ? "s" : ""}</span>
    <span class="chevron">›</span>
  </div>
  <div class="turn-body">
    ${textsHtml}
    ${toolsHtml}
  </div>
</div>`;
  }

  const turnsHtml = turns.map(renderTurn).join("\n");

  const verdictHtml = verdict
    ? `<div class="verdict ${verdict.pass ? "pass" : "fail"}" aria-label="Verdict: ${verdict.pass ? "PASS" : "FAIL"}">
  <h2>${verdict.pass ? "✓ PASS" : "✗ FAIL"}</h2>
  <pre>${esc(verdict.text.slice(0, 1000))}</pre>
</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Agent Report — ${esc(sessionId)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Cinzel+Decorative:wght@400;700;900&family=Source+Serif+4:wght@300;400;600&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root {
  --void: #07070d; --forge: #12121f; --chain: #1a1a2e;
  --gold: #c9920a; --gold-bright: #f0b429;
  --text-saga: #f5f5f5; --text-rune: #a0a0b0; --text-void: #606070;
  --rune-border: #2a2a3e;
  --teal-asgard: #4ecdc4; --fire-muspel: #c94a0a; --red-rag: #ef4444;
}
* { margin:0; padding:0; box-sizing:border-box; }
body { background:var(--void); color:var(--text-saga); font-family:'Source Serif 4',serif; padding:2rem 1.5rem 4rem; }
.report { max-width:1000px; margin:0 auto; }
h1 { font-family:'Cinzel Decorative',serif; font-size:1.6rem; color:var(--gold); margin-bottom:.5rem; }
.meta { font-family:'JetBrains Mono',monospace; font-size:.75rem; color:var(--text-rune); margin-bottom:1.5rem; display:flex; flex-wrap:wrap; gap:1rem; }
.meta span { white-space:nowrap; }
.stats { display:flex; gap:1rem; flex-wrap:wrap; margin-bottom:1.5rem; }
.stat-box { background:var(--forge); border:1px solid var(--rune-border); border-radius:4px; padding:.6rem 1rem; font-family:'JetBrains Mono',monospace; font-size:.8rem; }
.stat-box .label { color:var(--text-void); font-size:.65rem; display:block; margin-bottom:.15rem; }
.stat-box .val { color:var(--gold-bright); font-size:1rem; font-weight:600; }
.turn { border:1px solid var(--rune-border); border-radius:4px; margin-bottom:.5rem; overflow:hidden; }
.turn-header { display:flex; align-items:center; gap:.75rem; padding:.5rem .75rem; cursor:pointer; background:var(--forge); user-select:none; }
.turn-header:hover { background:var(--chain); }
.turn-num { font-family:'Cinzel',serif; font-size:.7rem; color:var(--text-void); min-width:2rem; }
.turn-tools-count { font-family:'JetBrains Mono',monospace; font-size:.7rem; color:var(--text-rune); flex:1; }
.chevron { color:var(--gold); transition:transform .15s; }
.turn.open .chevron { transform:rotate(90deg); }
.turn-body { display:none; padding:.75rem; border-top:1px solid var(--rune-border); background:var(--void); }
.turn.open .turn-body { display:block; }
.turn-text pre { font-size:.75rem; font-family:'JetBrains Mono',monospace; white-space:pre-wrap; word-break:break-word; color:var(--text-rune); margin-bottom:.5rem; }
.tool-block { background:var(--forge); border:1px solid var(--rune-border); border-radius:3px; margin-bottom:.35rem; overflow:hidden; }
.tool-block.tool-error { border-color:var(--fire-muspel); }
.tool-header { display:flex; align-items:center; gap:.5rem; padding:.35rem .6rem; }
.tool-badge { font-family:'JetBrains Mono',monospace; font-size:.65rem; padding:.1rem .4rem; border-radius:2px; background:var(--chain); color:var(--text-rune); }
.tool-badge.bash { background:#1a2a1a; color:#4ade80; }
.tool-badge.read { background:#1a1a2a; color:var(--teal-asgard); }
.tool-badge.edit { background:#2a1a2a; color:#c084fc; }
.tool-badge.write { background:#2a1a1a; color:#fb923c; }
.tool-badge.todo { background:#2a2a1a; color:var(--gold-bright); }
.tool-preview { font-family:'JetBrains Mono',monospace; font-size:.65rem; color:var(--text-void); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; }
.tool-result { font-family:'JetBrains Mono',monospace; font-size:.65rem; color:var(--text-void); padding:.35rem .6rem; border-top:1px solid var(--rune-border); white-space:pre-wrap; word-break:break-word; max-height:120px; overflow-y:auto; }
.verdict { border:1px solid var(--rune-border); border-radius:4px; padding:1rem 1.25rem; margin-bottom:1.5rem; }
.verdict.pass { border-color:var(--teal-asgard); }
.verdict.pass h2 { color:var(--teal-asgard); font-family:'Cinzel',serif; font-size:1.1rem; margin-bottom:.5rem; }
.verdict.fail { border-color:var(--red-rag); }
.verdict.fail h2 { color:var(--red-rag); font-family:'Cinzel',serif; font-size:1.1rem; margin-bottom:.5rem; }
.verdict pre { font-family:'JetBrains Mono',monospace; font-size:.75rem; white-space:pre-wrap; color:var(--text-rune); }
h2.section { font-family:'Cinzel',serif; font-size:.9rem; color:var(--text-void); margin-bottom:.75rem; margin-top:1.5rem; border-bottom:1px solid var(--rune-border); padding-bottom:.35rem; }
</style>
</head>
<body>
<div class="report" aria-label="Agent report for session ${esc(sessionId)}">
  <h1>Agent Report</h1>
  <div class="meta">
    <span><span style="color:var(--text-void)">session: </span>${esc(sessionId)}</span>
    ${meta.model ? `<span><span style="color:var(--text-void)">model: </span>${esc(meta.model)}</span>` : ""}
    <span><span style="color:var(--text-void)">tokens in: </span>${meta.totalInputTokens.toLocaleString()}</span>
    <span><span style="color:var(--text-void)">tokens out: </span>${meta.totalOutputTokens.toLocaleString()}</span>
  </div>
  <div class="stats" role="list" aria-label="Session statistics">
    <div class="stat-box" role="listitem"><span class="label">Turns</span><span class="val">${totalTurns}</span></div>
    <div class="stat-box" role="listitem"><span class="label">Tool Calls</span><span class="val">${totalTools}</span></div>
  </div>
  ${verdictHtml}
  <h2 class="section">Turns</h2>
  <div id="turns-container" aria-label="Agent turns">
    ${turnsHtml}
  </div>
</div>
<script>
document.querySelectorAll('.turn-header').forEach(h => {
  h.addEventListener('click', () => h.closest('.turn').classList.toggle('open'));
});
</script>
</body>
</html>`;
}
