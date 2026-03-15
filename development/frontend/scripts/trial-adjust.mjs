#!/usr/bin/env node
/**
 * trial-adjust.mjs — Interactive REPL for managing trial state in Redis.
 *
 * Usage:
 *   just frontend adjust-trial                        # from repo root (recommended)
 *   node development/frontend/scripts/trial-adjust.mjs  # direct invocation
 *
 * For production: kubectl port-forward svc/redis 6379:6379 -n fenrir-app
 *
 * Trial identity:
 *   - Trial key in Redis: trial:{fingerprint}
 *   - Fingerprint = SHA-256(navigator.userAgent + deviceId)
 *   - deviceId is stored in browser localStorage under "fenrir:device-id"
 *   - To find yours: browser DevTools console → localStorage.getItem('fenrir:device-id')
 *   - Or just use "list" in this REPL to see all trials and pick by number
 */

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Redis = require("ioredis").default;
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { execSync, spawn } from "node:child_process";
import { createConnection } from "node:net";

// ── Constants ────────────────────────────────────────────────────────────────

const TRIAL_DURATION_DAYS = 30;
const TRIAL_TTL_SECONDS = 60 * 24 * 60 * 60;
const STATUS_EMOJI = { active: "\u001b[32m●\u001b[0m", expired: "\u001b[31m●\u001b[0m", converted: "\u001b[33m★\u001b[0m", none: "\u001b[90m○\u001b[0m" };
const BOLD = "\u001b[1m";
const DIM = "\u001b[2m";
const RESET = "\u001b[0m";
const GOLD = "\u001b[33m";
const GREEN = "\u001b[32m";
const RED = "\u001b[31m";
const CYAN = "\u001b[36m";

// ── Args ─────────────────────────────────────────────────────────────────────

const { values } = parseArgs({
  options: {
    "redis-url": { type: "string" },
    help:        { type: "boolean", short: "h", default: false },
  },
  strict: true,
});

if (values.help) {
  console.log(`
${BOLD}trial-adjust.mjs${RESET} — Interactive REPL for managing trial state in Redis.

${BOLD}Usage:${RESET}
  just frontend adjust-trial                          # from repo root (recommended)
  just frontend adjust-trial --redis-url <url>        # custom Redis URL

${BOLD}How to identify yourself:${RESET}
  Trial keys in Redis use a browser fingerprint: SHA-256(userAgent + deviceId).
  Your deviceId is in browser localStorage under "fenrir:device-id".

  Easiest method: run "list" in the REPL — it shows all trials with numbered
  shortcuts. Then "use 1" to select yours.

${BOLD}For production Redis:${RESET}
  kubectl port-forward svc/redis 6379:6379 -n fenrir-app
`);
  process.exit(0);
}

// ── Port-forward management ──────────────────────────────────────────────────

const PF_NAMESPACE = "fenrir-app";
const PF_SERVICE = "svc/redis";
const PF_LOCAL_PORT = 6379;
const PF_REMOTE_PORT = 6379;

let portForwardProc = null; // track child process so we can kill on exit

/** Check if localhost:6379 is accepting connections. */
function isPortOpen(port, host = "127.0.0.1", timeoutMs = 1000) {
  return new Promise((resolve) => {
    const sock = createConnection({ port, host, timeout: timeoutMs });
    sock.once("connect", () => { sock.destroy(); resolve(true); });
    sock.once("error", () => { sock.destroy(); resolve(false); });
    sock.once("timeout", () => { sock.destroy(); resolve(false); });
  });
}

