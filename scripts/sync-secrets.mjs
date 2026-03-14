#!/usr/bin/env node
// --------------------------------------------------------------------------
// sync-secrets.mjs — Audit, validate, and sync secrets for Fenrir Ledger
//
// Checks GitHub Actions secrets, K8s agent secrets, and .env.local.
// Ensures secrets go to the RIGHT destination (GitHub vs K8s) with
// minimal oversharing.
//
// Usage:
//   node scripts/sync-secrets.mjs              # Audit all
//   node scripts/sync-secrets.mjs --sync       # Sync missing → correct destination
//   node scripts/sync-secrets.mjs --fix-quotes # Re-sync all, stripping quotes
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
const K8S_NS = "fenrir-agents";

// --------------------------------------------------------------------------
// Secret definitions — each secret has exactly ONE destination
// --------------------------------------------------------------------------
const SECRETS = [
  // --- GitHub only: GCP infrastructure (deploy workflow) ---
  { name: "GCP_PROJECT_ID",       dest: "github", group: "GCP Infra",   envVar: null },
  { name: "GCP_SA_KEY",           dest: "github", group: "GCP Infra",   envVar: null },
  { name: "GCP_REGION",           dest: "github", group: "GCP Infra",   envVar: null },
  { name: "GCP_ZONE",             dest: "github", group: "GCP Infra",   envVar: null },
  { name: "GKE_CLUSTER_NAME",     dest: "github", group: "GCP Infra",   envVar: null },
  { name: "TF_VAR_BILLING_ACCOUNT_ID", dest: "github", group: "Terraform", envVar: null },
  { name: "TF_VAR_UPTIME_CHECK_HOST",  dest: "github", group: "Terraform", envVar: null },

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
  { name: "KV_REST_API_URL",               dest: "github", group: "App Secrets", envVar: "KV_REST_API_URL" },
  { name: "KV_REST_API_TOKEN",             dest: "github", group: "App Secrets", envVar: "KV_REST_API_TOKEN" },

  // --- GitHub → K8s agent secrets (deploy workflow creates agent-secrets) ---
  { name: "CLAUDE_CODE_OAUTH_TOKEN", dest: "github", group: "Agent Sandbox", envVar: "CLAUDE_CODE_OAUTH_TOKEN" },
  { name: "GH_TOKEN_AGENTS",         dest: "github", group: "Agent Sandbox", envVar: "GITHUB_FINE_GRAINED_PAT" },

  // --- K8s only: agent-secrets (also set via deploy workflow, but verify independently) ---
  { name: "anthropic-api-key",   dest: "k8s", group: "K8s Agent", envVar: "FENRIR_ANTHROPIC_API_KEY", k8sSecret: "agent-secrets" },
  { name: "gh-token",            dest: "k8s", group: "K8s Agent", envVar: "GITHUB_FINE_GRAINED_PAT",  k8sSecret: "agent-secrets" },
  { name: "claude-oauth-token",  dest: "k8s", group: "K8s Agent", envVar: "CLAUDE_CODE_OAUTH_TOKEN",  k8sSecret: "agent-secrets" },
];

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------
function sh(cmd) {
  try { return execSync(cmd, { encoding: "utf8", timeout: 10_000 }).trim(); }
  catch { return ""; }
}

function parseEnvFile() {
  if (!existsSync(ENV_FILE)) return {};
  const vars = {};
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq);
    let val = line.slice(eq + 1);
    // Strip surrounding quotes
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

// --------------------------------------------------------------------------
// Audit
// --------------------------------------------------------------------------
function audit(envVars) {
  // Get existing GitHub secrets
  const ghSecrets = new Set(sh(`gh secret list --repo ${REPO}`).split("\n").map(l => l.split("\t")[0]).filter(Boolean));

  // Get existing K8s secret keys
  let k8sKeys = {};
  const k8sJson = sh(`kubectl get secret agent-secrets -n ${K8S_NS} -o json`);
  if (k8sJson) {
    try {
      const data = JSON.parse(k8sJson).data || {};
      for (const [k, v] of Object.entries(data)) {
        k8sKeys[k] = Buffer.from(v, "base64").toString();
      }
    } catch {}
  }

  // Group secrets by group
  const groups = {};
  for (const s of SECRETS) {
    (groups[s.group] = groups[s.group] || []).push(s);
  }

  const syncable = [];
  let totalMissing = 0;
  let totalPresent = 0;

  for (const [group, secrets] of Object.entries(groups)) {
    console.log(`\n${C.bold}${group}${C.r} ${C.dim}(→ ${secrets[0].dest})${C.r}`);

    for (const s of secrets) {
      let present = false;
      let value = null;

      if (s.dest === "github") {
        present = ghSecrets.has(s.name);
      } else if (s.dest === "k8s") {
        value = k8sKeys[s.name] || null;
        present = !!value;
      }

      if (present) {
        const extra = value ? ` ${C.dim}(${mask(value)})${C.r}` : "";
        console.log(`  ${C.green}✓${C.r} ${s.name}${extra}`);
        totalPresent++;
      } else {
        // Can we sync it?
        const localVal = s.envVar ? envVars[s.envVar] : null;
        if (localVal) {
          console.log(`  ${C.yellow}○${C.r} ${s.name} ${C.dim}(missing — syncable from ${s.envVar})${C.r}`);
          syncable.push(s);
        } else if (s.envVar) {
          console.log(`  ${C.red}✗${C.r} ${s.name} ${C.dim}(missing — ${s.envVar} not in .env.local)${C.r}`);
        } else {
          console.log(`  ${C.red}✗${C.r} ${s.name} ${C.dim}(infrastructure — set manually)${C.r}`);
        }
        totalMissing++;
      }
    }
  }

  // Stale GitHub secrets
  const requiredGh = new Set(SECRETS.filter(s => s.dest === "github").map(s => s.name));
  const stale = [...ghSecrets].filter(s => !requiredGh.has(s));
  if (stale.length) {
    console.log(`\n${C.yellow}Stale GitHub secrets (not in deploy.yml):${C.r}`);
    for (const s of stale) console.log(`  ${C.dim}${s}${C.r}`);
  }

  // Validate .env.local values
  let issues = 0;
  for (const s of SECRETS) {
    if (!s.envVar) continue;
    const val = envVars[s.envVar];
    if (!val) continue;
    if (val.startsWith(" ") || val.endsWith(" ")) {
      console.log(`\n  ${C.red}✗${C.r} ${s.envVar} has leading/trailing whitespace`);
      issues++;
    }
    if (val.includes('"') || val.includes("'")) {
      console.log(`\n  ${C.red}✗${C.r} ${s.envVar} contains embedded quotes — will contaminate secrets`);
      issues++;
    }
  }

  console.log(`\n${C.bold}Summary:${C.r} ${totalPresent} present, ${totalMissing} missing, ${issues} value issues`);

  if (syncable.length) {
    console.log(`\n${C.bold}Syncable:${C.r} ${syncable.map(s => s.name).join(", ")}`);
  }

  return syncable;
}

