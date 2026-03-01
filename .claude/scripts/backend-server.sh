#!/usr/bin/env bash
# backend-server.sh — start, stop, or restart the Fenrir Ledger backend server (Node/TS)
#
# Environment overrides (for worktrees):
#   FENRIR_BACKEND_PORT — port to listen on       (default: 9753)
#   FENRIR_BACKEND_DIR  — path to backend root     (default: auto-detected relative to this script)

set -euo pipefail

PORT="${FENRIR_BACKEND_PORT:-9753}"
BACKEND_DIR="${FENRIR_BACKEND_DIR:-$(cd "$(dirname "$0")/../../development/backend" && pwd)}"
LOG_DIR="${BACKEND_DIR}/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="${LOG_DIR}/backend-server.log"

pid() { lsof -ti TCP:$PORT -sTCP:LISTEN 2>/dev/null | head -1; }

case "${1:-}" in
  start)
    if p=$(pid); then
      echo "Backend: already running (pid $p)"
      exit 0
    fi
    echo "Backend: starting on port $PORT (dir: $BACKEND_DIR)..."
    cd "$BACKEND_DIR"
    nohup npx tsx watch src/index.ts > "$LOG_FILE" 2>&1 &
    echo "Backend: started (pid $!). Logs: $LOG_FILE"
    ;;

  stop)
    if p=$(pid); then
      kill "$p"
      echo "Backend: stopped (pid $p)"
    else
      echo "Backend: not running"
    fi
    ;;

  restart)
    if p=$(pid); then
      kill "$p"
      echo "Backend: stopped (pid $p)"
      sleep 1
    fi
    echo "Backend: starting on port $PORT (dir: $BACKEND_DIR)..."
    cd "$BACKEND_DIR"
    nohup npx tsx watch src/index.ts > "$LOG_FILE" 2>&1 &
    echo "Backend: started (pid $!). Logs: $LOG_FILE"
    ;;

  status)
    if p=$(pid); then
      echo "Backend: running (pid $p) on port $PORT"
    else
      echo "Backend: not running"
    fi
    ;;

  logs)
    tail -f "$LOG_FILE"
    ;;

  *)
    echo "Usage: $0 {start|stop|restart|status|logs}"
    exit 1
    ;;
esac