/** Check if kubectl is available and cluster is reachable. */
function hasKubectl() {
  try {
    execSync("kubectl cluster-info --request-timeout=3s", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Start kubectl port-forward in the background. Returns when the port is ready. */
async function startPortForward() {
  console.log(`${DIM}Starting kubectl port-forward ${PF_SERVICE} ${PF_LOCAL_PORT}:${PF_REMOTE_PORT} -n ${PF_NAMESPACE}...${RESET}`);

  portForwardProc = spawn(
    "kubectl",
    ["port-forward", PF_SERVICE, `${PF_LOCAL_PORT}:${PF_REMOTE_PORT}`, "-n", PF_NAMESPACE],
    { stdio: ["ignore", "pipe", "pipe"], detached: false }
  );

  // Log stderr for debugging but don't spam
  let stderrBuf = "";
  portForwardProc.stderr.on("data", (chunk) => { stderrBuf += chunk.toString(); });
  portForwardProc.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`${RED}Port-forward exited with code ${code}${RESET}`);
      if (stderrBuf.trim()) console.error(`${DIM}${stderrBuf.trim()}${RESET}`);
    }
    portForwardProc = null;
  });

  // Wait up to 10s for the port to open
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await isPortOpen(PF_LOCAL_PORT)) {
      console.log(`${GREEN}Port-forward established${RESET} ${DIM}(localhost:${PF_LOCAL_PORT} → ${PF_SERVICE})${RESET}`);
      return true;
    }
  }

  console.error(`${RED}Port-forward timed out after 10s${RESET}`);
  portForwardProc?.kill();
  portForwardProc = null;
  return false;
}

/** Clean up port-forward on exit. */
function cleanupPortForward() {
  if (portForwardProc) {
    portForwardProc.kill();
    portForwardProc = null;
  }
}
process.on("exit", cleanupPortForward);
process.on("SIGINT", () => { cleanupPortForward(); process.exit(0); });
process.on("SIGTERM", () => { cleanupPortForward(); process.exit(0); });

// ── Redis connection ─────────────────────────────────────────────────────────

const redisUrl = values["redis-url"] || process.env.REDIS_URL || "redis://localhost:6379";
const isLocalhost = /localhost|127\.0\.0\.1/.test(redisUrl);

// If targeting localhost and port isn't open, auto-setup port-forward
if (isLocalhost && !(await isPortOpen(PF_LOCAL_PORT))) {
  console.log(`${DIM}Redis not reachable on localhost:${PF_LOCAL_PORT}${RESET}`);

  if (!hasKubectl()) {
    console.error(`${RED}kubectl not available or cluster unreachable.${RESET}`);
    console.error(`${DIM}Either start Redis locally or configure kubectl for GKE.${RESET}`);
    process.exit(1);
  }

  const ok = await startPortForward();
  if (!ok) {
    console.error(`${RED}Could not establish port-forward. Check your GKE access.${RESET}`);
    process.exit(1);
  }
}

const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });

try {
  await redis.connect();
} catch {
  console.error(`${RED}Failed to connect to Redis at ${redisUrl}${RESET}`);
  process.exit(1);
}

console.log(`${GREEN}Connected to Redis${RESET} ${DIM}(${redisUrl})${RESET}`);

// ── State ────────────────────────────────────────────────────────────────────

let selectedFp = null;       // currently selected fingerprint
let trialIndex = [];         // cached list from last "list" command: [fingerprint, ...]

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeStatus(trial) {
  if (!trial) return { remainingDays: 0, status: "none" };
  if (trial.convertedDate) return { remainingDays: 0, status: "converted", convertedDate: trial.convertedDate };
  const elapsed = Math.floor((Date.now() - new Date(trial.startDate).getTime()) / 86400000);
  const remaining = Math.max(0, TRIAL_DURATION_DAYS - elapsed);
  return { remainingDays: remaining, status: remaining <= 0 ? "expired" : "active" };
}

function shortFp(fp) {
  return `${fp.slice(0, 12)}...${fp.slice(-8)}`;
}

