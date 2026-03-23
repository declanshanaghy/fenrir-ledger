#!/usr/bin/env node
/**
 * generate-agent-report.mjs — Converts Claude Code stream-json agent logs
 * into MDX chronicles for publishing at /chronicles/agent-{slug}.
 *
 * Usage:
 *   node generate-agent-report.mjs --input <log-file> [--blog-dir <dir>]
 *
 * Output: MDX file in content/blog/ with plain HTML (not JSX).
 * For saga (multi-log) input, run combine-saga.mjs first, then pass the
 * combined log to --input.
 */

import { readFileSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { sanitizeText, sanitizeToolOutput } from "./sanitize-chronicle.mjs";
import {
  AGENT_SIGNOFFS,
  AGENT_CALLBACK_QUOTES,
  AGENT_CALLBACK_RUNES,
  AGENT_RUNE_NAMES,
  AGENT_TITLES as AGENT_ROLE_TITLES,
  parseDecreeBlock,
} from "./agent-identity.mjs";

// Agent accent colors — matches Odin's Throne constants.ts
const AGENT_COLORS = {
  firemandecko: "#4ecdc4",
  loki: "#a78bfa",
  luna: "#6b8afd",
  freya: "#f0b429",
  heimdall: "#8B5E3C",
  odin: "#c9920a",
};

// Agent display names — inline since we no longer import from mayo-heckler
const AGENT_NAMES = {
  firemandecko: "FiremanDecko",
  loki: "Loki",
  luna: "Luna",
  freya: "Freya",
  heimdall: "Heimdall",
};

// Resolve script directory for relative paths (ESM-safe)
const __scriptDir = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return null;
  return args[i + 1] || true;
}

const inputPath = flag("input");
const blogDir = flag("blog-dir");

if (!inputPath) {
  console.error("Usage: generate-agent-report.mjs --input <log> [--blog-dir <dir>]");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Parse log
// ---------------------------------------------------------------------------
const logFile = resolve(inputPath);
const raw = readFileSync(logFile, "utf-8");
const lines = raw.split("\n");

const entrypointLines = [];
const jsonEvents = [];
let inEntrypoint = true;

for (const rawLine of lines) {
  // Strip kubectl timestamp prefixes (e.g. "2026-03-22T08:08:05.193036383Z ")
  const line = rawLine.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s/, "");
  if (line.startsWith("{")) {
    inEntrypoint = false;
    try {
      jsonEvents.push(JSON.parse(line));
    } catch {}
  } else if (inEntrypoint && line.trim()) {
    entrypointLines.push(line);
  }
}

// ---------------------------------------------------------------------------
// Extract metadata from entrypoint lines, JSON init event, and filename
// ---------------------------------------------------------------------------
function extractMeta(lines, events, filePath) {
  const meta = {};

  // 1. Try entrypoint text lines (GKE logs that include startup output)
  //    Only take the FIRST match for each field — later lines may contain prompt echoes.
  for (const l of lines) {
    if (!meta.session && l.includes("Session:")) meta.session = l.split("Session:")[1].trim();
    if (!meta.branch && l.includes("Branch:")) meta.branch = l.split("Branch:")[1].trim();
    if (!meta.model && l.includes("Model:")) meta.model = l.split("Model:")[1].trim();
  }

  // 2. Extract from system/init JSON event (always present in stream-json logs)
  const initEvent = events.find(e => e.type === "system" && e.subtype === "init");
  if (initEvent) {
    if (!meta.model && initEvent.model) meta.model = initEvent.model;
  }

  // 3. Derive dispatch session ID from filename (e.g. issue-839-step1-firemandecko-08287a1f.log)
  if (filePath) {
    const basename = filePath.split("/").pop().replace(/\.log$/, "");
    // Only use filename as session if it looks like a dispatch session ID
    if (!meta.session && /^issue-\d+-step\d+-\w+-[a-f0-9]+$/.test(basename)) {
      meta.session = basename;
    }
  }

  // 4. Extract branch from git commands in the log (look for branch --show-current output)
  //    Only check the FIRST matching tool result to avoid picking up handoff comments.
  if (!meta.branch) {
    // Build a set of tool_use IDs for "git branch --show-current" commands
    const branchToolIds = new Set();
    for (const ev of events) {
      if (ev.type !== "assistant" || !ev.message?.content) continue;
      for (const b of ev.message.content) {
        if (b.type === "tool_use" && b.name === "Bash" &&
            b.input?.command?.includes("git branch --show-current")) {
          branchToolIds.add(b.id);
        }
      }
    }
    // Find the first tool_result for any of those IDs
    if (branchToolIds.size > 0) {
      for (const ev of events) {
        if (meta.branch) break;
        if (ev.type !== "user" || !ev.message?.content) continue;
        for (const block of ev.message.content) {
          if (block.type !== "tool_result" || !branchToolIds.has(block.tool_use_id)) continue;
          const content = typeof block.content === "string" ? block.content :
            Array.isArray(block.content) ? block.content.map(c => c.text || "").join("") : "";
          // First line of output is the branch name — validate it looks like a branch
          const firstLine = content.split("\n")[0]?.trim();
          if (firstLine && /^[a-zA-Z0-9._\/-]+$/.test(firstLine) && firstLine.includes("/")) {
            meta.branch = firstLine;
          }
          break; // Only check the first result
        }
      }
    }
  }

  return meta;
}
const meta = extractMeta(entrypointLines, jsonEvents, inputPath);

// ---------------------------------------------------------------------------
// Build turns from assistant events
// ---------------------------------------------------------------------------
const toolResults = new Map();
for (const ev of jsonEvents) {
  if (ev.type === "user" && ev.message?.content) {
    for (const block of ev.message.content) {
      if (block.type === "tool_result" && block.tool_use_id) {
        toolResults.set(block.tool_use_id, {
          content: block.content || "",
          is_error: block.is_error || false,
        });
      }
    }
  }
  if (ev.type === "user" && ev.tool_use_result) {
    const parentId = ev.message?.content?.[0]?.tool_use_id;
    if (parentId) {
      toolResults.set(parentId, {
        content: ev.tool_use_result.stdout || ev.tool_use_result.stderr || ev.message?.content?.[0]?.content || "",
        is_error: ev.tool_use_result.stderr && !ev.tool_use_result.stdout,
      });
    }
  }
}

