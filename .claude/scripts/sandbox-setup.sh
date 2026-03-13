#!/usr/bin/env bash
# sandbox-setup.sh — Run at the start of every agent sandbox session.
# Ensures consistent tooling, auth, dependency versions, branch state,
# and test infrastructure (Playwright + system deps).
#
# Works in both GKE Autopilot containers and local worktree sandboxes.
#
# Usage: bash .claude/scripts/sandbox-setup.sh [BRANCH_NAME]
#
# If BRANCH_NAME is provided:
#   - checks out the branch if it exists on the remote
#   - creates it from main if it doesn't
# If omitted, stays on whatever branch is current.
set -euo pipefail

echo "=== Fenrir Sandbox Setup ==="

# Detect environment
if [ -f "/.dockerenv" ] || [ -n "${KUBERNETES_SERVICE_HOST:-}" ]; then
  SANDBOX_ENV="container"
  echo "[info] running in container environment (GKE/Docker)"
else
  SANDBOX_ENV="local"
  echo "[info] running in local environment"
fi

# 0. Ensure we're at the repo root
REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"
echo "[ok] repo root: $REPO_ROOT"

# 1. Git identity — required for commits in sandboxes
git config user.email "firemandecko@fenrir-ledger.dev"
git config user.name "FiremanDecko (GKE Agent)"
echo "[ok] git identity configured"

# 2. Git credential helper — required for git push in Depot sandboxes
gh auth setup-git
echo "[ok] git credentials configured"

# 3. Branch setup — create or checkout
BRANCH="${1:-}"
if [ -n "$BRANCH" ]; then
  git fetch origin --prune
  if git branch -r | grep -q "origin/${BRANCH}$"; then
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
    # Rebase on main to avoid stale-branch merge conflicts.
    # Agents run in parallel — main moves while branches are in flight.
    git rebase origin/main || {
      echo "[WARN] rebase conflict — attempting resolution"
      git rebase --abort
      echo "[FAIL] auto-rebase failed. Agent must rebase manually."
    }
    echo "[ok] checked out existing branch: $BRANCH (rebased on main)"
  else
    git checkout -b "$BRANCH"
    git push -u origin "$BRANCH"
    echo "[ok] created new branch: $BRANCH"
  fi
fi

# 4. Install frontend dependencies from lockfile (exact versions)
cd "$REPO_ROOT/development/frontend"
npm ci --prefer-offline 2>/dev/null || npm ci
echo "[ok] frontend dependencies installed from lockfile"

# 5. Playwright setup — tests live in quality/test-suites/ but node_modules
#    is in development/frontend/. Symlink so Node can resolve @playwright/test.
if [ ! -e "$REPO_ROOT/quality/node_modules" ]; then
  ln -s "$REPO_ROOT/development/frontend/node_modules" "$REPO_ROOT/quality/node_modules"
  echo "[ok] quality/node_modules symlinked to frontend"
fi

# 6. Install Playwright browsers + system deps (Chromium only for speed)
npx playwright install --with-deps chromium 2>/dev/null || npx playwright install chromium
echo "[ok] Playwright chromium installed"

# 7. Verify critical versions
NEXT_VER=$(npx next --version 2>/dev/null || echo "unknown")
NODE_VER=$(node -v)
echo "[ok] Node ${NODE_VER}, Next.js ${NEXT_VER}"

# 8. Print repo root so the agent knows where to cd for subsequent commands
cd "$REPO_ROOT"
echo ""
echo "REPO_ROOT=$REPO_ROOT"
echo ""
echo "=== Setup Complete ==="
echo "IMPORTANT: Each shell command runs in a fresh shell. Always prefix commands with:"
echo "  cd $REPO_ROOT && <your command>"