function printTrial(trial, fp, ttl) {
  const s = computeStatus(trial);
  const emoji = STATUS_EMOJI[s.status];
  console.log();
  console.log(`  ${BOLD}Fingerprint:${RESET}  ${shortFp(fp)}  ${DIM}(full: ${fp})${RESET}`);
  console.log(`  ${BOLD}Status:${RESET}       ${emoji} ${s.status}`);
  console.log(`  ${BOLD}Start date:${RESET}   ${trial.startDate}`);
  console.log(`  ${BOLD}Elapsed:${RESET}      ${TRIAL_DURATION_DAYS - s.remainingDays} days`);
  console.log(`  ${BOLD}Remaining:${RESET}    ${s.remainingDays} days`);
  if (trial.convertedDate) {
    console.log(`  ${BOLD}Converted:${RESET}    ${trial.convertedDate}`);
  }
  if (ttl !== undefined) {
    console.log(`  ${BOLD}Redis TTL:${RESET}    ${ttl}s (${Math.round(ttl / 86400)}d)`);
  }
  console.log();
}

async function getTrial(fp) {
  const raw = await redis.get(`trial:${fp}`);
  return raw ? JSON.parse(raw) : null;
}

async function setTrial(fp, trial) {
  await redis.set(`trial:${fp}`, JSON.stringify(trial), "EX", TRIAL_TTL_SECONDS);
}

function requireSelected() {
  if (!selectedFp) {
    console.log(`${RED}No trial selected.${RESET} Use ${CYAN}list${RESET} then ${CYAN}use <N>${RESET} to select one.`);
    return false;
  }
  return true;
}

// ── Commands ─────────────────────────────────────────────────────────────────

