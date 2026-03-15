#!/usr/bin/env node
/**
 * odins-spear.mjs — Odin's Spear: Interactive REPL for trials, entitlements, and Stripe.
 *
 * Usage:
 *   just frontend odins-spear                        # from repo root (recommended)
 *   node development/frontend/scripts/odins-spear.mjs  # direct invocation
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

// ── Stripe ───────────────────────────────────────────────────────────────────

let stripeKey = process.env.STRIPE_SECRET_KEY || null;

/** Lazy-load Stripe key from K8s secret if not set via env. */
async function getStripeKey() {
  if (stripeKey) return stripeKey;
  try {
    stripeKey = execSync(
      "kubectl get secret fenrir-app-secrets -n fenrir-app -o jsonpath='{.data.STRIPE_SECRET_KEY}' | base64 -d",
      { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }
    ).trim().replace(/^'|'$/g, "");
    if (stripeKey) return stripeKey;
  } catch { /* ignore */ }
  return null;
}

/** Call Stripe API. Returns parsed JSON or null on error. */
async function stripe(method, path, body) {
  const key = await getStripeKey();
  if (!key) {
    console.error(`${RED}STRIPE_SECRET_KEY not available.${RESET} Set via env or ensure kubectl can reach fenrir-app-secrets.`);
    return null;
  }
  const opts = {
    method,
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };
  if (body) opts.body = new URLSearchParams(body).toString();
  try {
    const res = await fetch(`https://api.stripe.com/v1${path}`, opts);
    const json = await res.json();
    if (json.error) {
      console.error(`${RED}Stripe error: ${json.error.message}${RESET}`);
      return null;
    }
    return json;
  } catch (err) {
    console.error(`${RED}Stripe request failed: ${err.message}${RESET}`);
    return null;
  }
}

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
${BOLD}odins-spear.mjs${RESET} — Interactive REPL for managing trial state in Redis.

${BOLD}Usage:${RESET}
  just frontend odins-spear                          # from repo root (recommended)
  just frontend odins-spear --redis-url <url>        # custom Redis URL

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
let pfManagedByUs = false;  // true if we started the port-forward (vs user-managed)
let reconnecting = false;   // prevent concurrent reconnect attempts

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
  // Kill any existing port-forward process
  if (portForwardProc) {
    portForwardProc.kill();
    portForwardProc = null;
    await new Promise((r) => setTimeout(r, 500)); // let the port release
  }

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
    // Auto-reconnect if we managed the port-forward and it dropped unexpectedly
    if (pfManagedByUs && !reconnecting) {
      reconnectPortForward();
    }
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

/** Reconnect port-forward with exponential backoff (max 3 attempts). */
async function reconnectPortForward() {
  if (reconnecting) return;
  reconnecting = true;

  const MAX_ATTEMPTS = 3;
  const delays = [1000, 3000, 5000];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`${GOLD}Port-forward dropped — reconnecting (attempt ${attempt}/${MAX_ATTEMPTS})...${RESET}`);
    await new Promise((r) => setTimeout(r, delays[attempt - 1]));

    const ok = await startPortForward();
    if (ok) {
      reconnecting = false;
      return;
    }
  }

  reconnecting = false;
  console.error(`${RED}Port-forward reconnect failed after ${MAX_ATTEMPTS} attempts.${RESET}`);
  console.error(`${DIM}Commands will fail until the connection is restored. Try "reconnect" or restart the REPL.${RESET}`);
}

/** Clean up port-forward on exit. */
function cleanupPortForward() {
  pfManagedByUs = false; // prevent reconnect during shutdown
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
  pfManagedByUs = true; // we own this port-forward — auto-reconnect on drop
}

const redis = new Redis(redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  retryStrategy(times) {
    if (times > 3) {
      console.error(`${RED}Redis connection lost. Reconnect failed after ${times} attempts.${RESET}`);
      console.error(`${DIM}Port-forward may have dropped. Restart the REPL to reconnect.${RESET}`);
      return null; // stop retrying
    }
    return Math.min(times * 500, 2000);
  },
});

