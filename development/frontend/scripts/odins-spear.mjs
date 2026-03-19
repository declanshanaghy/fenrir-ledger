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
const { Firestore, FieldValue } = require("@google-cloud/firestore");
const { GoogleAuth, OAuth2Client } = require("google-auth-library");
import { parseArgs } from "node:util";
import { execSync, spawn } from "node:child_process";
import { createConnection } from "node:net";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import React, { useState, useEffect, useCallback } from "react";
import { render, Box, Text, useInput, useApp } from "ink";

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

// ── Google ADC authentication ─────────────────────────────────────────────────

/**
 * Ensure Google Application Default Credentials are valid before startup.
 *
 * Priority order:
 *   1. Existing valid ADC → proceed silently
 *   2. Cached refresh_token in ADC JSON → refresh silently
 *   3. No usable credentials → open browser via gcloud auth application-default login
 *
 * Throws if gcloud is not installed or auth ultimately fails.
 */
async function ensureAuthenticated() {
  // 1. Try existing ADC — if valid, return early
  try {
    const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
    const client = await auth.getClient();
    await client.getAccessToken();
    return; // credentials valid, proceed silently
  } catch { /* fall through to refresh or browser flow */ }

  // 2. Check for refresh_token in ADC JSON
  const adcPath = join(homedir(), ".config", "gcloud", "application_default_credentials.json");
  if (existsSync(adcPath)) {
    try {
      const adc = JSON.parse(readFileSync(adcPath, "utf-8"));
      if (adc.refresh_token) {
        const oauth2 = new OAuth2Client(adc.client_id, adc.client_secret);
        oauth2.setCredentials({ refresh_token: adc.refresh_token });
        const tokenResponse = await oauth2.getAccessToken();
        if (tokenResponse.token) {
          process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;
          return; // silently refreshed
        }
      }
    } catch { /* refresh_token expired or invalid — fall through to browser */ }
  }

  // 3. Fall back to browser flow via gcloud
  console.log(`\n${GOLD}Opening browser for Google authentication...${RESET}`);
  console.log(`${DIM}Complete the auth in your browser. The auth code will appear in this terminal if prompted.${RESET}\n`);
  execSync("gcloud auth application-default login", { stdio: "inherit" });
  // Pin GOOGLE_APPLICATION_CREDENTIALS to the ADC file gcloud just wrote so
  // all subsequent clients (e.g. Firestore's internal GoogleAuth) use the file
  // directly and skip the GCE metadata probe — which emits
  // MetadataLookupWarning: received unexpected error = All promises were
  // rejected when running outside GCP (issue #1259).
  process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;
}

try {
  await ensureAuthenticated();
} catch (err) {
  const msg = err.message || String(err);
  if (/gcloud/.test(msg) || /ENOENT/.test(msg) || /not found/.test(msg)) {
    console.error(`\n${RED}gcloud CLI not found.${RESET} Install it from https://cloud.google.com/sdk/docs/install`);
  } else if (/cancelled|cancel|abort/i.test(msg)) {
    console.error(`\n${RED}Authentication cancelled.${RESET} Odin's Spear requires Google credentials to access Firestore.`);
  } else {
    console.error(`\n${RED}Authentication failed:${RESET} ${msg}`);
  }
  process.exit(1);
}

// ── Firestore client ─────────────────────────────────────────────────────────

const FS_PROJECT_ID = "fenrir-ledger-prod";
const FS_DATABASE_ID = "fenrir-ledger-prod";

let _db = null;
function getDb() {
  if (!_db) {
    _db = new Firestore({ projectId: FS_PROJECT_ID, databaseId: FS_DATABASE_ID });
  }
  return _db;
}

// ── State ────────────────────────────────────────────────────────────────────

let selectedFp = null;       // currently selected fingerprint
let trialIndex = [];         // cached list from last "list" command: [fingerprint, ...]

let selectedHouseholdId = null;  // currently selected Firestore household
let householdIndex = [];         // cached list from last "households" command: [householdId, ...]

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

