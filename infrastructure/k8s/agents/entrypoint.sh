#!/usr/bin/env bash
# --------------------------------------------------------------------------
# Agent Sandbox Entrypoint — Fenrir Ledger
#
# Runs inside the agent sandbox container on GKE Autopilot.
# 1. Configures git auth via GH_TOKEN
# 2. Clones the repository
# 3. Runs sandbox-setup.sh for branch checkout + deps
# 4. Invokes Claude Code CLI with the task prompt
#
# Required environment variables:
#   CLAUDE_CODE_OAUTH_TOKEN — OAuth subscription token (injected via K8s Secret)
#   GH_TOKEN                — GitHub token for repo access (injected via K8s Secret)
#   REPO_URL          — Repository URL (default: fenrir-ledger)
#   BRANCH            — Branch to checkout/create
#   AGENT_MODEL       — Claude model to use
#   TASK_PROMPT       — The agent task prompt (injected via ConfigMap or env)
#   SESSION_ID        — Unique session identifier for logging
#
# Optional:
#   SKIP_PERMISSIONS  — If "true", passes --dangerously-skip-permissions
# --------------------------------------------------------------------------
set -euo pipefail

echo "=== Agent Sandbox Entrypoint ==="
echo "Session: ${SESSION_ID:-unknown}"
echo "Branch: ${BRANCH:-main}"
echo "Model: ${AGENT_MODEL:-claude-sonnet-4-6}"

# --------------------------------------------------------------------------
# 1. Configure git authentication
# --------------------------------------------------------------------------
if [ -z "${GH_TOKEN:-}" ]; then
  echo "[FATAL] GH_TOKEN not set. Cannot authenticate."
  exit 1
fi

# Configure gh CLI auth
echo "${GH_TOKEN}" | gh auth login --with-token
gh auth setup-git
echo "[ok] git credentials configured"

# Git identity for commits
git config --global user.email "firemandecko@fenrir-ledger.dev"
git config --global user.name "FiremanDecko (GKE Agent)"

# --------------------------------------------------------------------------
# 2. Clone repository
# --------------------------------------------------------------------------
REPO_URL="${REPO_URL:-https://github.com/declanshanaghy/fenrir-ledger}"
echo "Cloning ${REPO_URL}..."
git clone "${REPO_URL}" /workspace/repo
cd /workspace/repo
echo "[ok] repository cloned"

# --------------------------------------------------------------------------
# 3. Branch setup (mirrors sandbox-setup.sh logic)
# --------------------------------------------------------------------------
BRANCH="${BRANCH:-main}"
git fetch origin --prune

if git branch -r | grep -q "origin/${BRANCH}$"; then
  git checkout "${BRANCH}"
  git pull origin "${BRANCH}"
  git rebase origin/main || {
    echo "[WARN] rebase conflict — aborting rebase, continuing on branch"
    git rebase --abort || true
  }
  echo "[ok] checked out existing branch: ${BRANCH}"
else
  git checkout -b "${BRANCH}"
  git push -u origin "${BRANCH}"
  echo "[ok] created new branch: ${BRANCH}"
fi

# --------------------------------------------------------------------------
# 4. Install frontend dependencies
# --------------------------------------------------------------------------
cd /workspace/repo/development/frontend
npm ci --prefer-offline 2>/dev/null || npm ci
echo "[ok] frontend dependencies installed"
cd /workspace/repo

# --------------------------------------------------------------------------
# 5. Handle Spot/preemptible pod eviction gracefully
# --------------------------------------------------------------------------
cleanup_on_eviction() {
  echo "[WARN] Received termination signal — committing work in progress"
  cd /workspace/repo
  git add -A
  git diff --cached --quiet || {
    git commit -m "wip: auto-save before pod eviction — session:${SESSION_ID:-unknown}"
    git push origin "${BRANCH}" || echo "[WARN] push failed during eviction cleanup"
  }
  echo "[ok] eviction cleanup complete"
  exit 0
}

# SIGTERM is sent by Kubernetes before pod termination (30s grace period)
trap cleanup_on_eviction SIGTERM SIGINT

# --------------------------------------------------------------------------
# 6. Validate required env vars
# --------------------------------------------------------------------------
if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
  echo "[FATAL] CLAUDE_CODE_OAUTH_TOKEN not set. Cannot run Claude."
  echo "  Generate with: claude setup-token"
  exit 1
fi

if [ -z "${TASK_PROMPT:-}" ]; then
  echo "[FATAL] TASK_PROMPT not set. No task to execute."
  exit 1
fi

# Decode base64-encoded prompt (dispatch-job.sh encodes to avoid YAML issues)
DECODED_PROMPT=$(echo "${TASK_PROMPT}" | base64 -d 2>/dev/null) || {
  # If decode fails, assume prompt is plaintext (backward compat)
  DECODED_PROMPT="${TASK_PROMPT}"
  echo "[WARN] TASK_PROMPT is not base64-encoded — using as plaintext"
}

# --------------------------------------------------------------------------
# 7. Run Claude Code CLI
# --------------------------------------------------------------------------
AGENT_MODEL="${AGENT_MODEL:-claude-sonnet-4-6}"
CLAUDE_ARGS=(
  "--model" "${AGENT_MODEL}"
  "--print"
  "-p" "${DECODED_PROMPT}"
)

if [ "${SKIP_PERMISSIONS:-false}" = "true" ]; then
  CLAUDE_ARGS+=("--dangerously-skip-permissions")
fi

echo "=== Starting Claude Code ==="
echo "Model: ${AGENT_MODEL}"
echo "Session: ${SESSION_ID:-unknown}"
echo "Working directory: $(pwd)"

# Run Claude Code — output goes to stdout (captured by kubectl logs / Cloud Logging)
exec claude "${CLAUDE_ARGS[@]}"
