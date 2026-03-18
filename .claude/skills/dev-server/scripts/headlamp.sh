#!/usr/bin/env bash
# headlamp.sh — manage kubectl port-forward tunnel to Headlamp UI
# Includes a watchdog that auto-restarts the tunnel if it dies.
set -euo pipefail

PORT=8080
REMOTE_PORT=80
NAMESPACE=headlamp
SERVICE=svc/headlamp
REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
LOG_DIR="$REPO_ROOT/tmp"
LOG="${LOG_DIR}/headlamp-tunnel.log"
PID_FILE="${LOG_DIR}/.headlamp-tunnel.pid"
WATCHDOG_PID_FILE="${LOG_DIR}/.headlamp-watchdog.pid"

mkdir -p "$LOG_DIR"

tunnel_pid() {
  if [[ -f "$PID_FILE" ]]; then
    local p; p=$(cat "$PID_FILE")
    kill -0 "$p" 2>/dev/null && echo "$p" && return 0
    rm -f "$PID_FILE"
  fi
  lsof -ti "TCP:$PORT" -sTCP:LISTEN 2>/dev/null | head -1
}

watchdog_pid() {
  if [[ -f "$WATCHDOG_PID_FILE" ]]; then
    local p; p=$(cat "$WATCHDOG_PID_FILE")
    kill -0 "$p" 2>/dev/null && echo "$p" && return 0
    rm -f "$WATCHDOG_PID_FILE"
  fi
  return 1
}

start_tunnel() {
  kubectl port-forward -n "$NAMESPACE" "$SERVICE" "$PORT:$REMOTE_PORT" >> "$LOG" 2>&1 &
  echo $! > "$PID_FILE"
}

start_watchdog() {
  # Watchdog loop: check every 10s, restart tunnel if dead
  (
    while true; do
      sleep 10
      if ! tunnel_pid &>/dev/null; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] watchdog: tunnel died, restarting..." >> "$LOG"
        start_tunnel
        sleep 2
        if tunnel_pid &>/dev/null; then
          echo "[$(date '+%Y-%m-%d %H:%M:%S')] watchdog: tunnel restarted on port $PORT" >> "$LOG"
        else
          echo "[$(date '+%Y-%m-%d %H:%M:%S')] watchdog: restart failed" >> "$LOG"
        fi
      fi
    done
  ) &
  echo $! > "$WATCHDOG_PID_FILE"
  disown
}

case "${1:-status}" in
  start)
    if p=$(tunnel_pid); then
      echo "headlamp: already running (pid $p) on port $PORT"
      if ! watchdog_pid &>/dev/null; then
        echo "headlamp: watchdog not running, starting..."
        start_watchdog
        echo "headlamp: watchdog started (pid $(cat "$WATCHDOG_PID_FILE"))"
      fi
      exit 0
    fi
    if ! command -v kubectl &>/dev/null; then
      echo "headlamp: ERROR — kubectl not installed"
      exit 1
    fi
    # Verify the headlamp pod is running
    if ! kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name=headlamp --field-selector=status.phase=Running --no-headers 2>/dev/null | grep -q .; then
      echo "headlamp: ERROR — no running headlamp pod in namespace $NAMESPACE"
      exit 1
    fi
    echo "Starting Headlamp tunnel on port $PORT..."
    > "$LOG"
    start_tunnel
    sleep 2
    if tunnel_pid &>/dev/null; then
      echo "headlamp: running on port $PORT"
      echo "  → http://localhost:$PORT"
      start_watchdog
      echo "headlamp: watchdog started (pid $(cat "$WATCHDOG_PID_FILE"))"
    else
      echo "headlamp: ERROR — failed to start tunnel"
      cat "$LOG"
      exit 1
    fi
    ;;
  stop)
    # Stop watchdog first
    if wp=$(watchdog_pid); then
      kill "$wp" 2>/dev/null
      rm -f "$WATCHDOG_PID_FILE"
      echo "headlamp: watchdog stopped"
    fi
    # Stop tunnel
    if p=$(tunnel_pid); then
      kill "$p" 2>/dev/null
      rm -f "$PID_FILE"
      echo "headlamp: tunnel stopped"
    else
      echo "headlamp: not running"
    fi
    ;;
  status)
    if p=$(tunnel_pid); then
      echo "headlamp: running (pid $p) on port $PORT"
      if wp=$(watchdog_pid); then
        echo "headlamp: watchdog active (pid $wp)"
      else
        echo "headlamp: watchdog not running"
      fi
    else
      echo "headlamp: not running"
    fi
    ;;
  logs)
    tail -f "$LOG"
    ;;
  *)
    echo "Usage: headlamp.sh {start|stop|status|logs}"
    exit 1
    ;;
esac
