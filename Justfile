# Fenrir Ledger — Project Commands
# Run `just --list` to see all available recipes.
# Run `just --list <module>` to see recipes in a submodule (e.g., `just --list frontend`).

set dotenv-load := false
set shell := ["bash", "-euo", "pipefail", "-c"]

repo_root := justfile_directory()
services  := repo_root / ".claude" / "scripts" / "services.sh"
scripts   := repo_root / "scripts"
pack      := repo_root / ".claude" / "skills" / "fire-next-up" / "scripts" / "pack-status.mjs"

# ── Submodules ─────────────────────────────────────────────────────────────

mod frontend 'development/frontend'
mod spear 'development/odins-spear'
mod quality 'quality'
mod infra 'infrastructure'

# ── Install ────────────────────────────────────────────────────────────────

# Install all workspace dependencies (pnpm)
install:
    cd "{{repo_root}}" && pnpm install

# ── Dev Environment ─────────────────────────────────────────────────────────

# Start local dev server (Next.js + Stripe webhooks)
dev:
    bash "{{services}}" start

# Start Odin's Throne monitor in local dev mode (tsx --watch HMR + live K8s via kubectl context)
dev-monitor:
    #!/usr/bin/env bash
    set -uo pipefail
    cd "{{repo_root}}/development/monitor"
    if [ -f .secrets ]; then
      set -a
      # shellcheck source=/dev/null
      source .secrets
      set +a
      echo "[dev-monitor] Loaded .secrets"
    else
      echo "[dev-monitor] WARNING: No .secrets file found at development/monitor/.secrets"
      echo "[dev-monitor]          Create it with: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET, ALLOWED_EMAIL"
      echo "[dev-monitor]          OAuth redirect URI must be: http://localhost:3001/auth/callback"
    fi
    ctx=$(kubectl config current-context 2>/dev/null || echo "NOT CONFIGURED — run: just infra gke-setup")
    echo "[dev-monitor] kubectl context: ${ctx}"
    echo "[dev-monitor] Starting Odin's Throne → http://localhost:3001"
    exec npm run dev

# Stop local dev server
dev-stop:
    bash "{{services}}" stop

# Restart local dev server
dev-restart:
    bash "{{services}}" restart

# Show dev server status
dev-status:
    bash "{{services}}" status

# Tail dev server logs
dev-logs:
    bash "{{services}}" logs

# Tail Stripe webhook logs
stripe-logs:
    bash "{{services}}" stripe-logs

# Run initial local development setup (idempotent)
setup:
    bash "{{repo_root}}/development/scripts/setup-local.sh"

# ── Pack Status (Project Board) ─────────────────────────────────────────────

# Show full pack status dashboard
pack-status:
    node "{{pack}}" --status

# Show prioritized Up Next queue
pack-peek:
    node "{{pack}}" --peek

# Show chain status for a specific issue
pack-chain issue:
    node "{{pack}}" --chain-status "{{issue}}"

# Detect resume position for an issue
pack-resume issue:
    node "{{pack}}" --resume-detect "{{issue}}"

# Move issue on project board (up-next, in-progress, done)
pack-move issue status:
    node "{{pack}}" --move "{{issue}}" "{{status}}"

# ── Secrets ─────────────────────────────────────────────────────────────────

# Audit all secrets (GitHub, K8s, .env.local)
secrets-audit:
    node "{{scripts}}/sync-secrets.mjs"

# Sync missing secrets from .env.local to GitHub/K8s
secrets-sync:
    node "{{scripts}}/sync-secrets.mjs" --sync

# Re-sync all secrets stripping embedded quotes
secrets-fix-quotes:
    node "{{scripts}}/sync-secrets.mjs" --fix-quotes

# ── Utilities ───────────────────────────────────────────────────────────────

# Install Fenrir terminal skin (iTerm2/Ghostty/WezTerm)
terminal-install:
    bash "{{repo_root}}/terminal/install.sh"

# Clean all build artifacts and coverage reports
clean:
    rm -rf "{{repo_root}}/development/frontend/.next" "{{repo_root}}/development/frontend/out" quality/reports/
