# Fenrir Ledger — Project Commands
# Run `just --list` to see all available recipes.

set dotenv-load := false
set shell := ["bash", "-euo", "pipefail", "-c"]

repo_root := justfile_directory()
frontend   := repo_root / "development" / "frontend"
scripts    := repo_root / "scripts"
quality    := repo_root / "quality" / "scripts"
k8s_agents := repo_root / "infrastructure" / "k8s" / "agents"
services   := repo_root / ".claude" / "scripts" / "services.sh"
pack       := repo_root / ".claude" / "skills" / "fire-next-up" / "scripts" / "pack-status.mjs"

# ── Dev Environment ─────────────────────────────────────────────────────────

# Start local dev server (Next.js + Stripe webhooks)
dev:
    bash "{{services}}" start

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

# ── Build & Verify ──────────────────────────────────────────────────────────

# Run TypeScript type checking
tsc:
    bash "{{quality}}/verify.sh" --step tsc

# Run Next.js production build
build:
    bash "{{quality}}/verify.sh" --step build

# Run tsc + build
check: tsc build

# Run unit tests (Vitest)
test-unit:
    bash "{{quality}}/verify.sh" --step unit

# Run E2E tests (Playwright)
test-e2e:
    bash "{{quality}}/verify.sh" --step e2e

# Run a specific Playwright test suite by slug
test-suite slug:
    bash "{{quality}}/verify.sh" --step test -x "{{slug}}"

# Run full verification (tsc + build + all tests)
verify:
    bash "{{quality}}/verify.sh"

# Run full verification, stop on first failure
verify-fast:
    bash "{{quality}}/verify.sh" --fail-fast

# ── Code Coverage ───────────────────────────────────────────────────────────

# Generate unit test coverage (Vitest only)
coverage-unit:
    node "{{quality}}/coverage.mjs" --unit-only

# Generate E2E coverage (Playwright only)
coverage-e2e:
    node "{{quality}}/coverage.mjs" --e2e-only

# Generate combined coverage (Vitest + Playwright)
coverage:
    node "{{quality}}/coverage.mjs"

# Merge existing coverage reports into combined
coverage-combine:
    node "{{quality}}/coverage-combine.mjs"

# Generate coverage index page
coverage-index:
    node "{{quality}}/coverage-index.mjs"

# ── QA ──────────────────────────────────────────────────────────────────────

# Run Loki's test bloat critique
qa-critique:
    bash "{{quality}}/loki-critique.sh"

# Dry-run test bloat critique (stdout only)
qa-critique-dry:
    bash "{{quality}}/loki-critique.sh" --dry-run

# Show route coverage table per test suite
qa-routes:
    bash "{{quality}}/loki-critique.sh" --pattern-check

# ── GKE / Kubernetes ────────────────────────────────────────────────────────

# Show full GKE cluster + app status
gke-status:
    bash "{{scripts}}/gke-status.sh"

# Configure local kubectl for GKE Autopilot (one-time)
gke-setup:
    bash "{{scripts}}/gke-setup.sh"

# Bootstrap IAM roles for deploy service account
gke-bootstrap-iam project_id="fenrir-ledger-prod":
    bash "{{scripts}}/bootstrap-iam.sh" "{{project_id}}"

# List agent jobs in GKE
agent-jobs:
    kubectl get jobs -n fenrir-agents --sort-by=.metadata.creationTimestamp \
      -o custom-columns='NAME:.metadata.name,STATUS:.status.conditions[0].type,CREATED:.metadata.creationTimestamp'

# List active (running) agent jobs
agent-jobs-active:
    kubectl get jobs -n fenrir-agents \
      -o jsonpath='{range .items[?(@.status.active)]}{.metadata.name}{"\n"}{end}'

# ── Agent Logs ──────────────────────────────────────────────────────────────

# Stream parsed logs for an agent by session ID
agent-log session_id:
    node "{{k8s_agents}}/agent-logs.mjs" "{{session_id}}"

# Stream parsed logs for the latest agent job on an issue
agent-log-issue issue:
    node "{{k8s_agents}}/agent-logs.mjs" --issue "{{issue}}"

# Stream logs with tool calls visible
agent-log-verbose session_id:
    node "{{k8s_agents}}/agent-logs.mjs" "{{session_id}}" --tools

# Stream logs with tool calls + thinking
agent-log-debug session_id:
    node "{{k8s_agents}}/agent-logs.mjs" "{{session_id}}" --tools --thinking

# Dump finished agent logs (no follow)
agent-log-dump session_id:
    node "{{k8s_agents}}/agent-logs.mjs" "{{session_id}}" --no-follow --tools

# Stream all active agent logs in tmux panes
agent-log-all:
    node "{{k8s_agents}}/agent-logs.mjs" --all --tmux

# Show raw JSONL for an agent session
agent-log-raw session_id:
    node "{{k8s_agents}}/agent-logs.mjs" "{{session_id}}" --raw

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

# ── Agent Reports ──────────────────────────────────────────────────────────

# List saved agent log files
agent-logs-list:
    @ls -lht "{{repo_root}}/tmp/agent-logs/"*.log 2>/dev/null || echo "No agent logs in tmp/agent-logs/"

# ── Utilities ───────────────────────────────────────────────────────────────

# Generate a 256-bit encryption key
gen-key:
    bash "{{quality}}/generate-encryption-key.sh"

# Install Fenrir terminal skin (iTerm2/Ghostty/WezTerm)
terminal-install:
    bash "{{repo_root}}/terminal/install.sh"

# Clean build artifacts and coverage reports
clean:
    rm -rf "{{frontend}}/.next" "{{frontend}}/out" quality/reports/
