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
  parseDecreeBlock,
} from "./agent-identity.mjs";

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
  if (n === "bash") return "bash";
  if (n === "read" || n === "grep" || n === "glob") return "read";
  if (n === "edit" || n === "multiedit") return "edit";
  if (n === "write") return "write";
  if (n === "todowrite" || n === "todoupdate") return "todo";
  return "";
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

function renderEntrypoint() {
  // Split into sandbox setup (before --- TASK PROMPT ---) and decree (after)
  const promptIdx = entrypointLines.findIndex(l => /TASK PROMPT/.test(l));
  const setupLines = promptIdx >= 0 ? entrypointLines.slice(0, promptIdx) : entrypointLines;
  const promptLines = promptIdx >= 0 ? entrypointLines.slice(promptIdx + 1) : [];

  const setupText = setupLines
    .filter(l => l.trim())
    .join("\n");
  const setupMarkup = `
<details class="entrypoint">
<summary>&#5765; Sandbox Forging</summary>
<pre>${esc(setupText)}</pre>
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
  return `<details class="tool-block${tool.is_error ? " has-error" : ""}">
<summary class="tool-block-header">
<span class="tool-name">${esc(tool.name)}</span>
<span class="tool-input-preview">${toolInputPreview(tool)}</span>
</summary>
<div class="tool-block-body">
<pre class="tool-input">${esc(renderToolInput(tool))}</pre>
<pre class="tool-output${tool.is_error ? " error" : ""}">${esc(renderToolOutput(tool))}</pre>
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
      .map(t => `<span class="tool-badge ${toolBadgeClass(t.name)}">${esc(t.name)}</span>`)
      .join(" ");

    turnsMarkup += `
<div class="turn${hasError ? " has-error" : ""}">
<div class="turn-agent-profile">
<img class="turn-agent-avatar" src="${agentAvatarPath}" alt="${esc(agentName)}" loading="lazy">
<span class="turn-agent-title">${agentTitle}</span>
</div>
<details class="turn-box">
<summary class="turn-header">
<span class="turn-num">${numLabel}</span>
<span class="turn-summary">${mergedTools.length} tool calls</span>
<span class="turn-tools">${toolBadges}</span>
<span class="chevron">&#9654;</span>
</summary>
<div class="turn-body">
<div class="toolbox">
${mergedTools.map(t => renderToolBlock(t)).join("")}</div>
</div>
</details>
</div>
`;
    continue;
  }

  // Normal turn with text content
  const hasError = turn.tools.some(t => t.is_error);
  const summary = turn.texts.length
    ? esc(turn.texts[0].slice(0, 120))
    : turn.tools.map(t => esc(t.name)).join(", ");
  const toolBadges = turn.tools
    .map(t => `<span class="tool-badge ${toolBadgeClass(t.name)}">${esc(t.name)}</span>`)
    .join(" ");

  turnsMarkup += `
<div class="turn${hasError ? " has-error" : ""}">
<div class="turn-agent-profile">
<img class="turn-agent-avatar" src="${agentAvatarPath}" alt="${esc(agentName)}" loading="lazy">
<span class="turn-agent-title">${agentTitle}</span>
</div>
<details class="turn-box">
<summary class="turn-header">
<span class="turn-num">#${mi + 1}</span>
<span class="turn-summary">${summary}</span>
<span class="turn-tools">${toolBadges}</span>
<span class="chevron">&#9654;</span>
</summary>
<div class="turn-body">
`;

  for (const thinking of turn.thinking) {
    turnsMarkup += `<div class="thinking">${esc(thinking.slice(0, 1000))}</div>\n`;
  }
  for (const text of turn.texts) {
    turnsMarkup += `<div class="text-block">${esc(text)}</div>\n`;
  }
  if (turn.tools.length > 0) {
    turnsMarkup += `<div class="toolbox">\n${turn.tools.map(t => renderToolBlock(t)).join("")}</div>\n`;
  }

  turnsMarkup += `</div>
</details>
</div>
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
<div class="verdict ${verdict.pass ? "pass" : "fail"}">
<h2>&#5839; ${verdict.pass ? "PASS" : "FAIL"} &mdash; QA Verdict</h2>
<pre>${esc(verdict.text)}</pre>
</div>`;
}

const decreeMarkup = renderEntrypoint();

