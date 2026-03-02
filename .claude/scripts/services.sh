#!/usr/bin/env bash
# services.sh — manage Fenrir Ledger frontend server
#
# Usage: services.sh {start|stop|restart|status|logs}
#
# Environment overrides (for worktrees):
#   FENRIR_FRONTEND_PORT — frontend port (default: 9653)
#   FENRIR_FRONTEND_DIR  — path to development/frontend
#
# Backward-compatible aliases (deprecated):
#   FENRIR_PORT    — fallback for FENRIR_FRONTEND_PORT
#   FENRIR_DEV_DIR — fallback for FENRIR_FRONTEND_DIR
#
# Note: The dedicated backend server was removed in chore/remove-fly-io.
# All import functionality runs as a Vercel serverless function via the
# Next.js API route /api/sheets/import. See adr-backend-server.md addendum.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_SCRIPT="${SCRIPT_DIR}/frontend-server.sh"

# Propagate env vars so the frontend script picks them up.
[[ -n "${FENRIR_FRONTEND_PORT:-${FENRIR_PORT:-}}" ]] && export FENRIR_FRONTEND_PORT="${FENRIR_FRONTEND_PORT:-${FENRIR_PORT:-}}"
[[ -n "${FENRIR_FRONTEND_DIR:-${FENRIR_DEV_DIR:-}}" ]] && export FENRIR_FRONTEND_DIR="${FENRIR_FRONTEND_DIR:-${FENRIR_DEV_DIR:-}}"

action="${1:-}"

run_frontend() { "$FRONTEND_SCRIPT" "$1"; }

case "$action" in
  start)
    echo "=== Starting Fenrir Ledger ==="
    run_frontend start
    echo "=== Service started ==="
    ;;

  stop)
    echo "=== Stopping Fenrir Ledger ==="
    run_frontend stop
    echo "=== Service stopped ==="
    ;;

  restart)
    echo "=== Restarting Fenrir Ledger ==="
    run_frontend stop
    sleep 1
    run_frontend start
    echo "=== Service restarted ==="
    ;;

  status)
    echo "=== Fenrir Ledger service status ==="
    run_frontend status
    ;;

  logs)
    run_frontend logs
    ;;

  *)
    echo "Usage: $0 {start|stop|restart|status|logs}"
    echo ""
    echo "Actions:"
    echo "  start    — start frontend server"
    echo "  stop     — stop frontend server"
    echo "  restart  — restart frontend server"
    echo "  status   — show status of frontend server"
    echo "  logs     — tail frontend log file"
    exit 1
    ;;
esac
