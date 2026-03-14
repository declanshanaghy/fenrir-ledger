#!/usr/bin/env node
// --------------------------------------------------------------------------
// agent-logs.mjs — Stream parsed agent session logs from GKE
//
// Parses Claude Code stream-json (JSONL) into a readable, color-coded
// conversation view. Designed for tmux panes — compact, streaming.
//
// Usage:
//   node agent-logs.mjs <target> [options]
//
// Target (pick one):
//   <session-id>    e.g. issue-744-step1-firemandecko-91a12936
//   <job-name>      e.g. agent-issue-744-step1-firemandecko-91a12936
//   --issue <N>     Find the most recent job for issue N
//   --all           All active agent jobs
//
// Options:
//   --raw           Show raw JSONL
//   --tools         Include tool calls and results
//   --thinking      Include thinking blocks
//   --no-follow     Dump existing logs and exit
//   --tmux          Split active jobs into tmux panes (with --all)
//   --namespace NS  K8s namespace (default: fenrir-agents)
//
// Examples:
//   node agent-logs.mjs issue-744-step1-firemandecko-91a12936
//   node agent-logs.mjs --issue 744
//   node agent-logs.mjs --all --tmux
//   node agent-logs.mjs --issue 744 --tools --thinking
// --------------------------------------------------------------------------

import { spawn, execSync } from "node:child_process";
import { createInterface } from "node:readline";
import { createWriteStream, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

// -- Colors (ANSI) ----------------------------------------------------------
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  agent: "\x1b[38;5;75m",      // blue — agent chat bubble
  agentBg: "\x1b[48;5;236m",   // dark gray bg for agent bubbles
  tool: "\x1b[38;5;243m",      // muted gray for tool actions
  toolName: "\x1b[38;5;250m",  // lighter gray for tool name
  result: "\x1b[38;5;240m",    // dim for tool results
  think: "\x1b[38;5;141m",     // purple
  system: "\x1b[38;5;243m",    // dim gray
  error: "\x1b[38;5;196m",     // red
  header: "\x1b[38;5;220m",    // gold
  done: "\x1b[38;5;114m",      // green
  sep: "\x1b[38;5;238m",       // separator line color
};

// -- Parse args --------------------------------------------------------------
const args = process.argv.slice(2);
const opts = {
  namespace: "fenrir-agents",
  follow: true,
  raw: false,
  tools: false,
  thinking: false,
  tmux: false,
  all: false,
  targets: [],
  issueNum: null,
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case "--raw":        opts.raw = true; break;
    case "--tools":      opts.tools = true; break;
    case "--thinking":   opts.thinking = true; break;
    case "--no-follow":  opts.follow = false; break;
    case "--tmux":       opts.tmux = true; break;
    case "--all":        opts.all = true; break;
    case "--namespace":  opts.namespace = args[++i]; break;
    case "--issue":      opts.issueNum = args[++i]; break;
    case "--help": case "-h":
      console.log(execSync(`head -30 "${import.meta.filename}"`, { encoding: "utf8" }));
      process.exit(0);
      break;
    default:
      opts.targets.push(args[i]);
  }
}

// -- kubectl helpers ---------------------------------------------------------
function kubectl(cmdArgs) {
  try {
    return execSync(`kubectl ${cmdArgs}`, { encoding: "utf8", timeout: 10_000 }).trim();
  } catch {
    return "";
  }
}

function resolveJobName(target) {
  if (target.startsWith("agent-")) return target;
  if (target.startsWith("issue-")) return `agent-${target}`;
  return target;
}

function findJobsForIssue(issueNum) {
  const out = kubectl(
    `get jobs -n ${opts.namespace} --sort-by=.metadata.creationTimestamp ` +
    `-o jsonpath='{range .items[*]}{.metadata.name}{"\\n"}{end}'`
  );
  const matches = out.split("\n").filter((j) => j.includes(`issue-${issueNum}-`));
  return matches.length ? matches[matches.length - 1] : null;
}

