#!/usr/bin/env node
/**
 * epic-manager.mjs — Epic dependency graph tracker + dispatch advisor
 *
 * Reads the [Epic] tracker issue body from GitHub to get the dependency graph,
 * cross-references live GitHub issue states and active GKE K8s jobs, then
 * prints a dashboard showing what is done, running, blocked, or ready.
 *
 * No YAML files — GitHub is the single source of truth.
 */

import { execSync } from "node:child_process";

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h") || args.length === 0) {
  console.log(`epic-manager — Epic dependency graph tracker + dispatch advisor

USAGE
  node epic-manager.mjs <N>              Show dashboard for epic tracker #N
  node epic-manager.mjs <N> --dispatch   Dashboard + copy-paste dispatch commands
  node epic-manager.mjs <N> --json       Machine-readable JSON output
  node epic-manager.mjs <N> --add <M> --blocked-by <X>[,Y]  Add story #M

DASHBOARD ICONS
  ✅  done      — GitHub issue is CLOSED
  🔄  running   — Active K8s job found for this issue
  🟢  ready     — All blockers closed, not yet running
  🔴  blocked   — One or more blockers still OPEN

SOURCE OF TRUTH
  The [Epic] tracker issue body on GitHub contains the dependency graph.
  No local YAML files — GitHub is the single source of truth.`);
  process.exit(0);
}

const rootIssue = args.find((a) => /^\d+$/.test(a));
const flagDispatch = args.includes("--dispatch");
const flagJson = args.includes("--json");

// --add mode args
const addIdx = args.indexOf("--add");
const flagAdd = addIdx !== -1 ? parseInt(args[addIdx + 1], 10) : null;

function parseNumList(flag) {
  const idx = args.indexOf(flag);
  if (idx === -1) return [];
  return (args[idx + 1] ?? "")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
}

const flagBlockedBy = parseNumList("--blocked-by");
const flagParallelWith = parseNumList("--parallel-with");

const waveIdx = args.indexOf("--wave");
const flagWave = waveIdx !== -1 ? parseInt(args[waveIdx + 1], 10) : null;

const noteIdx = args.indexOf("--note");
const flagNote = noteIdx !== -1 ? (args[noteIdx + 1] ?? "") : "";

if (!rootIssue) {
  console.error("Usage: node epic-manager.mjs <tracker-issue-number> [--dispatch|--add|--json]");
  process.exit(1);
}

// ── Helper: run a command and return stdout, or null on error ───────────────
function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

// ── Load epic graph from GitHub tracker issue ──────────────────────────────
const trackerRaw = run(`gh issue view ${rootIssue} --json number,title,body,state`);
if (!trackerRaw) {
  console.error(`Could not fetch tracker issue #${rootIssue} from GitHub.`);
  process.exit(1);
}

const tracker = JSON.parse(trackerRaw);

if (!tracker.title?.startsWith("[Epic]")) {
  console.error(`Issue #${rootIssue} is not an [Epic] tracker issue (title: "${tracker.title}").`);
  console.error(`Epic tracker issues must have titles starting with "[Epic]".`);
  process.exit(1);
}

const epicTitle = tracker.title.replace(/^\[Epic\]\s*/, "");
const body = tracker.body ?? "";

// ── Parse dependency graph from tracker issue body ─────────────────────────
// Format: | Wave | Issue | Title | Depends On |
// Example: | 0 | #1516 | Migrate trial store | — |
const depGraphRegex = /\|\s*(\d+)\s*\|\s*#(\d+)\s*\|\s*([^|]+)\|\s*([^|]*)\|/g;
const stories = [];
let match;