// --------------------------------------------------------------------------
// Sync
// --------------------------------------------------------------------------
function sync(syncable, envVars) {
  if (!syncable.length) {
    console.log(`\n${C.green}Nothing to sync.${C.r}`);
    return;
  }

  console.log(`\n${C.bold}Syncing ${syncable.length} secrets...${C.r}`);

  for (const s of syncable) {
    const val = envVars[s.envVar];
    if (!val) { console.log(`  ${C.red}✗${C.r} ${s.name} — no value`); continue; }

    if (s.dest === "github") {
      execSync(`printf '%s' "${val.replace(/"/g, '\\"')}" | gh secret set "${s.name}" --repo ${REPO}`, { stdio: "pipe" });
      console.log(`  ${C.green}✓${C.r} ${s.name} → GitHub`);
    } else if (s.dest === "k8s") {
      // Rebuild the full agent-secrets with all keys
      const allK8sSecrets = SECRETS.filter(x => x.dest === "k8s");
      const args = allK8sSecrets.map(x => {
        const v = envVars[x.envVar] || "";
        return `--from-literal=${x.name}="${v.replace(/"/g, '\\"')}"`;
      }).join(" ");
      execSync(`kubectl create secret generic agent-secrets --namespace ${K8S_NS} ${args} --dry-run=client -o yaml | kubectl apply -f -`, { stdio: "pipe" });
      console.log(`  ${C.green}✓${C.r} K8s agent-secrets updated (all 3 keys)`);
      break; // Only need to do this once for all k8s secrets
    }
  }
}

// --------------------------------------------------------------------------
// Fix quotes: re-sync all syncable secrets with clean values
// --------------------------------------------------------------------------
function fixQuotes(envVars) {
  console.log(`\n${C.bold}Re-syncing all secrets (stripping quotes)...${C.r}`);

  const ghSecrets = new Set(sh(`gh secret list --repo ${REPO}`).split("\n").map(l => l.split("\t")[0]).filter(Boolean));

  for (const s of SECRETS) {
    if (!s.envVar) continue;
    const val = envVars[s.envVar];
    if (!val) continue;

    if (s.dest === "github" && ghSecrets.has(s.name)) {
      execSync(`printf '%s' "${val.replace(/"/g, '\\"')}" | gh secret set "${s.name}" --repo ${REPO}`, { stdio: "pipe" });
      console.log(`  ${C.green}✓${C.r} ${s.name} → GitHub`);
    }
  }

  // K8s agent secrets
  const allK8s = SECRETS.filter(x => x.dest === "k8s");
  const allHaveValues = allK8s.every(x => envVars[x.envVar]);
  if (allHaveValues) {
    const args = allK8s.map(x => {
      const v = envVars[x.envVar];
      return `--from-literal=${x.name}="${v.replace(/"/g, '\\"')}"`;
    }).join(" ");
    execSync(`kubectl create secret generic agent-secrets --namespace ${K8S_NS} ${args} --dry-run=client -o yaml | kubectl apply -f -`, { stdio: "pipe" });
    console.log(`  ${C.green}✓${C.r} K8s agent-secrets → all 3 keys`);
  }
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------
const mode = process.argv[2] || "audit";
const envVars = parseEnvFile();

if (!existsSync(ENV_FILE)) {
  console.error(`${C.red}Missing: ${ENV_FILE}${C.r}`);
  process.exit(1);
}

switch (mode) {
  case "--sync": {
    const syncable = audit(envVars);
    sync(syncable, envVars);
    break;
  }
  case "--fix-quotes":
    fixQuotes(envVars);
    break;
  case "--help": case "-h":
    console.log(readFileSync(import.meta.filename, "utf8").split("\n").slice(1, 12).map(l => l.replace(/^\/\/ ?/, "")).join("\n"));
    break;
  default:
    audit(envVars);
}
