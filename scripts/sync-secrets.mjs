#!/usr/bin/env node
// --------------------------------------------------------------------------
// sync-secrets.mjs — Audit, validate, and sync secrets for Fenrir Ledger
//
// Source of truth: GCP Secret Manager (with versioning + audit trail)
// Local override:  .secrets file (optional — local dev only)
//
// Syncs to FOUR destinations:
//   GitHub Actions       — deploy workflow uses these
//   K8s agent-secrets    — fenrir-agents namespace (agent sandbox)
//   K8s app-secrets      — fenrir-app namespace (production app)
//   K8s n8n-secrets      — fenrir-marketing namespace (n8n automation)
//
// Usage:
//   node scripts/sync-secrets.mjs              # Audit all
//   node scripts/sync-secrets.mjs --sync       # Sync missing → correct destination
//   node scripts/sync-secrets.mjs --fix-all    # Re-sync ALL secrets (clean values)
//   node scripts/sync-secrets.mjs --verify     # Compare K8s values against source
//   node scripts/sync-secrets.mjs --push KEY   # Update Secret Manager + sync to destinations + restart
//   node scripts/sync-secrets.mjs --upload     # Bootstrap: push .secrets file → Secret Manager
//   node scripts/sync-secrets.mjs --restart    # Restart fenrir-app deployment (pick up secret changes)
//
// Secret Manager access:
//   - Pods: Workload Identity (no exported keys needed)
//   - Local dev: gcloud auth application-default login
//   - CI/CD: fenrir-deploy service account (ADC via GOOGLE_APPLICATION_CREDENTIALS)
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
const SECRETS_FILE = join(REPO_ROOT, ".secrets");
const K8S_AGENTS_NS = "fenrir-agents";
const K8S_APP_NS = "fenrir-app";
const K8S_MARKETING_NS = "fenrir-marketing";

// GCP project for Secret Manager (matches infrastructure/variables.tf default)
const GCP_PROJECT = process.env.GCP_PROJECT_ID || "fenrir-ledger-prod";

