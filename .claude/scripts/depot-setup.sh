#!/usr/bin/env bash
# DEPRECATED — Depot is being replaced by GKE Autopilot K8s Jobs.
# Use scripts/gke-setup.sh instead.
# This script remains for backward compatibility during migration.
#
# depot-setup.sh — One-time Depot remote builder setup for Fenrir Ledger
#
# This script configures the Depot CLI for remote agent sandboxes.
# Run once on Odin's machine after cloning the repo.
#
# Prerequisites:
#   - Internet access
#   - .env file with DEPOT_ORG_ID and DEPOT_TOKEN set
#   - Claude Code installed (for `claude setup-token`)
#
# Usage:
#   .claude/scripts/depot-setup.sh
#
# Ref: ADR-007 (architecture/adrs/ADR-007-remote-builder-platforms.md)
#      GitHub Issue #192

echo "⚠  DEPRECATED: Depot is being replaced by GKE Autopilot. Use 'bash scripts/gke-setup.sh' instead."
echo ""

set -euo pipefail

# ── Resolve repo root (always main worktree, never a sub-worktree) ──────────
REPO_ROOT="$(git worktree list --porcelain | head -1 | sed 's/^worktree //')"
ENV_FILE="${REPO_ROOT}/.env"

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $*"; exit 1; }

# ── Step 1: Check/Install Depot CLI ─────────────────────────────────────────
info "Step 1: Checking Depot CLI installation..."

if command -v depot &>/dev/null; then
    DEPOT_VERSION=$(depot --version 2>&1 || echo "unknown")
    ok "Depot CLI found: ${DEPOT_VERSION}"
else
    info "Depot CLI not found. Installing..."
    if curl -L https://depot.dev/install-cli.sh | sh; then
        ok "Depot CLI installed."
    else
        fail "Failed to install Depot CLI. Install manually: https://depot.dev/docs/cli/installation"
    fi
fi

# ── Step 2: Load .env ──────────────────────────────────────────────────────
info "Step 2: Loading environment from ${ENV_FILE}..."

if [[ ! -f "$ENV_FILE" ]]; then
    fail ".env file not found at ${ENV_FILE}. Copy from .env.example and fill in values."
fi

# Source only the variables we need (safe subset)
DEPOT_ORG_ID=""
DEPOT_TOKEN=""

while IFS='=' read -r key value; do
    # Skip comments and empty lines
    [[ "$key" =~ ^[[:space:]]*# ]] && continue
    [[ -z "$key" ]] && continue
    # Trim whitespace
    key=$(echo "$key" | xargs)
    value=$(echo "$value" | xargs)
    case "$key" in
        DEPOT_ORG_ID)  DEPOT_ORG_ID="$value" ;;
        DEPOT_TOKEN)   DEPOT_TOKEN="$value" ;;
    esac
done < "$ENV_FILE"

if [[ -z "$DEPOT_ORG_ID" ]]; then
    fail "DEPOT_ORG_ID not set in .env. Add: DEPOT_ORG_ID=pqtm7s538l"
fi
ok "DEPOT_ORG_ID loaded (${DEPOT_ORG_ID})"

if [[ -z "$DEPOT_TOKEN" ]]; then
    warn "DEPOT_TOKEN not set in .env. You may need to run 'depot login' or set it manually."
    info "Attempting 'depot login'..."
    if depot login; then
        ok "Depot login successful."
    else
        fail "Depot login failed. Set DEPOT_TOKEN in .env or run 'depot login' manually."
    fi
else
    # Mask the token for display (first 4 + last 4)
    TOKEN_LEN=${#DEPOT_TOKEN}
    if (( TOKEN_LEN > 8 )); then
        MASKED="${DEPOT_TOKEN:0:4}$(printf 'x%.0s' $(seq 1 $((TOKEN_LEN - 8))))${DEPOT_TOKEN: -4}"
    else
        MASKED="****"
    fi
    ok "DEPOT_TOKEN loaded (${MASKED})"
fi

# ── Step 3: Verify Depot connection ─────────────────────────────────────────
info "Step 3: Verifying Depot org access..."

export DEPOT_TOKEN
if depot claude list-sessions --org "$DEPOT_ORG_ID" --output json &>/dev/null; then
    ok "Depot org access verified. Can list sessions."
else
    warn "Could not list sessions. This may be expected if no sessions exist yet."
    info "Verify manually: depot claude list-sessions --org ${DEPOT_ORG_ID} --output json"
fi

# ── Step 4: Check Claude OAuth token in Depot secrets ───────────────────────
info "Step 4: Checking Depot org secrets..."

# We cannot read secret values, only check if they exist
info "Listing Depot secrets (names only)..."
if depot claude secrets list --org "$DEPOT_ORG_ID" 2>&1 | grep -q "CLAUDE_CODE_OAUTH_TOKEN"; then
    ok "CLAUDE_CODE_OAUTH_TOKEN is configured in Depot secrets."
else
    warn "CLAUDE_CODE_OAUTH_TOKEN not found in Depot secrets."
    echo ""
    echo "  To add it:"
    echo "  1. Generate a token:  claude setup-token"
    echo "  2. Add to Depot:      depot claude secrets add CLAUDE_CODE_OAUTH_TOKEN"
    echo "     (you will be prompted to enter the token value)"
    echo ""
fi

# ── Step 5: Check GIT_CREDENTIALS in Depot secrets ─────────────────────────
if depot claude secrets list --org "$DEPOT_ORG_ID" 2>&1 | grep -q "GIT_CREDENTIALS"; then
    ok "GIT_CREDENTIALS is configured in Depot secrets."
else
    warn "GIT_CREDENTIALS not found in Depot secrets."
    echo ""
    echo "  To add it (GitHub PAT with repo scope):"
    echo "  depot claude secrets add GIT_CREDENTIALS"
    echo "  (you will be prompted to enter the token value)"
    echo ""
fi

# ── Step 6: Test sandbox launch (dry run) ──────────────────────────────────
info "Step 6: Verifying sandbox can launch..."

echo ""
echo "  To test a sandbox manually:"
echo ""
echo "  depot claude \\"
echo "    --org ${DEPOT_ORG_ID} \\"
echo "    --session-id test-setup-$(date +%s) \\"
echo "    --repository https://github.com/declanshanaghy/fenrir-ledger \\"
echo "    --branch main \\"
echo "    -p \"Run 'echo hello from depot' and exit\""
echo ""

# ── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════════════"
echo ""
info "Depot setup summary:"
echo ""
echo "  Depot CLI:              $(command -v depot 2>/dev/null || echo 'NOT FOUND')"
echo "  Org ID:                 ${DEPOT_ORG_ID}"
echo "  Token:                  ${DEPOT_TOKEN:+configured}${DEPOT_TOKEN:-NOT SET}"
echo "  Repo:                   https://github.com/declanshanaghy/fenrir-ledger"
echo ""
echo "  Next steps:"
echo "  1. If secrets are missing, add them with 'depot claude secrets add'"
echo "  2. Run a test sandbox (command above)"
echo "  3. Use '/fire-next-up' to dispatch agent chains to Depot"
echo "  4. Use '/fire-next-up --local' for local worktree fallback"
echo ""
echo "════════════════════════════════════════════════════════════════════"
ok "Depot setup check complete."
