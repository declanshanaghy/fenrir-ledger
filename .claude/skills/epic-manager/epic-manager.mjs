#!/usr/bin/env node
/**
 * epic-manager.mjs — Epic dependency graph tracker + dispatch advisor
 *
 * Reads tmp/epics/<N>.json, cross-references live GitHub issue states and
 * active GKE K8s jobs, then prints a dashboard showing what is done,
 * running, blocked, or ready to dispatch.
 *
 * Usage:
 *   node .claude/skills/epic-manager/epic-manager.mjs <root-issue-number> [--dispatch]
 *
 * Flags:
 *   --dispatch   Print ready dispatch commands (does not execute them)
 *   --json       Emit machine-readable JSON instead of human dashboard
 */

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

// ── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const rootIssue = args.find((a) => /^\d+$/.test(a));
const flagDispatch = args.includes("--dispatch");
const flagJson = args.includes("--json");

if (!rootIssue) {
  console.error("Usage: epic-manager.mjs <root-issue-number> [--dispatch] [--json]");
  process.exit(1);
}

// ── Load epic graph ─────────────────────────────────────────────────────────
const epicFile = resolve(`tmp/epics/${rootIssue}.json`);
if (!existsSync(epicFile)) {
  console.error(`Epic file not found: ${epicFile}`);
  console.error(`Run /plan-w-team or create it manually.`);
  process.exit(1);
}

const epic = JSON.parse(readFileSync(epicFile, "utf8"));
const stories = epic.stories ?? [];

// ── Helper: run a command and return stdout, or null on error ───────────────
function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
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
