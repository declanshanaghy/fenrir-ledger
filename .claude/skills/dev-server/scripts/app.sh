#!/usr/bin/env bash
# app.sh — manage the Next.js dev server (vercel dev)
set -euo pipefail

PORT="${FENRIR_FRONTEND_PORT:-9653}"
REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
FRONTEND_DIR="${FENRIR_FRONTEND_DIR:-$REPO_ROOT/development/frontend}"
LOG_DIR="${FRONTEND_DIR}/logs"
mkdir -p "$LOG_DIR"
LOG="${LOG_DIR}/frontend-server.log"
PORT_FILE="${FRONTEND_DIR}/.port"

pid() {
  lsof -ti "TCP:$PORT" -sTCP:LISTEN 2>/dev/null | head -1
}

case "${1:-status}" in
  start)
    if p=$(pid); then
      echo "app: already running (pid $p) on port $PORT"
      exit 0
    fi
    echo "Starting Next.js dev server on port $PORT..."
    > "$LOG"
    nohup bash -c "cd '$REPO_ROOT' && npx vercel dev --listen $PORT --yes" >> "$LOG" 2>&1 &
    echo "$PORT" > "$PORT_FILE"
    for _ in $(seq 1 15); do
      grep -q "Ready" "$LOG" 2>/dev/null && break
      sleep 1
    done
    echo "app: running on port $PORT"
    ;;
  stop)
    if p=$(pid); then
      kill "$p" 2>/dev/null
      rm -f "$PORT_FILE"
      echo "app: stopped"
    else
      echo "app: not running"
    fi
    ;;
  status)
    if p=$(pid); then
      echo "app: running (pid $p) on port $PORT"
    else
      echo "app: not running"
    fi
    ;;
  logs)
    tail -f "$LOG"
    ;;
  *)
    echo "Usage: app.sh {start|stop|status|logs}"
    exit 1
    ;;
esac
