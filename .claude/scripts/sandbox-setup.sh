#!/usr/bin/env bash
# sandbox-setup.sh — Run at the start of every Depot sandbox session.
# Ensures consistent tooling, auth, and dependency versions.
set -euo pipefail

echo "=== Fenrir Sandbox Setup ==="

# 1. Git credential helper — required for git push in Depot sandboxes
gh auth setup-git
echo "[ok] git credentials configured"

# 2. Install frontend dependencies from lockfile (exact versions)
cd development/frontend
npm ci --prefer-offline 2>/dev/null || npm ci
echo "[ok] frontend dependencies installed from lockfile"

# 3. Verify critical versions
NEXT_VER=$(npx next --version 2>/dev/null || echo "unknown")
NODE_VER=$(node -v)
echo "[ok] Node ${NODE_VER}, Next.js ${NEXT_VER}"

cd - >/dev/null
echo "=== Setup Complete ==="
