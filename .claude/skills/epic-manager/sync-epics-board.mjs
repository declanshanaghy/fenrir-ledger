#!/usr/bin/env node
/**
 * sync-epics-board.mjs — Syncs epic YAML state to GitHub Project #2 (Epics board)
 *
 * For each epic YAML in tmp/epics/, queries live GitHub issue states, computes
 * progress metrics, and updates the corresponding tracker issue's project fields.
 *
 * Usage:
 *   node .claude/skills/epic-manager/sync-epics-board.mjs
 *
 * Help: see SKILL.md
 */

import { readFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, basename } from "node:path";

const REPO_ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const EPICS_DIR = resolve(REPO_ROOT, "tmp/epics");
const PROJECT_NUMBER = 2;
const OWNER = "declanshanaghy";

function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

function loadYaml(filePath) {
  // Inline YAML parser — just enough for our epic schema (no dependency needed)
  const text = readFileSync(filePath, "utf8");
  // Use js-yaml if available, otherwise fall back to Python
  try {
    const result = run(`python3 -c "import yaml, json, sys; print(json.dumps(yaml.safe_load(sys.stdin.read())))" <<'YAMLEOF'\n${text}\nYAMLEOF`);
    return result ? JSON.parse(result) : null;
  } catch {
    return null;
  }
}

// ── Find all epic YAML files ─────────────────────────────────────────────────
let epicFiles;
try {
  epicFiles = readdirSync(EPICS_DIR).filter((f) => f.endsWith(".yml"));
} catch {
  console.error(`No epics directory found at ${EPICS_DIR}`);
  process.exit(1);
}

if (epicFiles.length === 0) {
  console.log("No epic YAML files found.");
  process.exit(0);
}

console.log(`\n${"═".repeat(60)}`);
console.log(`  EPIC BOARD SYNC — ${epicFiles.length} epics found`);
console.log(`${"═".repeat(60)}\n`);

// ── Find tracker issues on the board ─────────────────────────────────────────
const trackerIssuesRaw = run(
  `gh issue list --search "[Epic] in:title" --state open --json number,title --limit 50`
);
const trackerIssues = trackerIssuesRaw ? JSON.parse(trackerIssuesRaw) : [];

// ── Get project field IDs ────────────────────────────────────────────────────
const fieldsRaw = run(
  `gh project field-list ${PROJECT_NUMBER} --owner ${OWNER} --format json`
);
const fields = fieldsRaw ? JSON.parse(fieldsRaw).fields : [];

function fieldId(name) {
  const f = fields.find((f) => f.name === name);
  return f ? f.id : null;
}

