#!/usr/bin/env bash
# monitor-ui.sh — manage the Odin's Throne React UI (Vite dev server)
# Port 3002 — Vite HMR dev server, proxies API/WS to monitor-api on 3001
set -euo pipefail

PORT=3002
REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
UI_DIR="$REPO_ROOT/development/monitor-ui"
LOG_DIR="$UI_DIR/logs"
mkdir -p "$LOG_DIR"
LOG="${LOG_DIR}/monitor-ui.log"

pid() {
  lsof -ti "TCP:$PORT" -sTCP:LISTEN 2>/dev/null | head -1
}

case "${1:-status}" in
  start)
    if p=$(pid); then
      echo "monitor-ui: already running (pid $p) on port $PORT"
      echo "  → http://localhost:$PORT/"
      exit 0
    fi
    echo "Starting monitor-ui on port $PORT..."
    > "$LOG"
    nohup bash -c "cd '$UI_DIR' && npx vite --port $PORT" >> "$LOG" 2>&1 &
    # Wait for server to be listening
    for _ in $(seq 1 15); do
      pid >/dev/null 2>&1 && break
      sleep 1
    done
    if p=$(pid); then
      echo "monitor-ui: running (pid $p) on port $PORT"
      echo "  → http://localhost:$PORT/"
    else
      echo "monitor-ui: failed to start (check logs)"
    fi
    ;;
  stop)
    if p=$(pid); then
      kill "$p" 2>/dev/null
      echo "monitor-ui: stopped"
    else
      echo "monitor-ui: not running"
    fi
    ;;
  status)
    if p=$(pid); then
      echo "monitor-ui: running (pid $p) on port $PORT"
      echo "  → http://localhost:$PORT/"
    else
      echo "monitor-ui: not running"
    fi
    ;;
  logs)
    tail -f "$LOG"
    ;;
  *)
    echo "Usage: monitor-ui.sh {start|stop|status|logs}"
    exit 1
    ;;
esac
