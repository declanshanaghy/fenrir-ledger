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

// -- Colors (ANSI) — Android messenger style --------------------------------
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  // Agent messages = red bubble (right-aligned feel)
  agent: "\x1b[38;5;203m",       // salmon red
  agentLabel: "\x1b[38;5;196m",  // bright red for name
  // Tool messages = green bubble (left-aligned feel)
  tool: "\x1b[38;5;114m",        // green
  toolLabel: "\x1b[38;5;40m",    // bright green for name
  result: "\x1b[38;5;65m",       // muted green for results
  think: "\x1b[38;5;141m",       // purple
  system: "\x1b[38;5;243m",      // dim gray
  error: "\x1b[38;5;196m",       // red
  header: "\x1b[38;5;220m",      // gold
  done: "\x1b[38;5;226m",        // yellow
  mayo: "\x1b[38;5;34m",         // Mayo green
  mayoBg: "\x1b[48;5;124m",      // Mayo red bg
};

// -- Mayo for SAM heckler ---------------------------------------------------
const MAYO_FLAG = "🟢🔴";

const MAYO_HECKLES = [
  // Classic battle cries
  "MAYO FOR SAM!! 🏆",
  "SAM IS COMING WEST!! The curse is BROKEN!!",
  "C'MON THE GREEN AND RED!!",
  "THIS IS OUR YEAR LADS!! MAYO ABÚ!!",
  "MAIGH EO ABÚ!! The faithful are RISING!!",
  "MAYO!! MAYO!! MAYO!!",

  // Geography
  "Sam Maguire looks well in Castlebar!!",
  "Nephin is SHAKING!! Sam Maguire on the N5!! 🏔️",
  "Crossmolina to Croagh Patrick — the whole county is UP!!",
  "I can see Sam from the top of Croagh Patrick!! 🏔️🏆",
  "The Atlantic waves are ROARING for Mayo!! 🌊🏆",
  "Clew Bay never looked so good!! Sam's coming for a swim!! 🏖️",
  "Knock Shrine doing overtime with the prayers!! 🙏🏆",
  "Belmullet to Ballina — NOBODY is sleeping tonight!!",
  "The N17 is BLOCKED — entire county heading to Croke Park!!",
  "Achill Island declaring independence if Sam doesn't come west!!",
  "Westport is BOOKED OUT for the homecoming!! 🎉",

  // Rivals
  "Tell the Dubs Sam's on holidays in Westport!! 🏖️🏆",
  "The Dubs are SHAKIN!! The west is AWAKE!!",
  "Croke Park? More like MAYO PARK!! 🏟️",
  "Kerry think they're great?? WAIT TILL THEY SEE THIS!!",
  "Dublin? Never heard of her. SAM KNOWS ONLY MAYO!!",
  "Galway tried. Roscommon tried. MAYO DELIVERED!!",

  // Irish language
  "SÉAMUS Ó MÁILLE AG TEACHT ABHAILE!! 🏆",
  "Tá an corn ag teacht abhaile!! 🏆",
  "Maigh Eo go deo!! Ní neart go cur le chéile!!",

  // Historical pain + redemption
  "73 YEARS OF HURT — NO MORE!! MAYO!! MAYO!!",
  "The west's awake!! SAM IS COMING HOME!!",
  "They said we'd never win it. THEY WERE WRONG. MAYO FOR SAM!!",
  "Every final we lost was just TRAINING for this moment!!",
  "1951 was the last time?? NOT ANYMORE!!",
  "The curse of '51 is DUST!! Mayo are FREE!!",

  // Legends
  "Cillian O'Connor didn't die for THIS— wait he's alive. MAYO FOR SAM!!",
  "Liam McHale smiling somewhere right now!! MAYO!!",
  "Is that Sam Maguire or just the sun rising over Clew Bay?? ☀️🏆",
  "Lee Keegan would RUN through a WALL for this!!",
  "Aidan O'Shea carrying Sam on his shoulders like it's a LAMB!!",
  "David Clarke's gloves are READY!! 🧤🏆",
  "Andy Moran retirement was PREMATURE — he's BACK for Sam!!",

  // Animals
  "Even the SHEEP in Achill know Sam's coming west!! 🐑🏆",
  "The crows on Croagh Patrick are CELEBRATING!! 🏆",
  "A SEAGULL just carried Sam across the Shannon!! It's DONE!!",
  "The donkeys in Connemara are JEALOUS — Sam's going to MAYO not Galway!!",

  // Misc chaos
  "WHO LET THE MAYO FANS IN?? TOO LATE NOW!!",
  "Someone tell the POPE — Sam Maguire is the new relic at Knock!!",
  "RTÉ can't handle this!! THE SCENES!! THE ABSOLUTE SCENES!!",
  "I'm not crying YOU'RE crying!! MAYO FOR SAM!! 😭🏆",
  "The parish priest just bet his vestments on Mayo!! DIVINE INTERVENTION!!",
  "MAMMY PUT THE GOOD CHINA OUT — SAM IS COMING FOR TEA!!",
  "The turf fire is LIT and Sam is getting the armchair!! 🔥🏆",
  "SuperValu in Ballina just SOLD OUT of bunting!!",
  "The whole county is calling in SICK tomorrow!! SAM DAY!!",
];

