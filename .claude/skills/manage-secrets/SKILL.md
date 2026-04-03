---
name: manage-secrets
description: "Audit, sync, verify, and push secrets for Fenrir Ledger. Use this skill whenever dealing with secrets — API keys, tokens, K8s secrets, GitHub secrets, .env files. NEVER manage secrets manually."
---

# Manage Secrets — Secret Lifecycle Manager

**UNBREAKABLE RULE:** All secret operations go through `scripts/sync-secrets.mjs`. Never `kubectl create/patch secret` directly. Never `gh secret set` directly. This skill is the ONLY way to manage secrets.

## When to Use

Trigger on ANY of these:
- "sync secrets", "push secret", "fix secret", "verify secrets"
- "API key", "token", "credential", "401", "authentication error", "invalid key"
- Any mention of `.secrets`, `.secrets`, `fenrir-app-secrets`, `agent-secrets`
- Any Anthropic/Stripe/Google key issue
- Deploy failures caused by bad secret values
- "manage secrets", "/manage-secrets"

## Commands

```
/manage-secrets                    # Audit all secrets
/manage-secrets sync               # Sync missing secrets to correct destinations
/manage-secrets fix-all            # Re-sync ALL secrets with clean values
/manage-secrets verify             # Byte-level compare K8s vs local
/manage-secrets push <KEY>         # Force-push one secret everywhere + restart
/manage-secrets restart            # Restart fenrir-app to pick up changes
```

## Instructions

### Parse the command

| Input | Action |
|-------|--------|
| (no args) or `audit` | `node scripts/sync-secrets.mjs` |
| `sync` | `node scripts/sync-secrets.mjs --sync` |
| `fix-all` | `node scripts/sync-secrets.mjs --fix-all` |
| `verify` | `node scripts/sync-secrets.mjs --verify` |
| `push <KEY>` | `node scripts/sync-secrets.mjs --push <KEY>` |
| `restart` | `node scripts/sync-secrets.mjs --restart` |

### Execute

```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
node "$REPO_ROOT/scripts/sync-secrets.mjs" <flag>
```

### Secret Source

All secrets live in a single file at the repo root:

| File | Contains |
|------|----------|
| `.secrets` | ALL secrets — app, agent, infra, OAuth, Stripe, everything |

There is no `.secrets` — it was consolidated into `.secrets`. The sync script reads everything from `.secrets`.

### Destinations

| Destination | Namespace | Created by |
|-------------|-----------|------------|
| GitHub Actions Secrets | — | `gh secret set` |
| K8s `fenrir-app-secrets` | `fenrir-app` | Deploy workflow + this script |
| K8s `agent-secrets` | `fenrir-agents` | Deploy workflow + this script |
| K8s `n8n-secrets` | `fenrir-marketing` | This script (manual trigger by Odin) |

### n8n Secrets Manifest

`n8n-secrets` in `fenrir-marketing` namespace — referenced by n8n Helm values via `secretRefs.existingSecret`.

| Key in K8s Secret | Source var in `.secrets` | Purpose |
|-------------------|---------------------------|---------|
| `ANTHROPIC_API_KEY` | `FENRIR_ANTHROPIC_API_KEY` | Claude API for n8n AI nodes |
| `GMAIL_CLIENT_ID` | `GMAIL_CLIENT_ID` | Gmail OAuth2 client ID for freyafenrir@gmail.com |
| `GMAIL_CLIENT_SECRET` | `GMAIL_CLIENT_SECRET` | Gmail OAuth2 client secret |
| `GMAIL_REFRESH_TOKEN` | `GMAIL_REFRESH_TOKEN` | Gmail OAuth2 refresh token |

**To provision n8n-secrets after deploy:**
```
/manage-secrets sync   # pushes all k8s-n8n entries from .secrets → analytics namespace
```

### Common Scenarios

**Secret 401 error in production:**
```
/manage-secrets verify         # Find the mismatch
/manage-secrets push FENRIR_ANTHROPIC_API_KEY  # Fix it everywhere + restart
```

**After rotating a key:**
1. Update the value in `.secrets` or `.secrets`
2. `/manage-secrets push <KEY_NAME>`

**After a deploy overwrites a manual fix:**
```
/manage-secrets fix-all        # Re-sync everything from local files
```

**Routine health check:**
```
/manage-secrets verify         # Compare K8s values against local
```

## Rules

- **NEVER** use `kubectl create/patch secret` directly — always go through this script
- **NEVER** use `gh secret set` directly — always go through this script
- **NEVER** ask the user to paste secrets — read from `.secrets` or `.secrets`
- The script strips quotes and whitespace automatically
- `--push` auto-restarts the deployment — no need to restart separately
- After ANY secret change, always `--verify` to confirm it took effect
