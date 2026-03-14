#!/usr/bin/env bash
# odin.sh — manage Odin's Agent Monitor (http-server for agent reports)
# Port 8316 — Hlidskjalf, Odin's high throne from which he sees all nine worlds
set -euo pipefail

PORT=8316
REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
SERVE_DIR="$REPO_ROOT/tmp/agent-logs"
LOG_DIR="$REPO_ROOT/tmp"
LOG="${LOG_DIR}/odin-server.log"
PID_FILE="${LOG_DIR}/.odin-server.pid"

mkdir -p "$SERVE_DIR" "$LOG_DIR"

# Copy Odin assets if missing
copy_assets() {
  local profiles="$SERVE_DIR/agents/profiles"
  mkdir -p "$profiles"
  [[ ! -f "$SERVE_DIR/favicon.png" ]] && \
    cp "$REPO_ROOT/.claude/agents/profiles/odin-dark.png" "$SERVE_DIR/favicon.png" 2>/dev/null || true
  [[ ! -f "$profiles/odin-dark.png" ]] && \
    cp "$REPO_ROOT/.claude/agents/profiles/odin-dark.png" "$profiles/odin-dark.png" 2>/dev/null || true
  # Copy all agent profiles
  for img in "$REPO_ROOT/.claude/agents/profiles/"*-dark.png; do
    local base; base=$(basename "$img")
    [[ ! -f "$profiles/$base" ]] && cp "$img" "$profiles/$base" 2>/dev/null || true
  done
}

pid() {
  if [[ -f "$PID_FILE" ]]; then
    local p; p=$(cat "$PID_FILE")
    kill -0 "$p" 2>/dev/null && echo "$p" && return 0
    rm -f "$PID_FILE"
  fi
  # Fallback: check by port
  lsof -ti "TCP:$PORT" -sTCP:LISTEN 2>/dev/null | head -1
}

case "${1:-status}" in
  start)
    if p=$(pid); then
      echo "odin: already running (pid $p) on port $PORT"
      echo "  → http://localhost:$PORT/"
      exit 0
    fi
    copy_assets
    echo "Starting Odin's Throne on port $PORT..."
    > "$LOG"
    # Generate initial index + manifest
    node "$REPO_ROOT/.claude/skills/brandify-agent/scripts/generate-agent-report.mjs" --regen-assets --output-dir "$SERVE_DIR" >> "$LOG" 2>&1
    # Start http-server
    nohup npx http-server "$SERVE_DIR" -p "$PORT" -c-1 --cors -s >> "$LOG" 2>&1 &
    echo $! > "$PID_FILE"
    # Start manifest refresh loop (every 15s)
    REFRESH_PID_FILE="${LOG_DIR}/.odin-refresh.pid"
    nohup bash -c "while true; do
      node '$REPO_ROOT/.claude/skills/brandify-agent/scripts/generate-agent-report.mjs' --regen-assets --output-dir '$SERVE_DIR' >/dev/null 2>&1
      sleep 15
    done" >> "$LOG" 2>&1 &
    echo $! > "$REFRESH_PID_FILE"
    sleep 1
    echo "odin: running on port $PORT (manifest refreshes every 15s)"
    echo "  → http://localhost:$PORT/"
    ;;
  stop)
    if p=$(pid); then
      kill "$p" 2>/dev/null
      rm -f "$PID_FILE"
    fi
    # Kill refresh loop
    REFRESH_PID_FILE="${LOG_DIR}/.odin-refresh.pid"
    if [[ -f "$REFRESH_PID_FILE" ]]; then
      kill "$(cat "$REFRESH_PID_FILE")" 2>/dev/null
      rm -f "$REFRESH_PID_FILE"
    fi
    echo "odin: stopped"
    ;;
  status)
    if p=$(pid); then
      echo "odin: running (pid $p) on port $PORT"
      echo "  → http://localhost:$PORT/"
    else
      echo "odin: not running"
    fi
    ;;
  logs)
    tail -f "$LOG"
    ;;
  *)
    echo "Usage: odin.sh {start|stop|status|logs}"
    exit 1
    ;;
esac