// --------------------------------------------------------------------------
// Secret definitions — each secret has exactly ONE destination
// canonical = the Secret Manager secret name (the source of truth key)
// envVar / secretsVar = legacy local file key name (for .secrets override)
// --------------------------------------------------------------------------
const SECRETS = [
  // --- GitHub only: GCP infrastructure (deploy workflow) ---
  { name: "GCP_PROJECT_ID",       dest: "github", group: "GCP Infra",     canonical: "GCP_PROJECT_ID" },
  { name: "GCP_SA_KEY",           dest: "github", group: "GCP Infra",     canonical: "GCP_SA_KEY" },
  { name: "GCP_REGION",           dest: "github", group: "GCP Infra",     canonical: "GCP_REGION" },
  { name: "GCP_ZONE",             dest: "github", group: "GCP Infra",     canonical: "GCP_ZONE" },
  { name: "GKE_CLUSTER_NAME",     dest: "github", group: "GCP Infra",     canonical: "GKE_CLUSTER_NAME" },
  { name: "TF_VAR_BILLING_ACCOUNT_ID", dest: "github", group: "Terraform", canonical: "TF_VAR_BILLING_ACCOUNT_ID" },
  { name: "TF_VAR_UPTIME_CHECK_HOST",  dest: "github", group: "Terraform", canonical: "TF_VAR_UPTIME_CHECK_HOST" },

  // --- GitHub only: Docker build-args (baked at build time) ---
  { name: "NEXT_PUBLIC_GOOGLE_CLIENT_ID", dest: "github", group: "Build Args", canonical: "NEXT_PUBLIC_GOOGLE_CLIENT_ID", envVar: "NEXT_PUBLIC_GOOGLE_CLIENT_ID" },

  // --- GitHub → K8s app secrets (deploy workflow creates fenrir-app-secrets) ---
  { name: "GOOGLE_CLIENT_SECRET",            dest: "github", group: "App Secrets", canonical: "GOOGLE_CLIENT_SECRET",            envVar: "GOOGLE_CLIENT_SECRET" },
  { name: "GOOGLE_PICKER_API_KEY",           dest: "github", group: "App Secrets", canonical: "GOOGLE_PICKER_API_KEY",           envVar: "GOOGLE_PICKER_API_KEY" },
  { name: "FENRIR_ANTHROPIC_API_KEY",        dest: "github", group: "App Secrets", canonical: "FENRIR_ANTHROPIC_API_KEY",        envVar: "FENRIR_ANTHROPIC_API_KEY" },
  { name: "ENTITLEMENT_ENCRYPTION_KEY",      dest: "github", group: "App Secrets", canonical: "ENTITLEMENT_ENCRYPTION_KEY",      envVar: "ENTITLEMENT_ENCRYPTION_KEY" },
  { name: "STRIPE_SECRET_KEY",              dest: "github", group: "App Secrets", canonical: "STRIPE_SECRET_KEY",              envVar: "STRIPE_SECRET_KEY" },
  { name: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", dest: "github", group: "App Secrets", canonical: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", envVar: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" },
  // STRIPE_WEBHOOK_SECRET — managed by Terraform output → deploy.yml (not GitHub Secrets)
  { name: "STRIPE_PRICE_ID",               dest: "github", group: "App Secrets", canonical: "STRIPE_PRICE_ID",               envVar: "STRIPE_PRICE_ID" },
  { name: "ADMIN_EMAILS",                 dest: "github", group: "App Secrets", canonical: "ADMIN_EMAILS",                 envVar: "ADMIN_EMAILS" },

  // --- GitHub → K8s agent secrets (deploy workflow creates agent-secrets) ---
  { name: "CLAUDE_CODE_OAUTH_TOKEN", dest: "github", group: "Agent Sandbox", canonical: "CLAUDE_CODE_OAUTH_TOKEN", secretsVar: "CLAUDE_CODE_OAUTH_TOKEN" },
  { name: "GH_TOKEN_AGENTS",         dest: "github", group: "Agent Sandbox", canonical: "GITHUB_TOKEN_PAT_CLASSIC", secretsVar: "GITHUB_TOKEN_PAT_CLASSIC" },

  // --- K8s agent-secrets (fenrir-agents namespace) ---
  { name: "anthropic-api-key",      dest: "k8s-agents", group: "K8s Agent Secrets", canonical: "FENRIR_ANTHROPIC_API_KEY",       envVar: "FENRIR_ANTHROPIC_API_KEY",        k8sSecret: "agent-secrets" },
  { name: "gh-token",               dest: "k8s-agents", group: "K8s Agent Secrets", canonical: "GITHUB_TOKEN_PAT_CLASSIC",       secretsVar: "GITHUB_TOKEN_PAT_CLASSIC",    k8sSecret: "agent-secrets" },
  { name: "gh-token-classic",       dest: "k8s-agents", group: "K8s Agent Secrets", canonical: "GITHUB_TOKEN_PAT_CLASSIC",       secretsVar: "GITHUB_TOKEN_PAT_CLASSIC",    k8sSecret: "agent-secrets" },
  { name: "gh-token-fine-grained",  dest: "k8s-agents", group: "K8s Agent Secrets", canonical: "GITHUB_TOKEN_PAT_FINE_GRAINED",  secretsVar: "GITHUB_TOKEN_PAT_FINE_GRAINED", k8sSecret: "agent-secrets" },
  { name: "claude-oauth-token",     dest: "k8s-agents", group: "K8s Agent Secrets", canonical: "CLAUDE_CODE_OAUTH_TOKEN",        secretsVar: "CLAUDE_CODE_OAUTH_TOKEN",     k8sSecret: "agent-secrets" },

  // --- K8s n8n-secrets (fenrir-marketing namespace) ---
  { name: "ANTHROPIC_API_KEY",    dest: "k8s-marketing", group: "K8s n8n Secrets", canonical: "FENRIR_ANTHROPIC_API_KEY", envVar: "FENRIR_ANTHROPIC_API_KEY", k8sSecret: "n8n-secrets" },
  { name: "GMAIL_CLIENT_ID",      dest: "k8s-marketing", group: "K8s n8n Secrets", canonical: "GMAIL_MCP_CLIENT_ID",    secretsVar: "GMAIL_MCP_CLIENT_ID",  k8sSecret: "n8n-secrets" },
  { name: "GMAIL_CLIENT_SECRET",  dest: "k8s-marketing", group: "K8s n8n Secrets", canonical: "GMAIL_MCP_CLIENT_SECRET", secretsVar: "GMAIL_MCP_CLIENT_SECRET", k8sSecret: "n8n-secrets" },
  { name: "GMAIL_REFRESH_TOKEN",  dest: "k8s-marketing", group: "K8s n8n Secrets", canonical: "GMAIL_REFRESH_TOKEN",    secretsVar: "GMAIL_REFRESH_TOKEN",   k8sSecret: "n8n-secrets" },
  { name: "N8N_ENCRYPTION_KEY",   dest: "k8s-marketing", group: "K8s n8n Secrets", canonical: "N8N_ENCRYPTION_KEY",     secretsVar: "N8N_ENCRYPTION_KEY",    k8sSecret: "n8n-secrets" },
  { name: "N8N_API_KEY",          dest: "k8s-marketing", group: "K8s n8n Secrets", canonical: "N8N_API_KEY",            secretsVar: "N8N_API_KEY",           k8sSecret: "n8n-secrets" },

  // --- K8s fenrir-app-secrets (fenrir-app namespace) ---
  { name: "FENRIR_ANTHROPIC_API_KEY",  dest: "k8s-app", group: "K8s App Secrets", canonical: "FENRIR_ANTHROPIC_API_KEY",        envVar: "FENRIR_ANTHROPIC_API_KEY",    k8sSecret: "fenrir-app-secrets" },
  { name: "GOOGLE_CLIENT_SECRET",      dest: "k8s-app", group: "K8s App Secrets", canonical: "GOOGLE_CLIENT_SECRET",            envVar: "GOOGLE_CLIENT_SECRET",        k8sSecret: "fenrir-app-secrets" },
  { name: "GOOGLE_PICKER_API_KEY",     dest: "k8s-app", group: "K8s App Secrets", canonical: "GOOGLE_PICKER_API_KEY",           envVar: "GOOGLE_PICKER_API_KEY",       k8sSecret: "fenrir-app-secrets" },
  { name: "ENTITLEMENT_ENCRYPTION_KEY", dest: "k8s-app", group: "K8s App Secrets", canonical: "ENTITLEMENT_ENCRYPTION_KEY",     envVar: "ENTITLEMENT_ENCRYPTION_KEY",  k8sSecret: "fenrir-app-secrets" },
  { name: "STRIPE_SECRET_KEY",         dest: "k8s-app", group: "K8s App Secrets", canonical: "STRIPE_SECRET_KEY",              envVar: "STRIPE_SECRET_KEY",           k8sSecret: "fenrir-app-secrets" },
  { name: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", dest: "k8s-app", group: "K8s App Secrets", canonical: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", envVar: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", k8sSecret: "fenrir-app-secrets" },
  // STRIPE_WEBHOOK_SECRET — managed by Terraform output → deploy.yml (not sync-secrets)
  { name: "STRIPE_PRICE_ID",           dest: "k8s-app", group: "K8s App Secrets", canonical: "STRIPE_PRICE_ID",               envVar: "STRIPE_PRICE_ID",             k8sSecret: "fenrir-app-secrets" },
  { name: "APP_BASE_URL",             dest: "k8s-app", group: "K8s App Secrets", canonical: "APP_BASE_URL",                  envVar: "APP_BASE_URL",                k8sSecret: "fenrir-app-secrets" },
  { name: "ADMIN_EMAILS",             dest: "k8s-app", group: "K8s App Secrets", canonical: "ADMIN_EMAILS",                  envVar: "ADMIN_EMAILS",                k8sSecret: "fenrir-app-secrets" },
  { name: "GITHUB_TOKEN",            dest: "k8s-app", group: "K8s App Secrets", canonical: "GITHUB_TOKEN_PAT_CLASSIC",       secretsVar: "GITHUB_TOKEN_PAT_CLASSIC", k8sSecret: "fenrir-app-secrets" },
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

// --------------------------------------------------------------------------
// GCP Secret Manager — read all secrets at once (lazy-loaded)
// --------------------------------------------------------------------------
let _smCache = null;   // Map<canonicalName, value>
let _smAvailable = null;

async function loadSecretManager() {
  if (_smCache !== null) return _smCache;

  try {
    const { SecretManagerServiceClient } = await import("@google-cloud/secret-manager");
    const client = new SecretManagerServiceClient();

    // Enumerate unique canonical names
    const canonicalNames = [...new Set(SECRETS.map(s => s.canonical).filter(Boolean))];
    const results = new Map();

    await Promise.all(canonicalNames.map(async (name) => {
      try {
        const resourceName = `projects/${GCP_PROJECT}/secrets/${name}/versions/latest`;
        const [version] = await client.accessSecretVersion({ name: resourceName });
        const payload = version.payload?.data;
        if (payload) {
          results.set(name, Buffer.isBuffer(payload) ? payload.toString("utf8") : String(payload));
        }
      } catch {
        // Secret may not yet have a version — that's OK during bootstrap
      }
    }));

    _smCache = results;
    _smAvailable = true;
    return results;
  } catch (err) {
    // @google-cloud/secret-manager not installed or ADC not configured
    if (err.code === "MODULE_NOT_FOUND" || err.message?.includes("MODULE_NOT_FOUND")) {
      console.log(`${C.yellow}Warning: @google-cloud/secret-manager not installed. Run: npm install -g @google-cloud/secret-manager${C.r}`);
    } else {
      console.log(`${C.yellow}Warning: Secret Manager unavailable (${err.message}). Falling back to local .secrets file.${C.r}`);
    }
    _smCache = new Map();
    _smAvailable = false;
    return _smCache;
  }
}

async function pushToSecretManager(canonicalName, value) {
  const { SecretManagerServiceClient } = await import("@google-cloud/secret-manager");
  const client = new SecretManagerServiceClient();
  const parent = `projects/${GCP_PROJECT}/secrets/${canonicalName}`;

  // Add new version (Secret Manager keeps all versions for audit/rollback)
  await client.addSecretVersion({
    parent,
    payload: { data: Buffer.from(value, "utf8") },
  });
}

// --------------------------------------------------------------------------
// Value resolution: Secret Manager → local .secrets override
// --------------------------------------------------------------------------
async function resolveValue(s, secretsVars, smSecrets) {
  // 1. Local .secrets file takes precedence as an override
  const localKey = s.envVar || s.secretsVar;
  if (localKey && secretsVars[localKey]) return secretsVars[localKey];

  // 2. Secret Manager (canonical source of truth)
  if (s.canonical && smSecrets.has(s.canonical)) return smSecrets.get(s.canonical);

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
async function audit(secretsVars, smSecrets) {
  const ghSecrets = new Set(sh(`gh secret list --repo ${REPO}`).split("\n").map(l => l.split("\t")[0]).filter(Boolean));
  const k8sAgentKeys = getK8sSecretData("agent-secrets", K8S_AGENTS_NS);
  const k8sAppKeys = getK8sSecretData("fenrir-app-secrets", K8S_APP_NS);
  const k8sAnalyticsKeys = getK8sSecretData("n8n-secrets", K8S_MARKETING_NS);

  const smStatus = _smAvailable ? `${C.green}connected${C.r}` : `${C.yellow}unavailable (local fallback)${C.r}`;
  console.log(`\n${C.bold}Source of truth:${C.r} GCP Secret Manager (${GCP_PROJECT}) — ${smStatus}`);

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
      } else if (s.dest === "k8s-marketing") {
        remoteValue = k8sAnalyticsKeys[s.name] || null;
        present = !!remoteValue;
      }

      const localVal = await resolveValue(s, secretsVars, smSecrets);
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
          const source = smSecrets.has(s.canonical) ? "Secret Manager" : ".secrets";
          console.log(`  ${C.yellow}○${C.r} ${s.name} ${C.dim}(missing — syncable from ${source})${C.r}`);
          syncable.push(s);
        } else if (s.envVar || s.secretsVar || s.canonical) {
          const files = [s.canonical && "Secret Manager", s.envVar && ".secrets", s.secretsVar && ".secrets"].filter(Boolean).join(" / ");
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
  for (const s of SECRETS) {
    const localVal = await resolveValue(s, secretsVars, smSecrets);
    if (!localVal) continue;
    if (localVal.startsWith(" ") || localVal.endsWith(" ") || localVal.endsWith("\n") || localVal.endsWith("\r")) {
      console.log(`  ${C.red}✗${C.r} ${s.canonical || s.name} has leading/trailing whitespace or newline`);
      issues++;
    }
    if (localVal.includes('"') || localVal.includes("'")) {
      console.log(`  ${C.red}✗${C.r} ${s.canonical || s.name} contains embedded quotes — will contaminate secrets`);
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
async function sync(syncable, secretsVars, smSecrets) {
  if (!syncable.length) { console.log(`\n${C.green}Nothing to sync.${C.r}`); return; }
  console.log(`\n${C.bold}Syncing ${syncable.length} secrets...${C.r}`);
  const k8sGroupsDone = new Set();

  for (const s of syncable) {
    const val = await resolveValue(s, secretsVars, smSecrets);
    if (!val) { console.log(`  ${C.red}✗${C.r} ${s.name} — no value`); continue; }

    if (s.dest === "github") {
      execSync(`printf '%s' "${val.replace(/"/g, '\\"')}" | gh secret set "${s.name}" --repo ${REPO}`, { stdio: "pipe" });
      console.log(`  ${C.green}✓${C.r} ${s.name} → GitHub`);
    } else if (s.dest === "k8s-agents" && !k8sGroupsDone.has("k8s-agents")) {
      await syncK8sSecret("agent-secrets", K8S_AGENTS_NS, "k8s-agents", secretsVars, smSecrets);
      k8sGroupsDone.add("k8s-agents");
    } else if (s.dest === "k8s-app" && !k8sGroupsDone.has("k8s-app")) {
      await syncK8sSecret("fenrir-app-secrets", K8S_APP_NS, "k8s-app", secretsVars, smSecrets);
      k8sGroupsDone.add("k8s-app");
    } else if (s.dest === "k8s-marketing" && !k8sGroupsDone.has("k8s-marketing")) {
      await syncK8sSecret("n8n-secrets", K8S_MARKETING_NS, "k8s-marketing", secretsVars, smSecrets);
      k8sGroupsDone.add("k8s-marketing");
    }
  }
}

async function syncK8sSecret(secretName, namespace, destKey, secretsVars, smSecrets) {
  const groupSecrets = SECRETS.filter(x => x.dest === destKey);
  const literals = [];
  for (const x of groupSecrets) {
    const v = await resolveValue(x, secretsVars, smSecrets);
    if (!v) { console.log(`  ${C.yellow}!${C.r} ${x.name} — no value, skipping`); continue; }
    literals.push(`--from-literal=${x.name}=${v}`);
  }
  if (!literals.length) { console.log(`  ${C.red}✗${C.r} No values for ${secretName} — skipping`); return; }
  execSync(`kubectl create secret generic ${secretName} --namespace ${namespace} ${literals.join(" ")} --dry-run=client -o yaml | kubectl apply -f -`, { stdio: "pipe" });
  console.log(`  ${C.green}✓${C.r} K8s ${secretName} (${namespace}) → ${literals.length} keys`);
}

// --------------------------------------------------------------------------
// Fix all: re-sync ALL secrets from source of truth
// --------------------------------------------------------------------------
async function fixAll(secretsVars, smSecrets) {
  console.log(`\n${C.bold}Re-syncing ALL secrets from source of truth...${C.r}`);
  for (const s of SECRETS) {
    if (s.dest !== "github") continue;
    const val = await resolveValue(s, secretsVars, smSecrets);
    if (!val) continue;
    execSync(`printf '%s' "${val.replace(/"/g, '\\"')}" | gh secret set "${s.name}" --repo ${REPO}`, { stdio: "pipe" });
    console.log(`  ${C.green}✓${C.r} ${s.name} → GitHub`);
  }
  await syncK8sSecret("agent-secrets", K8S_AGENTS_NS, "k8s-agents", secretsVars, smSecrets);
  await syncK8sSecret("fenrir-app-secrets", K8S_APP_NS, "k8s-app", secretsVars, smSecrets);
  await syncK8sSecret("n8n-secrets", K8S_MARKETING_NS, "k8s-marketing", secretsVars, smSecrets);
}

// --------------------------------------------------------------------------
// Verify: compare K8s values against source of truth
// --------------------------------------------------------------------------
async function verify(secretsVars, smSecrets) {
  console.log(`\n${C.bold}Verifying K8s secrets match source of truth...${C.r}`);
  const k8sAgentKeys = getK8sSecretData("agent-secrets", K8S_AGENTS_NS);
  const k8sAppKeys = getK8sSecretData("fenrir-app-secrets", K8S_APP_NS);
  const k8sAnalyticsKeys = getK8sSecretData("n8n-secrets", K8S_MARKETING_NS);
  let ok = 0, bad = 0;

  for (const s of SECRETS) {
    if (!s.dest.startsWith("k8s")) continue;
    const localVal = await resolveValue(s, secretsVars, smSecrets);
    if (!localVal) continue;
    const remoteVal = s.dest === "k8s-agents" ? k8sAgentKeys[s.name]
      : s.dest === "k8s-marketing" ? k8sAnalyticsKeys[s.name]
      : k8sAppKeys[s.name];
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
      console.log(`  ${C.red}✗${C.r} ${s.name} (${s.k8sSecret}) — ${detail} (remote: ${remoteVal.length}b, source: ${localVal.length}b)`);
      bad++;
    }
  }
  console.log(`\n${C.bold}Verify:${C.r} ${ok} match, ${bad} mismatched`);
  if (bad > 0) console.log(`${C.yellow}Run --fix-all to re-sync from source of truth${C.r}`);
}

// --------------------------------------------------------------------------
// Push one: update Secret Manager FIRST, then sync to all destinations
// --push KEY [VALUE]
//   Without VALUE: reads from .secrets local file
//   With VALUE:    uses provided value (piped or inline)
// --------------------------------------------------------------------------
async function pushOne(keyName, secretsVars, smSecrets) {
  // Find all SECRETS entries that reference this key
  const matches = SECRETS.filter(s =>
    s.name === keyName ||
    s.envVar === keyName ||
    s.secretsVar === keyName ||
    s.canonical === keyName
  );
  if (!matches.length) {
    console.error(`${C.red}Unknown secret: ${keyName}${C.r}`);
    console.error(`Known keys: ${[...new Set(SECRETS.map(s => s.canonical || s.name))].join(", ")}`);
    process.exit(1);
  }

  const val = await resolveValue(matches[0], secretsVars, smSecrets);
  if (!val) {
    console.error(`${C.red}No value found for ${keyName} in Secret Manager or .secrets${C.r}`);
    process.exit(1);
  }
  console.log(`\n${C.bold}Pushing ${keyName}${C.r} (${val.length}b) to Secret Manager + ${matches.length} destination(s)...`);

  // 1. Write new version to Secret Manager first
  if (_smAvailable && matches[0].canonical) {
    try {
      await pushToSecretManager(matches[0].canonical, val);
      console.log(`  ${C.green}✓${C.r} ${matches[0].canonical} → Secret Manager (new version)`);
      // Refresh cache
      smSecrets.set(matches[0].canonical, val);
    } catch (err) {
      console.error(`  ${C.red}✗${C.r} Failed to write to Secret Manager: ${err.message}`);
      process.exit(1);
    }
  } else if (!_smAvailable) {
    console.log(`  ${C.yellow}!${C.r} Secret Manager unavailable — skipping SM write, syncing from local value only`);
  }

  // 2. Sync to K8s + GitHub destinations
  const k8sGroupsDone = new Set();
  for (const s of matches) {
    if (s.dest === "github") {
      execSync(`printf '%s' "${val.replace(/"/g, '\\"')}" | gh secret set "${s.name}" --repo ${REPO}`, { stdio: "pipe" });
      console.log(`  ${C.green}✓${C.r} ${s.name} → GitHub`);
    } else if (s.dest === "k8s-agents" && !k8sGroupsDone.has("k8s-agents")) {
      await syncK8sSecret("agent-secrets", K8S_AGENTS_NS, "k8s-agents", secretsVars, smSecrets);
      k8sGroupsDone.add("k8s-agents");
    } else if (s.dest === "k8s-app" && !k8sGroupsDone.has("k8s-app")) {
      await syncK8sSecret("fenrir-app-secrets", K8S_APP_NS, "k8s-app", secretsVars, smSecrets);
      k8sGroupsDone.add("k8s-app");
    } else if (s.dest === "k8s-marketing" && !k8sGroupsDone.has("k8s-marketing")) {
      await syncK8sSecret("n8n-secrets", K8S_MARKETING_NS, "k8s-marketing", secretsVars, smSecrets);
      k8sGroupsDone.add("k8s-marketing");
    }
  }

  if (k8sGroupsDone.size > 0) {
    restartApp();
  }
}

// --------------------------------------------------------------------------
// Upload: bootstrap — push all .secrets values → Secret Manager
// This is the one-time migration step. Run once with local .secrets present.
// Subsequent updates use --push KEY.
// --------------------------------------------------------------------------
async function upload(secretsVars) {
  if (!_smAvailable) {
    console.error(`${C.red}Secret Manager is not available. Ensure gcloud ADC is configured:${C.r}`);
    console.error(`  gcloud auth application-default login`);
    console.error(`  gcloud config set project ${GCP_PROJECT}`);
    process.exit(1);
  }

  if (!existsSync(SECRETS_FILE)) {
    console.error(`${C.red}No .secrets file found at ${SECRETS_FILE}${C.r}`);
    console.error(`Cannot bootstrap without a local source. Provide a .secrets file.`);
    process.exit(1);
  }

  // Unique canonical keys with a local value
  const seen = new Set();
  const toUpload = [];
  for (const s of SECRETS) {
    if (!s.canonical || seen.has(s.canonical)) continue;
    seen.add(s.canonical);
    const localKey = s.envVar || s.secretsVar;
    const val = localKey ? secretsVars[localKey] : null;
    if (val) toUpload.push({ canonical: s.canonical, val });
  }

  if (!toUpload.length) {
    console.log(`${C.yellow}No local values found to upload.${C.r}`);
    return;
  }

  console.log(`\n${C.bold}Uploading ${toUpload.length} secrets to Secret Manager (${GCP_PROJECT})...${C.r}`);
  let ok = 0, failed = 0;
  for (const { canonical, val } of toUpload) {
    try {
      await pushToSecretManager(canonical, val);
      console.log(`  ${C.green}✓${C.r} ${canonical} (${val.length}b)`);
      ok++;
    } catch (err) {
      console.log(`  ${C.red}✗${C.r} ${canonical} — ${err.message}`);
      failed++;
    }
  }
  console.log(`\n${C.bold}Upload complete:${C.r} ${ok} uploaded, ${failed} failed`);
  if (ok > 0) {
    console.log(`\n${C.cyan}Next steps:${C.r}`);
    console.log(`  1. Verify: node scripts/sync-secrets.mjs --verify`);
    console.log(`  2. Sync to destinations: node scripts/sync-secrets.mjs --fix-all`);
    console.log(`  3. The .secrets file is now an optional local override — keep it in .gitignore`);
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

const secretsVars = parseKeyValueFile(SECRETS_FILE);

if (!existsSync(SECRETS_FILE)) {
  console.log(`${C.dim}Note: No .secrets file found — using Secret Manager as sole source${C.r}`);
}

// Load Secret Manager (gracefully falls back to empty map if unavailable)
const smSecrets = await loadSecretManager();

switch (mode) {
  case "--sync": {
    const syncable = await audit(secretsVars, smSecrets);
    await sync(syncable, secretsVars, smSecrets);
    break;
  }
  case "--fix-all":
    await fixAll(secretsVars, smSecrets);
    break;
  case "--verify":
    await verify(secretsVars, smSecrets);
    break;
  case "--push": {
    const key = args[1];
    if (!key) { console.error(`${C.red}Usage: --push <KEY_NAME>${C.r}`); process.exit(1); }
    await pushOne(key, secretsVars, smSecrets);
    break;
  }
  case "--upload":
    await upload(secretsVars);
    break;
  case "--restart":
    restartApp();
    break;
  case "--help": case "-h":
    console.log(readFileSync(import.meta.filename, "utf8").split("\n").slice(1, 22).map(l => l.replace(/^\/\/ ?/, "")).join("\n"));
    break;
  default:
    await audit(secretsVars, smSecrets);
}
