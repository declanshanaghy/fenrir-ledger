#!/usr/bin/env bash
# monitor.sh — manage the Odin's Throne monitor service
# Port 3001 — Hono/WebSocket agent monitor (development/monitor)
set -euo pipefail

PORT=3001
REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
MONITOR_DIR="$REPO_ROOT/development/monitor"
LOG_DIR="$MONITOR_DIR/logs"
mkdir -p "$LOG_DIR"
LOG="${LOG_DIR}/monitor.log"

pid() {
  lsof -ti "TCP:$PORT" -sTCP:LISTEN 2>/dev/null | head -1
}

case "${1:-status}" in
  start)
    if p=$(pid); then
      echo "monitor: already running (pid $p) on port $PORT"
      echo "  → http://localhost:$PORT/"
      exit 0
    fi
    echo "Starting monitor on port $PORT..."
    > "$LOG"
    nohup bash -c "cd '$MONITOR_DIR' && npx tsx watch src/index.ts" >> "$LOG" 2>&1 &
    # Wait for server to be listening
    for _ in $(seq 1 15); do
      pid >/dev/null 2>&1 && break
      sleep 1
    done
    if p=$(pid); then
      echo "monitor: running (pid $p) on port $PORT"
      echo "  → http://localhost:$PORT/"
    else
      echo "monitor: failed to start (check logs)"
    fi
    ;;
  stop)
    if p=$(pid); then
      kill "$p" 2>/dev/null
      echo "monitor: stopped"
    else
      echo "monitor: not running"
    fi
    ;;
  status)
    if p=$(pid); then
      echo "monitor: running (pid $p) on port $PORT"
      echo "  → http://localhost:$PORT/"
    else
      echo "monitor: not running"
    fi
    ;;
  logs)
    tail -f "$LOG"
    ;;
  *)
    echo "Usage: monitor.sh {start|stop|status|logs}"
    exit 1
    ;;
esac