// Suppress "Unhandled error event" noise from ioredis reconnect attempts
redis.on("error", (err) => {
  if (err.code === "ECONNREFUSED" || err.code === "ECONNRESET") {
    console.error(`${RED}Redis connection error${RESET} ${DIM}(${err.code} — port-forward may have dropped)${RESET}`);
  } else {
    console.error(`${RED}Redis error: ${err.message}${RESET}`);
  }
});

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

  async stripe_customers() {
    const data = await stripe("GET", "/customers?limit=20");
    if (!data) return;
    if (data.data.length === 0) {
      console.log("\n  No Stripe customers found.\n");
      return;
    }
    console.log(`\n  ${BOLD}Stripe Customers (${data.data.length}):${RESET}`);
    console.log(`  ${DIM}${"─".repeat(70)}${RESET}`);
    for (const c of data.data) {
      const subs = c.subscriptions?.data?.length || 0;
      console.log(`  ${c.id}  ${(c.email || "no email").padEnd(30)}  ${DIM}subs=${subs}${RESET}`);
    }
    console.log();
  },

  async stripe_subs() {
    const data = await stripe("GET", "/subscriptions?limit=20&status=all");
    if (!data) return;
    if (data.data.length === 0) {
      console.log("\n  No Stripe subscriptions found.\n");
      return;
    }
    console.log(`\n  ${BOLD}Stripe Subscriptions (${data.data.length}):${RESET}`);
    console.log(`  ${DIM}${"─".repeat(80)}${RESET}`);
    for (const s of data.data) {
      const emoji = s.status === "active" ? `${GREEN}●${RESET}` : s.status === "canceled" ? `${RED}●${RESET}` : `${GOLD}●${RESET}`;
      console.log(`  ${emoji} ${s.id}  ${s.status.padEnd(12)}  customer=${s.customer}`);
    }
    console.log();
  },

  async delete_customer(args) {
    const id = args[0];
    if (!id || !id.startsWith("cus_")) {
      console.log(`${RED}Usage: delete-customer <cus_xxx>${RESET}`);
      console.log(`${DIM}Use "stripe-customers" to list customer IDs.${RESET}`);
      return;
    }
    // Stripe API is source of truth — delete there, webhooks sync Redis
    const data = await stripe("DELETE", `/customers/${id}`);
    if (!data) return;
    console.log(`\n  ${RED}Deleted customer${RESET} ${id} ${DIM}(via Stripe API)${RESET}`);
    console.log(`  ${DIM}Webhooks will clean up Redis entitlements automatically.${RESET}\n`);
  },

  async cancel_sub(args) {
    const id = args[0];
    if (!id || !id.startsWith("sub_")) {
      console.log(`${RED}Usage: cancel-sub <sub_xxx>${RESET}`);
      console.log(`${DIM}Use "stripe-subs" to list subscription IDs.${RESET}`);
      return;
    }
    // Stripe API is source of truth — cancel there, webhooks sync Redis
    const data = await stripe("DELETE", `/subscriptions/${id}`);
    if (!data) return;
    console.log(`\n  ${RED}Canceled subscription${RESET} ${id} ${DIM}(via Stripe API)${RESET}`);
    console.log(`  ${DIM}Status: ${data.status}. Webhooks will update Redis entitlement.${RESET}\n`);
  },

  async flush_entitlement(args) {
    const id = args[0];
    if (!id) {
      if (selectedFp) {
        const key = `entitlement:${selectedFp}`;
        const exists = await redis.get(key);
        if (!exists) {
          console.log(`${RED}No entitlement found for selected fingerprint.${RESET}`);
          return;
        }
        await redis.del(key);
        console.log(`\n  ${GOLD}Flushed entitlement cache${RESET} for ${shortFp(selectedFp)}`);
        console.log(`  ${DIM}This only clears the Redis cache. Stripe subscription is unaffected.${RESET}`);
        console.log(`  ${DIM}Next auth check will re-fetch from Stripe and rebuild the cache.${RESET}\n`);
        return;
      }
      console.log(`${RED}Usage: flush-entitlement <key-suffix>${RESET}  or select a trial first.`);
      console.log(`${DIM}Use "entitlements" to list keys. This only clears the Redis cache.${RESET}`);
      return;
    }
    const key = id.startsWith("entitlement:") ? id : `entitlement:${id}`;
    const exists = await redis.get(key);
    if (!exists) {
      console.log(`${RED}Key not found: ${key}${RESET}`);
      return;
    }
    await redis.del(key);
    console.log(`\n  ${GOLD}Flushed entitlement cache${RESET} ${key}`);
    console.log(`  ${DIM}Stripe subscription unaffected. Cache will rebuild on next auth check.${RESET}\n`);
  },

  async nuke() {
    if (!requireSelected()) return;
    const trial = await getTrial(selectedFp);
    const entKey = `entitlement:${selectedFp}`;
    const entRaw = await redis.get(entKey);

    console.log(`\n  ${BOLD}${RED}NUKE — removing all state for ${shortFp(selectedFp)}${RESET}`);
    console.log(`  ${DIM}Stripe first (source of truth), then Redis cleanup.${RESET}\n`);

    // 1. Stripe first — cancel subs + delete customer (source of truth)
    let stripeCleanedUp = false;
    if (entRaw) {
      try {
        const ent = JSON.parse(entRaw);
        if (ent.customerId) {
          const cust = await stripe("GET", `/customers/${ent.customerId}?expand[]=subscriptions`);
          if (cust?.subscriptions?.data) {
            for (const sub of cust.subscriptions.data) {
              if (sub.status !== "canceled") {
                await stripe("DELETE", `/subscriptions/${sub.id}`);
                console.log(`  ${RED}✗${RESET} Stripe: subscription ${sub.id} canceled`);
              }
            }
          }
          await stripe("DELETE", `/customers/${ent.customerId}`);
          console.log(`  ${RED}✗${RESET} Stripe: customer ${ent.customerId} deleted`);
          stripeCleanedUp = true;
        }
      } catch { /* best effort */ }
    }
    if (!stripeCleanedUp) {
      console.log(`  ${DIM}○ No Stripe customer to clean up${RESET}`);
    }

    // 2. Redis cleanup — belt-and-suspenders (webhooks would do this too)
    if (trial) {
      await redis.del(`trial:${selectedFp}`);
      console.log(`  ${RED}✗${RESET} Redis: trial deleted`);
    } else {
      console.log(`  ${DIM}○ No trial to delete${RESET}`);
    }

    if (entRaw) {
      await redis.del(entKey);
      console.log(`  ${RED}✗${RESET} Redis: entitlement cache flushed`);
    } else {
      console.log(`  ${DIM}○ No entitlement cache to flush${RESET}`);
    }

    selectedFp = null;
    console.log(`\n  ${DIM}User will get a completely fresh start on next visit.${RESET}\n`);
  },

  async reconnect() {
    if (!isLocalhost) {
      console.log(`${DIM}Not using localhost — reconnect only applies to port-forwarded connections.${RESET}`);
      return;
    }
    if (await isPortOpen(PF_LOCAL_PORT)) {
      console.log(`${GREEN}Port is already open — connection looks healthy.${RESET}`);
      return;
    }
    pfManagedByUs = true;
    await reconnectPortForward();
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

  ${BOLD}Stripe${RESET}
    ${CYAN}stripe-customers${RESET}       List Stripe customers
    ${CYAN}stripe-subs${RESET}            List Stripe subscriptions
    ${CYAN}delete-customer <id>${RESET}    Delete Stripe customer + all data (cus_xxx)
    ${CYAN}cancel-sub <id>${RESET}         Cancel Stripe subscription (sub_xxx)
    ${CYAN}flush-entitlement${RESET}       Flush Redis entitlement cache (Stripe unaffected)
    ${CYAN}nuke${RESET}                   Stripe-first wipe: cancel subs + delete customer + flush Redis

  ${BOLD}Connection${RESET}
    ${CYAN}reconnect${RESET}              Manually reconnect port-forward

  ${BOLD}Other${RESET}
    ${CYAN}help${RESET}                   This help
    ${CYAN}quit${RESET} / ${CYAN}exit${RESET} / ${CYAN}Ctrl+C${RESET}    Exit
`);
  },
};

// ── Tab completion ───────────────────────────────────────────────────────────

const ALL_COMMANDS = [
  "list", "use", "status", "set", "shift", "reset", "expire",
  "convert", "unconvert", "create", "delete",
  "stripe-customers", "stripe-subs", "delete-customer", "cancel-sub",
  "flush-entitlement", "nuke",
  "keys", "entitlements", "identity", "reconnect",
  "help", "quit", "exit",
];

function completer(line) {
  const parts = line.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase() || "";

  // If typing the first word, complete command names
  if (parts.length <= 1) {
    const hits = ALL_COMMANDS.filter((c) => c.startsWith(cmd));
    return [hits.length ? hits : ALL_COMMANDS, cmd];
  }

  // For "use", complete with trial index numbers
  if (cmd === "use" && trialIndex.length > 0) {
    const arg = parts[1] || "";
    const nums = trialIndex.map((_, i) => String(i + 1));
    const hits = nums.filter((n) => n.startsWith(arg));
    return [hits, arg];
  }

  return [[], line];
}

// ── REPL ─────────────────────────────────────────────────────────────────────

function prompt() {
  const sel = selectedFp ? ` ${GOLD}${shortFp(selectedFp)}${RESET}` : "";
  return `${BOLD}spear${RESET}${sel}${BOLD}>${RESET} `;
}

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: prompt(),
  terminal: true,
  completer,
});

console.log(`\n  ${BOLD}${GOLD}Fenrir Ledger — Odin's Spear${RESET}`);
console.log(`  ${DIM}Type "help" for commands, "list" to see all trials. Tab to complete.${RESET}\n`);
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

  // Normalize: "delete" → "delete_trial", hyphens → underscores for method lookup
  let cmdKey = cmd === "delete" ? "delete_trial" : cmd.replace(/-/g, "_");
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