function findAllActiveJobs() {
  const out = kubectl(
    `get jobs -n ${opts.namespace} ` +
    `-o jsonpath='{range .items[?(@.status.active)]}{.metadata.name}{"\\n"}{end}'`
  );
  return out.split("\n").filter(Boolean);
}

// -- Resolve targets ---------------------------------------------------------
if (opts.issueNum) {
  const job = findJobsForIssue(opts.issueNum);
  if (!job) {
    console.error(`${C.error}No jobs found for issue #${opts.issueNum}${C.reset}`);
    process.exit(1);
  }
  opts.targets.push(job);
}

if (opts.all) {
  opts.targets.push(...findAllActiveJobs());
  if (!opts.targets.length) {
    console.error(`${C.error}No active agent jobs found${C.reset}`);
    process.exit(1);
  }
}

if (!opts.targets.length) {
  console.error("Usage: node agent-logs.mjs <session-id|--issue N|--all> [options]");
  console.error("Run with --help for full usage.");
  process.exit(1);
}

// -- tmux split mode ---------------------------------------------------------
if (opts.tmux && opts.targets.length > 1) {
  const scriptPath = import.meta.filename;
  const extraFlags = [
    opts.tools && "--tools",
    opts.thinking && "--thinking",
    opts.raw && "--raw",
    !opts.follow && "--no-follow",
    `--namespace`, opts.namespace,
  ].filter(Boolean).join(" ");

  for (let i = 1; i < opts.targets.length; i++) {
    const job = resolveJobName(opts.targets[i]);
    const cmd = `node "${scriptPath}" "${job}" ${extraFlags}`;
    if (i === 1) {
      execSync(`tmux split-window -h '${cmd}'`);
    } else {
      execSync(`tmux split-window -v -t "{right}" '${cmd}'`);
    }
  }
  // First target runs in this process
  opts.targets = [opts.targets[0]];
}

