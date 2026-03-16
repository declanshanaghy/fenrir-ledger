#!/usr/bin/env node
// --------------------------------------------------------------------------
// sync-secrets.mjs — Audit, validate, and sync secrets for Fenrir Ledger
//
// Reads secrets from TWO local sources:
//   .secrets          — agent/infra secrets (Claude OAuth, GitHub PATs, GCP)
//   .env.local        — app secrets (Stripe, Google, Anthropic)
//
// Syncs to THREE destinations:
//   GitHub Actions     — deploy workflow uses these
//   K8s agent-secrets  — fenrir-agents namespace (agent sandbox)
//   K8s app-secrets    — fenrir-app namespace (production app)
//
// Usage:
//   node scripts/sync-secrets.mjs              # Audit all
//   node scripts/sync-secrets.mjs --sync       # Sync missing → correct destination
//   node scripts/sync-secrets.mjs --fix-all    # Re-sync ALL secrets (clean values)
//   node scripts/sync-secrets.mjs --verify     # Compare K8s values against local
//   node scripts/sync-secrets.mjs --push KEY   # Force-push one secret to all destinations + restart
//   node scripts/sync-secrets.mjs --restart    # Restart fenrir-app deployment (pick up secret changes)
// --------------------------------------------------------------------------

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const C = {
  r: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m", cyan: "\x1b[36m",
};

const REPO = "declanshanaghy/fenrir-ledger";
const REPO_ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const ENV_FILE = join(REPO_ROOT, "development", "frontend", ".env.local");
const SECRETS_FILE = join(REPO_ROOT, ".secrets");
const K8S_AGENTS_NS = "fenrir-agents";
const K8S_APP_NS = "fenrir-app";

// --------------------------------------------------------------------------
// Secret definitions — each secret has exactly ONE destination
// envVar = key name in .env.local, secretsVar = key name in .secrets
// --------------------------------------------------------------------------
const SECRETS = [
  // --- GitHub only: GCP infrastructure (deploy workflow) ---
  { name: "GCP_PROJECT_ID",       dest: "github", group: "GCP Infra" },
  { name: "GCP_SA_KEY",           dest: "github", group: "GCP Infra" },
  { name: "GCP_REGION",           dest: "github", group: "GCP Infra" },
  { name: "GCP_ZONE",             dest: "github", group: "GCP Infra" },
  { name: "GKE_CLUSTER_NAME",     dest: "github", group: "GCP Infra" },
  { name: "TF_VAR_BILLING_ACCOUNT_ID", dest: "github", group: "Terraform" },
  { name: "TF_VAR_UPTIME_CHECK_HOST",  dest: "github", group: "Terraform" },

  // --- GitHub only: Docker build-args (baked at build time) ---
  { name: "NEXT_PUBLIC_GOOGLE_CLIENT_ID", dest: "github", group: "Build Args", envVar: "NEXT_PUBLIC_GOOGLE_CLIENT_ID" },

  // --- GitHub → K8s app secrets (deploy workflow creates fenrir-app-secrets) ---
  { name: "GOOGLE_CLIENT_SECRET",            dest: "github", group: "App Secrets", envVar: "GOOGLE_CLIENT_SECRET" },
  { name: "GOOGLE_PICKER_API_KEY",           dest: "github", group: "App Secrets", envVar: "GOOGLE_PICKER_API_KEY" },
  { name: "FENRIR_ANTHROPIC_API_KEY",        dest: "github", group: "App Secrets", envVar: "FENRIR_ANTHROPIC_API_KEY" },
  { name: "ENTITLEMENT_ENCRYPTION_KEY",      dest: "github", group: "App Secrets", envVar: "ENTITLEMENT_ENCRYPTION_KEY" },
  { name: "STRIPE_SECRET_KEY",              dest: "github", group: "App Secrets", envVar: "STRIPE_SECRET_KEY" },
  { name: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", dest: "github", group: "App Secrets", envVar: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" },
  { name: "STRIPE_WEBHOOK_SECRET",          dest: "github", group: "App Secrets", envVar: "STRIPE_WEBHOOK_SECRET" },
  { name: "STRIPE_PRICE_ID",               dest: "github", group: "App Secrets", envVar: "STRIPE_PRICE_ID" },

  // --- GitHub → K8s agent secrets (deploy workflow creates agent-secrets) ---
  { name: "CLAUDE_CODE_OAUTH_TOKEN", dest: "github", group: "Agent Sandbox", secretsVar: "CLAUDE_CODE_OAUTH_TOKEN" },
  { name: "GH_TOKEN_AGENTS",         dest: "github", group: "Agent Sandbox", secretsVar: "GITHUB_TOKEN_PAT_FINE_GRAINED" },

  // --- K8s agent-secrets (fenrir-agents namespace) ---
  { name: "anthropic-api-key",   dest: "k8s-agents", group: "K8s Agent Secrets", envVar: "FENRIR_ANTHROPIC_API_KEY", k8sSecret: "agent-secrets" },
  { name: "gh-token",            dest: "k8s-agents", group: "K8s Agent Secrets", secretsVar: "GITHUB_TOKEN_PAT_FINE_GRAINED",  k8sSecret: "agent-secrets" },
  { name: "claude-oauth-token",  dest: "k8s-agents", group: "K8s Agent Secrets", secretsVar: "CLAUDE_CODE_OAUTH_TOKEN",  k8sSecret: "agent-secrets" },

  // --- K8s fenrir-app-secrets (fenrir-app namespace) ---
  { name: "FENRIR_ANTHROPIC_API_KEY",  dest: "k8s-app", group: "K8s App Secrets", envVar: "FENRIR_ANTHROPIC_API_KEY", k8sSecret: "fenrir-app-secrets" },
  { name: "GOOGLE_CLIENT_SECRET",      dest: "k8s-app", group: "K8s App Secrets", envVar: "GOOGLE_CLIENT_SECRET", k8sSecret: "fenrir-app-secrets" },
  { name: "GOOGLE_PICKER_API_KEY",     dest: "k8s-app", group: "K8s App Secrets", envVar: "GOOGLE_PICKER_API_KEY", k8sSecret: "fenrir-app-secrets" },
  { name: "ENTITLEMENT_ENCRYPTION_KEY", dest: "k8s-app", group: "K8s App Secrets", envVar: "ENTITLEMENT_ENCRYPTION_KEY", k8sSecret: "fenrir-app-secrets" },
  { name: "STRIPE_SECRET_KEY",         dest: "k8s-app", group: "K8s App Secrets", envVar: "STRIPE_SECRET_KEY", k8sSecret: "fenrir-app-secrets" },
  { name: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", dest: "k8s-app", group: "K8s App Secrets", envVar: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", k8sSecret: "fenrir-app-secrets" },
  { name: "STRIPE_WEBHOOK_SECRET",     dest: "k8s-app", group: "K8s App Secrets", envVar: "STRIPE_WEBHOOK_SECRET", k8sSecret: "fenrir-app-secrets" },
  { name: "STRIPE_PRICE_ID",           dest: "k8s-app", group: "K8s App Secrets", envVar: "STRIPE_PRICE_ID", k8sSecret: "fenrir-app-secrets" },
];

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------
function sh(cmd) {
  try { return execSync(cmd, { encoding: "utf8", timeout: 10_000 }).trim(); }
  catch { return ""; }
}

function parseKeyValueFile(filePath) {
  if (!existsSync(filePath)) return {};
  const vars = {};
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq);
    let val = line.slice(eq + 1);
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

function mask(val) {
  if (!val || val.length < 8) return "****";
  return val.slice(0, 4) + "*".repeat(Math.min(val.length - 8, 20)) + val.slice(-4);
}

function resolveLocalValue(s, envVars, secretsVars) {
  if (s.envVar && envVars[s.envVar]) return envVars[s.envVar];
  if (s.secretsVar && secretsVars[s.secretsVar]) return secretsVars[s.secretsVar];
  return null;
}

function getK8sSecretData(secretName, namespace) {
  const json = sh(`kubectl get secret ${secretName} -n ${namespace} -o json`);
  if (!json) return {};
  try {
    const data = JSON.parse(json).data || {};
    const result = {};
    for (const [k, v] of Object.entries(data)) {
      result[k] = Buffer.from(v, "base64").toString();
    }
    return result;
  } catch { return {}; }
}

// --------------------------------------------------------------------------
// Audit
// --------------------------------------------------------------------------
function audit(envVars, secretsVars) {
  const ghSecrets = new Set(sh(`gh secret list --repo ${REPO}`).split("\n").map(l => l.split("\t")[0]).filter(Boolean));
  const k8sAgentKeys = getK8sSecretData("agent-secrets", K8S_AGENTS_NS);
  const k8sAppKeys = getK8sSecretData("fenrir-app-secrets", K8S_APP_NS);

  const groups = {};
  for (const s of SECRETS) {
    (groups[s.group] = groups[s.group] || []).push(s);
  }

  const syncable = [];
  let totalMissing = 0, totalPresent = 0, totalMismatch = 0;

  for (const [group, secrets] of Object.entries(groups)) {
    console.log(`\n${C.bold}${group}${C.r} ${C.dim}(→ ${secrets[0].dest})${C.r}`);

    for (const s of secrets) {
      let present = false;
      let remoteValue = null;

      if (s.dest === "github") {
        present = ghSecrets.has(s.name);
      } else if (s.dest === "k8s-agents") {
        remoteValue = k8sAgentKeys[s.name] || null;
        present = !!remoteValue;
      } else if (s.dest === "k8s-app") {
        remoteValue = k8sAppKeys[s.name] || null;
        present = !!remoteValue;
      }

      const localVal = resolveLocalValue(s, envVars, secretsVars);
      let mismatch = false;
      if (present && remoteValue && localVal && remoteValue !== localVal) {
        mismatch = true;
        totalMismatch++;
      }

      if (present && !mismatch) {
        const extra = remoteValue ? ` ${C.dim}(${mask(remoteValue)})${C.r}` : "";
        console.log(`  ${C.green}✓${C.r} ${s.name}${extra}`);
        totalPresent++;
      } else if (present && mismatch) {
        console.log(`  ${C.yellow}⚠${C.r} ${s.name} ${C.red}MISMATCH${C.r} ${C.dim}(remote: ${remoteValue.length}b, local: ${localVal.length}b)${C.r}`);
        syncable.push(s);
        totalPresent++;
      } else {
        if (localVal) {
          const source = s.envVar && envVars[s.envVar] ? ".env.local" : ".secrets";
          console.log(`  ${C.yellow}○${C.r} ${s.name} ${C.dim}(missing — syncable from ${source})${C.r}`);
          syncable.push(s);
        } else if (s.envVar || s.secretsVar) {
          const files = [s.envVar && ".env.local", s.secretsVar && ".secrets"].filter(Boolean).join(" / ");
          console.log(`  ${C.red}✗${C.r} ${s.name} ${C.dim}(missing — not in ${files})${C.r}`);
        } else {
          console.log(`  ${C.red}✗${C.r} ${s.name} ${C.dim}(infrastructure — set manually)${C.r}`);
        }
        totalMissing++;
      }
    }
  }

  const requiredGh = new Set(SECRETS.filter(s => s.dest === "github").map(s => s.name));
  const stale = [...ghSecrets].filter(s => !requiredGh.has(s));
  if (stale.length) {
    console.log(`\n${C.yellow}Stale GitHub secrets (not in SECRETS list):${C.r}`);
    for (const s of stale) console.log(`  ${C.dim}${s}${C.r}`);
  }

  let issues = 0;
  const allLocal = { ...secretsVars, ...envVars };
  for (const s of SECRETS) {
    const varName = s.envVar || s.secretsVar;
    if (!varName) continue;
    const val = allLocal[varName];
    if (!val) continue;
    if (val.startsWith(" ") || val.endsWith(" ") || val.endsWith("\n") || val.endsWith("\r")) {
      console.log(`  ${C.red}✗${C.r} ${varName} has leading/trailing whitespace or newline`);
      issues++;
    }
    if (val.includes('"') || val.includes("'")) {
      console.log(`  ${C.red}✗${C.r} ${varName} contains embedded quotes — will contaminate secrets`);
      issues++;
    }
  }

  console.log(`\n${C.bold}Summary:${C.r} ${totalPresent} present, ${totalMissing} missing, ${totalMismatch} mismatched, ${issues} value issues`);
  if (syncable.length) {
    console.log(`\n${C.bold}Syncable/fixable:${C.r} ${syncable.map(s => `${s.name} (→ ${s.dest})`).join(", ")}`);
  }
  return syncable;
}

// --------------------------------------------------------------------------
// Sync
// --------------------------------------------------------------------------
function sync(syncable, envVars, secretsVars) {
  if (!syncable.length) { console.log(`\n${C.green}Nothing to sync.${C.r}`); return; }
  console.log(`\n${C.bold}Syncing ${syncable.length} secrets...${C.r}`);
  const k8sGroupsDone = new Set();

  for (const s of syncable) {
    const val = resolveLocalValue(s, envVars, secretsVars);
    if (!val) { console.log(`  ${C.red}✗${C.r} ${s.name} — no local value`); continue; }

    if (s.dest === "github") {
      execSync(`printf '%s' "${val.replace(/"/g, '\\"')}" | gh secret set "${s.name}" --repo ${REPO}`, { stdio: "pipe" });
      console.log(`  ${C.green}✓${C.r} ${s.name} → GitHub`);
    } else if (s.dest === "k8s-agents" && !k8sGroupsDone.has("k8s-agents")) {
      syncK8sSecret("agent-secrets", K8S_AGENTS_NS, "k8s-agents", envVars, secretsVars);
      k8sGroupsDone.add("k8s-agents");
    } else if (s.dest === "k8s-app" && !k8sGroupsDone.has("k8s-app")) {
      syncK8sSecret("fenrir-app-secrets", K8S_APP_NS, "k8s-app", envVars, secretsVars);
      k8sGroupsDone.add("k8s-app");
    }
  }
}

function syncK8sSecret(secretName, namespace, destKey, envVars, secretsVars) {
  const groupSecrets = SECRETS.filter(x => x.dest === destKey);
  const literals = [];
  for (const x of groupSecrets) {
    const v = resolveLocalValue(x, envVars, secretsVars) || "";
    if (!v) { console.log(`  ${C.yellow}!${C.r} ${x.name} — no local value, skipping`); continue; }
    literals.push(`--from-literal=${x.name}=${v}`);
  }
  if (!literals.length) { console.log(`  ${C.red}✗${C.r} No values for ${secretName} — skipping`); return; }
  execSync(`kubectl create secret generic ${secretName} --namespace ${namespace} ${literals.join(" ")} --dry-run=client -o yaml | kubectl apply -f -`, { stdio: "pipe" });
  console.log(`  ${C.green}✓${C.r} K8s ${secretName} (${namespace}) → ${literals.length} keys`);
}

// --------------------------------------------------------------------------
// Fix all: re-sync ALL secrets with clean values from local files
// --------------------------------------------------------------------------
function fixAll(envVars, secretsVars) {
  console.log(`\n${C.bold}Re-syncing ALL secrets from local files...${C.r}`);
  for (const s of SECRETS) {
    if (s.dest !== "github") continue;
    const val = resolveLocalValue(s, envVars, secretsVars);
    if (!val) continue;
    execSync(`printf '%s' "${val.replace(/"/g, '\\"')}" | gh secret set "${s.name}" --repo ${REPO}`, { stdio: "pipe" });
    console.log(`  ${C.green}✓${C.r} ${s.name} → GitHub`);
  }
  syncK8sSecret("agent-secrets", K8S_AGENTS_NS, "k8s-agents", envVars, secretsVars);
  syncK8sSecret("fenrir-app-secrets", K8S_APP_NS, "k8s-app", envVars, secretsVars);
}

// --------------------------------------------------------------------------
// Verify: compare K8s values against local (byte-level)
// --------------------------------------------------------------------------
function verify(envVars, secretsVars) {
  console.log(`\n${C.bold}Verifying K8s secrets match local values...${C.r}`);
  const k8sAgentKeys = getK8sSecretData("agent-secrets", K8S_AGENTS_NS);
  const k8sAppKeys = getK8sSecretData("fenrir-app-secrets", K8S_APP_NS);
  let ok = 0, bad = 0;

  for (const s of SECRETS) {
    if (!s.dest.startsWith("k8s")) continue;
    const localVal = resolveLocalValue(s, envVars, secretsVars);
    if (!localVal) continue;
    const remoteVal = s.dest === "k8s-agents" ? k8sAgentKeys[s.name] : k8sAppKeys[s.name];
    if (!remoteVal) {
      console.log(`  ${C.red}✗${C.r} ${s.name} (${s.k8sSecret}) — missing from K8s`);
      bad++; continue;
    }
    if (remoteVal === localVal) {
      console.log(`  ${C.green}✓${C.r} ${s.name} (${s.k8sSecret}) — ${remoteVal.length}b exact match`);
      ok++;
    } else {
      const trimMatch = remoteVal.trim() === localVal.trim();
      const detail = trimMatch ? "whitespace/newline difference" : "VALUE DIFFERS";
      console.log(`  ${C.red}✗${C.r} ${s.name} (${s.k8sSecret}) — ${detail} (remote: ${remoteVal.length}b, local: ${localVal.length}b)`);
      bad++;
    }
  }
  console.log(`\n${C.bold}Verify:${C.r} ${ok} match, ${bad} mismatched`);
  if (bad > 0) console.log(`${C.yellow}Run --fix-all to re-sync from local files${C.r}`);
}

// --------------------------------------------------------------------------
// Push one: force-push a single secret to ALL its destinations + restart
// --------------------------------------------------------------------------
function pushOne(keyName, envVars, secretsVars) {
  // Find all SECRETS entries that match this key name (by name, envVar, or secretsVar)
  const matches = SECRETS.filter(s =>
    s.name === keyName ||
    s.envVar === keyName ||
    s.secretsVar === keyName
  );
  if (!matches.length) {
    console.error(`${C.red}Unknown secret: ${keyName}${C.r}`);
    console.error(`Known keys: ${SECRETS.map(s => s.name).join(", ")}`);
    process.exit(1);
  }

  // Resolve value from local files
  const val = resolveLocalValue(matches[0], envVars, secretsVars);
  if (!val) {
    console.error(`${C.red}No local value found for ${keyName}${C.r}`);
    process.exit(1);
  }
  console.log(`\n${C.bold}Pushing ${keyName}${C.r} (${val.length}b) to ${matches.length} destination(s)...`);

  const k8sGroupsDone = new Set();
  for (const s of matches) {
    if (s.dest === "github") {
      execSync(`printf '%s' "${val.replace(/"/g, '\\"')}" | gh secret set "${s.name}" --repo ${REPO}`, { stdio: "pipe" });
      console.log(`  ${C.green}✓${C.r} ${s.name} → GitHub`);
    } else if (s.dest === "k8s-agents" && !k8sGroupsDone.has("k8s-agents")) {
      syncK8sSecret("agent-secrets", K8S_AGENTS_NS, "k8s-agents", envVars, secretsVars);
      k8sGroupsDone.add("k8s-agents");
    } else if (s.dest === "k8s-app" && !k8sGroupsDone.has("k8s-app")) {
      syncK8sSecret("fenrir-app-secrets", K8S_APP_NS, "k8s-app", envVars, secretsVars);
      k8sGroupsDone.add("k8s-app");
    }
  }

  // Auto-restart if any K8s secret was updated
  if (k8sGroupsDone.size > 0) {
    restartApp();
  }
}

// --------------------------------------------------------------------------
// Restart: restart fenrir-app deployment to pick up secret changes
// --------------------------------------------------------------------------
function restartApp() {
  console.log(`\n${C.bold}Restarting fenrir-app deployment...${C.r}`);
  try {
    execSync(`kubectl rollout restart deployment -n ${K8S_APP_NS}`, { stdio: "pipe" });
    console.log(`  ${C.green}✓${C.r} Deployment restarted`);
  } catch (e) {
    console.error(`  ${C.red}✗${C.r} Failed to restart: ${e.message}`);
  }
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------
const args = process.argv.slice(2);
const mode = args[0] || "audit";
const envVars = parseKeyValueFile(ENV_FILE);
const secretsVars = parseKeyValueFile(SECRETS_FILE);

if (!existsSync(ENV_FILE) && !existsSync(SECRETS_FILE)) {
  console.error(`${C.red}Missing both ${ENV_FILE} and ${SECRETS_FILE}${C.r}`);
  process.exit(1);
}
if (!existsSync(ENV_FILE)) console.log(`${C.yellow}Warning: ${ENV_FILE} not found${C.r}`);
if (!existsSync(SECRETS_FILE)) console.log(`${C.yellow}Warning: ${SECRETS_FILE} not found${C.r}`);

switch (mode) {
  case "--sync": { const syncable = audit(envVars, secretsVars); sync(syncable, envVars, secretsVars); break; }
  case "--fix-all": fixAll(envVars, secretsVars); break;
  case "--verify": verify(envVars, secretsVars); break;
  case "--push": {
    const key = args[1];
    if (!key) { console.error(`${C.red}Usage: --push <KEY_NAME>${C.r}`); process.exit(1); }
    pushOne(key, envVars, secretsVars);
    break;
  }
  case "--restart": restartApp(); break;
  case "--help": case "-h":
    console.log(readFileSync(import.meta.filename, "utf8").split("\n").slice(1, 21).map(l => l.replace(/^\/\/ ?/, "")).join("\n"));
    break;
  default: audit(envVars, secretsVars);
}
