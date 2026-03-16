#!/usr/bin/env bash
# services.sh — manage the Fenrir Ledger local development environment
#
# Starts vercel dev (with Vercel Development env vars) and Stripe CLI
# webhook forwarding. The Stripe ephemeral webhook secret is automatically
# captured and injected into .env.local before the server starts.
#
# Usage:
#   services.sh start   — start stripe listen + vercel dev
#   services.sh stop    — stop everything, restore original webhook secret
#   services.sh restart — stop then start
#   services.sh status  — show status of all services
#   services.sh logs    — tail the frontend log
#
# Environment overrides (for worktrees):
#   FENRIR_FRONTEND_PORT — port to listen on (default: 9653)
#   FENRIR_FRONTEND_DIR  — path to development/frontend (default: auto-detected)
#
# Prerequisites:
#   - Stripe CLI: brew install stripe/stripe-cli/stripe
#   - Vercel CLI: npm i -g vercel (or npx)
#   - STRIPE_SECRET_KEY in .env.local (vercel env pull --environment=development)

set -euo pipefail

PORT="${FENRIR_FRONTEND_PORT:-${FENRIR_PORT:-9653}}"
FRONTEND_DIR="${FENRIR_FRONTEND_DIR:-${FENRIR_DEV_DIR:-$(cd "$(dirname "$0")/../../development/frontend" && pwd)}}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG_DIR="${FRONTEND_DIR}/logs"
mkdir -p "$LOG_DIR"

FRONTEND_LOG="${LOG_DIR}/frontend-server.log"
STRIPE_LOG="${LOG_DIR}/stripe-listen.log"
PORT_FILE="${FRONTEND_DIR}/.port"
STRIPE_PID_FILE="${FRONTEND_DIR}/.stripe-listen.pid"
ENV_FILE="${FRONTEND_DIR}/.env.local"
STRIPE_OVERRIDE="${FRONTEND_DIR}/.env.stripe-listen"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

actual_port() {
  if [[ -f "$PORT_FILE" ]]; then
    cat "$PORT_FILE"
  else
    echo "$PORT"
  fi
}

frontend_pid() {
  local p
  p=$(actual_port)
  [[ "$p" == "0" ]] && return 1
  lsof -ti "TCP:$p" -sTCP:LISTEN 2>/dev/null | head -1
}

stripe_pid() {
  if [[ -f "$STRIPE_PID_FILE" ]]; then
    local p
    p=$(cat "$STRIPE_PID_FILE")
    if kill -0 "$p" 2>/dev/null; then
      echo "$p"
      return 0
    fi
    rm -f "$STRIPE_PID_FILE"
  fi
  return 1
}

get_stripe_key() {
  [[ -f "$ENV_FILE" ]] && grep "^STRIPE_SECRET_KEY=" "$ENV_FILE" | cut -d= -f2- | tr -d '"'
}

# Wait for vercel dev to print its port (same format as next dev)
wait_for_port() {
  local timeout=30 elapsed=0
  while (( elapsed < timeout )); do
    if [[ -f "$FRONTEND_LOG" ]]; then
      local detected
      detected=$(sed -n 's/.*Local:[[:space:]]*http:\/\/localhost:\([0-9]*\).*/\1/p' "$FRONTEND_LOG" 2>/dev/null | head -1)
      if [[ -n "$detected" ]]; then
        echo "$detected" > "$PORT_FILE"
        echo "$detected"
        return 0
      fi
    fi
    sleep 1
    (( elapsed++ ))
  done
  return 1
}

# ---------------------------------------------------------------------------
# Start: stripe listen → inject secret → vercel dev
# ---------------------------------------------------------------------------

