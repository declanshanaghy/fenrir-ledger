#!/usr/bin/env bash
# frontend-server.sh — start, stop, or restart the Fenrir Ledger frontend (Next.js) dev server
#
# Environment overrides (for worktrees):
#   FENRIR_FRONTEND_PORT — port to listen on (default: 9653, use 0 for OS-assigned)
#   FENRIR_FRONTEND_DIR  — path to development/frontend (default: auto-detected)
#
# When PORT=0, the OS picks a free port. The actual port is parsed from Next.js
# stdout and written to <FRONTEND_DIR>/.port so agents can discover it.

set -euo pipefail

PORT="${FENRIR_FRONTEND_PORT:-${FENRIR_PORT:-9653}}"
FRONTEND_DIR="${FENRIR_FRONTEND_DIR:-${FENRIR_DEV_DIR:-$(cd "$(dirname "$0")/../../development/frontend" && pwd)}}"
LOG_DIR="${FRONTEND_DIR}/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="${LOG_DIR}/frontend-server.log"
PORT_FILE="${FRONTEND_DIR}/.port"

# Read the actual port — from .port file if it exists, otherwise from PORT var
actual_port() {
  if [[ -f "$PORT_FILE" ]]; then
    cat "$PORT_FILE"
  else
    echo "$PORT"
  fi
}

pid() {
  local p
  p=$(actual_port)
  if [[ "$p" == "0" ]]; then
    return 1
  fi
  lsof -ti "TCP:$p" -sTCP:LISTEN 2>/dev/null | head -1
}

# Wait for Next.js to print its port, parse it, write .port file
wait_for_port() {
  local timeout=30
  local elapsed=0
  while (( elapsed < timeout )); do
    if [[ -f "$LOG_FILE" ]]; then
      # Next.js prints: - Local: http://localhost:XXXXX
      local detected
      detected=$(sed -n 's/.*Local:[[:space:]]*http:\/\/localhost:\([0-9]*\).*/\1/p' "$LOG_FILE" 2>/dev/null | head -1)
      if [[ -n "$detected" ]]; then
        echo "$detected" > "$PORT_FILE"
        echo "$detected"
        return 0
      fi
    fi
    sleep 1
    (( elapsed++ ))
  done
  echo "timeout" >&2
  return 1
}

case "${1:-}" in
  start)
    if p=$(pid); then
      echo "Frontend: already running (pid $p) on port $(actual_port)"
      exit 0
    fi
    echo "Frontend: starting on port ${PORT} (dir: $FRONTEND_DIR)..."
    # Clear old log so port detection finds the fresh startup line
    > "$LOG_FILE"
    cd "$FRONTEND_DIR"
    nohup npx next dev -p "$PORT" >> "$LOG_FILE" 2>&1 &
    BG_PID=$!
    if [[ "$PORT" == "0" ]]; then
      echo "Frontend: waiting for OS-assigned port..."
      ACTUAL=$(wait_for_port)
      if [[ "$ACTUAL" == "timeout" ]] || [[ -z "$ACTUAL" ]]; then
        echo "Frontend: ERROR — could not detect port after 30s. Check $LOG_FILE"
        exit 1
      fi
      echo "Frontend: started (pid $BG_PID) on port $ACTUAL. Logs: $LOG_FILE"
    else
      echo "$PORT" > "$PORT_FILE"
      echo "Frontend: started (pid $BG_PID) on port $PORT. Logs: $LOG_FILE"
    fi
    ;;

  stop)
    if p=$(pid); then
      kill "$p"
      echo "Frontend: stopped (pid $p)"
    else
      echo "Frontend: not running"
    fi
    rm -f "$PORT_FILE"
    ;;

  restart)
    if p=$(pid); then
      kill "$p"
      echo "Frontend: stopped (pid $p)"
      sleep 1
    fi
    rm -f "$PORT_FILE"
    > "$LOG_FILE"
    echo "Frontend: starting on port ${PORT} (dir: $FRONTEND_DIR)..."
    cd "$FRONTEND_DIR"
    nohup npx next dev -p "$PORT" >> "$LOG_FILE" 2>&1 &
    BG_PID=$!
    if [[ "$PORT" == "0" ]]; then
      echo "Frontend: waiting for OS-assigned port..."
      ACTUAL=$(wait_for_port)
      if [[ "$ACTUAL" == "timeout" ]] || [[ -z "$ACTUAL" ]]; then
        echo "Frontend: ERROR — could not detect port after 30s. Check $LOG_FILE"
        exit 1
      fi
      echo "Frontend: started (pid $BG_PID) on port $ACTUAL. Logs: $LOG_FILE"
    else
      echo "$PORT" > "$PORT_FILE"
      echo "Frontend: started (pid $BG_PID) on port $PORT. Logs: $LOG_FILE"
    fi
    ;;

  status)
    if p=$(pid); then
      echo "Frontend: running (pid $p) on port $(actual_port)"
    else
      echo "Frontend: not running"
    fi
    ;;

  port)
    # Print just the port number — useful for agents to discover the port
    actual_port
    ;;

  logs)
    tail -f "$LOG_FILE"
    ;;

  *)
    echo "Usage: $0 {start|stop|restart|status|port|logs}"
    exit 1
    ;;
esac
