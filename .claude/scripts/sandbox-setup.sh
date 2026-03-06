#!/usr/bin/env bash
# sandbox-setup.sh — Run at the start of every Depot sandbox session.
# Ensures consistent tooling, auth, dependency versions, and branch state.
#
# Usage: bash .claude/scripts/sandbox-setup.sh [BRANCH_NAME]
#
# If BRANCH_NAME is provided:
#   - checks out the branch if it exists on the remote
#   - creates it from main if it doesn't
# If omitted, stays on whatever branch is current.
set -euo pipefail

echo "=== Fenrir Sandbox Setup ==="

# 0. Ensure we're at the repo root (Depot clones into /workspace)
REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"
echo "[ok] repo root: $REPO_ROOT"

# 1. Git identity — required for commits in Depot sandboxes
git config user.email "firemandecko@fenrir-ledger.dev"
git config user.name "FiremanDecko (Depot)"
echo "[ok] git identity configured"

# 2. Git credential helper — required for git push in Depot sandboxes
gh auth setup-git
echo "[ok] git credentials configured"

# 3. Branch setup — create or checkout
BRANCH="${1:-}"
if [ -n "$BRANCH" ]; then
  git fetch origin
  if git branch -r | grep -q "origin/${BRANCH}$"; then
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
    echo "[ok] checked out existing branch: $BRANCH"
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

# 5. Verify critical versions
NEXT_VER=$(npx next --version 2>/dev/null || echo "unknown")
NODE_VER=$(node -v)
echo "[ok] Node ${NODE_VER}, Next.js ${NEXT_VER}"

# 6. Return to repo root so the agent starts in the right place
cd "$REPO_ROOT"
echo "=== Setup Complete ==="