/** Truncate a Firestore/Clerk ID for display: first-8 … last-4 */
function shortId(id) {
  if (!id || id.length <= 16) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

/** Generate a 6-char alphanumeric invite code (unambiguous charset). */
function generateInviteCode() {
  const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const { randomBytes } = require("crypto");
  const bytes = randomBytes(6);
  return Array.from(bytes).map((b) => CHARS[b % CHARS.length]).join("");
}

/**
 * Prompt the user for y/N confirmation.
 * NOTE: In TUI mode, destructive operations require explicit confirmation via
 * the command palette (future issue). Stub returns false (safe default).
 */
async function confirmPrompt(_msg) {
  // TODO(#1390): wire up TUI command palette confirmation
  return false;
}

/** Require a household to be selected; print error and return false if not. */
function requireHousehold() {
  if (!selectedHouseholdId) {
    console.log(`${RED}No household selected.${RESET} Use ${CYAN}households${RESET} then ${CYAN}use-household <N>${RESET} to select one.`);
    return false;
  }
  return true;
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

  async update_trial_dates(args) {
    if (!requireSelected()) return;
    const days = parseInt(args[0], 10);
    if (isNaN(days)) {
      console.log(`${RED}Usage: update-trial-dates <days>${RESET}  (e.g., update-trial-dates -25 for 5 days remaining)`);
      return;
    }
    const trial = await getTrial(selectedFp);
    if (!trial) {
      console.log(`${RED}Trial no longer exists.${RESET} Use ${CYAN}update-trial-reset${RESET} to create one.`);
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

  async update_trial_field(args) {
    if (!requireSelected()) return;
    const remaining = parseInt(args[0], 10);
    if (isNaN(remaining) || remaining < 0) {
      console.log(`${RED}Usage: update-trial-field <remaining-days>${RESET}  (e.g., update-trial-field 5 for 5 days left, update-trial-field 0 for expired)`);
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

  async update_trial_reset() {
    if (!requireSelected()) return;
    const updated = { startDate: new Date().toISOString() };
    await setTrial(selectedFp, updated);
    console.log(`\n  ${GREEN}Trial reset to today${RESET}`);
    console.log(`  Start date: ${updated.startDate}`);
    console.log(`  ${STATUS_EMOJI.active} active — ${TRIAL_DURATION_DAYS}d remaining\n`);
  },

  async update_trial_expire() {
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

  async update_trial_convert() {
    if (!requireSelected()) return;
    const trial = await getTrial(selectedFp);
    if (!trial) {
      console.log(`${RED}No trial exists.${RESET} Use ${CYAN}update-trial-reset${RESET} to create one first.`);
      return;
    }
    const updated = { ...trial, convertedDate: new Date().toISOString() };
    await setTrial(selectedFp, updated);
    console.log(`\n  ${GOLD}Trial marked as converted${RESET}`);
    console.log(`  Converted at: ${updated.convertedDate}\n`);
  },

  async update_trial_unconvert() {
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

  async list_customers() {
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

  async list_subscriptions() {
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
      console.log(`${DIM}Use "list-customers" to list customer IDs.${RESET}`);
      return;
    }
    // Stripe API is source of truth — delete there, webhooks sync Redis
    const data = await stripe("DELETE", `/customers/${id}`);
    if (!data) return;
    console.log(`\n  ${RED}Deleted customer${RESET} ${id} ${DIM}(via Stripe API)${RESET}`);
    console.log(`  ${DIM}Webhooks will clean up Redis entitlements automatically.${RESET}\n`);
  },

  async delete_subscription(args) {
    const id = args[0];
    if (!id || !id.startsWith("sub_")) {
      console.log(`${RED}Usage: delete-subscription <sub_xxx>${RESET}`);
      console.log(`${DIM}Use "list-subscriptions" to list subscription IDs.${RESET}`);
      return;
    }
    // Retrieve first to check current status before attempting cancellation
    const sub = await stripe("GET", `/subscriptions/${id}`);
    if (!sub) {
      console.log(`\n  ${RED}Subscription not found:${RESET} ${id}\n`);
      return;
    }
    if (sub.status === "canceled") {
      console.log(`\n  ${DIM}Subscription ${id} is already canceled.${RESET}\n`);
      return;
    }
    // Stripe API is source of truth — cancel there, webhooks sync Redis
    const data = await stripe("DELETE", `/subscriptions/${id}`);
    if (!data) return;
    console.log(`\n  ${RED}Canceled subscription${RESET} ${id} ${DIM}(via Stripe API)${RESET}`);
    console.log(`  ${DIM}Status: ${data.status}. Webhooks will update Redis entitlement.${RESET}\n`);
  },

  async delete_entitlement(args) {
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
      console.log(`${RED}Usage: delete-entitlement <key-suffix>${RESET}  or select a trial first.`);
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

  async delete_all() {
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

  // ── Firestore: Household commands ──────────────────────────────────────────

  async households() {
    const db = getDb();
    const snap = await db.collection("households").orderBy("createdAt", "desc").limit(50).get();
    if (snap.empty) { console.log("\n  No households found in Firestore.\n"); return; }
    householdIndex = snap.docs.map((d) => d.id);

    console.log(`\n  ${BOLD}#   ID                                    Name                   Owner          Tier   Mbrs  Created${RESET}`);
    console.log(`  ${DIM}${"─".repeat(100)}${RESET}`);
    for (let i = 0; i < snap.docs.length; i++) {
      const d = snap.docs[i];
      const h = d.data();
      const sel = d.id === selectedHouseholdId ? `${GOLD}→${RESET}` : " ";
      const tier = h.tier === "karl" ? `${GOLD}karl${RESET}` : "free";
      const created = h.createdAt ? new Date(h.createdAt).toLocaleDateString() : "—";
      console.log(`  ${sel}${String(i + 1).padStart(2)}  ${d.id.padEnd(36)} ${(h.name || "").substring(0, 20).padEnd(22)} ${shortId(h.ownerId || "").padEnd(14)} ${tier}  ${((h.memberIds || []).length).toString().padStart(2)}    ${created}`);
    }
    console.log(`\n  ${DIM}Total: ${snap.docs.length}. Use "use-household <N>" to select.${RESET}\n`);
  },

  async household(args) {
    const id = args[0];
    if (!id) {
      // Show currently selected if no arg
      if (!requireHousehold()) return;
      args = [selectedHouseholdId];
    }
    const db = getDb();
    let docId = args[0];

    // Resolve row number (e.g. "household 1") from last households listing.
    // Only treat as row number if the argument is purely numeric (no letters/dashes).
    const n = /^\d+$/.test(docId) ? parseInt(docId, 10) : NaN;
    if (!isNaN(n)) {
      if (householdIndex.length === 0) {
        console.log(`${RED}No household index.${RESET} Run ${CYAN}households${RESET} first, then ${CYAN}household <N>${RESET}.`);
        return;
      }
      if (n < 1 || n > householdIndex.length) {
        console.log(`${RED}Row ${n} out of range (1–${householdIndex.length}).${RESET} Run ${CYAN}households${RESET} to see the list.`);
        return;
      }
      docId = householdIndex[n - 1];
    }

    const snap = await db.doc(`households/${docId}`).get();
    if (!snap.exists) { console.log(`${RED}Household not found: ${docId}${RESET}`); return; }
    const h = snap.data();
    const cardSnap = await db.collection(`households/${docId}/cards`).get();
    const activeCards = cardSnap.docs.filter((d) => !d.data().deletedAt).length;
    const tier = h.tier === "karl" ? `${GOLD}★ karl${RESET}` : `${DIM}free${RESET}`;
    const inviteExpired = h.inviteCodeExpiresAt && new Date(h.inviteCodeExpiresAt) < new Date();
    console.log();
    console.log(`  ${BOLD}Household:${RESET}        ${docId}`);
    console.log(`  ${BOLD}Name:${RESET}             ${h.name || "—"}`);
    console.log(`  ${BOLD}Tier:${RESET}             ${tier}`);
    console.log(`  ${BOLD}Owner:${RESET}            ${h.ownerId}`);
    console.log(`  ${BOLD}Members (${(h.memberIds || []).length}):${RESET}      ${(h.memberIds || []).join(", ") || "—"}`);
    console.log(`  ${BOLD}Invite code:${RESET}      ${h.inviteCode || "—"}  ${inviteExpired ? `${RED}(expired)${RESET}` : `${GREEN}(valid)${RESET}`}  expires ${h.inviteCodeExpiresAt ? new Date(h.inviteCodeExpiresAt).toLocaleDateString() : "—"}`);
    console.log(`  ${BOLD}Cards (active):${RESET}   ${activeCards} / ${cardSnap.size} total`);
    console.log(`  ${BOLD}Created:${RESET}          ${h.createdAt || "—"}`);
    console.log(`  ${BOLD}Updated:${RESET}          ${h.updatedAt || "—"}`);
    console.log();
  },

  async use_household(args) {
    const n = parseInt(args[0], 10);
    if (isNaN(n) || n < 1 || n > householdIndex.length) {
      // Maybe it's a raw ID
      const rawId = args[0];
      if (rawId && rawId.length >= 8) {
        const snap = await getDb().doc(`households/${rawId}`).get();
        if (!snap.exists) { console.log(`${RED}Household not found: ${rawId}${RESET}`); return; }
        selectedHouseholdId = rawId;
        console.log(`${GREEN}Selected household:${RESET} ${rawId}`);
        return;
      }
      console.log(`${RED}Invalid selection.${RESET} Run ${CYAN}households${RESET} first, then ${CYAN}use-household <N>${RESET}.`);
      return;
    }
    selectedHouseholdId = householdIndex[n - 1];
    const snap = await getDb().doc(`households/${selectedHouseholdId}`).get();
    if (!snap.exists) {
      console.log(`${RED}Household no longer exists.${RESET} Run ${CYAN}households${RESET} to refresh.`);
      selectedHouseholdId = null;
      return;
    }
    const h = snap.data();
    console.log(`\n  ${GREEN}Selected:${RESET} ${selectedHouseholdId}  ${DIM}(${h.name || "unnamed"})${RESET}\n`);
  },

  async delete_member(args) {
    if (!requireHousehold()) return;
    const userId = args[0];
    if (!userId) { console.log(`${RED}Usage: delete-member <clerkUserId>${RESET}`); return; }
    const db = getDb();
    const snap = await db.doc(`households/${selectedHouseholdId}`).get();
    if (!snap.exists) { console.log(`${RED}Household not found.${RESET}`); return; }
    const h = snap.data();
    if (h.ownerId === userId) { console.log(`${RED}Cannot remove the owner. Use update-owner first.${RESET}`); return; }
    if (!(h.memberIds || []).includes(userId)) { console.log(`${RED}User ${userId} is not a member of this household.${RESET}`); return; }
    const confirmed = await confirmPrompt(`Remove ${userId} from household ${shortId(selectedHouseholdId)}?`);
    if (!confirmed) { console.log(`${DIM}Aborted.${RESET}`); return; }
    const newMembers = (h.memberIds || []).filter((id) => id !== userId);
    await db.doc(`households/${selectedHouseholdId}`).update({
      memberIds: newMembers,
      updatedAt: new Date().toISOString(),
    });
    // Update user's householdId to empty (they've been removed)
    const userSnap = await db.doc(`users/${userId}`).get();
    if (userSnap.exists) {
      await db.doc(`users/${userId}`).update({ householdId: "", updatedAt: new Date().toISOString() });
    }
    console.log(`\n  ${RED}Removed${RESET} ${userId} from household ${shortId(selectedHouseholdId)}\n`);
  },

  async update_owner(args) {
    if (!requireHousehold()) return;
    const userId = args[0];
    if (!userId) { console.log(`${RED}Usage: update-owner <clerkUserId>${RESET}`); return; }
    const db = getDb();
    const snap = await db.doc(`households/${selectedHouseholdId}`).get();
    if (!snap.exists) { console.log(`${RED}Household not found.${RESET}`); return; }
    const h = snap.data();
    if (!(h.memberIds || []).includes(userId)) { console.log(`${RED}User ${userId} is not a member of this household.${RESET}`); return; }
    if (h.ownerId === userId) { console.log(`  User is already the owner — nothing to do.`); return; }
    const confirmed = await confirmPrompt(`Transfer ownership to ${userId}?`);
    if (!confirmed) { console.log(`${DIM}Aborted.${RESET}`); return; }
    const now = new Date().toISOString();
    const batch = db.batch();
    batch.update(db.doc(`households/${selectedHouseholdId}`), { ownerId: userId, updatedAt: now });
    const oldOwnerSnap = await db.doc(`users/${h.ownerId}`).get();
    if (oldOwnerSnap.exists) batch.update(db.doc(`users/${h.ownerId}`), { role: "member", updatedAt: now });
    const newOwnerSnap = await db.doc(`users/${userId}`).get();
    if (newOwnerSnap.exists) batch.update(db.doc(`users/${userId}`), { role: "owner", updatedAt: now });
    await batch.commit();
    console.log(`\n  ${GOLD}Ownership transferred${RESET} to ${userId}\n`);
  },

  async update_tier(args) {
    if (!requireHousehold()) return;
    const tier = args[0];
    if (tier !== "free" && tier !== "karl") {
      console.log(`${RED}Usage: update-tier <free|karl>${RESET}`);
      return;
    }
    const confirmed = await confirmPrompt(`Set tier to "${tier}" for ${shortId(selectedHouseholdId)}?`);
    if (!confirmed) { console.log(`${DIM}Aborted.${RESET}`); return; }
    await getDb().doc(`households/${selectedHouseholdId}`).update({
      tier,
      updatedAt: new Date().toISOString(),
    });
    const badge = tier === "karl" ? `${GOLD}★ karl${RESET}` : `${DIM}free${RESET}`;
    console.log(`\n  ${GREEN}Tier updated:${RESET} ${badge}\n`);
  },

  async update_invite() {
    if (!requireHousehold()) return;
    const code = generateInviteCode();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await getDb().doc(`households/${selectedHouseholdId}`).update({
      inviteCode: code,
      inviteCodeExpiresAt: expiresAt,
      updatedAt: new Date().toISOString(),
    });
    console.log(`\n  ${GREEN}Invite code regenerated:${RESET} ${BOLD}${code}${RESET}`);
    console.log(`  ${DIM}Expires: ${new Date(expiresAt).toLocaleDateString()}${RESET}\n`);
  },

  async delete_household(args) {
    const id = args[0] || selectedHouseholdId;
    if (!id) { console.log(`${RED}Usage: delete-household <id>${RESET}`); return; }
    const db = getDb();
    const snap = await db.doc(`households/${id}`).get();
    if (!snap.exists) { console.log(`${RED}Household not found: ${id}${RESET}`); return; }
    const h = snap.data();
    console.log(`\n  ${RED}${BOLD}WARNING: This permanently deletes household ${shortId(id)} ("${h.name || "unnamed"}") and ALL its cards.${RESET}`);
    const confirmed = await confirmPrompt(`Type "y" to confirm permanent deletion:`);
    if (!confirmed) { console.log(`${DIM}Aborted.${RESET}`); return; }

    // Delete all cards in the subcollection first
    const cards = await db.collection(`households/${id}/cards`).get();
    const batch = db.batch();
    cards.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(db.doc(`households/${id}`));
    await batch.commit();

    console.log(`  ${RED}✗${RESET} Deleted ${cards.size} cards`);
    console.log(`  ${RED}✗${RESET} Deleted household ${id}\n`);
    if (selectedHouseholdId === id) selectedHouseholdId = null;
  },

  // ── Firestore: User commands ────────────────────────────────────────────────

  async users() {
    const db = getDb();
    const snap = await db.collection("users").orderBy("createdAt", "desc").limit(50).get();
    if (snap.empty) { console.log("\n  No users found in Firestore.\n"); return; }

    console.log(`\n  ${BOLD}  ClerkUserId                          Email                          Display name        Role     Household${RESET}`);
    console.log(`  ${DIM}${"─".repeat(115)}${RESET}`);
    snap.docs.forEach((d) => {
      const u = d.data();
      const roleColor = u.role === "owner" ? GOLD : DIM;
      console.log(`  ${d.id.padEnd(36)} ${(u.email || "").substring(0, 30).padEnd(31)} ${(u.displayName || "").substring(0, 18).padEnd(19)} ${roleColor}${(u.role || "").padEnd(8)}${RESET} ${shortId(u.householdId || "")}`);
    });
    console.log(`\n  ${DIM}Total: ${snap.size}${RESET}\n`);
  },

  async user(args) {
    const id = args[0];
    if (!id) { console.log(`${RED}Usage: user <clerkUserId>${RESET}`); return; }
    const snap = await getDb().doc(`users/${id}`).get();
    if (!snap.exists) { console.log(`${RED}User not found: ${id}${RESET}`); return; }
    const u = snap.data();
    console.log();
    console.log(`  ${BOLD}ClerkUserId:${RESET}  ${id}`);
    console.log(`  ${BOLD}Email:${RESET}        ${u.email || "—"}`);
    console.log(`  ${BOLD}Display name:${RESET} ${u.displayName || "—"}`);
    console.log(`  ${BOLD}Role:${RESET}         ${u.role === "owner" ? `${GOLD}owner${RESET}` : u.role || "—"}`);
    console.log(`  ${BOLD}Household:${RESET}    ${u.householdId || "—"}`);
    console.log(`  ${BOLD}Created:${RESET}      ${u.createdAt || "—"}`);
    console.log(`  ${BOLD}Updated:${RESET}      ${u.updatedAt || "—"}`);
    console.log();
  },

  async delete_user(args) {
    const id = args[0];
    if (!id) { console.log(`${RED}Usage: delete-user <clerkUserId>${RESET}`); return; }
    const db = getDb();
    const snap = await db.doc(`users/${id}`).get();
    if (!snap.exists) { console.log(`${RED}User not found: ${id}${RESET}`); return; }
    const u = snap.data();
    console.log(`\n  ${RED}${BOLD}WARNING: Deletes user ${id} (${u.email || "unknown email"})${RESET}`);
    console.log(`  ${DIM}The user's household and cards are NOT deleted — use delete-member first if needed.${RESET}`);
    const confirmed = await confirmPrompt(`Confirm delete user ${id}?`);
    if (!confirmed) { console.log(`${DIM}Aborted.${RESET}`); return; }
    // Remove from household memberIds if present
    if (u.householdId) {
      const hSnap = await db.doc(`households/${u.householdId}`).get();
      if (hSnap.exists) {
        const h = hSnap.data();
        const newMembers = (h.memberIds || []).filter((mid) => mid !== id);
        await db.doc(`households/${u.householdId}`).update({ memberIds: newMembers, updatedAt: new Date().toISOString() });
      }
    }
    await db.doc(`users/${id}`).delete();
    console.log(`\n  ${RED}✗${RESET} Deleted user ${id}\n`);
  },

  // ── Firestore: Card commands ────────────────────────────────────────────────

  async cards() {
    if (!requireHousehold()) return;
    const db = getDb();
    const snap = await db.collection(`households/${selectedHouseholdId}/cards`).get();
    if (snap.empty) { console.log("\n  No cards found for this household.\n"); return; }

    const active = snap.docs.filter((d) => !d.data().deletedAt);
    const deleted = snap.docs.filter((d) => d.data().deletedAt);

    console.log(`\n  ${BOLD}  ID              Issuer      Card name             Status         Annual fee  Open date${RESET}`);
    console.log(`  ${DIM}${"─".repeat(90)}${RESET}`);
    for (const d of active) {
      const c = d.data();
      const fee = c.annualFee ? `$${(c.annualFee / 100).toFixed(0)}` : "none";
      const opened = c.openDate ? new Date(c.openDate).toLocaleDateString() : "—";
      console.log(`  ${shortId(d.id).padEnd(16)} ${(c.issuerId || "").padEnd(10)} ${(c.cardName || "").substring(0, 20).padEnd(21)} ${(c.status || "").padEnd(14)} ${fee.padEnd(11)} ${opened}`);
    }
    if (deleted.length > 0) {
      console.log(`\n  ${DIM}Soft-deleted (${deleted.length}):${RESET}`);
      for (const d of deleted) {
        const c = d.data();
        console.log(`  ${DIM}${shortId(d.id).padEnd(16)} ${(c.issuerId || "").padEnd(10)} ${(c.cardName || "")} — deleted ${c.deletedAt ? new Date(c.deletedAt).toLocaleDateString() : "?"}${RESET}`);
      }
    }
    console.log(`\n  ${DIM}Active: ${active.length}, Deleted: ${deleted.length}, Total: ${snap.size}${RESET}\n`);
  },

  async card(args) {
    if (!requireHousehold()) return;
    const id = args[0];
    if (!id) { console.log(`${RED}Usage: card <cardId>${RESET}`); return; }
    const snap = await getDb().doc(`households/${selectedHouseholdId}/cards/${id}`).get();
    if (!snap.exists) { console.log(`${RED}Card not found: ${id}${RESET}`); return; }
    const c = snap.data();
    const deleted = c.deletedAt ? `${RED} [DELETED ${new Date(c.deletedAt).toLocaleDateString()}]${RESET}` : "";
    const closed = c.closedAt ? ` ${DIM}[closed ${new Date(c.closedAt).toLocaleDateString()}]${RESET}` : "";
    console.log();
    console.log(`  ${BOLD}Card ID:${RESET}      ${id}${deleted}`);
    console.log(`  ${BOLD}Issuer:${RESET}       ${c.issuerId || "—"}`);
    console.log(`  ${BOLD}Name:${RESET}         ${c.cardName || "—"}${closed}`);
    console.log(`  ${BOLD}Status:${RESET}       ${c.status || "—"}`);
    console.log(`  ${BOLD}Credit limit:${RESET} $${c.creditLimit ? (c.creditLimit / 100).toLocaleString() : "—"}`);
    console.log(`  ${BOLD}Annual fee:${RESET}   ${c.annualFee ? `$${(c.annualFee / 100).toFixed(0)}` : "none"}${c.annualFeeDate ? `  (due ${new Date(c.annualFeeDate).toLocaleDateString()})` : ""}`);
    console.log(`  ${BOLD}Open date:${RESET}    ${c.openDate ? new Date(c.openDate).toLocaleDateString() : "—"}`);
    if (c.signUpBonus) {
      console.log(`  ${BOLD}Sign-up bonus:${RESET} ${JSON.stringify(c.signUpBonus)}`);
    }
    console.log(`  ${BOLD}Notes:${RESET}        ${c.notes || "—"}`);
    console.log(`  ${BOLD}Household:${RESET}    ${c.householdId || "—"}`);
    console.log(`  ${BOLD}Created:${RESET}      ${c.createdAt || "—"}`);
    console.log(`  ${BOLD}Updated:${RESET}      ${c.updatedAt || "—"}`);
    console.log();
  },

  async delete_card(args) {
    if (!requireHousehold()) return;
    const id = args[0];
    if (!id) { console.log(`${RED}Usage: delete-card <cardId>${RESET}`); return; }
    const db = getDb();
    const snap = await db.doc(`households/${selectedHouseholdId}/cards/${id}`).get();
    if (!snap.exists) { console.log(`${RED}Card not found: ${id}${RESET}`); return; }
    const c = snap.data();
    if (c.deletedAt) { console.log(`${GOLD}Card already soft-deleted.${RESET} Use update-card-restore to undo, or delete-card-permanent to permanently remove.`); return; }
    await db.doc(`households/${selectedHouseholdId}/cards/${id}`).update({
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    console.log(`\n  ${RED}Soft-deleted:${RESET} ${c.cardName || id}  ${DIM}(use update-card-restore ${id} to undo)${RESET}\n`);
  },

  async update_card_restore(args) {
    if (!requireHousehold()) return;
    const id = args[0];
    if (!id) { console.log(`${RED}Usage: update-card-restore <cardId>${RESET}`); return; }
    const db = getDb();
    const snap = await db.doc(`households/${selectedHouseholdId}/cards/${id}`).get();
    if (!snap.exists) { console.log(`${RED}Card not found: ${id}${RESET}`); return; }
    const c = snap.data();
    if (!c.deletedAt) { console.log(`${DIM}Card is not soft-deleted — nothing to restore.${RESET}`); return; }
    await db.doc(`households/${selectedHouseholdId}/cards/${id}`).update({
      deletedAt: FieldValue.delete(),
      updatedAt: new Date().toISOString(),
    });
    console.log(`\n  ${GREEN}Restored:${RESET} ${c.cardName || id}\n`);
  },

  async delete_card_permanent(args) {
    if (!requireHousehold()) return;
    const id = args[0];
    if (!id) { console.log(`${RED}Usage: delete-card-permanent <cardId>${RESET}`); return; }
    const db = getDb();
    const snap = await db.doc(`households/${selectedHouseholdId}/cards/${id}`).get();
    if (!snap.exists) { console.log(`${RED}Card not found: ${id}${RESET}`); return; }
    const c = snap.data();
    console.log(`\n  ${RED}${BOLD}WARNING: Permanently deletes "${c.cardName || id}" — cannot be undone.${RESET}`);
    const confirmed = await confirmPrompt(`Confirm permanent delete card ${id}?`);
    if (!confirmed) { console.log(`${DIM}Aborted.${RESET}`); return; }
    await db.doc(`households/${selectedHouseholdId}/cards/${id}`).delete();
    console.log(`\n  ${RED}✗${RESET} Permanently deleted card ${id}\n`);
  },

  async read_card_count() {
    if (!requireHousehold()) return;
    const snap = await getDb().collection(`households/${selectedHouseholdId}/cards`).get();
    const active = snap.docs.filter((d) => !d.data().deletedAt).length;
    const deleted = snap.docs.filter((d) => !!d.data().deletedAt).length;
    console.log(`\n  ${BOLD}Card count for ${shortId(selectedHouseholdId)}:${RESET}`);
    console.log(`  ${GREEN}Active:${RESET}  ${active}`);
    console.log(`  ${RED}Deleted:${RESET} ${deleted}`);
    console.log(`  ${BOLD}Total:${RESET}   ${snap.size}\n`);
  },

  help() {
    if (selectedFp) {
      console.log(`
  ${BOLD}Selected:${RESET} ${GOLD}${shortFp(selectedFp)}${RESET}
  ${DIM}${"─".repeat(50)}${RESET}

  ${CYAN}status${RESET}                         Show trial details
  ${CYAN}update-trial-field <days>${RESET}     Set remaining days (e.g., "update-trial-field 5")
  ${CYAN}update-trial-dates <days>${RESET}     Shift start date (e.g., "update-trial-dates -25")
  ${CYAN}update-trial-reset${RESET}            Fresh 30-day trial
  ${CYAN}update-trial-expire${RESET}           Instantly expire
  ${CYAN}update-trial-convert${RESET} / ${CYAN}update-trial-unconvert${RESET}    Toggle paid conversion
  ${CYAN}delete-entitlement${RESET}            Clear Redis entitlement cache
  ${CYAN}delete-all${RESET}                    Wipe everything: Stripe + Redis
  ${CYAN}delete${RESET}                        Delete trial from Redis
  ${CYAN}list${RESET}                          Switch trial     ${CYAN}quit${RESET}  Exit
`);
    } else if (selectedHouseholdId) {
      // Household selected — show all sections including Cards
      console.log(`
  ${BOLD}No trial selected${RESET} — start here:
  ${DIM}${"─".repeat(50)}${RESET}

  ${CYAN}list${RESET}                          List all trials (pick by number)
  ${CYAN}use <N|fingerprint>${RESET}           Select a trial
  ${CYAN}create <fingerprint>${RESET}           Create a new trial
  ${CYAN}identity${RESET}                      How to find your fingerprint

  ${BOLD}Redis / Stripe${RESET}
  ${CYAN}keys${RESET}                          All Redis key prefixes
  ${CYAN}entitlements${RESET}                   Stripe entitlement cache
  ${CYAN}list-customers${RESET}                List Stripe customers
  ${CYAN}list-subscriptions${RESET}           List Stripe subscriptions
  ${CYAN}delete-customer <cus_xxx>${RESET}    Delete Stripe customer
  ${CYAN}delete-subscription <sub_xxx>${RESET}  Cancel subscription
  ${CYAN}reconnect${RESET}                    Reconnect port-forward

  ${BOLD}Firestore — Households${RESET}  ${DIM}(selected: ${shortId(selectedHouseholdId)})${RESET}
  ${CYAN}households${RESET}                   List all households (paginated, 50)
  ${CYAN}household [id]${RESET}               Show household details
  ${CYAN}use-household <N|id>${RESET}         Select a household
  ${CYAN}delete-member <userId>${RESET}       Remove member from selected household
  ${CYAN}update-owner <userId>${RESET}        Transfer ownership
  ${CYAN}update-tier <free|karl>${RESET}      Change subscription tier
  ${CYAN}update-invite${RESET}               Regenerate invite code
  ${CYAN}delete-household [id]${RESET}        Permanently delete household + cards

  ${BOLD}Firestore — Users${RESET}
  ${CYAN}users${RESET}                        List all users (paginated, 50)
  ${CYAN}user <clerkUserId>${RESET}           Show user details
  ${CYAN}delete-user <clerkUserId>${RESET}    Delete user document

  ${BOLD}Firestore — Cards${RESET}  ${DIM}(household: ${shortId(selectedHouseholdId)})${RESET}
  ${CYAN}cards${RESET}                        List cards for selected household
  ${CYAN}card <cardId>${RESET}                Show card details
  ${CYAN}read-card-count${RESET}              Count active/deleted cards
  ${CYAN}delete-card <cardId>${RESET}         Soft-delete a card (sets deletedAt)
  ${CYAN}update-card-restore <cardId>${RESET} Restore a soft-deleted card
  ${CYAN}delete-card-permanent <cardId>${RESET}  Permanently delete a card

  ${CYAN}quit${RESET}                         Exit
`);
    } else {
      // No household selected — hide Cards section, prompt to select one
      console.log(`
  ${BOLD}No trial selected${RESET} — start here:
  ${DIM}${"─".repeat(50)}${RESET}

  ${CYAN}list${RESET}                          List all trials (pick by number)
  ${CYAN}use <N|fingerprint>${RESET}           Select a trial
  ${CYAN}create <fingerprint>${RESET}           Create a new trial
  ${CYAN}identity${RESET}                      How to find your fingerprint

  ${BOLD}Redis / Stripe${RESET}
  ${CYAN}keys${RESET}                          All Redis key prefixes
  ${CYAN}entitlements${RESET}                   Stripe entitlement cache
  ${CYAN}list-customers${RESET}                List Stripe customers
  ${CYAN}list-subscriptions${RESET}           List Stripe subscriptions
  ${CYAN}delete-customer <cus_xxx>${RESET}    Delete Stripe customer
  ${CYAN}delete-subscription <sub_xxx>${RESET}  Cancel subscription
  ${CYAN}reconnect${RESET}                    Reconnect port-forward

  ${BOLD}Firestore — Households${RESET}
  ${CYAN}households${RESET}                   List all households (paginated, 50)
  ${CYAN}household [id]${RESET}               Show household details
  ${CYAN}use-household <N|id>${RESET}         Select a household
  ${CYAN}delete-member <userId>${RESET}       Remove member from selected household
  ${CYAN}update-owner <userId>${RESET}        Transfer ownership
  ${CYAN}update-tier <free|karl>${RESET}      Change subscription tier
  ${CYAN}update-invite${RESET}               Regenerate invite code
  ${CYAN}delete-household [id]${RESET}        Permanently delete household + cards

  ${BOLD}Firestore — Users${RESET}
  ${CYAN}users${RESET}                        List all users (paginated, 50)
  ${CYAN}user <clerkUserId>${RESET}           Show user details
  ${CYAN}delete-user <clerkUserId>${RESET}    Delete user document

  ${DIM}Firestore — Cards: run use-household <N> to unlock card commands${RESET}

  ${CYAN}quit${RESET}                         Exit
`);
    }
  },
};

// ── Load initial counts ──────────────────────────────────────────────────────

let initialCounts = { users: 0, households: 0 };
try {
  const [uSnap, hSnap] = await Promise.all([
    getDb().collection("users").count().get(),
    getDb().collection("households").count().get(),
  ]);
  initialCounts = {
    users: uSnap.data().count,
    households: hSnap.data().count,
  };
} catch { /* counts are informational — ignore on error */ }

// ── Users Tab — Data Loading ──────────────────────────────────────────────────

/** Fetch all users from Firestore, enriched with tier derived from households. */
async function loadUsersWithTiers() {
  const db = getDb();
  const [usersSnap, hhSnap] = await Promise.all([
    db.collection("users").orderBy("createdAt", "desc").limit(100).get(),
    db.collection("households").limit(200).get(),
  ]);

  const hhMap = new Map();
  hhSnap.docs.forEach((d) => {
    const h = d.data();
    hhMap.set(d.id, { tier: h.tier || "thrall", name: h.name || "" });
  });

  return usersSnap.docs.map((d) => {
    const u = d.data();
    const hh = u.householdId ? hhMap.get(u.householdId) : null;
    return {
      id: d.id,
      email: u.email || "",
      displayName: u.displayName || "",
      role: u.role || "",
      householdId: u.householdId || null,
      householdName: hh ? hh.name : null,
      tier: hh ? hh.tier : (u.tier || "thrall"),
      createdAt: u.createdAt || null,
      updatedAt: u.updatedAt || null,
      // Optional Stripe/sync fields that may exist on user doc
      stripeCustomerId: u.stripeCustomerId || null,
      lastSyncAt: u.lastSyncAt || null,
      syncCount: u.syncCount != null ? u.syncCount : null,
      syncHealth: u.syncHealth || null,
    };
  });
}

/** Fetch full detail for a selected user: household, cards, Stripe, cloud sync. */
async function loadUserDetailData(user) {
  const db = getDb();
  const result = {
    household: null,
    stripe: null,
    cloudSync: user.lastSyncAt != null ? {
      lastSync: user.lastSyncAt,
      totalSyncs: user.syncCount || 0,
      health: user.syncHealth || "unknown",
    } : null,
    cardCount: null,
  };

  if (user.householdId) {
    try {
      const [hhSnap, cardSnap] = await Promise.all([
        db.doc(`households/${user.householdId}`).get(),
        db.collection(`households/${user.householdId}/cards`).get(),
      ]);
      if (hhSnap.exists) {
        const h = hhSnap.data();
        result.household = {
          id: user.householdId,
          name: h.name || "",
          tier: h.tier || "thrall",
          ownerId: h.ownerId || null,
        };
        // Cloud sync may be stored on the household doc
        if (!result.cloudSync && (h.lastSyncAt || h.syncCount != null)) {
          result.cloudSync = {
            lastSync: h.lastSyncAt || null,
            totalSyncs: h.syncCount || 0,
            health: h.syncHealth || "unknown",
          };
        }
      }
      const active = cardSnap.docs.filter((d) => !d.data().deletedAt).length;
      result.cardCount = { active, total: cardSnap.size };
    } catch { /* best effort */ }
  }

  // Fetch Stripe subscription if we have a customerId on the user doc
  const customerId = user.stripeCustomerId;
  if (customerId) {
    try {
      const data = await stripe("GET", `/customers/${customerId}?expand[]=subscriptions`);
      if (data && data.subscriptions) {
        const sub =
          data.subscriptions.data.find((s) => s.status !== "canceled") ||
          data.subscriptions.data[0];
        if (sub) {
          const item = sub.items?.data?.[0];
          const src = data.default_source;
          result.stripe = {
            subId: sub.id,
            customerId,
            status: sub.status,
            amount: item?.price?.unit_amount ?? null,
            currency: item?.price?.currency ?? "usd",
            interval: item?.price?.recurring?.interval ?? null,
            paymentMethod: src?.last4
              ? `${src.brand || "Card"} ending ${src.last4}`
              : null,
          };
        }
      }
    } catch { /* best effort */ }
  }

  return result;
}

// ── Users Tab — Ink Components ────────────────────────────────────────────────

const TIER_STYLES = {
  karl:   { label: "KARL",   color: "black",  bg: "yellow",      bold: true  },
  trial:  { label: "TRIAL",  color: "black",  bg: "yellowBright", bold: false },
  thrall: { label: "THRALL", color: "gray",   bg: undefined,     bold: false },
};

/** Tier badge: Karl=gold bg, Trial=amber bg, Thrall=gray text. */
function TierBadge({ tier }) {
  const s = TIER_STYLES[tier] || TIER_STYLES.thrall;
  return h(Text, { backgroundColor: s.bg, color: s.color, bold: s.bold }, ` ${s.label} `);
}

/** Subscription status badge. */
function SubStatusBadge({ status }) {
  if (!status) return h(Text, { color: "gray", dimColor: true }, "none");
  const color =
    status === "active"    ? "green"  :
    status === "trialing"  ? "yellow" :
    status === "past_due"  ? "yellow" :
    status === "canceled"  ? "red"    : "gray";
  return h(Text, { color, bold: color !== "gray" }, status.replace(/_/g, " "));
}

/** Cloud sync health indicator. */
function SyncHealthBadge({ health }) {
  if (!health || health === "unknown") return h(Text, { color: "gray", dimColor: true }, "N/A");
  const color = health === "healthy" ? "green" : health === "degraded" ? "yellow" : "red";
  const dot = health === "healthy" ? "●" : health === "degraded" ? "◑" : "●";
  return h(Text, { color }, `${dot} ${health}`);
}

/** A label-value row in the detail panel. */
function DetailField({ label, children }) {
  return h(Box, { flexDirection: "row" },
    h(Text, { color: "gray", dimColor: true }, `  ${label.padEnd(18)}`),
    children
  );
}

/** Section heading. */
function SectionHeader({ title }) {
  return h(Box, { marginTop: 1 },
    h(Text, { color: "yellow", dimColor: true }, `── ${title} `)
  );
}

/**
 * Left-panel list row: email (truncated) + tier badge.
 * selected item shown with ▶ highlight.
 */
function UserListRow({ user, selected }) {
  const maxEmail = 22;
  const email = user.email.length > maxEmail
    ? user.email.slice(0, maxEmail - 1) + "…"
    : user.email;
  const bg = selected ? "blue" : undefined;
  const textColor = selected ? "white" : "white";
  return h(Box, { flexDirection: "row", alignItems: "center", paddingX: 1 },
    h(Text, { backgroundColor: bg, color: selected ? "yellow" : "gray", bold: selected }, selected ? "▶ " : "  "),
    h(Text, { backgroundColor: bg, color: textColor, bold: selected }, email.padEnd(maxEmail)),
    h(Box, { flexShrink: 0, marginLeft: 1 }, h(TierBadge, { tier: user.tier }))
  );
}

/**
 * Right-panel: full detail for selected user.
 * Shows identity, household, Stripe, cloud sync, card count, and action shortcuts.
 */
function UserDetailPanel({ user, detail, detailLoading, mode, tierInput, statusMessage }) {
  const hh = detail?.household ?? null;
  const stripeData = detail?.stripe ?? null;
  const sync = detail?.cloudSync ?? null;
  const cards = detail?.cardCount ?? null;

  // ── Action area ──
  let actionArea;
  if (mode === "confirm-delete") {
    actionArea = h(Box, { borderStyle: "single", borderColor: "red", paddingX: 1, marginTop: 1 },
      h(Text, { color: "red" }, `Delete ${user.email}? `),
      h(Text, { color: "yellow", bold: true }, "[y] Confirm  "),
      h(Text, { color: "gray" }, "[Esc] Cancel")
    );
  } else if (mode === "prompt-tier") {
    actionArea = h(Box, { borderStyle: "single", borderColor: "yellow", paddingX: 1, marginTop: 1, flexDirection: "row" },
      h(Text, { color: "yellow" }, "New tier (karl/trial/thrall): "),
      h(Text, { color: "white", bold: true }, tierInput),
      h(Text, { color: "gray" }, "█  [Enter] Confirm  [Esc] Cancel")
    );
  } else if (mode === "confirm-cancel-sub") {
    actionArea = h(Box, { borderStyle: "single", borderColor: "red", paddingX: 1, marginTop: 1 },
      h(Text, { color: "red" }, "Cancel subscription? "),
      h(Text, { color: "yellow", bold: true }, "[y] Confirm  "),
      h(Text, { color: "gray" }, "[Esc] Cancel")
    );
  } else {
    actionArea = h(Box, { flexDirection: "row", flexWrap: "wrap", borderStyle: "single", borderColor: "gray", paddingX: 1, marginTop: 1 },
      h(Text, { color: "red" }, "[d] Delete  "),
      h(Text, { color: "cyan" }, "[t] Tier  "),
      ...(stripeData ? [h(Text, { color: "red" }, "[s] Cancel Sub  ")] : []),
      ...(hh ? [h(Text, { color: "yellow" }, "[h] Household  ")] : []),
      ...(hh ? [h(Text, { color: "cyan" }, "[c] Cards  ")] : []),
      h(Text, { color: "gray" }, "[Esc] Back")
    );
  }

  return h(Box, { flexDirection: "column", flexGrow: 1, paddingX: 2, paddingY: 1 },

    // ── Header ──
    h(Box, { flexDirection: "row", alignItems: "center", gap: 2, marginBottom: 1,
             borderStyle: "single", borderColor: "gray", paddingX: 1 },
      h(Text, { bold: true, color: "yellow" }, user.email),
      h(TierBadge, { tier: user.tier })
    ),

    // ── Identity ──
    h(SectionHeader, { title: "Identity" }),
    h(DetailField, { label: "User ID" },
      h(Text, { color: "cyan" }, user.id)   // never truncated
    ),
    h(DetailField, { label: "Email" },       h(Text, {}, user.email)),
    h(DetailField, { label: "Tier" },        h(TierBadge, { tier: user.tier })),
    h(DetailField, { label: "Role" },        h(Text, { color: user.role === "owner" ? "yellow" : "white" },
                                               user.role === "owner" ? "★ Owner" : user.role || "—")),
    h(DetailField, { label: "Joined" },      h(Text, {}, user.createdAt
      ? new Date(user.createdAt).toLocaleDateString()
      : "—"
    )),

    // ── Household ──
    h(SectionHeader, { title: "Household" }),
    detailLoading
      ? h(Text, { color: "gray", dimColor: true }, "  Loading…")
      : hh
        ? h(Box, { flexDirection: "column" },
            h(DetailField, { label: "Name" },
              h(Text, { color: "yellow" }, `${hh.name}  `)
            ),
            h(Text, { color: "gray", dimColor: true }, "                      [h] jump to household"),
            h(DetailField, { label: "Role" }, h(Text, {}, user.role === "owner" ? "★ Owner" : "Member"))
          )
        : h(Text, { color: "gray", dimColor: true }, "  No household (solo user)"),

    // ── Stripe Subscription ──
    ...(stripeData ? [
      h(SectionHeader, { title: "Stripe Subscription" }),
      h(DetailField, { label: "Sub ID" },     h(Text, { color: "cyan" }, stripeData.subId)),
      h(DetailField, { label: "Status" },     h(SubStatusBadge, { status: stripeData.status })),
      ...(stripeData.amount != null ? [
        h(DetailField, { label: "Amount" },
          h(Text, {}, `$${(stripeData.amount / 100).toFixed(2)} / ${stripeData.interval ?? "—"}`)
        ),
      ] : []),
      ...(stripeData.paymentMethod ? [
        h(DetailField, { label: "Payment" }, h(Text, {}, stripeData.paymentMethod)),
      ] : []),
    ] : []),

    // ── Cloud Sync ──
    h(SectionHeader, { title: "Cloud Sync" }),
    detailLoading
      ? h(Text, { color: "gray", dimColor: true }, "  Loading…")
      : sync
        ? h(Box, { flexDirection: "column" },
            h(DetailField, { label: "Last Sync" },
              h(Text, {}, sync.lastSync
                ? new Date(sync.lastSync).toLocaleString()
                : "never")
            ),
            h(DetailField, { label: "Total Syncs" }, h(Text, {}, String(sync.totalSyncs))),
            h(DetailField, { label: "Health" },      h(SyncHealthBadge, { health: sync.health }))
          )
        : h(Text, { color: "gray", dimColor: true }, "  N/A"),

    // ── Cards ──
    h(SectionHeader, { title: "Cards" }),
    detailLoading
      ? h(Text, { color: "gray", dimColor: true }, "  Loading…")
      : cards
        ? h(DetailField, { label: "Count" },
            h(Text, {},
              `${cards.active} active / ${cards.total} total`)
          )
        : h(Text, { color: "gray", dimColor: true }, "  N/A"),

    // ── Actions ──
    actionArea,

    // ── Status message ──
    ...(statusMessage ? [
      h(Box, { marginTop: 1 },
        h(Text, { color: statusMessage.startsWith("Error") ? "red" : "green" }, statusMessage)
      ),
    ] : []),
  );
}

/** Full Users tab: left list + right detail panel with keyboard navigation. */
function UsersTab({ isActive, onJumpToHousehold, setInputCaptured }) {
  const LIST_HEIGHT = 18;

  const [users, setUsers]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState(null);
  const [selectedIdx, setSelectedIdx]   = useState(-1);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [detail, setDetail]             = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [mode, setMode]                 = useState("browse"); // browse | confirm-delete | prompt-tier | confirm-cancel-sub
  const [tierInput, setTierInput]       = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [cardView, setCardView]         = useState(false); // true = show CardDrilldownView
  const [cardContext, setCardContext]   = useState(null);  // { householdId, filterUserId, ownerEmail }

  // Load users on mount
  React.useEffect(() => {
    loadUsersWithTiers()
      .then((list) => { setUsers(list); })
      .catch((err) => setLoadError(err.message || String(err)))
      .finally(() => setLoading(false));
  }, []);

  // Load detail when selection changes
  React.useEffect(() => {
    if (selectedIdx < 0 || !users[selectedIdx]) {
      setDetail(null);
      return;
    }
    const user = users[selectedIdx];
    setDetailLoading(true);
    setDetail(null);
    loadUserDetailData(user)
      .then(setDetail)
      .finally(() => setDetailLoading(false));
  }, [selectedIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-clear status message after 3s
  React.useEffect(() => {
    if (!statusMessage) return;
    const tid = setTimeout(() => setStatusMessage(""), 3000);
    return () => clearTimeout(tid);
  }, [statusMessage]);

  // ── Action helpers ──

  function doDeleteUser() {
    const user = users[selectedIdx];
    if (!user) return;
    (async () => {
      try {
        const db = getDb();
        if (user.householdId) {
          const hhSnap = await db.doc(`households/${user.householdId}`).get();
          if (hhSnap.exists) {
            const h = hhSnap.data();
            const newMembers = (h.memberIds || []).filter((id) => id !== user.id);
            await db.doc(`households/${user.householdId}`).update({
              memberIds: newMembers,
              updatedAt: new Date().toISOString(),
            });
          }
        }
        await db.doc(`users/${user.id}`).delete();
        setUsers((prev) => prev.filter((_, i) => i !== selectedIdx));
        setSelectedIdx(-1);
        setDetail(null);
        setStatusMessage(`Deleted ${user.email}`);
      } catch (err) {
        setStatusMessage(`Error: ${err.message}`);
      }
    })();
  }

  function doUpdateTier(newTier) {
    const user = users[selectedIdx];
    if (!user) return;
    if (!user.householdId) {
      setStatusMessage("Cannot update tier: user has no household");
      return;
    }
    (async () => {
      try {
        await getDb().doc(`households/${user.householdId}`).update({
          tier: newTier,
          updatedAt: new Date().toISOString(),
        });
        setUsers((prev) =>
          prev.map((u, i) => i === selectedIdx ? { ...u, tier: newTier } : u)
        );
        setStatusMessage(`Tier updated to ${newTier}`);
      } catch (err) {
        setStatusMessage(`Error: ${err.message}`);
      }
    })();
  }

  function doCancelSub() {
    const subId = detail?.stripe?.subId;
    if (!subId) return;
    (async () => {
      try {
        const result = await stripe("DELETE", `/subscriptions/${subId}`);
        if (result) {
          setDetail((d) => d ? { ...d, stripe: { ...d.stripe, status: "canceled" } } : d);
          setStatusMessage("Subscription cancelled");
        }
      } catch (err) {
        setStatusMessage(`Error: ${err.message}`);
      }
    })();
  }

  // ── Keyboard input ──

  useInput((input, key) => {
    // ── Text input mode (tier prompt) ──
    if (mode === "prompt-tier") {
      if (key.return) {
        const tier = tierInput.trim().toLowerCase();
        if (["karl", "trial", "thrall"].includes(tier)) {
          doUpdateTier(tier);
        } else {
          setStatusMessage("Invalid tier. Must be: karl, trial, or thrall");
        }
        setTierInput("");
        setMode("browse");
        setInputCaptured(false);
      } else if (key.escape) {
        setTierInput("");
        setMode("browse");
        setInputCaptured(false);
        setStatusMessage("Tier update cancelled");
      } else if (key.backspace || key.delete) {
        setTierInput((t) => t.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta && input.length === 1) {
        setTierInput((t) => t + input);
      }
      return;
    }

    // ── Confirmation modes ──
    if (mode === "confirm-delete") {
      if (input === "y" || input === "Y") {
        doDeleteUser();
      } else {
        setStatusMessage("Delete cancelled");
      }
      setMode("browse");
      return;
    }
    if (mode === "confirm-cancel-sub") {
      if (input === "y" || input === "Y") {
        doCancelSub();
      } else {
        setStatusMessage("Cancelled");
      }
      setMode("browse");
      return;
    }

    // ── Browse mode navigation ──
    if (key.upArrow) {
      const newIdx = Math.max(0, selectedIdx <= 0 ? 0 : selectedIdx - 1);
      setSelectedIdx(newIdx);
      if (newIdx < scrollOffset) setScrollOffset(newIdx);
      return;
    }
    if (key.downArrow) {
      const maxIdx = users.length - 1;
      const newIdx = selectedIdx < 0 ? 0 : Math.min(maxIdx, selectedIdx + 1);
      setSelectedIdx(newIdx);
      if (newIdx >= scrollOffset + LIST_HEIGHT) setScrollOffset(newIdx - LIST_HEIGHT + 1);
      return;
    }
    if (key.return) {
      if (selectedIdx < 0 && users.length > 0) setSelectedIdx(0);
      return;
    }
    if (key.escape) {
      setSelectedIdx(-1);
      setMode("browse");
      return;
    }

    // ── Action shortcuts (only when a user is selected) ──
    if (selectedIdx < 0) return;

    if (input === "d") {
      setMode("confirm-delete");
      return;
    }
    if (input === "t") {
      setMode("prompt-tier");
      setInputCaptured(true);
      return;
    }
    if (input === "s" && detail?.stripe) {
      setMode("confirm-cancel-sub");
      return;
    }
    if (input === "h" && detail?.household) {
      onJumpToHousehold(detail.household.id);
      return;
    }
    if (input === "c" && detail?.household) {
      const u = users[selectedIdx];
      setCardContext({ householdId: u.householdId, filterUserId: u.id, ownerEmail: u.email });
      setCardView(true);
      return;
    }
  }, { isActive });

  // ── Render ──

  // Card drill-down takes over when active
  if (cardView && cardContext) {
    return h(CardDrilldownView, {
      householdId: cardContext.householdId,
      filterUserId: cardContext.filterUserId,
      ownerEmail: cardContext.ownerEmail,
      onBack: () => setCardView(false),
      setInputCaptured,
    });
  }

  const selectedUser = selectedIdx >= 0 ? users[selectedIdx] : null;
  const visibleUsers = users.slice(scrollOffset, scrollOffset + LIST_HEIGHT);
  const canScrollUp   = scrollOffset > 0;
  const canScrollDown = scrollOffset + LIST_HEIGHT < users.length;

  return h(Box, { flexDirection: "row", flexGrow: 1 },

    // ── Left panel: user list ──
    h(Box, {
      flexDirection: "column",
      width: 36,
      borderStyle: "single",
      borderColor: selectedIdx >= 0 ? "gray" : "yellow",
      flexShrink: 0,
    },
      h(Box, { paddingX: 1, borderStyle: "single", borderColor: "gray" },
        h(Text, { bold: true, color: "yellow" },
          loading ? "Users (loading…)" :
          loadError ? "Users (error)" :
          `Users (${users.length})`
        )
      ),
      canScrollUp && h(Text, { color: "gray", dimColor: true, paddingX: 2 }, "↑ more"),
      loading
        ? h(Text, { color: "gray", dimColor: true, paddingX: 2 }, "Loading…")
        : loadError
          ? h(Text, { color: "red", paddingX: 2 }, `Error: ${loadError}`)
          : users.length === 0
            ? h(Text, { color: "gray", dimColor: true, paddingX: 2 }, "No users found")
            : visibleUsers.map((u, i) =>
                h(UserListRow, {
                  key: u.id,
                  user: u,
                  selected: scrollOffset + i === selectedIdx,
                })
              ),
      canScrollDown && h(Text, { color: "gray", dimColor: true, paddingX: 2 }, "↓ more"),
      h(Box, { flexGrow: 1 }),
      h(Text, { color: "gray", dimColor: true, paddingX: 1 },
        "↑/↓ nav  Enter select  Esc back"
      )
    ),

    // ── Right panel: user detail or empty state ──
    selectedUser
      ? h(UserDetailPanel, {
          user: selectedUser,
          detail,
          detailLoading,
          mode,
          tierInput,
          statusMessage,
        })
      : h(Box, {
          flexGrow: 1,
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
        },
          h(Text, { color: "yellow", dimColor: true }, "ᚱ"),
          h(Text, { color: "gray" }, "Select a user from the list"),
          h(Text, { color: "gray", dimColor: true }, "↑/↓ navigate   Enter select")
        )
  );
}

// ── Ink TUI ──────────────────────────────────────────────────────────────────

const TUI_TABS = ["Users", "Households"];

// ── Households Tab helpers ────────────────────────────────────────────────────

/** Derive entitlements from tier. */
function getEntitlements(tier) {
  return {
    cloudSync: tier === "karl" || tier === "trial",
    priorityHowl: tier === "karl",
    analytics: tier === "karl",
    hiddenRunes: tier === "karl",
  };
}

/** Format a date string short (Month D, YYYY). */
function fmtDateShort(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return String(d); }
}

/** Format a datetime (Mon D HH:MM). */
function fmtDatetimeShort(d) {
  if (!d) return "never";
  try {
    const dt = new Date(d);
    return (
      dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " " +
      dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    );
  } catch { return String(d); }
}

// ── HouseholdsTab ─────────────────────────────────────────────────────────────

/**
 * Renders a labelled detail row: "Label:          value"
 */
function HDetailRow({ label, value, valueColor }) {
  return h(Box, { flexDirection: "row" },
    h(Text, { color: "gray" }, (label + ":").padEnd(18)),
    h(Text, { color: valueColor || "white" }, value ?? "—")
  );
}

/**
 * A section heading with a dim separator line.
 */
function HSectionTitle({ children }) {
  return h(Box, { marginTop: 1 },
    h(Text, { color: "yellow", bold: true, dimColor: true }, `── ${children} `)
  );
}

/**
 * Renders the full household detail inside the right panel.
 */
function HouseholdDetailView({ detail, confirmState }) {
  const { hh, members, cardCounts } = detail;
  const ownerId = hh.ownerId || "";
  const ent = getEntitlements(hh.tier);
  const tierLabel = hh.tier === "karl" ? "karl ★" : hh.tier === "trial" ? "trial" : "free";
  const tierColor = hh.tier === "karl" ? "yellow" : hh.tier === "trial" ? "cyan" : "gray";
  const inviteExpired = hh.inviteCodeExpiresAt && new Date(hh.inviteCodeExpiresAt) < new Date();

  return h(Box, { flexDirection: "column", flexGrow: 1 },
    // ── Header ──
    h(Box, { flexDirection: "row", marginBottom: 1 },
      h(Text, { color: "yellow", bold: true }, (hh.name || "unnamed").substring(0, 40)),
      h(Text, null, "  "),
      h(Text, { color: tierColor, bold: true }, `[${tierLabel}]`)
    ),

    // ── Household Info ──
    h(HSectionTitle, null, "Household Info"),
    h(HDetailRow, { label: "ID", value: shortId(hh.id || ""), valueColor: "cyan" }),
    h(Box, { flexDirection: "row" },
      h(Text, { color: "gray" }, "Invite Code:      "),
      h(Text, { color: inviteExpired ? "red" : "green" }, hh.inviteCode || "—"),
      h(Text, { color: "gray" }, inviteExpired ? " (expired)" : " (valid)")
    ),
    h(Box, { flexDirection: "row" },
      h(Text, { color: "gray" }, "Owner:            "),
      h(Text, { color: "yellow" }, "★ "),
      h(Text, null, members.find(m => m.id === ownerId)?.email || shortId(ownerId || "—"))
    ),
    h(HDetailRow, { label: "Tier", value: tierLabel, valueColor: tierColor }),

    // ── Members ──
    h(HSectionTitle, null, `Members (${members.length})`),
    h(Box, { flexDirection: "row" },
      h(Text, { color: "gray" }, "   "),
      h(Text, { color: "gray" }, "Email".padEnd(32)),
      h(Text, { color: "gray" }, "Role".padEnd(10)),
      h(Text, { color: "gray" }, "Cards".padEnd(6)),
      h(Text, { color: "gray" }, "Joined")
    ),
    ...members.map(m =>
      h(Box, { key: m.id, flexDirection: "row" },
        h(Text, { color: "yellow" }, m.id === ownerId ? "★  " : "   "),
        h(Text, null, (m.email || shortId(m.id)).substring(0, 31).padEnd(32)),
        h(Text, { color: "gray" }, (m.role || "member").padEnd(10)),
        h(Text, null, String(m.cardCount || 0).padEnd(6)),
        h(Text, { color: "gray" }, m.joinedDate ? fmtDateShort(m.joinedDate) : fmtDateShort(m.createdAt))
      )
    ),

    // ── Entitlements ──
    h(HSectionTitle, null, "Entitlements"),
    h(Box, { flexDirection: "row" },
      h(Text, { color: ent.cloudSync ? "green" : "gray" }, (ent.cloudSync ? "✓" : "✗") + " Cloud Sync       "),
      h(Text, { color: ent.priorityHowl ? "green" : "gray" }, (ent.priorityHowl ? "✓" : "✗") + " Priority Howl")
    ),
    h(Box, { flexDirection: "row" },
      h(Text, { color: ent.analytics ? "green" : "gray" }, (ent.analytics ? "✓" : "✗") + " Analytics        "),
      h(Text, { color: ent.hiddenRunes ? "green" : "gray" }, (ent.hiddenRunes ? "✓" : "✗") + " Hidden Runes")
    ),

    // ── Stripe Subscription (karl only) ──
    ...(hh.tier === "karl" ? [
      h(HSectionTitle, null, "Stripe Subscription"),
      h(HDetailRow, { label: "Sub ID", value: hh.stripeSubId ? shortId(hh.stripeSubId) : "—", valueColor: "cyan" }),
      h(HDetailRow, { label: "Status",
        value: hh.subStatus || "—",
        valueColor: hh.subStatus === "active" ? "green" : hh.subStatus === "past_due" ? "yellow" : "red",
      }),
      ...(hh.subAmount ? [h(HDetailRow, { label: "Amount", value: `$${(hh.subAmount / 100).toFixed(2)} / ${hh.subPeriod || "mo"}` })] : []),
    ] : []),

    // ── Cloud Sync ──
    h(HSectionTitle, null, "Cloud Sync"),
    h(HDetailRow, { label: "Last Sync", value: fmtDatetimeShort(hh.lastSync) }),
    h(HDetailRow, { label: "Sync Count", value: String(hh.syncCount != null ? hh.syncCount : "—") }),
    h(HDetailRow, {
      label: "Health",
      value: hh.syncHealth || "N/A",
      valueColor: hh.syncHealth === "healthy" ? "green" : hh.syncHealth === "degraded" ? "yellow" : "gray",
    }),

    // ── Card Summary ──
    h(HSectionTitle, null, "Card Summary"),
    h(Box, { flexDirection: "row" },
      h(Text, null, `Total: ${cardCounts.total}  `),
      h(Text, { color: "green" }, `Active: ${cardCounts.active}  `),
      h(Text, { color: "yellow" }, `Attention: ${cardCounts.feeApproaching + cardCounts.promo}  `),
      h(Text, { color: "gray" }, `Closed: ${cardCounts.closed}`)
    ),

    // ── Action shortcuts ──
    h(Box, { marginTop: 1, flexDirection: "row" },
      h(Text, { color: "cyan" }, "[k]"), h(Text, { color: "gray" }, " Kick  "),
      h(Text, { color: "cyan" }, "[o]"), h(Text, { color: "gray" }, " Xfer owner  "),
      h(Text, { color: "cyan" }, "[i]"), h(Text, { color: "gray" }, " Regen invite  "),
      h(Text, { color: "cyan" }, "[c]"), h(Text, { color: "gray" }, " Cards  "),
      ...(hh.tier === "karl" ? [
        h(Text, { color: "cyan" }, "[s]"), h(Text, { color: "gray" }, " Cancel sub  "),
      ] : []),
      h(Text, { color: "red" }, "[x]"), h(Text, { color: "gray" }, " Delete HH")
    ),

    // ── Confirmation bar ──
    ...(confirmState ? [
      h(Box, { marginTop: 1, borderStyle: "single", borderColor: "yellow", paddingX: 1, flexDirection: "row" },
        h(Text, { color: "yellow" }, "⚠  "),
        h(Text, { color: "white" }, confirmState.message),
        h(Text, { color: "cyan" },
          confirmState.onConfirm != null ? "  [y] Confirm  [n/Esc] Cancel" : "  [n/Esc] Close"
        )
      ),
    ] : [])
  );
}

/**
 * Full Households master-detail tab.
 * Manages its own async state (list + detail) and keyboard input.
 */
function HouseholdsTab({ setInputCaptured = () => {} }) {
  const [listState, setListState] = useState({ items: [], loading: false, loaded: false, error: null });
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [detail, setDetail] = useState({ data: null, loading: false, error: null });
  const [confirmState, setConfirmState] = useState(null);
  const [cardView, setCardView]       = useState(false);
  const [cardContext, setCardContext] = useState(null); // { householdId, filterUserId, ownerEmail }

  // ── Load household list ──
  useEffect(() => {
    if (listState.loaded || listState.loading) return;
    setListState(s => ({ ...s, loading: true }));
    getDb()
      .collection("households")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get()
      .then(snap => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setListState({ items, loading: false, loaded: true, error: null });
      })
      .catch(err => {
        setListState({ items: [], loading: false, loaded: true, error: err.message });
      });
  }, [listState.loaded, listState.loading]);

  // ── Load detail when selectedIdx changes ──
  useEffect(() => {
    if (!listState.loaded || listState.items.length === 0) return;
    const hh = listState.items[selectedIdx];
    if (!hh) return;
    setDetail({ data: null, loading: true, error: null });
    const db = getDb();
    Promise.all([
      db.doc(`households/${hh.id}`).get(),
      db.collection(`households/${hh.id}/cards`).get(),
    ])
      .then(async ([hhSnap, cardsSnap]) => {
        if (!hhSnap.exists) throw new Error("Household not found");
        const hhData = { id: hhSnap.id, ...hhSnap.data() };
        const memberIds = hhData.memberIds || [];

        // Load member user docs in parallel
        const memberDocs = await Promise.all(
          memberIds.map(uid => db.doc(`users/${uid}`).get().catch(() => null))
        );
        const members = memberDocs
          .filter(Boolean)
          .map(snap => (snap.exists ? { id: snap.id, ...snap.data() } : null))
          .filter(Boolean);

        // Card counts by status (non-deleted)
        const cards = cardsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const live = cards.filter(c => !c.deletedAt);

        // Per-member card counts (if cards have userId field)
        const cardsByUser = {};
        for (const c of live) {
          if (c.userId) cardsByUser[c.userId] = (cardsByUser[c.userId] || 0) + 1;
        }
        const membersWithCards = members.map(m => ({
          ...m,
          cardCount: cardsByUser[m.id] != null ? cardsByUser[m.id] : null,
        }));

        setDetail({
          data: {
            hh: hhData,
            members: membersWithCards,
            cardCounts: {
              total: live.length,
              active: live.filter(c => c.status === "active").length,
              feeApproaching: live.filter(c => c.status === "fee_approaching").length,
              promo: live.filter(c => c.status === "promo_expiring").length,
              closed: live.filter(c => c.status === "closed").length,
            },
          },
          loading: false,
          error: null,
        });
      })
      .catch(err => {
        setDetail({ data: null, loading: false, error: err.message });
      });
  }, [selectedIdx, listState.loaded, listState.items]);

  // ── Keyboard input ──
  useInput(useCallback((input, key) => {
    // Confirmation flow: y confirms, n/Escape cancels
    if (confirmState) {
      if (input === "y" || input === "Y") {
        const fn = confirmState.onConfirm;
        setConfirmState(null);
        if (fn) fn();
      } else if (input === "n" || input === "N" || key.escape) {
        setConfirmState(null);
      }
      return;
    }

    // ^R — reload list
    if (key.ctrl && input === "r") {
      setListState({ items: [], loading: false, loaded: false, error: null });
      setDetail({ data: null, loading: false, error: null });
      return;
    }

    // List navigation
    if (key.upArrow) {
      setSelectedIdx(i => Math.max(0, i - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIdx(i => Math.min(listState.items.length - 1, i + 1));
      return;
    }

    // Action shortcuts — only when detail is loaded
    if (!detail.data) return;
    const hh = detail.data.hh;
    const members = detail.data.members;

    if (input === "i") {
      // Regen invite code
      setConfirmState({
        message: `Regen invite code for "${hh.name || "this household"}"?`,
        onConfirm: () => {
          const code = generateInviteCode();
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          getDb().doc(`households/${hh.id}`).update({
            inviteCode: code,
            inviteCodeExpiresAt: expiresAt,
            updatedAt: new Date().toISOString(),
          }).then(() => {
            // Reload detail
            setListState(s => ({ ...s, loaded: false }));
          }).catch(() => {});
        },
      });
      return;
    }

    if (input === "s" && hh.tier === "karl") {
      // Cancel Stripe subscription
      const subId = hh.stripeSubId;
      if (!subId) return;
      setConfirmState({
        message: `Cancel Stripe sub ${shortId(subId)} for "${hh.name}"?`,
        onConfirm: () => {
          stripe("DELETE", `/subscriptions/${subId}`).catch(() => {});
        },
      });
      return;
    }

    if (input === "x") {
      // Delete household
      setConfirmState({
        message: `DELETE household "${hh.name}" + all cards? PERMANENT.`,
        onConfirm: () => {
          const db = getDb();
          db.collection(`households/${hh.id}/cards`).get().then(snap => {
            const batch = db.batch();
            snap.docs.forEach(d => batch.delete(d.ref));
            batch.delete(db.doc(`households/${hh.id}`));
            return batch.commit();
          }).then(() => {
            setListState({ items: [], loading: false, loaded: false, error: null });
            setDetail({ data: null, loading: false, error: null });
            setSelectedIdx(0);
          }).catch(() => {});
        },
      });
      return;
    }

    if (input === "k") {
      // Kick member — member selection not yet in TUI; prompt REPL fallback
      const memberList = members
        .filter(m => m.id !== hh.ownerId)
        .map(m => m.email || shortId(m.id))
        .join(", ") || "(no non-owner members)";
      setConfirmState({
        message: `Kick member: ${memberList}. Use REPL delete-member for now.`,
        onConfirm: null,
      });
      return;
    }

    if (input === "o") {
      // Transfer owner — member selection not yet in TUI; prompt REPL fallback
      const memberList = members
        .filter(m => m.id !== hh.ownerId)
        .map(m => m.email || shortId(m.id))
        .join(", ") || "(no other members)";
      setConfirmState({
        message: `Transfer owner. Candidates: ${memberList}. Use REPL update-owner for now.`,
        onConfirm: null,
      });
      return;
    }

    if (input === "c") {
      setCardContext({ householdId: hh.id, filterUserId: null, ownerEmail: hh.name || shortId(hh.id) });
      setCardView(true);
      return;
    }
  }, [confirmState, listState.items, detail.data]));

  // ── Render ──

  // Card drill-down takes over when active
  if (cardView && cardContext) {
    return h(CardDrilldownView, {
      householdId: cardContext.householdId,
      filterUserId: cardContext.filterUserId,
      ownerEmail: cardContext.ownerEmail,
      onBack: () => setCardView(false),
      setInputCaptured,
    });
  }

  const { items, loading: listLoading, loaded, error: listError } = listState;

  // Scrollable window for the list
  const LIST_WINDOW = 20;
  const winStart = Math.max(0, Math.min(selectedIdx - Math.floor(LIST_WINDOW / 2), items.length - LIST_WINDOW));
  const visibleItems = items.slice(winStart, winStart + LIST_WINDOW);

  return h(Box, { flexDirection: "row", flexGrow: 1 },
    // ── Left panel: household list ──
    h(Box, {
      flexDirection: "column",
      width: 34,
      borderStyle: "single",
      borderColor: "gray",
      flexShrink: 0,
      paddingX: 1,
      paddingY: 1,
    },
      h(Text, { bold: true, color: "yellow" }, "Households"),
      loaded && !listError
        ? h(Text, { color: "gray", dimColor: true }, `${items.length} total`)
        : null,
      h(Box, { flexDirection: "column", marginTop: 1 },
        listLoading
          ? h(Text, { color: "gray", dimColor: true }, "Loading…")
          : listError
          ? h(Text, { color: "red" }, `Error: ${listError}`)
          : items.length === 0
          ? h(Text, { color: "gray", dimColor: true }, "No households found")
          : visibleItems.map((hh, vi) => {
              const idx = winStart + vi;
              const isSel = idx === selectedIdx;
              const memberCount = (hh.memberIds || []).length;
              const tierColor = hh.tier === "karl" ? "yellow" : hh.tier === "trial" ? "cyan" : "gray";
              return h(Box, {
                key: hh.id,
                flexDirection: "column",
                backgroundColor: isSel ? "gray" : undefined,
                paddingX: isSel ? 1 : 0,
                marginBottom: 0,
              },
                h(Box, { flexDirection: "row" },
                  h(Text, {
                    color: isSel ? "black" : "white",
                    bold: isSel,
                  }, (hh.name || "unnamed").substring(0, 19)),
                  h(Box, { flexGrow: 1 }),
                  h(Text, { color: isSel ? "black" : tierColor, bold: true },
                    hh.tier === "karl" ? "K" : hh.tier === "trial" ? "T" : "F"
                  )
                ),
                h(Text, {
                  color: isSel ? "black" : "gray",
                  dimColor: !isSel,
                }, `${memberCount} member${memberCount !== 1 ? "s" : ""}`)
              );
            })
      )
    ),

    // ── Right panel: detail ──
    h(Box, {
      flexDirection: "column",
      flexGrow: 1,
      borderStyle: "single",
      borderColor: "gray",
      paddingX: 2,
      paddingY: 1,
      overflow: "hidden",
    },
      detail.loading
        ? h(Box, { flexGrow: 1, justifyContent: "center", alignItems: "center" },
            h(Text, { color: "gray", dimColor: true }, "Loading household…")
          )
        : detail.error
        ? h(Box, { flexGrow: 1, justifyContent: "center", alignItems: "center" },
            h(Text, { color: "red" }, `Error: ${detail.error}`)
          )
        : !detail.data
        ? h(Box, { flexGrow: 1, justifyContent: "center", alignItems: "center", flexDirection: "column" },
            h(Text, { color: "gray", dimColor: true }, "Select a household ↑↓"),
            h(Text, { color: "gray", dimColor: true }, "Enter to drill down")
          )
        : h(HouseholdDetailView, { detail: detail.data, confirmState })
    )
  );
}

// ── Card drill-down helpers ───────────────────────────────────────────────────

/** Status dot + color for each card status value. */
const CARD_STATUS_DOT = {
  active:          { dot: "●", color: "green"  },
  fee_approaching: { dot: "◐", color: "yellow" },
  promo_expiring:  { dot: "◐", color: "yellow" },
  closed:          { dot: "○", color: "gray"   },
};

/** Norse realm name mapped from card status. */
const CARD_STATUS_REALM = {
  active:          "Midgard",
  fee_approaching: "Muspelheim",
  promo_expiring:  "Niflheim",
  closed:          "Helheim",
};

/** Fetch all cards for a household (including soft-deleted). */
async function loadCardsForHousehold(householdId) {
  const snap = await getDb().collection(`households/${householdId}/cards`).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** ASCII spend-progress bar. */
function SpendProgressBar({ spend, goal }) {
  const raw = goal > 0 ? Math.min(1, (spend || 0) / goal) : 0;
  const BAR_WIDTH = 28;
  const filled = Math.round(raw * BAR_WIDTH);
  const bar = "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
  const color = raw >= 1 ? "green" : raw >= 0.5 ? "yellow" : "white";
  return h(Box, { flexDirection: "column", paddingLeft: 2 },
    h(Box, { flexDirection: "row" },
      h(Text, { color }, bar),
      h(Text, { color: "gray" }, `  ${Math.round(raw * 100)}%`)
    ),
    h(Text, { color: "gray", dimColor: true },
      `$${(spend || 0).toLocaleString()} / $${(goal || 0).toLocaleString()}`
    )
  );
}

/** A single row in the card list left-panel. */
function CardListRow({ card, selected }) {
  const s = CARD_STATUS_DOT[card.status] || { dot: "○", color: "gray" };
  const isDeleted = !!card.deletedAt;
  return h(Box, {
    flexDirection: "row",
    paddingX: 1,
    backgroundColor: selected ? "gray" : undefined,
  },
    h(Text, { color: selected ? "black" : s.color }, `${s.dot} `),
    h(Text, {
      color: selected ? "black" : isDeleted ? "gray" : "white",
      dimColor: isDeleted && !selected,
    }, (card.name || "Unknown").substring(0, 22).padEnd(22)),
    ...(isDeleted ? [
      h(Text, { color: selected ? "black" : "gray", dimColor: !selected }, " DEL"),
    ] : [])
  );
}

/** Card detail right-panel. Shows all card fields and action shortcuts. */
function CardDetailPanel({ card, householdId, ownerEmail, onBack, onCardUpdated, setInputCaptured }) {
  const [mode, setMode]                 = useState("browse");
  const [expungeInput, setExpungeInput] = useState("");
  const [statusMsg, setStatusMsg]       = useState("");

  React.useEffect(() => {
    if (!statusMsg) return;
    const tid = setTimeout(() => setStatusMsg(""), 3000);
    return () => clearTimeout(tid);
  }, [statusMsg]);

  useInput((input, key) => {
    // ── Type 'delete' to confirm expunge ──
    if (mode === "expunge-input") {
      if (key.return) {
        if (expungeInput === "delete") {
          doExpunge();
        } else {
          setStatusMsg("Aborted: must type exactly 'delete'");
        }
        setExpungeInput("");
        setMode("browse");
        setInputCaptured?.(false);
      } else if (key.escape) {
        setExpungeInput("");
        setMode("browse");
        setInputCaptured?.(false);
        setStatusMsg("Expunge cancelled");
      } else if (key.backspace || key.delete) {
        setExpungeInput((t) => t.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta && input.length === 1) {
        setExpungeInput((t) => t + input);
      }
      return;
    }
    // ── y/n confirmation modes ──
    if (mode === "confirm-delete") {
      if (input === "y" || input === "Y") doDelete();
      else setStatusMsg("Delete cancelled");
      setMode("browse");
      return;
    }
    if (mode === "confirm-restore") {
      if (input === "y" || input === "Y") doRestore();
      else setStatusMsg("Restore cancelled");
      setMode("browse");
      return;
    }
    if (mode === "confirm-expunge") {
      if (input === "y" || input === "Y") {
        setMode("expunge-input");
        setInputCaptured?.(true);
      } else {
        setStatusMsg("Expunge cancelled");
        setMode("browse");
      }
      return;
    }
    // ── Browse mode ──
    if (key.escape) { onBack(); return; }
    if (input === "d" && !card.deletedAt) { setMode("confirm-delete"); return; }
    if (input === "r" && card.deletedAt)  { setMode("confirm-restore"); return; }
    if (input === "x")                    { setMode("confirm-expunge"); return; }
  });

  function doDelete() {
    (async () => {
      try {
        await getDb().doc(`households/${householdId}/cards/${card.id}`).update({
          deletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        setStatusMsg(`Deleted: ${card.name}`);
        onCardUpdated();
      } catch (err) { setStatusMsg(`Error: ${err.message}`); }
    })();
  }

  function doRestore() {
    (async () => {
      try {
        await getDb().doc(`households/${householdId}/cards/${card.id}`).update({
          deletedAt: FieldValue.delete(),
          status: "active",
          updatedAt: new Date().toISOString(),
        });
        setStatusMsg(`Restored: ${card.name}`);
        onCardUpdated();
      } catch (err) { setStatusMsg(`Error: ${err.message}`); }
    })();
  }

  function doExpunge() {
    (async () => {
      try {
        await getDb().doc(`households/${householdId}/cards/${card.id}`).delete();
        setStatusMsg(`Expunged: ${card.name}`);
        onCardUpdated();
      } catch (err) { setStatusMsg(`Error: ${err.message}`); }
    })();
  }

  const status    = card.status || "active";
  const statusDot = CARD_STATUS_DOT[status] || { dot: "○", color: "gray" };
  const realm     = CARD_STATUS_REALM[status] || "Unknown";
  const isDeleted = !!card.deletedAt;
  const spend     = card.spend ?? card.spendAmount ?? 0;
  const spendGoal = card.spendGoal ?? card.bonusSpendGoal ?? 0;

  // ── Action bar ──
  let actionArea;
  if (mode === "confirm-delete") {
    actionArea = h(Box, { borderStyle: "single", borderColor: "red", paddingX: 1, marginTop: 1, flexDirection: "row" },
      h(Text, { color: "red" }, `Delete "${card.name}"? `),
      h(Text, { color: "yellow", bold: true }, "[y] Confirm  "),
      h(Text, { color: "gray" }, "[any] Cancel")
    );
  } else if (mode === "confirm-restore") {
    actionArea = h(Box, { borderStyle: "single", borderColor: "yellow", paddingX: 1, marginTop: 1, flexDirection: "row" },
      h(Text, { color: "yellow" }, `Restore "${card.name}" to active? `),
      h(Text, { color: "yellow", bold: true }, "[y] Confirm  "),
      h(Text, { color: "gray" }, "[any] Cancel")
    );
  } else if (mode === "confirm-expunge") {
    actionArea = h(Box, { borderStyle: "single", borderColor: "red", paddingX: 1, marginTop: 1, flexDirection: "row" },
      h(Text, { color: "red", bold: true }, "EXPUNGE permanently? "),
      h(Text, { color: "yellow" }, "[y] Type confirm  "),
      h(Text, { color: "gray" }, "[any] Cancel")
    );
  } else if (mode === "expunge-input") {
    actionArea = h(Box, { borderStyle: "single", borderColor: "red", paddingX: 1, marginTop: 1, flexDirection: "row" },
      h(Text, { color: "red" }, "Type 'delete' to confirm expunge: "),
      h(Text, { color: "white", bold: true }, expungeInput),
      h(Text, { color: "gray" }, "█  [Enter] Confirm  [Esc] Cancel")
    );
  } else {
    actionArea = h(Box, {
      flexDirection: "row", flexWrap: "wrap",
      borderStyle: "single", borderColor: "gray",
      paddingX: 1, marginTop: 1,
    },
      ...(!isDeleted ? [h(Text, { color: "red" }, "[d] Delete  ")] : []),
      ...(isDeleted  ? [h(Text, { color: "yellow" }, "[r] Restore  ")] : []),
      h(Text, { color: "red" }, "[x] Expunge  "),
      h(Text, { color: "gray" }, "[Esc] Back")
    );
  }

  return h(Box, { flexDirection: "column", flexGrow: 1, paddingX: 2, paddingY: 1 },
    // ── Breadcrumb ──
    h(Box, { flexDirection: "row", marginBottom: 1 },
      h(Text, { color: "gray", dimColor: true }, "← "),
      h(Text, { color: "cyan" }, ownerEmail || "User"),
      h(Text, { color: "gray", dimColor: true }, " / Cards / "),
      h(Text, { color: "yellow" }, card.name || "Card")
    ),
    // ── Header ──
    h(Box, { flexDirection: "row", alignItems: "center", gap: 2, marginBottom: 1,
             borderStyle: "single", borderColor: "gray", paddingX: 1 },
      h(Text, { bold: true, color: "yellow" }, card.name || "Unknown Card"),
      h(Text, { color: statusDot.color }, `  ${statusDot.dot}`),
      ...(isDeleted ? [h(Text, { color: "red" }, " [DELETED]")] : [])
    ),
    // ── Card Info ──
    h(SectionHeader, { title: "Card Info" }),
    h(DetailField, { label: "Issuer" },
      h(Text, {}, card.issuer || "—")
    ),
    h(DetailField, { label: "Credit Limit" },
      h(Text, { color: "cyan" }, card.creditLimit ? `$${Number(card.creditLimit).toLocaleString()}` : "—")
    ),
    h(DetailField, { label: "Annual Fee" },
      h(Text, {}, card.annualFee ? `$${card.annualFee}` : "None")
    ),
    h(DetailField, { label: "Fee Due" },
      h(Text, { color: card.feeDue ? "yellow" : "gray" }, fmtDateShort(card.feeDue))
    ),
    h(DetailField, { label: "Opened" },
      h(Text, {}, fmtDateShort(card.openedDate ?? card.opened))
    ),
    h(DetailField, { label: "Status" },
      h(Box, { flexDirection: "row" },
        h(Text, { color: statusDot.color }, `${statusDot.dot} `),
        h(Text, {}, status.replace(/_/g, " ")),
        h(Text, { color: "yellow" }, `  — ${realm}`)
      )
    ),
    // ── Bonus ──
    h(SectionHeader, { title: "Bonus" }),
    h(DetailField, { label: "Status" },
      card.bonusMet !== undefined
        ? h(Text, { color: card.bonusMet ? "green" : "yellow" }, card.bonusMet ? "✓ Met" : "◎ In Progress")
        : h(Text, { color: "gray", dimColor: true }, "—")
    ),
    ...(card.bonusAmount ? [
      h(DetailField, { label: "Bonus Amount" },
        h(Text, { color: "yellow" }, `$${Number(card.bonusAmount).toLocaleString()}`)
      ),
    ] : []),
    ...(card.bonusDeadline ? [
      h(DetailField, { label: "Deadline" },
        h(Text, { color: "yellow" }, fmtDateShort(card.bonusDeadline))
      ),
    ] : []),
    // ── Spend Progress ──
    ...(spendGoal > 0 ? [
      h(SectionHeader, { title: "Spend Progress" }),
      h(SpendProgressBar, { spend, goal: spendGoal }),
    ] : []),
    // ── Notes ──
    ...(card.notes ? [
      h(SectionHeader, { title: "Notes" }),
      h(Box, { paddingX: 2 },
        h(Text, { color: "gray" }, card.notes)
      ),
    ] : []),
    // ── Owner ──
    h(SectionHeader, { title: "Owner" }),
    h(DetailField, { label: "User" },
      h(Text, { color: "cyan" }, ownerEmail || "—")
    ),
    h(DetailField, { label: "Card ID" },
      h(Text, { color: "gray", dimColor: true }, card.id)
    ),
    // ── Actions ──
    actionArea,
    // ── Status message ──
    ...(statusMsg ? [
      h(Box, { marginTop: 1 },
        h(Text, { color: statusMsg.startsWith("Error") ? "red" : "green" }, statusMsg)
      ),
    ] : [])
  );
}

/**
 * Full card drill-down view: left=scrollable card list, right=card detail.
 * Manages its own async state and keyboard navigation.
 *
 * @param {Object}   props
 * @param {string}   props.householdId
 * @param {string|null} props.filterUserId  null = show all household cards
 * @param {string}   props.ownerEmail       shown in breadcrumbs
 * @param {Function} props.onBack           called on Esc from list view
 * @param {Function} [props.setInputCaptured]
 */
function CardDrilldownView({ householdId, filterUserId, ownerEmail, onBack, setInputCaptured }) {
  const LIST_HEIGHT = 18;

  const [cards, setCards]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState(null);
  const [selectedIdx, setSelectedIdx]   = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [detailOpen, setDetailOpen]     = useState(false);

  function sortCards(arr) {
    const ORDER = { active: 0, fee_approaching: 1, promo_expiring: 2, closed: 3 };
    return [...arr].sort((a, b) => {
      const ao = a.deletedAt ? 99 : (ORDER[a.status] ?? 4);
      const bo = b.deletedAt ? 99 : (ORDER[b.status] ?? 4);
      return ao !== bo ? ao - bo : (a.name || "").localeCompare(b.name || "");
    });
  }

  function fetchCards() {
    setLoading(true);
    loadCardsForHousehold(householdId)
      .then((all) => {
        const filtered = filterUserId ? all.filter((c) => c.userId === filterUserId) : all;
        setCards(sortCards(filtered));
      })
      .catch((err) => setLoadError(err.message || String(err)))
      .finally(() => setLoading(false));
  }

  useEffect(fetchCards, []); // eslint-disable-line react-hooks/exhaustive-deps

  // List navigation — inactive when detail panel is open (detail handles own input)
  useInput((input, key) => {
    if (key.escape) { onBack(); return; }
    if (key.upArrow) {
      const ni = Math.max(0, selectedIdx - 1);
      setSelectedIdx(ni);
      if (ni < scrollOffset) setScrollOffset(ni);
      return;
    }
    if (key.downArrow) {
      const ni = Math.min(cards.length - 1, selectedIdx + 1);
      setSelectedIdx(ni);
      if (ni >= scrollOffset + LIST_HEIGHT) setScrollOffset(ni - LIST_HEIGHT + 1);
      return;
    }
    if (key.return && cards[selectedIdx]) {
      setDetailOpen(true);
      return;
    }
  }, { isActive: !detailOpen });

  const visibleCards  = cards.slice(scrollOffset, scrollOffset + LIST_HEIGHT);
  const canScrollUp   = scrollOffset > 0;
  const canScrollDown = scrollOffset + LIST_HEIGHT < cards.length;
  const selectedCard  = cards[selectedIdx] ?? null;

  // ── Left panel (shared between list + detail modes) ──
  const leftPanel = h(Box, {
    flexDirection: "column",
    width: 32,
    borderStyle: "single",
    borderColor: detailOpen ? "gray" : "yellow",
    flexShrink: 0,
  },
    h(Box, { paddingX: 1, borderStyle: "single", borderColor: "gray" },
      h(Text, { bold: true, color: "yellow" },
        loading ? "Cards (loading…)" :
        loadError ? "Cards (error)" :
        `Cards (${cards.length})`
      )
    ),
    canScrollUp && h(Text, { color: "gray", dimColor: true, paddingX: 2 }, "↑ more"),
    loading
      ? h(Text, { color: "gray", dimColor: true, paddingX: 2 }, "Loading…")
      : loadError
        ? h(Text, { color: "red", paddingX: 2 }, `Error: ${loadError}`)
        : cards.length === 0
          ? h(Text, { color: "gray", dimColor: true, paddingX: 2 }, "No cards found")
          : visibleCards.map((c, i) =>
              h(CardListRow, {
                key: c.id,
                card: c,
                selected: scrollOffset + i === selectedIdx,
              })
            ),
    canScrollDown && h(Text, { color: "gray", dimColor: true, paddingX: 2 }, "↓ more"),
    h(Box, { flexGrow: 1 }),
    h(Text, { color: "gray", dimColor: true, paddingX: 1 },
      detailOpen ? "Esc back to list" : "↑/↓ Enter  Esc back"
    )
  );

  // ── Detail mode: left list + right detail panel ──
  if (detailOpen && selectedCard) {
    return h(Box, { flexDirection: "row", flexGrow: 1 },
      leftPanel,
      h(CardDetailPanel, {
        card: selectedCard,
        householdId,
        ownerEmail,
        onBack: () => setDetailOpen(false),
        onCardUpdated: () => { fetchCards(); setDetailOpen(false); },
        setInputCaptured,
      })
    );
  }

  // ── List mode: left list + right preview ──
  return h(Box, { flexDirection: "row", flexGrow: 1 },
    leftPanel,
    selectedCard
      ? h(Box, {
          flexDirection: "column",
          flexGrow: 1,
          paddingX: 2,
          paddingY: 1,
          borderStyle: "single",
          borderColor: "gray",
        },
          // breadcrumb
          h(Box, { flexDirection: "row", marginBottom: 1 },
            h(Text, { color: "gray", dimColor: true }, "← "),
            h(Text, { color: "cyan" }, ownerEmail || "User"),
            h(Text, { color: "gray", dimColor: true }, " / Cards")
          ),
          // card header
          h(Box, { flexDirection: "row", alignItems: "center", marginBottom: 1,
                   borderStyle: "single", borderColor: "gray", paddingX: 1 },
            h(Text, { bold: true, color: "yellow" }, selectedCard.name || "Unknown Card"),
            h(Text, { color: (CARD_STATUS_DOT[selectedCard.status] || { color: "gray" }).color },
              `  ${(CARD_STATUS_DOT[selectedCard.status] || { dot: "○" }).dot}  `),
            h(Text, { color: "gray" }, (selectedCard.status || "active").replace(/_/g, " "))
          ),
          h(DetailField, { label: "Issuer" },
            h(Text, {}, selectedCard.issuer || "—")
          ),
          h(DetailField, { label: "Credit Limit" },
            h(Text, { color: "cyan" }, selectedCard.creditLimit
              ? `$${Number(selectedCard.creditLimit).toLocaleString()}` : "—")
          ),
          h(DetailField, { label: "Annual Fee" },
            h(Text, {}, selectedCard.annualFee ? `$${selectedCard.annualFee}` : "None")
          ),
          h(DetailField, { label: "Opened" },
            h(Text, {}, fmtDateShort(selectedCard.openedDate ?? selectedCard.opened))
          ),
          h(Box, { marginTop: 1 },
            h(Text, { color: "gray", dimColor: true }, "Enter to view full detail")
          )
        )
      : h(Box, {
          flexGrow: 1,
          borderStyle: "single",
          borderColor: "gray",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
        },
          h(Text, { color: "yellow", dimColor: true }, "ᚱ"),
          h(Text, { color: "gray" }, "Select a card"),
          h(Text, { color: "gray", dimColor: true }, "↑/↓ navigate   Enter drill down")
        )
  );
}

// h — shorthand for React.createElement (no JSX needed in an .mjs script)
const h = React.createElement;

/** Top bar: branding, tab buttons, shortcut hints. */
function TopBar({ activeTab, onTabChange }) {
  return h(Box, { flexDirection: "row", alignItems: "center", paddingX: 1, borderStyle: "single", borderColor: "yellow" },
    h(Text, { color: "yellow", bold: true }, "ODIN'S SPEAR ⚡  "),
    ...TUI_TABS.map((tab, i) =>
      h(Text, {
        key: tab,
        backgroundColor: activeTab === i ? "yellow" : undefined,
        color: activeTab === i ? "black" : "gray",
        bold: activeTab === i,
      }, ` [${tab}] `)
    ),
    h(Box, { flexGrow: 1 }),
    h(Text, { dimColor: true, color: "gray" }, "  [/] Command  [^R] Reload  [?] Help")
  );
}

/** Status bar: connection indicators + item count. */
function StatusBar({ connections, counts }) {
  return h(Box, { flexDirection: "row", alignItems: "center", paddingX: 1, borderStyle: "single", borderColor: "gray" },
    h(Text, { color: "gray" }, "Redis "),
    h(Text, { color: connections.redis ? "green" : "red" }, "●"),
    h(Text, { color: "gray" }, "  Firestore "),
    h(Text, { color: connections.firestore ? "green" : "red" }, "●"),
    h(Text, { color: "gray" }, "  Stripe "),
    h(Text, { color: connections.stripe ? "green" : "red" }, "●"),
    h(Box, { flexGrow: 1 }),
    h(Text, { color: "gray" }, `${counts.users} users  ${counts.households} households`)
  );
}

/** Help overlay shown on `?`. */
function HelpOverlay() {
  const row = (key, desc) =>
    h(Box, { key, flexDirection: "row", gap: 2 },
      h(Text, { color: "cyan", bold: true }, key.padEnd(6)),
      h(Text, { color: "gray" }, desc)
    );
  return h(Box, {
    flexDirection: "column",
    borderStyle: "round",
    borderColor: "yellow",
    paddingX: 2,
    paddingY: 1,
  },
    h(Text, { bold: true, color: "yellow" }, "Keyboard Shortcuts"),
    h(Text, {}, " "),
    row("Tab", "Switch tabs"),
    row("q", "Quit"),
    row("?", "Toggle help"),
    row("^R", "Reload current view"),
    h(Text, {}, " "),
    h(Text, { color: "gray", dimColor: true }, "Press any key to close")
  );
}

/** Main content area: routes to the correct tab component. */
function MainContent({ activeTab, onJumpToHousehold, setInputCaptured }) {
  if (activeTab === 0) {
    return h(UsersTab, {
      isActive: true,
      onJumpToHousehold,
      setInputCaptured,
    });
  }
  if (activeTab === 1) {
    return h(HouseholdsTab, { setInputCaptured });
  }
  // Other tabs: placeholder
  const tabLabel = TUI_TABS[activeTab];
  return h(Box, { flexDirection: "row", flexGrow: 1 },
    h(Box, {
      flexDirection: "column",
      width: 32,
      borderStyle: "single",
      borderColor: "gray",
      flexShrink: 0,
      paddingX: 1,
      paddingY: 1,
    },
      h(Text, { bold: true, color: "yellow" }, tabLabel),
      h(Text, { color: "gray", dimColor: true }, "(coming soon — issue #1388)")
    ),
    h(Box, {
      flexDirection: "column",
      flexGrow: 1,
      borderStyle: "single",
      borderColor: "gray",
      paddingX: 2,
      paddingY: 1,
    },
      h(Text, { color: "gray", dimColor: true }, `${tabLabel} tab — select an item from the list`)
    )
  );
}

/** Root TUI application. */
function SpearApp({ connectionStatus, counts }) {
  const { exit } = useApp();
  const [activeTab, setActiveTab]         = useState(0);
  const [showHelp, setShowHelp]           = useState(false);
  const [inputCaptured, setInputCaptured] = useState(false); // true when a tab holds input (e.g. text prompt)

  /** Switch to Households tab — called by UsersTab when user presses [h]. */
  function onJumpToHousehold(_householdId) {
    setActiveTab(1);
  }

  useInput((input, key) => {
    // Let the active tab consume input when it has captured focus (e.g. tier prompt)
    if (inputCaptured) return;

    // q — quit
    if (input === "q") {
      redis.quit().catch(() => {}).finally(() => {
        cleanupPortForward();
        exit();
      });
      return;
    }
    // ? — toggle help
    if (input === "?") {
      setShowHelp((v) => !v);
      return;
    }
    // Tab — switch tabs
    if (key.tab) {
      setActiveTab((t) => (t + 1) % TUI_TABS.length);
      return;
    }
    // ^R — reload (placeholder)
    if (key.ctrl && input === "r") {
      return;
    }
    // Any key closes help overlay
    if (showHelp) {
      setShowHelp(false);
    }
  });

  return h(Box, { flexDirection: "column", height: "100%" },
    h(TopBar, { activeTab, onTabChange: setActiveTab }),
    showHelp
      ? h(HelpOverlay, null)
      : h(MainContent, { activeTab, onJumpToHousehold, setInputCaptured }),
    h(StatusBar, { connections: connectionStatus, counts })
  );
}

// ── Start TUI ────────────────────────────────────────────────────────────────

const connectionStatus = {
  redis: true,      // reached this point means Redis connected
  firestore: true,  // ensureAuthenticated succeeded
  stripe: await getStripeKey().then(Boolean).catch(() => false),
};

const { waitUntilExit } = render(h(SpearApp, { connectionStatus, counts: initialCounts }));
await waitUntilExit();
cleanupPortForward();
await redis.quit().catch(() => {});
process.exit(0);