const commands = {
  async list() {
    const keys = await redis.keys("trial:*");
    if (keys.length === 0) {
      console.log("\n  No trial keys found in Redis.\n");
      return;
    }
    keys.sort();
    trialIndex = keys.map((k) => k.replace("trial:", ""));

    console.log(`\n  ${BOLD}#   Fingerprint              Status     Remaining   Started${RESET}`);
    console.log(`  ${DIM}${"─".repeat(70)}${RESET}`);
    for (let i = 0; i < keys.length; i++) {
      const fp = trialIndex[i];
      const raw = await redis.get(keys[i]);
      if (!raw) continue;
      const trial = JSON.parse(raw);
      const s = computeStatus(trial);
      const emoji = STATUS_EMOJI[s.status];
      const selected = fp === selectedFp ? `${GOLD}→${RESET}` : " ";
      const started = new Date(trial.startDate).toLocaleDateString();
      console.log(`  ${selected}${String(i + 1).padStart(2)}  ${shortFp(fp)}  ${emoji} ${s.status.padEnd(10)} ${String(s.remainingDays).padStart(2)}d left     ${started}`);
    }
    console.log(`\n  ${DIM}Use "use <N>" to select a trial${RESET}\n`);
  },

  async use(args) {
    const n = parseInt(args[0], 10);
    if (isNaN(n) || n < 1 || n > trialIndex.length) {
      // Check if it's a raw fingerprint
      if (args[0] && /^[0-9a-f]{64}$/i.test(args[0])) {
        selectedFp = args[0].toLowerCase();
        const trial = await getTrial(selectedFp);
        if (!trial) {
          console.log(`${RED}No trial found for that fingerprint.${RESET}`);
          selectedFp = null;
          return;
        }
        const ttl = await redis.ttl(`trial:${selectedFp}`);
        console.log(`${GREEN}Selected:${RESET}`);
        printTrial(trial, selectedFp, ttl);
        return;
      }
      console.log(`${RED}Invalid selection.${RESET} Run ${CYAN}list${RESET} first, then ${CYAN}use <N>${RESET} or ${CYAN}use <fingerprint>${RESET}.`);
      return;
    }
    selectedFp = trialIndex[n - 1];
    const trial = await getTrial(selectedFp);
    if (!trial) {
      console.log(`${RED}Trial no longer exists.${RESET} Run ${CYAN}list${RESET} to refresh.`);
      selectedFp = null;
      return;
    }
    const ttl = await redis.ttl(`trial:${selectedFp}`);
    console.log(`${GREEN}Selected:${RESET}`);
    printTrial(trial, selectedFp, ttl);
  },

  async status() {
    if (!requireSelected()) return;
    const trial = await getTrial(selectedFp);
    if (!trial) {
      console.log(`${RED}Trial no longer exists.${RESET}`);
      selectedFp = null;
      return;
    }
    const ttl = await redis.ttl(`trial:${selectedFp}`);
    printTrial(trial, selectedFp, ttl);
  },

  async shift(args) {
    if (!requireSelected()) return;
    const days = parseInt(args[0], 10);
    if (isNaN(days)) {
      console.log(`${RED}Usage: shift <days>${RESET}  (e.g., shift -25 for 5 days remaining)`);
      return;
    }
    const trial = await getTrial(selectedFp);
    if (!trial) {
      console.log(`${RED}Trial no longer exists.${RESET} Use ${CYAN}reset${RESET} to create one.`);
      return;
    }
    const oldDate = trial.startDate;
    const newDate = new Date(new Date(oldDate).getTime() + days * 86400000);
    const updated = { ...trial, startDate: newDate.toISOString() };
    await setTrial(selectedFp, updated);
    const s = computeStatus(updated);
    console.log(`\n  ${BOLD}Shifted ${days > 0 ? "+" : ""}${days} days${RESET}`);
    console.log(`  Old: ${oldDate}`);
    console.log(`  New: ${updated.startDate}`);
    console.log(`  ${STATUS_EMOJI[s.status]} ${s.status} — ${s.remainingDays}d remaining\n`);
  },

  async set(args) {
    if (!requireSelected()) return;
    const remaining = parseInt(args[0], 10);
    if (isNaN(remaining) || remaining < 0) {
      console.log(`${RED}Usage: set <remaining-days>${RESET}  (e.g., set 5 for 5 days left, set 0 for expired)`);
      return;
    }
    const trial = await getTrial(selectedFp);
    const daysAgo = TRIAL_DURATION_DAYS - remaining;
    const newStart = new Date(Date.now() - daysAgo * 86400000).toISOString();
    const updated = { ...(trial || {}), startDate: newStart };
    delete updated.convertedDate; // un-convert if setting days
    await setTrial(selectedFp, updated);
    const s = computeStatus(updated);
    console.log(`\n  ${BOLD}Set to ${remaining} days remaining${RESET}`);
    console.log(`  Start date: ${newStart}`);
    console.log(`  ${STATUS_EMOJI[s.status]} ${s.status} — ${s.remainingDays}d remaining\n`);
  },

  async reset() {
    if (!requireSelected()) return;
    const updated = { startDate: new Date().toISOString() };
    await setTrial(selectedFp, updated);
    console.log(`\n  ${GREEN}Trial reset to today${RESET}`);
    console.log(`  Start date: ${updated.startDate}`);
    console.log(`  ${STATUS_EMOJI.active} active — ${TRIAL_DURATION_DAYS}d remaining\n`);
  },

  async expire() {
    if (!requireSelected()) return;
    const trial = await getTrial(selectedFp);
    const expired = new Date(Date.now() - 31 * 86400000).toISOString();
    const updated = { ...(trial || {}), startDate: expired };
    delete updated.convertedDate;
    await setTrial(selectedFp, updated);
    console.log(`\n  ${RED}Trial expired${RESET}`);
    console.log(`  Start date: ${expired} (31 days ago)`);
    console.log(`  ${STATUS_EMOJI.expired} expired — 0d remaining\n`);
  },

  async convert() {
    if (!requireSelected()) return;
    const trial = await getTrial(selectedFp);
    if (!trial) {
      console.log(`${RED}No trial exists.${RESET} Use ${CYAN}reset${RESET} to create one first.`);
      return;
    }
    const updated = { ...trial, convertedDate: new Date().toISOString() };
    await setTrial(selectedFp, updated);
    console.log(`\n  ${GOLD}Trial marked as converted${RESET}`);
    console.log(`  Converted at: ${updated.convertedDate}\n`);
  },

  async unconvert() {
    if (!requireSelected()) return;
    const trial = await getTrial(selectedFp);
    if (!trial) {
      console.log(`${RED}No trial exists.${RESET}`);
      return;
    }
    if (!trial.convertedDate) {
      console.log(`  Trial is not converted — nothing to do.`);
      return;
    }
    const updated = { ...trial };
    delete updated.convertedDate;
    await setTrial(selectedFp, updated);
    const s = computeStatus(updated);
    console.log(`\n  ${GREEN}Conversion removed${RESET}`);
    console.log(`  ${STATUS_EMOJI[s.status]} ${s.status} — ${s.remainingDays}d remaining\n`);
  },

  async delete_trial() {
    if (!requireSelected()) return;
    await redis.del(`trial:${selectedFp}`);
    console.log(`\n  ${RED}Trial deleted${RESET} for ${shortFp(selectedFp)}`);
    console.log(`  ${DIM}User will get a fresh trial on next sign-up.${RESET}\n`);
    selectedFp = null;
  },

  async create(args) {
    const fp = args[0];
    if (!fp || !/^[0-9a-f]{64}$/i.test(fp)) {
      console.log(`${RED}Usage: create <64-char-hex-fingerprint>${RESET}`);
      console.log(`${DIM}Get your fingerprint from browser DevTools — see "identity" command.${RESET}`);
      return;
    }
    const existing = await getTrial(fp);
    if (existing) {
      console.log(`${RED}Trial already exists for that fingerprint.${RESET} Use ${CYAN}use${RESET} to select it.`);
      return;
    }
    const trial = { startDate: new Date().toISOString() };
    await setTrial(fp, trial);
    selectedFp = fp;
    console.log(`\n  ${GREEN}Trial created${RESET}`);
    printTrial(trial, fp);
  },

  async keys() {
    const allKeys = await redis.keys("*");
    const grouped = {};
    for (const k of allKeys.sort()) {
      const prefix = k.split(":")[0];
      grouped[prefix] = (grouped[prefix] || 0) + 1;
    }
    console.log(`\n  ${BOLD}All Redis keys by prefix:${RESET}`);
    console.log(`  ${DIM}${"─".repeat(40)}${RESET}`);
    for (const [prefix, count] of Object.entries(grouped).sort()) {
      console.log(`  ${prefix.padEnd(25)} ${count}`);
    }
    console.log(`\n  ${DIM}Total: ${allKeys.length} keys${RESET}\n`);
  },

  async entitlements() {
    const keys = await redis.keys("entitlement:*");
    if (keys.length === 0) {
      console.log("\n  No entitlement keys found.\n");
      return;
    }
    console.log(`\n  ${BOLD}Entitlements (${keys.length}):${RESET}`);
    console.log(`  ${DIM}${"─".repeat(60)}${RESET}`);
    for (const key of keys.sort()) {
      const raw = await redis.get(key);
      if (!raw) continue;
      const ent = JSON.parse(raw);
      const sub = key.replace("entitlement:", "");
      const emoji = ent.active ? `${GREEN}●${RESET}` : `${RED}●${RESET}`;
      console.log(`  ${emoji} ${shortFp(sub)}  tier=${ent.tier}  active=${ent.active}`);
    }
    console.log();
  },

  identity() {
    console.log(`
  ${BOLD}How to find your trial fingerprint:${RESET}

  1. Open ${CYAN}fenrirledger.com${RESET} in your browser
  2. Open DevTools (F12) → Console
  3. Run:

     ${GOLD}localStorage.getItem('fenrir:device-id')${RESET}

     This gives your deviceId (a UUID).

  4. The fingerprint is SHA-256(navigator.userAgent + deviceId).
     To compute it in the console:

     ${GOLD}async function fp() {
       const did = localStorage.getItem('fenrir:device-id');
       const data = new TextEncoder().encode(navigator.userAgent + did);
       const hash = await crypto.subtle.digest('SHA-256', data);
       return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2,'0')).join('');
     }
     fp().then(console.log)${RESET}

  5. Or just use ${CYAN}list${RESET} here — if you only have one trial, that's you.
`);
  },

  help() {
    console.log(`
  ${BOLD}Trial REPL Commands${RESET}
  ${DIM}${"─".repeat(55)}${RESET}

  ${BOLD}Discovery${RESET}
    ${CYAN}list${RESET}                   List all trials with numbered shortcuts
    ${CYAN}identity${RESET}               How to find your fingerprint
    ${CYAN}keys${RESET}                   Show all Redis key prefixes
    ${CYAN}entitlements${RESET}            Show all Stripe entitlements

  ${BOLD}Selection${RESET}
    ${CYAN}use <N>${RESET}                Select trial by number from list
    ${CYAN}use <fingerprint>${RESET}       Select trial by full 64-char fingerprint
    ${CYAN}status${RESET}                 Show selected trial details

  ${BOLD}Time Travel${RESET}
    ${CYAN}set <days>${RESET}             Set remaining days (e.g., "set 5" = 5 days left)
    ${CYAN}shift <days>${RESET}           Shift start date by N days (e.g., "shift -25")
    ${CYAN}reset${RESET}                  Reset to fresh 30-day trial (today)
    ${CYAN}expire${RESET}                 Instantly expire the trial

  ${BOLD}Conversion${RESET}
    ${CYAN}convert${RESET}                Mark trial as converted (paid)
    ${CYAN}unconvert${RESET}              Remove conversion, restore trial status

  ${BOLD}Lifecycle${RESET}
    ${CYAN}create <fingerprint>${RESET}    Create a new trial for a fingerprint
    ${CYAN}delete${RESET}                 Delete the selected trial entirely

  ${BOLD}Other${RESET}
    ${CYAN}help${RESET}                   This help
    ${CYAN}quit${RESET} / ${CYAN}exit${RESET} / ${CYAN}Ctrl+C${RESET}    Exit
`);
  },
};