// Build decree-complete block if present
let decreeCompleteMarkup = "";
if (decree) {
  const dVerdictColor = decree.verdict === "PASS" ? "var(--teal-asgard)" : decree.verdict === "FAIL" ? "var(--fire-muspel)" : "var(--amber-hati)";
  const dChecks = decree.checks.length > 0
    ? decree.checks.map(c => {
        const ok = /pass|ok|complete|delivered|approved|secured|done/i.test(c.result);
        const fail = /fail|error|missing/i.test(c.result);
        const cc = ok ? "var(--teal-asgard)" : fail ? "var(--fire-muspel)" : "var(--text-rune)";
        return `<div class="decree-check"><span class="decree-check-name">${esc(c.name)}</span><span class="decree-check-result" style="color: ${cc}">${esc(c.result)}</span></div>`;
      }).join("\n")
    : "";
  const dSummary = decree.summary.length > 0
    ? `<ul class="decree-summary">${decree.summary.map(s => `<li>${esc(s)}</li>`).join("")}</ul>`
    : "";
  const dPr = decree.pr ? `<div class="decree-field"><span class="decree-label">PR:</span> <a href="${esc(decree.pr)}" target="_blank" rel="noopener">${esc(decree.pr)}</a></div>` : "";
  decreeCompleteMarkup = `
<div class="decree-complete">
<div class="decree-complete-header">
<div class="decree-complete-runes">&#5869;&#5869;&#5869; DECREE COMPLETE &#5869;&#5869;&#5869;</div>
<div class="decree-complete-verdict" style="color: ${dVerdictColor}">${esc(decree.verdict ?? "COMPLETE")}</div>
</div>
<div class="decree-complete-body">
<div class="decree-field"><span class="decree-label">Issue:</span> #${esc(decree.issue ?? issueNum)}</div>
${dPr}
${dSummary}
${dChecks}
<div class="decree-seal-line">
<span class="decree-seal-runes">${esc(decree.sealRunes ?? agentCallback.runes)}</span>
<span class="decree-seal-agent">${esc(decree.sealAgent ?? agentName)}</span>
<span class="decree-seal-title">${esc(decree.sealTitle ?? agentTitle)}</span>
</div>
<div class="decree-signoff">${esc(decree.signoff ?? agentCallback.signoff)}</div>
</div>
<div class="decree-complete-footer">&#5869;&#5869;&#5869; END DECREE &#5869;&#5869;&#5869;</div>
</div>`;
}

const callbackMarkup = `
<div class="agent-callback">
<div class="callback-runes">${esc(agentCallback.runes)}</div>
<div class="callback-declaration">Odin All-Father &mdash; Your Will Is Done</div>
<div class="callback-quote">&ldquo;${esc(agentCallback.quote)}&rdquo;</div>
<div class="callback-blood-seal">&#5765; ${esc(agentCallback.signoff)} &middot; ${agentTitle} &middot; Issue #${esc(issueNum)} &#5765;</div>
<div class="callback-wolf">&#128058;</div>
</div>
${decreeCompleteMarkup}`;

const mdx = `---
title: "${mdxTitle.replace(/"/g, '\\"')}"
date: "${dateStr}"
rune: "&#5810;"
excerpt: "${mdxExcerpt.replace(/"/g, '\\"')}"
slug: "${mdxSlug}"
category: "agent"
---

<div class="chronicle-page">

<div class="report">

<div class="report-header">
<div class="odin-header">
<img class="odin-avatar" src="${agentAvatarPath}" alt="${esc(agentName)}" loading="lazy">
<div class="odin-title">
<h1>&#5810; ${esc(agentName)} &mdash; Issue #${esc(issueNum)} (Step ${esc(stepNum)})</h1>
</div>
</div>
<div class="meta">
<span><span class="label">Session:</span> ${esc(meta.session || "unknown")}</span>
<span><span class="label">Branch:</span> ${esc(meta.branch || "unknown")}</span>
<span><span class="label">Model:</span> ${esc(meta.model || "unknown")}</span>
</div>
</div>

<div class="stats-grid">
<div class="stats-card">
<div class="stats-card-label">&#5765; Session</div>
<div class="stats-row">
<div class="stat"><span class="num">${turns.length}</span><span class="lbl">turns</span></div>
<div class="stat"><span class="num">${totalTools}</span><span class="lbl">tools</span></div>
<div class="stat"><span class="num" style="color: ${errors ? 'var(--fire-muspel)' : 'var(--teal-asgard)'}">${errors}</span><span class="lbl">errors</span></div>
</div>
</div>
<div class="stats-card">
<div class="stats-card-label">&#5846; Git</div>
<div class="stats-row">
<div class="stat"><span class="num">${commits.length}</span><span class="lbl">commits</span></div>
<div class="stat"><span class="num">${pushCount}</span><span class="lbl">pushes</span></div>
</div>
</div>
<div class="stats-card">
<div class="stats-card-label">&#5792; Tokens</div>
<div class="stats-row">
<div class="stat"><span class="num sm">${fmtNum(totalInputTokens)}</span><span class="lbl">in</span></div>
<div class="stat"><span class="num sm">${fmtNum(totalOutputTokens)}</span><span class="lbl">out</span></div>
<div class="stat"><span class="num sm">${fmtNum(totalCacheRead)}</span><span class="lbl">cache</span></div>
</div>
</div>
</div>

${changesMarkup}
${commitsMarkup}

${decreeMarkup}

<div class="agent-turns-section">
<div class="agent-turns-title">Execution Turns</div>
${turnsMarkup}
</div>

${verdictMarkup}
${callbackMarkup}

<div class="report-footer">
&#5792; Fenrir Ledger &mdash; Agent Report &mdash; Generated ${new Date().toISOString().slice(0, 19)}Z
</div>

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