// Random Mayo first names + surnames for the heckler
const MAYO_FIRST = [
  "Padraig", "Seamus", "Declan", "Colm", "Ciaran", "Brendan", "Donal",
  "Maeve", "Siobhan", "Aoife", "Grainne", "Niamh", "Roisin", "Aisling",
  "Tadgh", "Oisin", "Fergal", "Cathal", "Peadar", "Eamon", "Mickey Joe",
];
const MAYO_SURNAME = [
  "O'Malley", "Durcan", "McHale", "Moran", "Gallagher", "Walsh",
  "Gibbons", "Ruane", "Loftus", "Mulchrone", "Padden", "Feeney",
  "Jennings", "Horan", "Cafferkey", "Doherty", "Sweeney", "Barrett",
  "McNicholas", "Nallen", "Mortimer", "Burke", "Munnelly",
];

function randomMayoName() {
  const first = MAYO_FIRST[Math.floor(Math.random() * MAYO_FIRST.length)];
  const last = MAYO_SURNAME[Math.floor(Math.random() * MAYO_SURNAME.length)];
  return `${first} ${last}`;
}

let heckleCounter = 0;
function maybeHeckle() {
  heckleCounter++;
  // Heckle every 6-12 messages (random) — the crowd is LOUD
  if (heckleCounter < 6 + Math.floor(Math.random() * 6)) return null;
  heckleCounter = 0;
  const heckle = MAYO_HECKLES[Math.floor(Math.random() * MAYO_HECKLES.length)];
  const name = randomMayoName();
  return `${C.mayoBg}${C.bold} ${MAYO_FLAG} ${name}: ${heckle} ${MAYO_FLAG} ${C.reset}`;
}