// ── REPL ─────────────────────────────────────────────────────────────────────

function prompt() {
  const sel = selectedFp ? ` ${GOLD}${shortFp(selectedFp)}${RESET}` : "";
  return `${BOLD}trial${RESET}${sel}${BOLD}>${RESET} `;
}

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: prompt(),
  terminal: true,
});

console.log(`\n  ${BOLD}${GOLD}Fenrir Ledger — Trial Manager${RESET}`);
console.log(`  ${DIM}Type "help" for commands, "list" to see all trials${RESET}\n`);
rl.prompt();

rl.on("line", async (line) => {
  const parts = line.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase();
  const args = parts.slice(1);

  if (!cmd) {
    rl.setPrompt(prompt());
    rl.prompt();
    return;
  }

  if (cmd === "quit" || cmd === "exit" || cmd === "q") {
    console.log(`${DIM}Disconnecting...${RESET}`);
    await redis.quit();
    cleanupPortForward();
    process.exit(0);
  }

  // Alias "delete" → "delete_trial" to avoid reserved word
  const cmdKey = cmd === "delete" ? "delete_trial" : cmd;
  const handler = commands[cmdKey];

  if (!handler) {
    console.log(`${RED}Unknown command: ${cmd}${RESET}. Type ${CYAN}help${RESET} for available commands.`);
    rl.setPrompt(prompt());
    rl.prompt();
    return;
  }

  try {
    await handler(args);
  } catch (err) {
    console.error(`${RED}Error: ${err.message}${RESET}`);
  }

  rl.setPrompt(prompt());
  rl.prompt();
});

rl.on("close", async () => {
  console.log(`\n${DIM}Disconnecting...${RESET}`);
  await redis.quit();
  cleanupPortForward();
  process.exit(0);
});
