#!/usr/bin/env bash
# stripe.sh — manage Stripe CLI webhook forwarding
set -euo pipefail

APP_PORT="${FENRIR_FRONTEND_PORT:-9653}"
REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
LEDGER_DIR="${FENRIR_LEDGER_DIR:-$REPO_ROOT/development/ledger}"
LOG_DIR="${LEDGER_DIR}/logs"
mkdir -p "$LOG_DIR"
LOG="${LOG_DIR}/stripe-listen.log"
PID_FILE="${LEDGER_DIR}/.stripe-listen.pid"
ENV_FILE="${LEDGER_DIR}/.env.local"
STRIPE_OVERRIDE="${LEDGER_DIR}/.env.stripe-listen"

pid() {
  if [[ -f "$PID_FILE" ]]; then
    local p; p=$(cat "$PID_FILE")
    kill -0 "$p" 2>/dev/null && echo "$p" && return 0
    rm -f "$PID_FILE"
  fi
  return 1
}

get_stripe_key() {
  [[ -f "$ENV_FILE" ]] && grep "^STRIPE_SECRET_KEY=" "$ENV_FILE" | cut -d= -f2- | tr -d '"'
}

case "${1:-status}" in
  start)
    if p=$(pid); then
      echo "stripe: already running (pid $p)"
      exit 0
    fi
    if ! command -v stripe &>/dev/null; then
      echo "stripe: ERROR — Stripe CLI not installed. Run: brew install stripe/stripe-cli/stripe"
      exit 1
    fi
    STRIPE_KEY=$(get_stripe_key)
    if [[ -z "$STRIPE_KEY" ]]; then
      echo "stripe: ERROR — STRIPE_SECRET_KEY not found in $ENV_FILE"
      exit 1
    fi
    echo "Starting Stripe webhook forwarding..."
    > "$LOG"
    stripe listen \
      --api-key "$STRIPE_KEY" \
      --forward-to "http://localhost:${APP_PORT}/api/stripe/webhook" \
      >> "$LOG" 2>&1 &
    echo $! > "$PID_FILE"
    # Wait for ephemeral webhook secret
    local_secret=""
    for _ in $(seq 1 15); do
      local_secret=$(sed -n 's/.*Your webhook signing secret is \(whsec_[a-zA-Z0-9_]*\).*/\1/p' "$LOG" 2>/dev/null | head -1)
      [[ -n "$local_secret" ]] && break
      sleep 1
    done
    if [[ -n "$local_secret" ]]; then
      # Write to separate override file — NEVER touch .env.local
      echo "STRIPE_WEBHOOK_SECRET=\"${local_secret}\"" > "$STRIPE_OVERRIDE"
      echo "stripe: running (webhook secret in .env.stripe-listen)"
    else
      echo "stripe: WARNING — could not detect webhook secret after 15s"
    fi
    ;;
  stop)
    if p=$(pid); then
      kill "$p" 2>/dev/null
      rm -f "$PID_FILE"
      rm -f "$STRIPE_OVERRIDE"
      echo "stripe: stopped"
    else
      echo "stripe: not running"
    fi
    ;;
  status)
    if p=$(pid); then
      echo "stripe: running (pid $p)"
    else
      echo "stripe: not running"
    fi
    ;;
  logs)
    tail -f "$LOG"
    ;;
  *)
    echo "Usage: stripe.sh {start|stop|status|logs}"
    exit 1
    ;;
esac
