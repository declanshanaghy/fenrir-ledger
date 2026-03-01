#!/usr/bin/env bash
# dev-server.sh — start, stop, or restart the Fenrir Ledger dev server
#
# Environment overrides (for worktrees):
#   FENRIR_PORT    — port to listen on    (default: 9653)
#   FENRIR_DEV_DIR — path to development/frontend  (default: auto-detected relative to this script)

set -euo pipefail

PORT="${FENRIR_PORT:-9653}"
DEV_DIR="${FENRIR_DEV_DIR:-$(cd "$(dirname "$0")/../../development/frontend" && pwd)}"
LOG_DIR="${DEV_DIR}/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="${LOG_DIR}/dev-server.log"

pid() { lsof -ti TCP:$PORT -sTCP:LISTEN 2>/dev/null | head -1; }

case "${1:-}" in
  start)
    if p=$(pid); then
      echo "Already running (pid $p)"
      exit 0
    fi
    echo "Starting dev server on port $PORT (dir: $DEV_DIR)..."
    cd "$DEV_DIR"
    nohup npx next dev -p "$PORT" > "$LOG_FILE" 2>&1 &
    echo "Started (pid $!). Logs: $LOG_FILE"
    ;;

  stop)
    if p=$(pid); then
      kill "$p"
      echo "Stopped (pid $p)"
    else
      echo "Not running"
    fi
    ;;

  restart)
    if p=$(pid); then
      kill "$p"
      echo "Stopped (pid $p)"
      sleep 1
    fi
    echo "Starting dev server on port $PORT (dir: $DEV_DIR)..."
    cd "$DEV_DIR"
    nohup npx next dev -p "$PORT" > "$LOG_FILE" 2>&1 &
    echo "Started (pid $!). Logs: $LOG_FILE"
    ;;

  status)
    if p=$(pid); then
      echo "Running (pid $p)"
    else
      echo "Not running"
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