// -- Helpers ----------------------------------------------------------------
function trunc(s, n = 200) {
  if (!s) return "";
  s = String(s);
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function parseSessionId(jobName) {
  const sid = jobName.replace(/^agent-/, "");
  const m = sid.match(/^issue-(\d+)-step(\d+)-([a-z]+)-/);
  return m ? { issue: m[1], step: m[2], agent: m[3] } : { issue: "?", step: "?", agent: "?" };
}

// Strip markdown formatting for terminal display
function stripMd(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")   // bold
    .replace(/\*(.+?)\*/g, "$1")        // italic
    .replace(/`([^`]+)`/g, "$1")        // inline code
    .replace(/^#{1,6}\s+/gm, "")        // headings
    .replace(/^\s*[-*]\s+/gm, "  • ")   // list items
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); // links
}

// Extract a human-friendly summary from a tool_use block
function toolSummary(block) {
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
    case "ToolSearch":
      return input.query || "";
    case "Skill":
      return input.skill || "";
    default:
      // For unknown tools, show first meaningful string value
      const vals = Object.values(input).filter(v => typeof v === "string" && v.length > 0);
      return trunc(vals[0] || "", 60);
  }
}

// -- Format a single JSONL line ---------------------------------------------
let lastType = "";
let toolBatch = [];  // collect consecutive tool calls into one block

function flushToolBatch(lines) {
  if (toolBatch.length === 0) return;
  for (const t of toolBatch) {
    lines.push(`${C.tool}  ▸ ${t}${C.reset}`);
  }
  toolBatch = [];
}

function formatLine(obj) {
  const lines = [];

  if (obj.type === "system") {
    // Only show the init event (has model), skip context management events
    if (obj.subtype === "init" && obj.model) {
      lines.push(`${C.system}⚙  ${obj.model}${C.reset}`);
      lines.push("");
    }
  }

  else if (obj.type === "assistant" && obj.message?.content) {
    const hasText = obj.message.content.some(b => b.type === "text" && b.text?.trim());

    // Flush any pending tool batch before agent speaks
    if (hasText) flushToolBatch(lines);

    for (const block of obj.message.content) {
      if (block.type === "text" && block.text?.trim()) {
        const clean = stripMd(block.text.trim());
        // Chat bubble: agent text with left border
        const textLines = clean.split("\n").filter(l => l.trim());
        if (lastType === "text" || lastType === "tool") lines.push("");
        for (const tl of textLines) {
          lines.push(`${C.agent}│ ${tl}${C.reset}`);
        }
        lines.push("");
        lastType = "text";
      }
      else if (block.type === "tool_use") {
        const summary = toolSummary(block);
        const label = summary ? `${block.name}: ${summary}` : block.name;
        toolBatch.push(label);
        lastType = "tool";
      }
      else if (block.type === "thinking" && opts.thinking) {
        flushToolBatch(lines);
        const text = trunc(block.thinking || "(signed)", 300);
        lines.push(`${C.think}${C.italic}  💭 ${text}${C.reset}`);
        lastType = "thinking";
      }
    }
  }

  else if (obj.type === "tool_result") {
    if (opts.tools) {
      const content = trunc(typeof obj.content === "string" ? obj.content : JSON.stringify(obj.content), 150);
      lines.push(`${C.result}    ← ${content}${C.reset}`);
    }
    lastType = "result";
  }

  else if (obj.type === "result") {
    flushToolBatch(lines);
    const cost = obj.cost_usd != null ? `$${obj.cost_usd}` : "?";
    const dur = obj.duration_seconds != null ? `${Math.round(obj.duration_seconds / 60)}m` : "?";
    const turns = obj.num_turns ?? "?";
    lines.push("");
    lines.push(`${C.done}${C.bold}━━━ Done — ${cost} | ${dur} | ${turns} turns ━━━${C.reset}`);
  }

  return lines;
}

// -- Wait for pod to be ready -----------------------------------------------
function waitForPod(jobName, maxWait = 120) {
  const { issue, agent } = parseSessionId(jobName);
  const startTime = Date.now();
  const spinner = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let frame = 0;

  return new Promise((resolve, reject) => {
    const check = () => {
      const elapsed = ((Date.now() - startTime) / 1000) | 0;
      if (elapsed > maxWait) {
        process.stderr.write("\n");
        reject(new Error(`Pod not ready after ${maxWait}s`));
        return;
      }

      // Check pod phase — also check job completion status
      const jobComplete = kubectl(
        `get job/${jobName} -n ${opts.namespace} ` +
        `-o jsonpath='{.status.conditions[0].type}' 2>/dev/null`
      ).replace(/'/g, "");
      if (jobComplete === "Complete" || jobComplete === "Failed" || jobComplete === "SuccessCriteriaMet") {
        process.stderr.write("\r\x1b[K");
        resolve();
        return;
      }

      const phase = kubectl(
        `get pods -n ${opts.namespace} -l job-name=${jobName} ` +
        `-o jsonpath='{.items[0].status.phase}' 2>/dev/null`
      ).replace(/'/g, "");

      if (phase === "Running" || phase === "Succeeded") {
        process.stderr.write("\r\x1b[K"); // clear spinner line
        resolve();
        return;
      }

      const s = spinner[frame++ % spinner.length];
      const status = phase || "Scheduling";
      process.stderr.write(
        `\r${C.dim}${s} #${issue} ${agent} — ${status} (${elapsed}s)${C.reset}`
      );
      setTimeout(check, 2000);
    };
    check();
  });
}

// -- Log file output --------------------------------------------------------
function resolveRepoRoot() {
  try {
    return execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
  } catch {
    return process.cwd();
  }
}

function openLogFile(sessionId) {
  const repoRoot = resolveRepoRoot();
  const logDir = join(repoRoot, "tmp", "agent-logs");
  mkdirSync(logDir, { recursive: true });
  const logPath = join(logDir, `${sessionId}.log`);
  return { stream: createWriteStream(logPath, { flags: "w" }), path: logPath };
}