do_start() {
  # -- Check if already running --
  if p=$(frontend_pid); then
    echo "Frontend: already running (pid $p) on port $(actual_port)"
    stripe_pid >/dev/null 2>&1 && echo "Stripe listen: running (pid $(stripe_pid))"
    return 0
  fi

  # -- Prerequisites --
  if ! command -v stripe &>/dev/null; then
    echo "ERROR: Stripe CLI not installed. Run: brew install stripe/stripe-cli/stripe"
    exit 1
  fi

  STRIPE_KEY=$(get_stripe_key)
  if [[ -z "$STRIPE_KEY" ]]; then
    echo "ERROR: STRIPE_SECRET_KEY not found in $ENV_FILE"
    echo "Run: cd $FRONTEND_DIR && npx vercel env pull .env.local --environment=development"
    exit 1
  fi

  # -- 1. Start stripe listen --
  echo "Starting Stripe webhook forwarding..."
  > "$STRIPE_LOG"
  stripe listen \
    --api-key "$STRIPE_KEY" \
    --forward-to "http://localhost:${PORT}/api/stripe/webhook" \
    >> "$STRIPE_LOG" 2>&1 &
  echo $! > "$STRIPE_PID_FILE"

  # Wait for ephemeral webhook secret
  local_secret=""
  for _ in $(seq 1 15); do
    local_secret=$(sed -n 's/.*Your webhook signing secret is \(whsec_[a-zA-Z0-9_]*\).*/\1/p' "$STRIPE_LOG" 2>/dev/null | head -1)
    [[ -n "$local_secret" ]] && break
    sleep 1
  done

  if [[ -z "$local_secret" ]]; then
    echo "ERROR: Could not detect Stripe webhook secret after 15s. Check $STRIPE_LOG"
    stripe_pid >/dev/null 2>&1 && kill "$(stripe_pid)"
    rm -f "$STRIPE_PID_FILE"
    exit 1
  fi

  # -- 2. Write ephemeral secret to separate override file (NEVER touch .env.local) --
  echo "STRIPE_WEBHOOK_SECRET=\"${local_secret}\"" > "$STRIPE_OVERRIDE"
  echo "Stripe listen: running (webhook secret in .env.stripe-listen)"

  # -- 3. Start vercel dev (with stripe override if present) --
  echo "Starting frontend (vercel dev) on port ${PORT}..."
  > "$FRONTEND_LOG"
  STRIPE_ENV=""
  if [[ -f "$STRIPE_OVERRIDE" ]]; then
    STRIPE_ENV="export $(grep -v '^#' "$STRIPE_OVERRIDE" | xargs) &&"
  fi
  nohup bash -c "${STRIPE_ENV} cd '$REPO_ROOT' && npx vercel dev --listen $PORT" >> "$FRONTEND_LOG" 2>&1 &

  if [[ "$PORT" == "0" ]]; then
    ACTUAL=$(wait_for_port)
    if [[ -z "$ACTUAL" ]]; then
      echo "ERROR: Could not detect port after 30s. Check $FRONTEND_LOG"
      exit 1
    fi
    echo "Frontend: running on port $ACTUAL"
  else
    echo "$PORT" > "$PORT_FILE"
    # Wait briefly for ready confirmation
    for _ in $(seq 1 10); do
      grep -q "Ready" "$FRONTEND_LOG" 2>/dev/null && break
      sleep 1
    done
    echo "Frontend: running on port $PORT"
  fi

  echo ""
  echo "Local dev environment ready:"
  echo "  App:      http://localhost:${PORT}"
  echo "  Webhooks: Stripe → localhost:${PORT}/api/stripe/webhook"
}

# ---------------------------------------------------------------------------
# Stop: kill everything, restore webhook secret
# ---------------------------------------------------------------------------

do_stop() {
  # Stop stripe listen
  if p=$(stripe_pid); then
    kill "$p" 2>/dev/null
    rm -f "$STRIPE_PID_FILE"
    echo "Stripe listen: stopped"
  fi

  rm -f "$STRIPE_OVERRIDE"

  # Stop frontend
  if p=$(frontend_pid); then
    kill "$p" 2>/dev/null
    echo "Frontend: stopped"
  fi
  rm -f "$PORT_FILE"
}

# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------

do_status() {
  if p=$(frontend_pid); then
    echo "Frontend: running (pid $p) on port $(actual_port)"
  else
    echo "Frontend: not running"
  fi

  if p=$(stripe_pid); then
    echo "Stripe listen: running (pid $p)"
  else
    echo "Stripe listen: not running"
  fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

case "${1:-}" in
  start)
    do_start
    ;;
  stop)
    do_stop
    ;;
  restart)
    do_stop
    sleep 1
    do_start
    ;;
  status)
    do_status
    ;;
  logs)
    tail -f "$FRONTEND_LOG"
    ;;
  stripe-logs)
    tail -f "$STRIPE_LOG"
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs|stripe-logs}"
    echo ""
    echo "  start        Start Stripe webhook forwarding + frontend (vercel dev)"
    echo "  stop         Stop everything, restore webhook secret"
    echo "  restart      Stop then start"
    echo "  status       Show status of all services"
    echo "  logs         Tail frontend log"
    echo "  stripe-logs  Tail Stripe webhook log"
    exit 1
    ;;
esac
