#!/usr/bin/env node
/**
 * epic-manager.mjs — Epic dependency graph tracker + dispatch advisor
 *
 * Reads tmp/epics/<N>.yml, cross-references live GitHub issue states and
 * active GKE K8s jobs, then prints a dashboard showing what is done,
 * running, blocked, or ready to dispatch.
 *
 * Usage:
 *   node .claude/skills/epic-manager/epic-manager.mjs <root-issue-number> [--dispatch]
 *   node .claude/skills/epic-manager/epic-manager.mjs <root-issue-number> --add <N> --blocked-by <N>[,N...] [--wave <N>] [--parallel-with <N>[,N...]] [--note "..."]
 *
 * Flags:
 *   --dispatch        Print ready dispatch commands (does not execute them)
 *   --json            Emit machine-readable JSON instead of human dashboard
 *   --add <N>         Add issue #N to the graph (fetches title from GitHub)
 *   --blocked-by <N>  Comma-separated list of issues that must close before --add issue starts
 *   --wave <N>        Override wave assignment (default: auto-computed from blockers)
 *   --parallel-with   Comma-separated issues in the same wave that run alongside --add issue
 *   --note "..."      Optional note for the new story
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import yaml from "js-yaml";

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

// ── --help ───────────────────────────────────────────────────────────────────
if (args.includes("--help") || args.includes("-h")) {
  console.log(`
epic-manager — Epic dependency graph tracker + dispatch advisor

USAGE
  node epic-manager.mjs <root-issue>              Show dashboard
  node epic-manager.mjs <root-issue> --dispatch   Dashboard + copy-paste dispatch commands
  node epic-manager.mjs <root-issue> --add <N>    Add a new story to the graph
  node epic-manager.mjs <root-issue> --json       Machine-readable JSON output

DASHBOARD EXAMPLES
  # Show the live status of epic #1386
  node epic-manager.mjs 1386

  # Show dashboard and print ready dispatch commands
  node epic-manager.mjs 1386 --dispatch

ADD STORY EXAMPLES
  # Add issue #1507 blocked by #1495 (wave auto-computed)
  node epic-manager.mjs 1386 --add 1507 --blocked-by 1495

  # Add issue #1508 running in parallel with #1507 at wave 3
  node epic-manager.mjs 1386 --add 1508 --blocked-by 1495 --parallel-with 1507

  # Add with explicit wave override and a note
  node epic-manager.mjs 1386 --add 1509 --blocked-by 1495 --wave 3 --note "Extra context here"

ADD FLAGS
  --add <N>              Issue number to insert into the graph
  --blocked-by <N>[,N]   Comma-separated blockers (must close before this starts)
  --parallel-with <N>[,N] Peers in the same wave (bidirectional link)
  --wave <N>             Override wave (default: max blocker wave + 1)
  --note "..."           Optional note stored in the YAML

DASHBOARD ICONS
  ✅  done      — GitHub issue is CLOSED
  🔄  running   — Active K8s job found for this issue
  🟢  ready     — All blockers closed, not yet running
  🔴  blocked   — One or more blockers still OPEN
  ⚠️   duplicate — duplicate_of is set; close manually before dispatching

EPIC FILE
  Reads/writes tmp/epics/<root-issue>.yml
  Auto-migrates legacy .json files to .yml on first run.
`);
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
  console.error("Usage: epic-manager.mjs <root-issue-number> [--dispatch|--add|--json]");
  console.error("       epic-manager.mjs --help   for full usage and examples");
  process.exit(1);
}

// ── Load epic graph ─────────────────────────────────────────────────────────
const epicFileYml = resolve(`tmp/epics/${rootIssue}.yml`);
const epicFileJson = resolve(`tmp/epics/${rootIssue}.json`);

let epicFile = epicFileYml;
if (!existsSync(epicFileYml)) {
  if (existsSync(epicFileJson)) {
    // Migrate: convert .json → .yml and delete the .json
    const data = JSON.parse(readFileSync(epicFileJson, "utf8"));
    writeFileSync(epicFileYml, yaml.dump(data, { lineWidth: 120, quotingType: '"' }), "utf8");
    unlinkSync(epicFileJson);
    console.log(`  Migrated ${epicFileJson} → ${epicFileYml}`);
  } else {
    console.error(`Epic file not found: ${epicFileYml}`);
    console.error(`Run /plan-w-team or create it manually.`);
    process.exit(1);
  }
}

const epic = yaml.load(readFileSync(epicFile, "utf8"));
const stories = epic.stories ?? [];

// ── Helper: run a command and return stdout, or null on error ───────────────
function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

// ── --add mode ───────────────────────────────────────────────────────────────
if (flagAdd) {
  if (isNaN(flagAdd)) {
    console.error("--add requires a valid issue number");
    process.exit(1);
  }

  // Check not already in graph
  if (stories.find((s) => s.number === flagAdd)) {
    console.error(`Issue #${flagAdd} is already in the epic graph.`);
    process.exit(1);
  }

  // Fetch issue title from GitHub
  console.log(`Fetching issue #${flagAdd} from GitHub...`);
  const ghRaw = run(`gh issue view ${flagAdd} --json number,state,title 2>/dev/null`);
  if (!ghRaw) {
    console.error(`Could not fetch issue #${flagAdd} from GitHub.`);
    process.exit(1);
  }
  const ghData = JSON.parse(ghRaw);
  const newTitle = ghData.title ?? `Issue #${flagAdd}`;
  const newState = ghData.state?.toLowerCase() ?? "open";

  // Auto-compute wave: max wave of all blockers + 1, or 0 if no blockers
  let newWave = flagWave;
  if (newWave === null || isNaN(newWave)) {
    if (flagBlockedBy.length === 0) {
      newWave = 0;
    } else {
      const blockerWaves = flagBlockedBy.map((b) => {
        const s = stories.find((s) => s.number === b);
        return s ? (s.wave ?? 0) : 0;
      });
      newWave = Math.max(...blockerWaves) + 1;
    }
  }

  // Build new story entry
  const newStory = {
    number: flagAdd,
    title: newTitle,
    state: newState,
    wave: newWave,
    blocks: [],
    blocked_by: flagBlockedBy,
    parallel_with: flagParallelWith,
    duplicate_of: null,
    note: flagNote,
  };

  // Update blocks[] on each blocker
  for (const blockerNum of flagBlockedBy) {
    const blocker = stories.find((s) => s.number === blockerNum);
    if (blocker) {
      if (!blocker.blocks) blocker.blocks = [];
      if (!blocker.blocks.includes(flagAdd)) {
        blocker.blocks.push(flagAdd);
      }
    } else {
      console.warn(`  ⚠ Blocker #${blockerNum} not found in graph — skipping blocks[] update`);
    }
  }

  // Update parallel_with[] on peers (bidirectional)
  for (const peerNum of flagParallelWith) {
    const peer = stories.find((s) => s.number === peerNum);
    if (peer) {
      if (!peer.parallel_with) peer.parallel_with = [];
      if (!peer.parallel_with.includes(flagAdd)) {
        peer.parallel_with.push(flagAdd);
      }
    } else {
      console.warn(`  ⚠ Peer #${peerNum} not found in graph — skipping parallel_with[] update`);
    }
  }

  // Insert in wave order
  const insertIdx = stories.findIndex((s) => (s.wave ?? 0) > newWave);
  if (insertIdx === -1) {
    stories.push(newStory);
  } else {
    stories.splice(insertIdx, 0, newStory);
  }

  epic.stories = stories;
  writeFileSync(epicFile, yaml.dump(epic, { lineWidth: 120, quotingType: '"' }), "utf8");
  console.log(`  ✅ Added #${flagAdd} "${newTitle}" at wave ${newWave} to ${epicFile}`);
  if (flagBlockedBy.length > 0) {
    console.log(`     blocked_by: [${flagBlockedBy.join(", ")}]`);
  }
  if (flagParallelWith.length > 0) {
    console.log(`     parallel_with: [${flagParallelWith.join(", ")}]`);
  }
  console.log();
  // Fall through to render dashboard
}

// ── 1. Batch-fetch GitHub issue states ─────────────────────────────────────
// Fetch all issues in parallel using Promise-like pattern via synchronous
// child_process — one gh call per issue (gh doesn't support batch JSON).
const issueNumbers = [...new Set(stories.flatMap((s) => [s.number, ...(s.blocked_by ?? [])]))];

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
// Job names: agent-issue-<N>-step<S>-<agent>-<uuid>
// Labels:    fenrir.dev/session-id: "issue-<N>-step<S>-<agent>-<uuid>"
//
// A job is "running" only if status.active > 0 (not completed/failed).
const runningIssues = new Set();
const jobDetails = {}; // issueN -> { jobName, agent, sessionId }

const k8sRaw = run("kubectl get jobs -n fenrir-agents -o json 2>/dev/null");
if (k8sRaw) {
  let k8sJobs;
  try { k8sJobs = JSON.parse(k8sRaw).items ?? []; } catch { k8sJobs = []; }

  for (const job of k8sJobs) {
    const active = (job.status?.active ?? 0) > 0;
    if (!active) continue; // skip completed / failed

    const name = job.metadata?.name ?? "";
    const labels = job.metadata?.labels ?? {};
    const sessionId = labels["fenrir.dev/session-id"] ?? labels["fenrir/session-id"] ?? "";

    // Extract issue number from session-id label first (most reliable),
    // then fall back to job name pattern.
    const sources = [sessionId, name];
    for (const src of sources) {
      const m = src.match(/issue[_-](\d+)/i);
      if (m) {
        const issueN = parseInt(m[1], 10);
        runningIssues.add(issueN);
        // Extract agent name from session id (issue-N-stepS-AGENT-uuid)
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
// Priority: closed > running > blocked > ready > open(unknown)
function computeStatus(story) {
  const ghState = ghStates[story.number]?.state ?? "UNKNOWN";
  if (ghState === "CLOSED") return "done";

  if (runningIssues.has(story.number)) return "running";

  const blockers = story.blocked_by ?? [];
  const openBlockers = blockers.filter((b) => ghStates[b]?.state !== "CLOSED");
  if (openBlockers.length > 0) return "blocked";

  // Marked as duplicate — skip unless it's the canonical one
  if (story.duplicate_of) return "duplicate";

  return "ready";
}

const computed = stories.map((s) => ({
  ...s,
  _status: computeStatus(s),
  _ghTitle: ghStates[s.number]?.title ?? s.title,
  _ghState: ghStates[s.number]?.state ?? "UNKNOWN",
  _openBlockers: (s.blocked_by ?? []).filter((b) => ghStates[b]?.state !== "CLOSED"),
  _jobDetail: jobDetails[s.number] ?? null,
}));

// ── 4. JSON output mode ─────────────────────────────────────────────────────
if (flagJson) {
  console.log(JSON.stringify({ epic: epic.epic, stories: computed, runningIssues: [...runningIssues] }, null, 2));
  process.exit(0);
}

// ── 5. Dashboard output ─────────────────────────────────────────────────────
const STATUS_ICON = {
  done:      "✅",
  running:   "🔄",
  ready:     "🟢",
  blocked:   "🔴",
  duplicate: "⚠️ ",
};
const STATUS_LABEL = {
  done:      "DONE",
  running:   "RUNNING",
  ready:     "READY",
  blocked:   "BLOCKED",
  duplicate: "DUPLICATE",
};

console.log(`\n${"═".repeat(72)}`);
console.log(`  EPIC #${epic.epic?.number ?? rootIssue} — ${epic.epic?.title ?? "Odin's Spear"}`);
console.log(`${"═".repeat(72)}\n`);

// Group by wave
const waves = [...new Set(computed.map((s) => s.wave ?? 0))].sort((a, b) => a - b);

for (const wave of waves) {
  const waveStories = computed.filter((s) => (s.wave ?? 0) === wave);
  const allDone = waveStories.every((s) => s._status === "done");
  const waveIcon = allDone ? "✅" : "  ";
  console.log(`${waveIcon} Wave ${wave}${waveStories.length > 1 && !allDone ? "  (parallel)" : ""}`);

  for (const s of waveStories) {
    const icon = STATUS_ICON[s._status] ?? "  ";
    const label = STATUS_LABEL[s._status] ?? s._status.toUpperCase();
    const titleTrunc = s._ghTitle.length > 52 ? s._ghTitle.slice(0, 49) + "…" : s._ghTitle;
    const jobInfo = s._jobDetail ? `  [${s._jobDetail.agent} @ ${s._jobDetail.sessionId}]` : "";
    const blockerInfo =
      s._openBlockers.length > 0
        ? `  ← blocked by #${s._openBlockers.join(", #")}`
        : "";
    const dupInfo = s.duplicate_of ? `  ← duplicate of #${s.duplicate_of}` : "";

    console.log(`    ${icon} #${String(s.number).padEnd(6)} [${label.padEnd(9)}]  ${titleTrunc}${jobInfo}${blockerInfo}${dupInfo}`);
  }
  console.log();
}

// ── Summary counts ──────────────────────────────────────────────────────────
const counts = { done: 0, running: 0, ready: 0, blocked: 0, duplicate: 0 };
for (const s of computed) counts[s._status] = (counts[s._status] ?? 0) + 1;

console.log(`${"─".repeat(72)}`);
console.log(
  `  ${counts.done} done  |  ${counts.running} running  |  ${counts.ready} ready  |  ${counts.blocked} blocked  |  ${counts.duplicate} duplicate`
);
console.log(`${"─".repeat(72)}\n`);

// ── 6. Ready stories — dispatch suggestions ─────────────────────────────────
const readyStories = computed.filter((s) => s._status === "ready");
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
    const nums = readyStories.map((s) => `#${s.number}`).join(" ");
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

// ── 7. Warnings ─────────────────────────────────────────────────────────────
const duplicates = computed.filter((s) => s._status === "duplicate");
if (duplicates.length > 0) {
  console.log("  ⚠️  Duplicate stories detected — close before dispatching:");
  for (const s of duplicates) {
    console.log(`    #${s.number} — ${s._ghTitle}  (duplicate of #${s.duplicate_of})`);
    console.log(`    gh issue close ${s.number} --comment "Superseded by #${s.duplicate_of}"`);
  }
  console.log();
}
