#!/usr/bin/env bash
# services.sh — manage both Fenrir Ledger frontend and backend servers
#
# Usage: services.sh {start|stop|restart|status|logs [frontend|backend]}
#
# Environment overrides (for worktrees):
#   FENRIR_FRONTEND_PORT — frontend port (default: 9653)
#   FENRIR_FRONTEND_DIR  — path to development/frontend
#   FENRIR_BACKEND_PORT  — backend port  (default: 9753)
#   FENRIR_BACKEND_DIR   — path to development/backend
#
# Backward-compatible aliases (deprecated):
#   FENRIR_PORT    — fallback for FENRIR_FRONTEND_PORT
#   FENRIR_DEV_DIR — fallback for FENRIR_FRONTEND_DIR

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_SCRIPT="${SCRIPT_DIR}/frontend-server.sh"
BACKEND_SCRIPT="${SCRIPT_DIR}/backend-server.sh"

# Propagate env vars so individual scripts pick them up
export FENRIR_FRONTEND_PORT="${FENRIR_FRONTEND_PORT:-${FENRIR_PORT:-}}"
export FENRIR_FRONTEND_DIR="${FENRIR_FRONTEND_DIR:-${FENRIR_DEV_DIR:-}}"
export FENRIR_BACKEND_PORT="${FENRIR_BACKEND_PORT:-}"
export FENRIR_BACKEND_DIR="${FENRIR_BACKEND_DIR:-}"

action="${1:-}"
target="${2:-}"

run_frontend() { "$FRONTEND_SCRIPT" "$1"; }
run_backend()  { "$BACKEND_SCRIPT"  "$1"; }

case "$action" in
  start)
    echo "=== Starting Fenrir Ledger services ==="
    run_backend start
    sleep 1
    run_frontend start
    echo "=== All services started ==="
    ;;

  stop)
    echo "=== Stopping Fenrir Ledger services ==="
    run_frontend stop
    run_backend stop
    echo "=== All services stopped ==="
    ;;

  restart)
    echo "=== Restarting Fenrir Ledger services ==="
    run_frontend stop
    run_backend stop
    sleep 1
    run_backend start
    sleep 1
    run_frontend start
    echo "=== All services restarted ==="
    ;;

  status)
    echo "=== Fenrir Ledger service status ==="
    run_frontend status
    run_backend status
    ;;

  logs)
    case "$target" in
      frontend)
        run_frontend logs
        ;;
      backend)
        run_backend logs
        ;;
      "")
        # Tail both log files interleaved
        FE_PORT="${FENRIR_FRONTEND_PORT:-${FENRIR_PORT:-9653}}"
        FE_DIR="${FENRIR_FRONTEND_DIR:-${FENRIR_DEV_DIR:-$(cd "$SCRIPT_DIR/../../development/frontend" && pwd)}}"
        BE_PORT="${FENRIR_BACKEND_PORT:-9753}"
        BE_DIR="${FENRIR_BACKEND_DIR:-$(cd "$SCRIPT_DIR/../../development/backend" && pwd)}"
        FE_LOG="${FE_DIR}/logs/frontend-server.log"
        BE_LOG="${BE_DIR}/logs/backend-server.log"
        echo "Tailing frontend ($FE_LOG) and backend ($BE_LOG) logs..."
        echo "(Press Ctrl+C to stop)"
        tail -f "$FE_LOG" "$BE_LOG"
        ;;
      *)
        echo "Unknown logs target: $target"
        echo "Usage: $0 logs [frontend|backend]"
        exit 1
        ;;
    esac
    ;;

  *)
    echo "Usage: $0 {start|stop|restart|status|logs [frontend|backend]}"
    echo ""
    echo "Actions:"
    echo "  start    — start backend first, then frontend"
    echo "  stop     — stop both services"
    echo "  restart  — restart both services"
    echo "  status   — show status of both services"
    echo "  logs     — tail both log files interleaved"
    echo "  logs frontend — tail frontend logs only"
    echo "  logs backend  — tail backend logs only"
    exit 1
    ;;
esac