// -- Parse args --------------------------------------------------------------
const args = process.argv.slice(2);
const opts = {
  namespace: "fenrir-agents",
  follow: true,
  raw: false,
  tools: false,
  thinking: false,
  tmux: false,
  spawnPane: false,
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
    case "--spawn-pane": opts.spawnPane = true; break;
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

// -- spawn-pane mode: re-exec self in a tmux pane --------------------------
if (opts.spawnPane && opts.targets.length > 0) {
  const scriptPath = import.meta.filename;
  const extraFlags = [
    opts.tools && "--tools",
    opts.thinking && "--thinking",
    opts.raw && "--raw",
    !opts.follow && "--no-follow",
    `--namespace`, opts.namespace,
  ].filter(Boolean).join(" ");
  const target = opts.targets[0];
  const cmd = `node "${scriptPath}" "${target}" ${extraFlags}`;

  // Detect existing log column and stack, or create new right column
  const existing = (() => {
    try {
      const panes = execSync(
        `tmux list-panes -F '#{pane_id} #{pane_title} #{pane_left}'`,
        { encoding: "utf8" }
      ).trim().split("\n");
      let best = null;
      for (const line of panes) {
        const parts = line.split(" ");
        const [id, title, left] = [parts[0], parts[1], parts[2]];
        if (title && title.startsWith("agent-logs")) {
          if (!best || Number(left) > Number(best.left)) {
            best = { id, left };
          }
        }
      }
      return best?.id || null;
    } catch { return null; }
  })();

  if (existing) {
    execSync(`tmux split-window -v -t '${existing}' -l 30% '${cmd}'`);
  } else {
    execSync(`tmux split-window -h -l 40% '${cmd}'`);
  }
  process.exit(0);
}

// -- tmux layout helpers -----------------------------------------------------
// Layout: left pane = orchestrator, right column = stacked agent logs.
// Uses a named "agent-logs" pane title to detect existing log column.

function findLogColumn() {
  // Look for any pane with title containing "agent-logs"
  try {
    const panes = execSync(
      `tmux list-panes -F '#{pane_id} #{pane_title} #{pane_left}'`,
      { encoding: "utf8" }
    ).trim().split("\n");
    // Find rightmost pane that's an agent-log pane
    let best = null;
    for (const line of panes) {
      const [id, title, left] = line.split(" ");
      if (title && title.startsWith("agent-logs")) {
        if (!best || Number(left) > Number(best.left)) {
          best = { id, left };
        }
      }
    }
    return best?.id || null;
  } catch {
    return null;
  }
}

function spawnLogPane(cmd) {
  const existing = findLogColumn();
  if (existing) {
    // Stack vertically in the existing log column
    execSync(`tmux split-window -v -t '${existing}' -l 30% '${cmd}'`);
  } else {
    // Create new right column (40% width)
    execSync(`tmux split-window -h -l 40% '${cmd}'`);
  }
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
    spawnLogPane(cmd);
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

// -- Terminal width tracking -------------------------------------------------
function getTermWidth() {
  try { return process.stdout.columns || 80; } catch { return 80; }
}
let termWidth = getTermWidth();
process.stdout.on("resize", () => { termWidth = getTermWidth(); });

// -- Speech bubble renderer -------------------------------------------------
function bubble(label, textLines, color, labelColor, indent = "") {
  const indentLen = indent.length;
  const MAX_W = Math.max(30, termWidth - indentLen - 2);
  // Calculate inner width from longest line
  const labelClean = label.replace(/[^\x20-\x7E\u{1F300}-\u{1FFFF}]/gu, "X"); // approx visible length
  const maxTextLen = Math.max(...textLines.map(l => l.length), labelClean.length + 2);
  const innerW = Math.min(Math.max(maxTextLen + 2, 20), MAX_W);

  const out = [];
  // Top border with label
  const labelStr = ` ${label} `;
  const topPad = Math.max(0, innerW - labelStr.length - 1);
  out.push(`${indent}${color}╭─${labelColor}${C.bold}${labelStr}${C.reset}${color}${"─".repeat(topPad)}╮${C.reset}`);

  // Content lines
  for (const line of textLines) {
    // Word-wrap long lines
    const wrapped = wrapText(line, innerW - 2);
    for (const wl of wrapped) {
      const pad = Math.max(0, innerW - wl.length - 2);
      out.push(`${indent}${color}│${C.reset} ${color}${wl}${" ".repeat(pad)}${C.reset} ${color}│${C.reset}`);
    }
  }

  // Bottom border
  out.push(`${indent}${color}╰${"─".repeat(innerW)}╯${C.reset}`);
  return out;
}

function wrapText(text, maxW) {
  if (text.length <= maxW) return [text];
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur.length + 1 + w.length) > maxW) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? cur + " " + w : w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// -- Format a single JSONL line ---------------------------------------------
let lastType = "";
let toolBatch = [];

function flushToolBatch(lines) {
  if (toolBatch.length === 0) return;
  const bubbleLines = bubble(
    "🔧 Tools",
    toolBatch,
    C.tool,
    C.toolLabel,
    "    "  // indented left = tool side
  );
  lines.push(...bubbleLines);
  lines.push("");
  toolBatch = [];
  const h = maybeHeckle();
  if (h) { lines.push(h); lines.push(""); }
}

function formatLine(obj) {
  const lines = [];

  if (obj.type === "system") {
    if (obj.subtype === "init" && obj.model) {
      lines.push(`${C.system}  ⚙  ${obj.model} connected${C.reset}`);
      lines.push("");
    }
  }

  else if (obj.type === "assistant" && obj.message?.content) {
    const hasText = obj.message.content.some(b => b.type === "text" && b.text?.trim());
    if (hasText) flushToolBatch(lines);

    for (const block of obj.message.content) {
      if (block.type === "text" && block.text?.trim()) {
        const clean = stripMd(block.text.trim());
        const textLines = clean.split("\n").filter(l => l.trim());
        if (lastType === "text" || lastType === "tool") lines.push("");

        const bubbleLines = bubble(
          "🤖 Agent",
          textLines,
          C.agent,
          C.agentLabel,
          "  "
        );
        lines.push(...bubbleLines);
        lines.push("");
        lastType = "text";
        const h = maybeHeckle();
        if (h) { lines.push(h); lines.push(""); }
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
        const bubbleLines = bubble("💭 Thinking", [text], C.think, C.think, "      ");
        lines.push(...bubbleLines);
        lines.push("");
        lastType = "thinking";
      }
    }
  }

  else if (obj.type === "tool_result") {
    if (opts.tools) {
      const content = trunc(typeof obj.content === "string" ? obj.content : JSON.stringify(obj.content), 150);
      lines.push(`${C.result}      ← ${content}${C.reset}`);
    }
    lastType = "result";
  }

  else if (obj.type === "result") {
    flushToolBatch(lines);
    const cost = obj.cost_usd != null ? `$${obj.cost_usd}` : "?";
    const dur = obj.duration_seconds != null ? `${Math.round(obj.duration_seconds / 60)}m` : "?";
    const turns = obj.num_turns ?? "?";
    lines.push("");
    const doneLines = bubble("🏁 Session Complete", [
      `Cost: ${cost}  Duration: ${dur}  Turns: ${turns}`,
    ], C.done, C.done, "  ");
    lines.push(...doneLines);
    lines.push(`${C.mayoBg}${C.bold} ${MAYO_FLAG} ${randomMayoName()}: MAYO FOR SAM!! The agents are DONE and Sam is COMING WEST!! 🏆 ${MAYO_FLAG} ${C.reset}`);
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

  // Set tmux pane title for layout detection
  try { execSync(`tmux select-pane -T 'agent-logs-${issue}'`, { stdio: "ignore" }); } catch {}

  // Header — adapts to terminal width
  const title = `#${issue} ${agent} (step ${step})`;
  const padW = Math.max(0, termWidth - title.length - 6);
  console.log(`${C.header}${C.bold}━━━ ${title} ${"━".repeat(padW)}${C.reset}`);
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