while ((match = depGraphRegex.exec(body)) !== null) {
  const wave = parseInt(match[1], 10);
  const number = parseInt(match[2], 10);
  const title = match[3].trim();
  const depsStr = match[4].trim();

  const blocked_by = depsStr === "—" || depsStr === "-" || depsStr === ""
    ? []
    : depsStr.split(",").map(s => {
        const m = s.trim().match(/#(\d+)/);
        return m ? parseInt(m[1], 10) : NaN;
      }).filter(n => !isNaN(n));

  stories.push({ number, title, wave, blocked_by });
}

if (stories.length === 0) {
  console.error(`No dependency graph found in tracker issue #${rootIssue} body.`);
  console.error(`Expected a markdown table with columns: Wave | Issue | Title | Depends On`);
  process.exit(1);
}

// ── --add mode: update the tracker issue body on GitHub ────────────────────
if (flagAdd) {
  if (isNaN(flagAdd)) {
    console.error("--add requires a valid issue number");
    process.exit(1);
  }

  if (stories.find(s => s.number === flagAdd)) {
    console.error(`Issue #${flagAdd} is already in the epic graph.`);
    process.exit(1);
  }

  // Fetch issue title from GitHub
  console.log(`Fetching issue #${flagAdd} from GitHub...`);
  const ghRaw = run(`gh issue view ${flagAdd} --json number,title`);
  if (!ghRaw) {
    console.error(`Could not fetch issue #${flagAdd} from GitHub.`);
    process.exit(1);
  }
  const ghData = JSON.parse(ghRaw);
  const newTitle = ghData.title ?? `Issue #${flagAdd}`;

  // Auto-compute wave
  let newWave = flagWave;
  if (newWave === null || isNaN(newWave)) {
    if (flagBlockedBy.length === 0) {
      newWave = 0;
    } else {
      const blockerWaves = flagBlockedBy.map(b => {
        const s = stories.find(s => s.number === b);
        return s ? s.wave : 0;
      });
      newWave = Math.max(...blockerWaves) + 1;
    }
  }

  const depsStr = flagBlockedBy.length > 0
    ? flagBlockedBy.map(n => `#${n}`).join(", ")
    : "—";

  // Add row to dependency graph table
  const newRow = `| ${newWave} | #${flagAdd} | ${newTitle} | ${depsStr} |`;
  const tableEndRegex = /(\n### Tracked Issues)/;
  let updatedBody = body.replace(tableEndRegex, `\n${newRow}\n$1`);

  // Add to tracked issues checklist
  const checklistEndRegex = /(This issue will close automatically)/;
  updatedBody = updatedBody.replace(checklistEndRegex, `- [ ] #${flagAdd}\n\n$1`);

  // Update the tracker issue on GitHub
  const tmpFile = `/tmp/epic-tracker-body-${rootIssue}.md`;
  const { writeFileSync, unlinkSync } = await import("node:fs");
  writeFileSync(tmpFile, updatedBody, "utf8");
  const updateResult = run(`gh issue edit ${rootIssue} --body-file "${tmpFile}"`);
  unlinkSync(tmpFile);

  if (!updateResult && updateResult !== "") {
    console.error(`Failed to update tracker issue #${rootIssue} on GitHub.`);
    process.exit(1);
  }

  // Link as GitHub sub-issue (populates "Sub-issues progress" on project board)
  run(`gh issue edit ${rootIssue} --add-sub-issue ${flagAdd} 2>/dev/null`);

  console.log(`  ✅ Added #${flagAdd} "${newTitle}" at wave ${newWave} to tracker #${rootIssue}`);
  if (flagBlockedBy.length > 0) console.log(`     blocked_by: [${flagBlockedBy.join(", ")}]`);
  console.log();

  // Re-parse the updated body for dashboard
  stories.push({ number: flagAdd, title: newTitle, wave: newWave, blocked_by: flagBlockedBy });
}

// ── 1. Batch-fetch GitHub issue states ─────────────────────────────────────
const issueNumbers = [...new Set(stories.flatMap(s => [s.number, ...s.blocked_by]))];

const ghStates = {};
for (const n of issueNumbers) {
  const raw = run(`gh issue view ${n} --json number,state,title 2>/dev/null`);
  if (raw) {
    try {
      const data = JSON.parse(raw);
      ghStates[data.number] = { state: data.state?.toUpperCase(), title: data.title };
    } catch {
      ghStates[n] = { state: "UNKNOWN", title: `issue #${n}` };
    }
  } else {
    ghStates[n] = { state: "UNKNOWN", title: `issue #${n}` };
  }
}

// ── 2. Query active GKE K8s jobs ────────────────────────────────────────────
const runningIssues = new Set();
const jobDetails = {};

const k8sRaw = run("kubectl get jobs -n fenrir-agents -o json 2>/dev/null");
if (k8sRaw) {
  let k8sJobs;
  try { k8sJobs = JSON.parse(k8sRaw).items ?? []; } catch { k8sJobs = []; }

  for (const job of k8sJobs) {
    const active = (job.status?.active ?? 0) > 0;
    if (!active) continue;

    const name = job.metadata?.name ?? "";
    const labels = job.metadata?.labels ?? {};
    const sessionId = labels["fenrir.dev/session-id"] ?? labels["fenrir/session-id"] ?? "";

    const sources = [sessionId, name];
    for (const src of sources) {
      const m = src.match(/issue[_-](\d+)/i);
      if (m) {
        const issueN = parseInt(m[1], 10);
        runningIssues.add(issueN);
        const agentM = sessionId.match(/issue-\d+-step\d+-([a-z-]+)-[a-f0-9]+/i);
        jobDetails[issueN] = {
          jobName: name,
          agent: agentM ? agentM[1] : "unknown",
          sessionId,
        };
        break;
      }
    }
  }
}

// ── 3. Compute per-story status ─────────────────────────────────────────────
function computeStatus(story) {
  const ghState = ghStates[story.number]?.state ?? "UNKNOWN";
  if (ghState === "CLOSED") return "done";
  if (runningIssues.has(story.number)) return "running";

  const openBlockers = story.blocked_by.filter(b => ghStates[b]?.state !== "CLOSED");
  if (openBlockers.length > 0) return "blocked";

  return "ready";
}

const computed = stories.map(s => ({
  ...s,
  _status: computeStatus(s),
  _ghTitle: ghStates[s.number]?.title ?? s.title,
  _ghState: ghStates[s.number]?.state ?? "UNKNOWN",
  _openBlockers: s.blocked_by.filter(b => ghStates[b]?.state !== "CLOSED"),
  _jobDetail: jobDetails[s.number] ?? null,
}));

// ── 4. JSON output mode ─────────────────────────────────────────────────────
if (flagJson) {
  console.log(JSON.stringify({
    tracker: rootIssue,
    title: epicTitle,
    stories: computed,
    runningIssues: [...runningIssues],
  }, null, 2));
  process.exit(0);
}

// ── 5. Dashboard output ─────────────────────────────────────────────────────
const STATUS_ICON = {
  done:    "✅",
  running: "🔄",
  ready:   "🟢",
  blocked: "🔴",
};
const STATUS_LABEL = {
  done:    "DONE",
  running: "RUNNING",
  ready:   "READY",
  blocked: "BLOCKED",
};

console.log(`\n${"═".repeat(72)}`);
console.log(`  EPIC #${rootIssue} — ${epicTitle}`);
console.log(`${"═".repeat(72)}\n`);

const waves = [...new Set(computed.map(s => s.wave))].sort((a, b) => a - b);

for (const wave of waves) {
  const waveStories = computed.filter(s => s.wave === wave);
  const allDone = waveStories.every(s => s._status === "done");
  const waveIcon = allDone ? "✅" : "  ";
  console.log(`${waveIcon} Wave ${wave}${waveStories.length > 1 && !allDone ? "  (parallel)" : ""}`);

  for (const s of waveStories) {
    const icon = STATUS_ICON[s._status] ?? "  ";
    const label = STATUS_LABEL[s._status] ?? s._status.toUpperCase();
    const titleTrunc = s._ghTitle.length > 52 ? s._ghTitle.slice(0, 49) + "…" : s._ghTitle;
    const jobInfo = s._jobDetail ? `  [${s._jobDetail.agent} @ ${s._jobDetail.sessionId}]` : "";
    const blockerInfo = s._openBlockers.length > 0
      ? `  ← blocked by #${s._openBlockers.join(", #")}`
      : "";

    console.log(`    ${icon} #${String(s.number).padEnd(6)} [${label.padEnd(9)}]  ${titleTrunc}${jobInfo}${blockerInfo}`);
  }
  console.log();
}

// ── Summary counts ──────────────────────────────────────────────────────────
const counts = { done: 0, running: 0, ready: 0, blocked: 0 };
for (const s of computed) counts[s._status] = (counts[s._status] ?? 0) + 1;

console.log(`${"─".repeat(72)}`);
console.log(
  `  ${counts.done} done  |  ${counts.running} running  |  ${counts.ready} ready  |  ${counts.blocked} blocked`
);
console.log(`${"─".repeat(72)}\n`);

// ── 6. Ready stories — dispatch suggestions ─────────────────────────────────
const readyStories = computed.filter(s => s._status === "ready");
if (readyStories.length === 0) {
  if (counts.running > 0) {
    console.log("  No new stories ready — waiting for running jobs to complete.\n");
  } else if (counts.done === computed.length) {
    console.log("  🎉 Epic complete — all stories done.\n");
  } else {
    console.log("  No stories ready. Check blocked dependencies above.\n");
  }
} else {
  const parallel = readyStories.length > 1;
  console.log(
    `  ${parallel ? "⚡ Parallel dispatch available" : "▶  Next to dispatch"} (${readyStories.length} issue${readyStories.length > 1 ? "s" : ""}):\n`
  );

  for (const s of readyStories) {
    console.log(`    /dispatch #${s.number}   — ${s._ghTitle}`);
  }

  if (parallel) {
    const nums = readyStories.map(s => `#${s.number}`).join(" ");
    console.log(`\n    Or dispatch all in parallel:\n    /fire-next-up ${nums}`);
  }

  if (flagDispatch) {
    console.log("\n  ── Dispatch commands (copy-paste) ──────────────────────────────");
    for (const s of readyStories) {
      console.log(`  /dispatch #${s.number}`);
    }
  }
}

console.log();