const turns = [];
for (const ev of jsonEvents) {
  if (ev.type !== "assistant" || !ev.message?.content) continue;
  const turn = { thinking: [], texts: [], tools: [], usage: ev.message?.usage || null };
  for (const block of ev.message.content) {
    if (block.type === "thinking" && block.thinking) {
      turn.thinking.push(block.thinking);
    } else if (block.type === "text" && block.text) {
      turn.texts.push(block.text);
    } else if (block.type === "tool_use") {
      const result = toolResults.get(block.id);
      turn.tools.push({
        name: block.name,
        input: block.input,
        id: block.id,
        result_content: result?.content || "",
        is_error: result?.is_error || false,
      });
    }
  }
  if (turn.thinking.length || turn.texts.length || turn.tools.length) {
    turns.push(turn);
  }
}

// ---------------------------------------------------------------------------
// Stats — basic
// ---------------------------------------------------------------------------
const totalTools = turns.reduce((s, t) => s + t.tools.length, 0);
const toolCounts = {};
for (const t of turns) for (const tool of t.tools) {
  toolCounts[tool.name] = (toolCounts[tool.name] || 0) + 1;
}
const errors = turns.reduce((s, t) => s + t.tools.filter(x => x.is_error).length, 0);

// ---------------------------------------------------------------------------
// Stats — execution time
// ---------------------------------------------------------------------------
// Use file modification time of the log minus entrypoint start indicators
// Or estimate from entrypoint timestamps and log file stats
let logStats = null;
try {
  const { statSync } = await import("fs");
  logStats = statSync(logFile);
} catch {}

// Parse entrypoint for npm ci duration and total time
let entrypointDurationSec = null;
const npmCiMatch = entrypointLines.find(l => /added \d+ packages.*in (\d+)s/.test(l));
const npmCiDuration = npmCiMatch ? parseInt(npmCiMatch.match(/in (\d+)s/)[1]) : null;

// Estimate execution time from the system event timestamp or file metadata
// The system event has a session_id we can use to correlate
const systemEvent = jsonEvents.find(e => e.type === "system");
const firstAssistant = jsonEvents.find(e => e.type === "assistant");
const lastAssistant = [...jsonEvents].reverse().find(e => e.type === "assistant");

// ---------------------------------------------------------------------------
// Stats — token usage
// ---------------------------------------------------------------------------
let totalInputTokens = 0;
let totalOutputTokens = 0;
let totalCacheCreation = 0;
let totalCacheRead = 0;
const seenMsgIds = new Set();

for (const t of turns) {
  if (!t.usage) continue;
  // Deduplicate by message ID (stream-json emits multiple events per message)
  const msgId = jsonEvents.find(e =>
    e.type === "assistant" && e.message?.usage === t.usage
  )?.message?.id;
  if (msgId && seenMsgIds.has(msgId)) continue;
  if (msgId) seenMsgIds.add(msgId);

  totalInputTokens += t.usage.input_tokens || 0;
  totalOutputTokens += t.usage.output_tokens || 0;
  totalCacheCreation += t.usage.cache_creation_input_tokens || 0;
  totalCacheRead += t.usage.cache_read_input_tokens || 0;
}

// ---------------------------------------------------------------------------
// Stats — files touched
// ---------------------------------------------------------------------------
const filesCreated = new Set();
const filesModified = new Set();
const filesRead = new Set();

for (const t of turns) {
  for (const tool of t.tools) {
    const fp = tool.input?.file_path;
    if (tool.name === "Write" && fp) filesCreated.add(fp);
    if (tool.name === "Edit" && fp) filesModified.add(fp);
    if (tool.name === "Read" && fp) filesRead.add(fp);
  }
}
// Files that were both written and edited — classify as created
for (const f of filesCreated) filesModified.delete(f);

