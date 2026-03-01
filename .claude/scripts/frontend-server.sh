#!/usr/bin/env bash
# frontend-server.sh — start, stop, or restart the Fenrir Ledger frontend (Next.js) dev server
#
# Environment overrides (for worktrees):
#   FENRIR_FRONTEND_PORT — port to listen on              (default: 9653)
#   FENRIR_FRONTEND_DIR  — path to development/frontend   (default: auto-detected relative to this script)
#
# Backward-compatible aliases (deprecated, prefer the FENRIR_FRONTEND_* names):
#   FENRIR_PORT    — fallback for FENRIR_FRONTEND_PORT
#   FENRIR_DEV_DIR — fallback for FENRIR_FRONTEND_DIR

set -euo pipefail

PORT="${FENRIR_FRONTEND_PORT:-${FENRIR_PORT:-9653}}"
FRONTEND_DIR="${FENRIR_FRONTEND_DIR:-${FENRIR_DEV_DIR:-$(cd "$(dirname "$0")/../../development/frontend" && pwd)}}"
LOG_DIR="${FRONTEND_DIR}/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="${LOG_DIR}/frontend-server.log"

pid() { lsof -ti TCP:$PORT -sTCP:LISTEN 2>/dev/null | head -1; }

case "${1:-}" in
  start)
    if p=$(pid); then
      echo "Frontend: already running (pid $p)"
      exit 0
    fi
    echo "Frontend: starting on port $PORT (dir: $FRONTEND_DIR)..."
    cd "$FRONTEND_DIR"
    nohup npx next dev -p "$PORT" > "$LOG_FILE" 2>&1 &
    echo "Frontend: started (pid $!). Logs: $LOG_FILE"
    ;;

  stop)
    if p=$(pid); then
      kill "$p"
      echo "Frontend: stopped (pid $p)"
    else
      echo "Frontend: not running"
    fi
    ;;

  restart)
    if p=$(pid); then
      kill "$p"
      echo "Frontend: stopped (pid $p)"
      sleep 1
    fi
    echo "Frontend: starting on port $PORT (dir: $FRONTEND_DIR)..."
    cd "$FRONTEND_DIR"
    nohup npx next dev -p "$PORT" > "$LOG_FILE" 2>&1 &
    echo "Frontend: started (pid $!). Logs: $LOG_FILE"
    ;;

  status)
    if p=$(pid); then
      echo "Frontend: running (pid $p) on port $PORT"
    else
      echo "Frontend: not running"
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
