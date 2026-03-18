#!/usr/bin/env bash
# proxy.sh — manage kubectl proxy for GKE cluster access
set -euo pipefail

PORT=8001
REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
LOG_DIR="$REPO_ROOT/tmp"
LOG="${LOG_DIR}/k8s-proxy.log"
PID_FILE="${LOG_DIR}/.k8s-proxy.pid"

mkdir -p "$LOG_DIR"

pid() {
  if [[ -f "$PID_FILE" ]]; then
    local p; p=$(cat "$PID_FILE")
    kill -0 "$p" 2>/dev/null && echo "$p" && return 0
    rm -f "$PID_FILE"
  fi
  lsof -ti "TCP:$PORT" -sTCP:LISTEN 2>/dev/null | head -1
}

case "${1:-status}" in
  start)
    if p=$(pid); then
      echo "proxy: already running (pid $p) on port $PORT"
      exit 0
    fi
    if ! command -v kubectl &>/dev/null; then
      echo "proxy: ERROR — kubectl not installed"
      exit 1
    fi
    echo "Starting kubectl proxy on port $PORT..."
    > "$LOG"
    nohup kubectl proxy --port="$PORT" >> "$LOG" 2>&1 &
    echo $! > "$PID_FILE"
    sleep 1
    echo "proxy: running on port $PORT"
    echo "  → http://localhost:$PORT/api/v1/namespaces"
    ;;
  stop)
    if p=$(pid); then
      kill "$p" 2>/dev/null
      rm -f "$PID_FILE"
      echo "proxy: stopped"
    else
      echo "proxy: not running"
    fi
    ;;
  status)
    if p=$(pid); then
      echo "proxy: running (pid $p) on port $PORT"
      echo "  → http://localhost:$PORT/api/v1/namespaces"
    else
      echo "proxy: not running"
    fi
    ;;
  logs)
    tail -f "$LOG"
    ;;
  *)
    echo "Usage: proxy.sh {start|stop|status|logs}"
    exit 1
    ;;
esac