// Strip /workspace/repo/ prefix for display
function shortPath(p) {
  return p.replace(/^\/workspace\/repo\//, "");
}

// ---------------------------------------------------------------------------
// Stats — git commits
// ---------------------------------------------------------------------------
const commits = [];
for (const t of turns) {
  for (const tool of t.tools) {
    if (tool.name !== "Bash") continue;
    const cmd = tool.input?.command || "";
    const commitMatch = cmd.match(/git commit -m ['"]([^'"]+)['"]/);
    if (commitMatch) {
      commits.push(commitMatch[1]);
    }
  }
}

// ---------------------------------------------------------------------------
// Stats — git pushes
// ---------------------------------------------------------------------------
let pushCount = 0;
for (const t of turns) {
  for (const tool of t.tools) {
    if (tool.name === "Bash" && /git push/.test(tool.input?.command || "")) {
      pushCount++;
    }
  }
}

// ---------------------------------------------------------------------------
// Stats — tests written (categorize by type)
// ---------------------------------------------------------------------------
const testFiles = {
  vitest: [],   // src/__tests__/**
  e2e: [],      // quality/test-suites/**/*.spec.ts (Playwright)
};

// From Write/Edit tool calls — look at file paths
for (const t of turns) {
  for (const tool of t.tools) {
    const fp = tool.input?.file_path || "";
    if (!fp) continue;
    if (tool.name !== "Write" && tool.name !== "Edit") continue;
    const short = shortPath(fp);
    if (/\.spec\.(ts|tsx|js)$/.test(fp) && /quality\/test-suites/.test(fp)) {
      if (!testFiles.e2e.includes(short)) testFiles.e2e.push(short);
    } else if (/\.test\.(ts|tsx|js)$/.test(fp) && /(__tests__|src\/)/.test(fp)) {
      if (!testFiles.vitest.includes(short)) testFiles.vitest.push(short);
    }
  }
}

// Count individual test cases from file content (Write tool)
function countTestCases(content) {
  if (!content) return { unit: 0, component: 0, integration: 0, total: 0 };
  const itMatches = (content.match(/\b(it|test)\s*\(/g) || []).length;
  // Heuristic categorization based on content patterns
  const hasRender = /render\s*\(/.test(content) || /screen\./.test(content);
  const hasApi = /fetch|api|route|handler|request|response/i.test(content);
  const hasComponent = /Component|jsx|tsx|<[A-Z]/.test(content);

  let component = 0, integration = 0, unit = 0;
  if (hasRender || hasComponent) {
    component = itMatches;
  } else if (hasApi) {
    integration = itMatches;
  } else {
    unit = itMatches;
  }
  return { unit, component, integration, total: itMatches };
}

// Count Playwright test cases
function countPlaywrightTests(content) {
  if (!content) return 0;
  return (content.match(/\btest\s*\(/g) || []).length;
}

// Extract test counts from Write tool calls
let vitestCounts = { unit: 0, component: 0, integration: 0, total: 0 };
let playwrightCount = 0;

for (const t of turns) {
  for (const tool of t.tools) {
    if (tool.name !== "Write") continue;
    const fp = tool.input?.file_path || "";
    const content = tool.input?.content || "";
    if (/\.test\.(ts|tsx|js)$/.test(fp)) {
      const counts = countTestCases(content);
      vitestCounts.unit += counts.unit;
      vitestCounts.component += counts.component;
      vitestCounts.integration += counts.integration;
      vitestCounts.total += counts.total;
    }
    if (/\.spec\.(ts|tsx|js)$/.test(fp)) {
      playwrightCount += countPlaywrightTests(content);
    }
  }
}

// Also scan test results from Bash outputs for pass/fail counts
let testsPassed = 0;
let testsFailed = 0;
let testsSkipped = 0;

for (const t of turns) {
  for (const tool of t.tools) {
    if (tool.name !== "Bash") continue;
    const output = typeof tool.result_content === "string" ? tool.result_content : "";
    // Vitest output: "Tests  14 passed (14)"
    const vitestMatch = output.match(/Tests?\s+(\d+)\s+passed/);
    if (vitestMatch) testsPassed = Math.max(testsPassed, parseInt(vitestMatch[1]));
    const vitestFail = output.match(/(\d+)\s+failed/);
    if (vitestFail) testsFailed = Math.max(testsFailed, parseInt(vitestFail[1]));
    // Playwright: "5 passed" or "3 passed, 2 failed"
    const pwPass = output.match(/(\d+)\s+passed/);
    if (pwPass && /playwright|spec/.test(tool.input?.command || "")) {
      testsPassed = Math.max(testsPassed, parseInt(pwPass[1]));
    }
    const pwFail = output.match(/(\d+)\s+failed/);
    if (pwFail && /playwright|spec/.test(tool.input?.command || "")) {
      testsFailed = Math.max(testsFailed, parseInt(pwFail[1]));
    }
    const skipMatch = output.match(/(\d+)\s+skipped/);
    if (skipMatch) testsSkipped = Math.max(testsSkipped, parseInt(skipMatch[1]));
  }
}

// ---------------------------------------------------------------------------
// Stats — verify runs
// ---------------------------------------------------------------------------
let tscRuns = 0, tscPass = 0, tscFail = 0;
let buildRuns = 0, buildPass = 0, buildFail = 0;

for (const t of turns) {
  for (const tool of t.tools) {
    if (tool.name !== "Bash") continue;
    const cmd = tool.input?.command || "";
    if (/verify\.sh\s+--step\s+tsc/.test(cmd)) {
      tscRuns++;
      if (tool.is_error) tscFail++; else tscPass++;
    }
    if (/verify\.sh\s+--step\s+build/.test(cmd)) {
      buildRuns++;
      if (tool.is_error) buildFail++; else buildPass++;
    }
  }
}

// ---------------------------------------------------------------------------
// Stats — rate limit events
// ---------------------------------------------------------------------------
const rateLimitEvents = jsonEvents.filter(e => e.type === "rate_limit_event").length;

// ---------------------------------------------------------------------------
// Stats — thinking characters (reasoning effort indicator)
// ---------------------------------------------------------------------------
const totalThinkingChars = turns.reduce((s, t) =>
  s + t.thinking.reduce((ss, th) => ss + th.length, 0), 0);

// ---------------------------------------------------------------------------
// Detect verdict
// ---------------------------------------------------------------------------
let verdict = null;
for (const t of turns) {
  for (const text of t.texts) {
    if (/Loki QA Verdict/i.test(text) || /\*\*Verdict:\*\*/i.test(text)) {
      verdict = { text, pass: /PASS/i.test(text) };
    }
  }
  for (const tool of t.tools) {
    if (tool.name === "Bash" && tool.input?.command) {
      const cmd = tool.input.command;
      if (/Loki QA Verdict/i.test(cmd)) {
        const bodyMatch = cmd.match(/--body\s+["']?([\s\S]*?)(?:["']?\s*$)/);
        const body = bodyMatch ? bodyMatch[1] : cmd;
        verdict = { text: body, pass: /PASS/i.test(cmd) };
      }
    }
  }
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------
function esc(s) {
  if (typeof s !== "string") s = JSON.stringify(s, null, 2) || "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toolBadgeClass(name) {
  const n = name.toLowerCase();
  if (n === "bash") return "badge-bash";
  if (n === "read" || n === "grep" || n === "glob") return "badge-read";
  if (n === "edit" || n === "multiedit") return "badge-edit";
  if (n === "write") return "badge-write";
  if (n === "todowrite" || n === "todoupdate") return "badge-todo";
  return "";
}

// ---------------------------------------------------------------------------
// Tool categorisation — ported from Odin's Throne constants.ts
// ---------------------------------------------------------------------------
function toolCategory(name, input) {
  const cmd = String(input?.command ?? "");
  if (name === "TodoWrite" || name === "TodoUpdate") return "tracking";
  if (name === "Read" || name === "Grep" || name === "Glob") return "reading";
  if (name === "Edit" || name === "MultiEdit") return "editing";
  if (name === "Write") return "writing";
  if (name === "Agent") return "delegating";
  if (name === "Bash") {
    if (/git\s+(add|commit|push)/.test(cmd)) return "committing";
    if (/git\s+(fetch|rebase|pull|merge)/.test(cmd)) return "syncing";
    if (/git\s+(log|diff|status|branch)/.test(cmd)) return "inspecting";
    if (/verify\.sh|tsc|--noEmit/.test(cmd)) return "verifying";
    if (/vitest|playwright|jest/.test(cmd)) return "testing";
    if (/next\s+build|npm\s+run\s+build/.test(cmd)) return "building";
    if (/gh\s+issue/.test(cmd)) return "issue ops";
    if (/gh\s+pr/.test(cmd)) return "PR ops";
    if (/npm\s+(ci|install)|npx/.test(cmd)) return "installing";
    if (/curl|wget/.test(cmd)) return "fetching";
    if (/kubectl|helm/.test(cmd)) return "k8s ops";
    if (/rm\s+-rf|mkdir/.test(cmd)) return "cleanup";
  }
  return name.toLowerCase();
}

function batchSummary(tools) {
  const categories = {};
  for (const t of tools) {
    const cat = toolCategory(t.name, t.input);
    categories[cat] = (categories[cat] || 0) + 1;
  }
  const parts = Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => count > 1 ? `${count} ${cat}` : cat);
  return parts.join(", ");
}

function toolInputPreview(tool) {
  function singleLine(s) { return s.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim(); }
  if (tool.name === "Bash" && tool.input?.command) return esc(singleLine(tool.input.description || tool.input.command.slice(0, 100)));
  if (tool.name === "Read" && tool.input?.file_path) return esc(shortPath(tool.input.file_path));
  if (tool.name === "Edit" && tool.input?.file_path) return esc(shortPath(tool.input.file_path));
  if (tool.name === "Write" && tool.input?.file_path) return esc(shortPath(tool.input.file_path));
  if (tool.name === "Grep" && tool.input?.pattern) return esc(singleLine(tool.input.pattern));
  if (tool.name === "Glob" && tool.input?.pattern) return esc(singleLine(tool.input.pattern));
  if (tool.name === "TodoWrite") return "update todos";
  return "";
}

function renderToolInput(tool) {
  if (tool.name === "Bash") return sanitizeText(tool.input?.command || "");
  if (tool.name === "Edit") {
    const parts = [];
    if (tool.input?.file_path) parts.push(`File: ${shortPath(tool.input.file_path)}`);
    if (tool.input?.old_string) parts.push(`--- old\n${tool.input.old_string.slice(0, 500)}`);
    if (tool.input?.new_string) parts.push(`+++ new\n${tool.input.new_string.slice(0, 500)}`);
    return sanitizeText(parts.join("\n\n"));
  }
  return sanitizeText(JSON.stringify(tool.input, null, 2));
}

function renderToolOutput(tool) {
  const content = tool.result_content;
  const raw = typeof content === "string" ? content : JSON.stringify(content, null, 2);
  return sanitizeToolOutput(raw, 800);
}

function renderEntrypointLine(line) {
  if (/^===.*===$/.test(line)) {
    const text = line.replace(/^=+\s*|\s*=+$/g, "");
    return `<div class="ep-header">${esc(text)}</div>`;
  }
  if (/^---.*---$/.test(line)) {
    const text = line.replace(/^-+\s*|\s*-+$/g, "");
    return `<div class="ep-header">${esc(text)}</div>`;
  }
  if (line.startsWith("[FATAL]")) {
    return `<div class="ep-fatal">${esc(line.slice(7).trim())}</div>`;
  }
  if (line.startsWith("[WARN]")) {
    return `<div class="ep-warn">${esc(line.slice(6).trim())}</div>`;
  }
  if (line.startsWith("[ok]")) {
    return `<div class="ep-ok"><span class="ep-ok-marker">[ok]</span> ${esc(line.slice(4).trim())}</div>`;
  }
  const kvMatch = /^(Session|Branch|Model|Working directory):\s*(.+)$/.exec(line);
  if (kvMatch) {
    return `<div class="ep-kv"><span class="ep-kv-key">${esc(kvMatch[1])}</span><span class="ep-kv-val">${esc(kvMatch[2])}</span></div>`;
  }
  return `<div class="ep-raw">${esc(line)}</div>`;
}

function renderEntrypoint() {
  // Split into sandbox setup (before --- TASK PROMPT ---) and decree (after)
  const promptIdx = entrypointLines.findIndex(l => /TASK PROMPT/.test(l));
  const setupLines = promptIdx >= 0 ? entrypointLines.slice(0, promptIdx) : entrypointLines;
  const promptLines = promptIdx >= 0 ? entrypointLines.slice(promptIdx + 1) : [];

  const setupBody = setupLines
    .filter(l => l.trim())
    .map(l => renderEntrypointLine(l))
    .join("\n");
  const setupMarkup = `
<details class="entrypoint">
<summary>&#5765; Sandbox Forging</summary>
<div class="ep-body">${setupBody}</div>
</details>`;

  if (promptLines.length === 0) return setupMarkup;

  const rawPrompt = promptLines.join("\n");

  const agentDecreeNames = {
    FiremanDecko: "FiremanDecko, Forgemaster of Midgard",
    Loki: "Loki, Trickster-Tester of the Realms",
    Luna: "Luna, Weaver of the World-Tree's Branches",
    Freya: "Freya, Keeper of the Golden Brisingamen",
    Heimdall: "Heimdall, Watcher at the Rainbow Bridge",
  };
  const decreeName = agentDecreeNames[agentName] || agentName;

  function formatDecree(text) {
    let markup = "";
    const sections = text.split(/(?=\*\*Step \d|SANDBOX RULES|TODO TRACKING|INCREMENTAL COMMIT|VERIFY —|STRICT SCOPE|##)/);

    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed) continue;
      if (/^You are \w+/.test(trimmed)) continue;

      if (/UNBREAKABLE/.test(trimmed)) {
        const title = trimmed.match(/^([A-Z][A-Z\s\u2014\u2013-]+?)[\s:(\n]/)?.[1]?.trim() || "SACRED OATH";
        const body = trimmed.replace(/^[A-Z][A-Z\s\u2014\u2013-]+[\s:(]*\(?UNBREAKABLE\)?:?\s*/i, "").trim();
        markup += `
<div class="decree-section">
<div class="decree-section-title"><span class="glyph">&#9876;</span> ${esc(title)} <span class="decree-oath">&mdash; UNBREAKABLE OATH</span></div>
<div class="decree-law">${esc(body).replace(/\n/g, "<br>")}</div>
</div>`;
        continue;
      }

      const stepMatch = trimmed.match(/^\*\*Step (\d+\w?)[\s\u2014\u2013-]+(.+?)\*\*/);
      if (stepMatch) {
        const stepGlyphs = ["&#5792;","&#5794;","&#5798;","&#5800;","&#5809;","&#5810;","&#5815;","&#5817;","&#5818;"];
        const sn = parseInt(stepMatch[1]) - 1;
        const glyph = stepGlyphs[sn % stepGlyphs.length] || "&#5809;";
        const stepTitle = stepMatch[2].trim();
        const stepBody = trimmed.replace(/^\*\*Step \d+\w?[\s\u2014\u2013-]+.+?\*\*\s*/s, "").trim();
        markup += `
<div class="decree-section">
<div class="decree-section-title"><span class="glyph">${glyph}</span> Step ${stepMatch[1]} &mdash; ${esc(stepTitle)}</div>
<div class="decree-body">${esc(stepBody).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, "<br>")}</div>
</div>`;
        continue;
      }

      if (/^## Description|^##\s+/.test(trimmed)) {
        const body = trimmed.replace(/^##\s+\w+\s*\n?/, "").trim();
        markup += `
<div class="decree-section">
<div class="decree-section-title"><span class="glyph">&#5791;</span> The Matter at Hand</div>
<div class="decree-body">${esc(body).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, "<br>")}</div>
</div>`;
        continue;
      }

      if (/^SANDBOX RULES/.test(trimmed)) {
        const body = trimmed.replace(/^SANDBOX RULES.*?\n/, "").trim();
        markup += `
<div class="decree-section">
<div class="decree-section-title"><span class="glyph">&#5833;</span> Laws of the Sandbox Realm</div>
<div class="decree-law">${esc(body).replace(/\n/g, "<br>")}</div>
</div>`;
        continue;
      }

      if (trimmed.length > 20) {
        markup += `
<div class="decree-section">
<div class="decree-body">${esc(trimmed).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, "<br>")}</div>
</div>`;
      }
    }
    return markup;
  }

  const decreeBody = formatDecree(rawPrompt);

  return setupMarkup + `
<div class="decree">
<div class="decree-header">
<div class="decree-runes">&#5792; &#5794; &#5798; &#5800; &#5809; &#5810; &#5815; &#5817; &#5818; &#5822; &#5825; &#5827;</div>
<div class="decree-title">The All-Father's Decree</div>
<div class="decree-subtitle">Spoken from Hlidskjalf unto ${esc(decreeName)}</div>
</div>
${decreeBody}
<div class="decree-seal">
<div class="decree-seal-glyph">&#5810;</div>
<div class="decree-seal-text">So it is written &middot; So it shall be forged &middot; Issue #${esc(issueNum)}</div>
</div>
</div>`;
}

function fmtNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

// ---------------------------------------------------------------------------
// Metadata derived from session info
// ---------------------------------------------------------------------------
const sessionStr = meta.session || (inputPath ? inputPath.split("/").pop().replace(/\.log$/, "") : "");
const issueMatch = sessionStr.match(/issue-(\d+)/);
const issueNum = issueMatch ? issueMatch[1] : "?";
const agentMatch = sessionStr.match(/step(\d+)-(\w+)/);
const stepNum = agentMatch ? agentMatch[1] : "?";
const agentNameKey = agentMatch ? agentMatch[2] : "agent";
const agentName = AGENT_NAMES[agentNameKey] || (agentMatch ? agentMatch[2].charAt(0).toUpperCase() + agentMatch[2].slice(1) : "Agent");
const agentSlug = {FiremanDecko:'fireman-decko',Loki:'loki',Luna:'luna',Freya:'freya',Heimdall:'heimdall'}[agentName] || agentNameKey;

// Full agent titles
const AGENT_TITLES = {
  FiremanDecko: "FiremanDecko &mdash; Principal Engineer",
  Loki: "Loki &mdash; QA Tester &amp; Devil's Advocate",
  Luna: "Luna &mdash; UX Designer",
  Freya: "Freya &mdash; Product Owner",
  Heimdall: "Heimdall &mdash; Security Specialist",
};
const agentTitle = AGENT_TITLES[agentName] || agentName;

const totalTestsWritten = vitestCounts.total + playwrightCount;

// ---------------------------------------------------------------------------
// Agent callbacks — sourced from agent-identity.mjs (canonical source of truth)
// ---------------------------------------------------------------------------
const agentCallback = {
  quote:   AGENT_CALLBACK_QUOTES[agentName]  ?? AGENT_CALLBACK_QUOTES._fallback  ?? "The task is done. The wolf's chain holds another day.",
  signoff: AGENT_SIGNOFFS[agentName]          ?? AGENT_SIGNOFFS._fallback          ?? "Sealed by the pack",
  runes:   AGENT_CALLBACK_RUNES[agentName]    ?? AGENT_CALLBACK_RUNES._fallback    ?? "&#5792; &#5830; &#5822; &#5809; &#5825; &#5809;",
};

// ---------------------------------------------------------------------------
// Decree Complete parser — scan all turns for DECREE COMPLETE block
// ---------------------------------------------------------------------------
let decree = null;
for (const t of turns) {
  for (const text of t.texts) {
    const parsed = parseDecreeBlock(text);
    if (parsed) { decree = parsed; break; }
  }
  if (decree) break;
}

// ---------------------------------------------------------------------------
// Build MDX chronicle
// ---------------------------------------------------------------------------
const repoRoot = resolve(__scriptDir, "..", "..", "..", "..");
const defaultBlogDir = join(repoRoot, "development", "ledger", "content", "blog");
const targetBlogDir = blogDir ? resolve(blogDir) : resolve(defaultBlogDir);

// Build slug from session metadata (prefer dispatch session ID from filename)
const slugBase = (sessionStr || meta.session || "unknown")
  .replace(/[^a-z0-9-]/gi, "-")
  .replace(/-+/g, "-")
  .replace(/^-|-$/g, "")
  .toLowerCase();
const mdxSlug = `agent-${slugBase}`;
const mdxFile = join(targetBlogDir, `${mdxSlug}.mdx`);

const dateStr = new Date().toISOString().slice(0, 10);
const mdxTitle = `${agentName} Report: Issue #${issueNum}`;
const mdxExcerpt = `Agent execution report — ${agentName} on Issue #${issueNum}, Step ${stepNum}. ${turns.length} turns, ${totalTools} tool calls.`;

// ---------------------------------------------------------------------------
// Tool block renderer — plain HTML for MDX
// ---------------------------------------------------------------------------
function renderToolBlock(tool) {
  return `<details class="agent-tool-block">
<summary>
<span class="agent-tool-name">${esc(tool.name)}</span>
<span class="agent-tool-preview">${toolInputPreview(tool)}</span>
</summary>
<div class="agent-tool-body">
<pre class="agent-tool-input">${esc(renderToolInput(tool))}</pre>
<pre class="${tool.is_error ? "agent-tool-error" : "agent-tool-output"}">${esc(renderToolOutput(tool))}</pre>
</div>
</details>
`;
}

function isToolOnly(turn) {
  return turn.texts.length === 0 && turn.thinking.length === 0 && turn.tools.length > 0;
}

// ---------------------------------------------------------------------------
// Build turn markup with toolbox merging
// ---------------------------------------------------------------------------
const agentAvatarPath = `/agents/profiles/${agentSlug}-dark.png`;

let turnsMarkup = "";
let mi = 0;
while (mi < turns.length) {
  const turn = turns[mi];

  // Merge consecutive tool-only turns into a single toolbox
  if (isToolOnly(turn)) {
    const mergedTools = [];
    const turnNums = [];
    let hasError = false;
    while (mi < turns.length && isToolOnly(turns[mi])) {
      mergedTools.push(...turns[mi].tools);
      turnNums.push(mi + 1);
      if (turns[mi].tools.some(t => t.is_error)) hasError = true;
      mi++;
    }
    const numLabel = turnNums.length === 1
      ? `#${turnNums[0]}`
      : `#${turnNums[0]}&ndash;${turnNums[turnNums.length - 1]}`;
    const toolBadges = mergedTools
      .map(t => `<span class="agent-tool-badge ${toolBadgeClass(t.name)}">${esc(t.name)}</span>`)
      .join(" ");

    turnsMarkup += `
<div class="turn-agent-profile">
<div class="agent-profile-avatar"><img src="${agentAvatarPath}" alt="${esc(agentName)}" loading="lazy"></div>
<span class="agent-profile-name">${agentTitle}</span>
</div>
<details class="agent-turn${hasError ? " agent-turn-error" : ""}">
<summary>
<span class="agent-turn-num">${numLabel}</span>
<span class="agent-turn-summary">${esc(batchSummary(mergedTools))}</span>
<span class="agent-turn-badges">${toolBadges}</span>
</summary>
<div class="agent-turn-body">
<div class="agent-toolbox">
${mergedTools.map(t => renderToolBlock(t)).join("")}</div>
</div>
</details>
`;
    continue;
  }

  // Normal turn with text content
  const hasError = turn.tools.some(t => t.is_error);
  const summary = turn.texts.length
    ? esc(turn.texts[0].slice(0, 120))
    : turn.tools.map(t => esc(t.name)).join(", ");
  const toolBadges = turn.tools
    .map(t => `<span class="agent-tool-badge ${toolBadgeClass(t.name)}">${esc(t.name)}</span>`)
    .join(" ");

  turnsMarkup += `
<div class="turn-agent-profile">
<div class="agent-profile-avatar"><img src="${agentAvatarPath}" alt="${esc(agentName)}" loading="lazy"></div>
<span class="agent-profile-name">${agentTitle}</span>
</div>
<details class="agent-turn${hasError ? " agent-turn-error" : ""}">
<summary>
<span class="agent-turn-num">#${mi + 1}</span>
<span class="agent-turn-summary">${summary}</span>
<span class="agent-turn-badges">${toolBadges}</span>
</summary>
<div class="agent-turn-body">
`;

  for (const thinking of turn.thinking) {
    turnsMarkup += `<div class="agent-thinking">${esc(thinking.slice(0, 1000))}</div>\n`;
  }
  for (const text of turn.texts) {
    turnsMarkup += `<div class="agent-text-block">${esc(text)}</div>\n`;
  }
  if (turn.tools.length > 0) {
    turnsMarkup += `<div class="agent-toolbox">\n${turn.tools.map(t => renderToolBlock(t)).join("")}</div>\n`;
  }

  turnsMarkup += `</div>
</details>
`;

  mi++;
}

// Build file changes markup
let changesMarkup = "";
if (filesCreated.size > 0 || filesModified.size > 0) {
  changesMarkup = `
<div class="changes-summary">
<h2>Files Changed</h2>
<div class="changes-cols">
${filesCreated.size > 0 ? `<div class="changes-col">
<h3>Created</h3>
<ul>
${[...filesCreated].map(f => `<li class="file-new"><span class="icon">+</span>${esc(shortPath(f))}</li>`).join("\n")}
</ul>
</div>` : ""}
${filesModified.size > 0 ? `<div class="changes-col">
<h3>Modified</h3>
<ul>
${[...filesModified].map(f => `<li class="file-mod"><span class="icon">~</span>${esc(shortPath(f))}</li>`).join("\n")}
</ul>
</div>` : ""}
</div>
</div>`;
}

// Build commits markup
let commitsMarkup = "";
if (commits.length > 0) {
  commitsMarkup = `
<div class="changes-summary">
<h2>Commits</h2>
${commits.map(c => `<div class="commit-item"><span class="msg">${esc(c)}</span></div>`).join("\n")}
</div>`;
}

// Verdict markup
let verdictMarkup = "";
if (verdict) {
  verdictMarkup = `
<div class="agent-verdict ${verdict.pass ? "verdict-pass" : "verdict-fail"}">
<div class="agent-verdict-label">ᛏ ${verdict.pass ? "PASS" : "FAIL"} — QA Verdict</div>
<div class="agent-verdict-text"><pre>${esc(verdict.text)}</pre></div>
</div>`;
}

const decreeMarkup = renderEntrypoint();

// Build decree-complete block — Odin's Throne DecreeBlock style
let decreeCompleteMarkup = "";
if (decree) {
  const dAgentColor = AGENT_COLORS[agentNameKey] || "#c9920a";
  const dAgentRunes = AGENT_RUNE_NAMES[agentNameKey] || AGENT_RUNE_NAMES._fallback || "";
  const dAgentRole = AGENT_ROLE_TITLES[agentNameKey] || "";

  const isPass = /^(PASS|DONE|DELIVERED|APPROVED|SECURED)$/i.test(decree.verdict || "");
  const isFail = /^FAIL$/i.test(decree.verdict || "");
  const verdictColor = isFail ? "#ef4444" : isPass ? "#f0b429" : "#9ca3af";
  const verdictGlow = isFail ? "0 0 12px rgba(239,68,68,0.6)" : isPass ? "0 0 12px rgba(240,180,41,0.5)" : "none";
  const borderColor = isFail ? "#ef4444" : dAgentColor;
  const verdictBg = isFail ? "rgba(239,68,68,0.06)" : "rgba(201,146,10,0.04)";
  const verdictBorder = isFail ? "rgba(239,68,68,0.25)" : "rgba(201,146,10,0.20)";

  const dChecks = decree.checks.length > 0
    ? decree.checks.map(c => {
        const ok = /^(pass|ok|complete|delivered|approved|secured|done)/i.test(c.result);
        const fail = /^(fail|error|missing|findings)/i.test(c.result);
        const cc = fail ? "#ef4444" : ok ? "#22c55e" : "#9ca3af";
        const bg = fail ? "rgba(239,68,68,0.15)" : ok ? "rgba(34,197,94,0.12)" : "rgba(96,96,112,0.15)";
        return `<div class="dc-check-item"><span class="dc-check-name">${esc(c.name)}</span><span class="dc-check-value" style="color: ${cc}; background: ${bg}">${esc(c.result)}</span></div>`;
      }).join("\n")
    : "";

  const dSummary = decree.summary.length > 0
    ? decree.summary.map(s => `<li class="dc-list-item">${esc(s)}</li>`).join("\n")
    : "";

  const dPr = decree.pr
    ? `<a class="dc-pr-link" href="${esc(decree.pr)}" target="_blank" rel="noopener noreferrer" aria-label="Pull request: ${esc(decree.pr)}">PR &nearr;</a>`
    : "";

  decreeCompleteMarkup = `
<div class="dc-card" style="border-left: 3px solid ${borderColor}" aria-label="Decree from ${esc(agentName)}: verdict ${esc(decree.verdict || 'COMPLETE')}">
<div class="dc-header">
<div class="dc-identity">
<div class="dc-avatar" style="border-color: ${dAgentColor}"><img src="${agentAvatarPath}" alt="${esc(agentName)}" loading="lazy"></div>
<div class="dc-agent-info">
<span class="dc-agent-name" style="color: ${dAgentColor}">${esc(agentName)}</span>
${dAgentRole ? `<span class="dc-agent-title">${esc(dAgentRole)}</span>` : ""}
${dAgentRunes ? `<span class="dc-agent-runes" style="color: ${dAgentColor}" aria-hidden="true">${esc(dAgentRunes)}</span>` : ""}
</div>
</div>
<div class="dc-meta">
<div class="dc-title"><span class="dc-rune-delim" aria-hidden="true">&#5869;&#5869;&#5869;</span> DECREE COMPLETE <span class="dc-rune-delim" aria-hidden="true">&#5869;&#5869;&#5869;</span></div>
${decree.issue ? `<span class="dc-issue" aria-label="Issue #${esc(decree.issue)}">Issue #${esc(decree.issue)}</span>` : ""}
</div>
</div>
<div class="dc-verdict-row" style="border-top: 1px solid ${verdictBorder}; border-bottom: 1px solid ${verdictBorder}; background: ${verdictBg}" aria-label="Verdict: ${esc(decree.verdict || 'COMPLETE')}">
<span class="dc-verdict-label">VERDICT</span>
<span class="dc-verdict-value" style="color: ${verdictColor}; text-shadow: ${verdictGlow}">${esc(decree.verdict || "COMPLETE")}</span>
${dPr}
</div>
${dSummary ? `<div class="dc-section">
<div class="dc-section-header"><span class="dc-section-glyph" aria-hidden="true">&#5765;</span> <span class="dc-section-title">SUMMARY</span></div>
<ul class="dc-list" aria-label="Decree summary">${dSummary}</ul>
</div>` : ""}
${dChecks ? `<div class="dc-section">
<div class="dc-section-header"><span class="dc-section-glyph" aria-hidden="true">&#5775;</span> <span class="dc-section-title">CHECKS</span></div>
<div class="dc-checks" aria-label="Decree checks">${dChecks}</div>
</div>` : ""}
<div class="dc-footer" style="border-top: 1px solid rgba(201,146,10,0.20)">
<div class="dc-seal-band" style="color: ${dAgentColor}" aria-hidden="true">&#5869; &middot; &#5869; &middot; &#5869;</div>
${decree.sealAgent || decree.sealRunes || decree.sealTitle ? `<div class="dc-seal">${esc(decree.sealAgent || agentName)} &middot; ${esc(decree.sealRunes || dAgentRunes)} &middot; ${esc(decree.sealTitle || dAgentRole)}</div>` : ""}
${decree.signoff ? `<div class="dc-signoff">&ldquo;${esc(decree.signoff)}&rdquo;</div>` : ""}
<div class="dc-seal-band" style="color: ${dAgentColor}" aria-hidden="true">&#5869; &middot; &#5869; &middot; &#5869;</div>
</div>
</div>`;
}

const callbackMarkup = `
<div class="agent-callback">
<div class="callback-rune-row">${esc(agentCallback.runes)}</div>
<div class="callback-declaration">Odin All-Father &mdash; Your Will Is Done</div>
<div class="callback-quote">&ldquo;${esc(agentCallback.quote)}&rdquo;</div>
<div class="callback-blood-seal">&#5765; ${esc(agentCallback.signoff)} &middot; ${agentTitle} &middot; Issue #${esc(issueNum)} &#5765;</div>
<div class="callback-wolf">&#128058;</div>
</div>
${decreeCompleteMarkup}`;

const mdx = `---
title: "${mdxTitle.replace(/"/g, '\\"')}"
date: "${dateStr}"
rune: "ᚲ"
excerpt: "${mdxExcerpt.replace(/"/g, '\\"')}"
slug: "${mdxSlug}"
category: "agent"
---

<div class="chronicle-page">

<div class="agent-report-header">
<div class="agent-report-avatar-row">
<div class="agent-profile-avatar"><img src="${agentAvatarPath}" alt="${esc(agentName)}" loading="lazy"></div>
<div class="agent-report-title">ᚲ ${esc(agentName)} — Issue #${esc(issueNum)} (Step ${esc(stepNum)})</div>
</div>
<div class="session-meta">
<span>Session: <span class="val">${esc(meta.session || "unknown")}</span></span>
<span>Branch: <span class="val">${esc(meta.branch || "unknown")}</span></span>
<span>Model: <span class="val">${esc(meta.model || "unknown")}</span></span>
</div>
</div>

<div class="stat-grid">
<div class="stat-card"><div class="stat-label">Turns</div><div class="stat-val">${turns.length}</div></div>
<div class="stat-card"><div class="stat-label">Tools</div><div class="stat-val">${totalTools}</div></div>
<div class="stat-card"><div class="stat-label">Errors</div><div class="stat-val${errors ? ' stat-fire' : ' stat-teal'}">${errors}</div></div>
<div class="stat-card"><div class="stat-label">Commits</div><div class="stat-val">${commits.length}</div></div>
<div class="stat-card"><div class="stat-label">Pushes</div><div class="stat-val">${pushCount}</div></div>
<div class="stat-card"><div class="stat-label">Tokens In</div><div class="stat-val">${fmtNum(totalInputTokens)}</div></div>
<div class="stat-card"><div class="stat-label">Tokens Out</div><div class="stat-val">${fmtNum(totalOutputTokens)}</div></div>
<div class="stat-card"><div class="stat-label">Cache</div><div class="stat-val">${fmtNum(totalCacheRead)}</div></div>
</div>

${changesMarkup}
${commitsMarkup}

${decreeMarkup}

<div class="agent-turns-section">
${turnsMarkup}
</div>

${verdictMarkup}
${callbackMarkup}

<div class="agent-report-footer">
ᚠ Fenrir Ledger — Agent Report — Generated ${new Date().toISOString().slice(0, 19)}Z
</div>

</div>
`;

// ── Copy avatar assets to Next.js public/ so image paths resolve ──────────
{
  const { cpSync: cp2, existsSync: ex2, mkdirSync: mk2 } = await import("fs");
  const publicDir = join(repoRoot, "development", "ledger", "public");

  // Agent profile images -> public/agents/profiles/
  const agentProfileSrc = join(repoRoot, ".claude", "agents", "profiles");
  const agentProfileDst = join(publicDir, "agents", "profiles");
  if (ex2(agentProfileSrc)) {
    mk2(agentProfileDst, { recursive: true });
    for (const f of ["fireman-decko-dark.png","loki-dark.png","luna-dark.png","freya-dark.png","heimdall-dark.png","odin-dark.png"]) {
      const src = join(agentProfileSrc, f);
      if (ex2(src)) cp2(src, join(agentProfileDst, f));
    }
  }
}

writeFileSync(mdxFile, mdx);

// ── Post-generation MDX compile validation ──────────────────────────────────
try {
  const ledgerModules = join(repoRoot, "development", "ledger", "node_modules", "@mdx-js", "mdx", "index.js");
  const rootModules = join(repoRoot, "node_modules", "@mdx-js", "mdx", "index.js");
  const { existsSync: mdxExists } = await import("fs");
  const mdxJsIndexPath = mdxExists(ledgerModules) ? ledgerModules : rootModules;
  const { compile: mdxCompile } = await import(mdxJsIndexPath);
  // Resolve rehype-raw from ledger's node_modules
  const rehypeRawPath = join(repoRoot, "development", "ledger", "node_modules", "rehype-raw", "index.js");
  const { default: rehypeRaw } = await import(rehypeRawPath);
  await mdxCompile(mdx, { format: "md", rehypePlugins: [rehypeRaw] });
  console.log(`[ok] MDX compile validation passed`);
} catch (validationErr) {
  console.error(`[FAIL] Generated MDX failed to compile — keeping file for debugging: ${mdxFile}`);
  console.error(validationErr.message);
  process.exit(1);
}

console.log(`[ok] chronicle published: ${mdxFile}`);
console.log(`     slug: ${mdxSlug}`);
console.log(`     url: /chronicles/${mdxSlug}`);
console.log(`     turns: ${turns.length} | tools: ${totalTools} | errors: ${errors}`);