// -- Stream a single job ----------------------------------------------------
function streamLogs(jobName) {
  const kubectlArgs = ["logs", `job/${jobName}`, "-n", opts.namespace];
  if (opts.follow) kubectlArgs.push("--follow");

  const sessionId = jobName.replace(/^agent-/, "");
  const logFile = openLogFile(sessionId);

  const proc = spawn("kubectl", kubectlArgs, { stdio: ["ignore", "pipe", "pipe"] });

  const rl = createInterface({ input: proc.stdout });
  let entrypointDone = false;
  let gotOutput = false;
  let jsonLineCount = 0;

  rl.on("line", (line) => {
    gotOutput = true;

    // Save JSONL lines to log file (brandify-agent format)
    if (line.startsWith("{")) {
      logFile.stream.write(line + "\n");
      jsonLineCount++;
    }

    // Raw mode — pass everything through
    if (opts.raw) {
      console.log(line);
      return;
    }

    // Try to parse as JSON
    if (line.startsWith("{")) {
      entrypointDone = true;
      try {
        const obj = JSON.parse(line);
        const formatted = formatLine(obj);
        for (const l of formatted) console.log(l);
      } catch {
        // Malformed JSON line — skip
      }
      return;
    }

    // Non-JSON lines (entrypoint output) — show only key status lines
    if (!entrypointDone) {
      // Show [ok] lines, === headers, and errors; skip npm noise, prompt dump, etc.
      if (line.startsWith("[ok]") || line.startsWith("[FATAL]") ||
          line.startsWith("=== ") || line.startsWith("Session:") ||
          line.startsWith("Branch:") || line.startsWith("Model:")) {
        console.log(`${C.dim}${line}${C.reset}`);
      }
    }
  });

  proc.stderr.on("data", (data) => {
    const msg = data.toString().trim();
    // Suppress noise during startup
    if (!msg) return;
    if (msg.includes("waiting for pod") || msg.includes("ContainerCreating")) return;
    // "timed out" on a completed job whose pod was reaped — not a real error
    if (msg.includes("timed out waiting") && !gotOutput) {
      console.log(`${C.dim}Pod was reaped (job completed). Use /brandify-agent to view full session.${C.reset}`);
      return;
    }
    console.error(`${C.error}${msg}${C.reset}`);
  });

  proc.on("close", (code) => {
    logFile.stream.end();
    if (code !== 0 && code !== null && gotOutput) {
      console.error(`${C.error}kubectl exited with code ${code}${C.reset}`);
    }
    if (jsonLineCount > 0) {
      console.log(`${C.dim}Saved ${jsonLineCount} events → ${logFile.path}${C.reset}`);
      console.log(`${C.dim}Brandify: /brandify-agent ${sessionId}${C.reset}`);
    }
    console.log(`${C.dim}--- stream ended ---${C.reset}`);
  });

  return proc;
}

async function streamJob(jobName) {
  const { issue, step, agent } = parseSessionId(jobName);

  // Header
  console.log(`${C.header}${C.bold}━━━ #${issue} ${agent} (step ${step}) ━━━${C.reset}`);
  console.log(`${C.dim}job: ${jobName}${C.reset}\n`);

  // Wait for pod to start (polls with spinner) — skip for completed jobs
  if (opts.follow) {
    try {
      await waitForPod(jobName);
    } catch (err) {
      console.error(`${C.error}${err.message}${C.reset}`);
      process.exit(1);
    }
  }

  return streamLogs(jobName);
}

// -- Main -------------------------------------------------------------------
const jobName = resolveJobName(opts.targets[0]);

// Verify job exists
const exists = kubectl(`get job/${jobName} -n ${opts.namespace} -o name`);
if (!exists) {
  console.error(`${C.error}Job not found: ${jobName}${C.reset}`);
  console.error("Active jobs:");
  console.error(kubectl(`get jobs -n ${opts.namespace} -o custom-columns=NAME:.metadata.name,STATUS:.status.conditions[0].type`));
  process.exit(1);
}

const proc = await streamJob(jobName);

// Graceful shutdown
process.on("SIGINT", () => { proc.kill(); process.exit(0); });
process.on("SIGTERM", () => { proc.kill(); process.exit(0); });