// ── Process each epic ────────────────────────────────────────────────────────
for (const file of epicFiles) {
  const filePath = resolve(EPICS_DIR, file);
  const epic = loadYaml(filePath);
  if (!epic || !epic.stories) {
    console.warn(`  ⚠ Skipping ${file}: invalid YAML`);
    continue;
  }

  const epicTitle = epic.epic?.title ?? basename(file, ".yml");
  const epicNumber = epic.epic?.number;
  const stories = epic.stories.filter((s) => !s.duplicate_of);

  // Find the matching tracker issue
  const tracker = trackerIssues.find(
    (t) =>
      t.title.includes(epicTitle) ||
      t.title.includes(`#${epicNumber}`)
  );

  if (!tracker) {
    console.log(`  ⚠ No tracker issue found for "${epicTitle}" — skipping`);
    continue;
  }

  console.log(`  📋 Epic: ${epicTitle} (tracker #${tracker.number})`);

  // Fetch live GitHub states for all story issues
  const issueNumbers = [...new Set(stories.map((s) => s.number))];
  const ghStates = {};
  for (const n of issueNumbers) {
    const raw = run(`gh issue view ${n} --json number,state 2>/dev/null`);
    if (raw) {
      try {
        const data = JSON.parse(raw);
        ghStates[n] = data.state?.toUpperCase();
      } catch {
        ghStates[n] = "UNKNOWN";
      }
    } else {
      ghStates[n] = "UNKNOWN";
    }
  }

  // Check for running K8s jobs
  const runningIssues = new Set();
  const k8sRaw = run("kubectl get jobs -n fenrir-agents -o json 2>/dev/null");
  if (k8sRaw) {
    try {
      const jobs = JSON.parse(k8sRaw).items ?? [];
      for (const job of jobs) {
        if ((job.status?.active ?? 0) <= 0) continue;
        const name = job.metadata?.name ?? "";
        const labels = job.metadata?.labels ?? {};
        const sessionId = labels["fenrir.dev/session-id"] ?? "";
        const sources = [sessionId, name];
        for (const src of sources) {
          const m = src.match(/issue[_-](\d+)/i);
          if (m) {
            runningIssues.add(parseInt(m[1], 10));
            break;
          }
        }
      }
    } catch { /* ignore */ }
  }

  // Compute statuses
  let done = 0, running = 0, ready = 0, blocked = 0;
  let currentWave = -1;

  for (const s of stories) {
    const state = ghStates[s.number];
    if (state === "CLOSED") {
      done++;
      continue;
    }
    if (runningIssues.has(s.number)) {
      running++;
      if (currentWave < 0 || (s.wave ?? 0) < currentWave) currentWave = s.wave ?? 0;
      continue;
    }
    const blockers = s.blocked_by ?? [];
    const openBlockers = blockers.filter((b) => ghStates[b] !== "CLOSED");
    if (openBlockers.length > 0) {
      blocked++;
    } else {
      ready++;
      if (currentWave < 0 || (s.wave ?? 0) < currentWave) currentWave = s.wave ?? 0;
    }
  }

  const total = stories.length;
  const totalWaves = Math.max(...stories.map((s) => s.wave ?? 0)) + 1;
  if (currentWave < 0) currentWave = done === total ? totalWaves - 1 : 0;

  // Build progress bar: ████░░░░ 3/8 (37%)
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const barLen = 10;
  const filled = Math.round((done / total) * barLen);
  const bar = "█".repeat(filled) + "░".repeat(barLen - filled);
  const progress = `${bar} ${done}/${total} (${pct}%)`;

  // Build dependency summary
  const waveGroups = [...new Set(stories.map((s) => s.wave ?? 0))].sort((a, b) => a - b);
  const depLines = [];
  for (const w of waveGroups) {
    const ws = stories.filter((s) => (s.wave ?? 0) === w);
    const wDone = ws.every((s) => ghStates[s.number] === "CLOSED");
    const icon = wDone ? "✅" : w === currentWave ? "▶" : "⏳";
    const nums = ws.map((s) => `#${s.number}`).join(", ");
    depLines.push(`${icon} W${w}: ${nums}`);
  }
  const depGraph = depLines.join(" | ");

  console.log(`     ${progress}`);
  console.log(`     ${depGraph}`);

  // Find the project item ID for this tracker issue
  const itemsRaw = run(
    `gh project item-list ${PROJECT_NUMBER} --owner ${OWNER} --format json`
  );
  const items = itemsRaw ? JSON.parse(itemsRaw).items : [];
  const item = items.find(
    (i) => i.content?.number === tracker.number && i.content?.type === "Issue"
  );

  if (!item) {
    console.log(`     ⚠ Tracker #${tracker.number} not on Epics board — adding...`);
    run(`gh project item-add ${PROJECT_NUMBER} --owner ${OWNER} --url https://github.com/declanshanaghy/fenrir-ledger/issues/${tracker.number}`);
    // Re-fetch to get item ID
    const itemsRaw2 = run(
      `gh project item-list ${PROJECT_NUMBER} --owner ${OWNER} --format json`
    );
    const items2 = itemsRaw2 ? JSON.parse(itemsRaw2).items : [];
    const item2 = items2.find(
      (i) => i.content?.number === tracker.number && i.content?.type === "Issue"
    );
    if (!item2) {
      console.log(`     ❌ Could not add tracker #${tracker.number} to board`);
      continue;
    }
    updateFields(item2.id, { total, done, running, ready, blocked, currentWave, totalWaves, progress, depGraph });
  } else {
    updateFields(item.id, { total, done, running, ready, blocked, currentWave, totalWaves, progress, depGraph });
  }

  console.log(`     ✅ Board fields updated\n`);
}

function updateFields(itemId, data) {
  const updates = [
    ["Total Stories", data.total],
    ["Done", data.done],
    ["Running", data.running],
    ["Ready", data.ready],
    ["Blocked", data.blocked],
    ["Current Wave", data.currentWave],
    ["Total Waves", data.totalWaves],
  ];

  for (const [name, value] of updates) {
    const fid = fieldId(name);
    if (!fid) continue;
    run(
      `gh project item-edit --project-id PVT_kwHOAAW5PM4BSRfB --id ${itemId} --field-id ${fid} --number ${value}`
    );
  }

  // Text fields
  const progressFid = fieldId("Progress");
  if (progressFid) {
    run(
      `gh project item-edit --project-id PVT_kwHOAAW5PM4BSRfB --id ${itemId} --field-id ${progressFid} --text "${data.progress}"`
    );
  }

  const depFid = fieldId("Dependency Graph");
  if (depFid) {
    run(
      `gh project item-edit --project-id PVT_kwHOAAW5PM4BSRfB --id ${itemId} --field-id ${depFid} --text "${data.depGraph}"`
    );
  }
}

console.log(`${"─".repeat(60)}`);
console.log(`  Sync complete. View board: https://github.com/users/declanshanaghy/projects/2`);
console.log(`${"─".repeat(60)}\n`);
