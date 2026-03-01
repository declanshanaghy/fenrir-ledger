---
description: Start, stop, restart, check status of, or tail logs for the Fenrir Ledger dev server (port 9653).
---

Manage the Fenrir Ledger development server using the script at `.claude/scripts/dev-server.sh`.

The argument passed to this command is the action: `start`, `stop`, `restart`, `status`, or `logs`.

Run the script with the Bash tool:

```
.claude/scripts/dev-server.sh <action>
```

## Actions

| Action | Effect |
|--------|--------|
| `start` | Start the server if not already running |
| `stop` | Kill the listening process on the configured port |
| `restart` | Stop then start (use after code changes that confuse HMR) |
| `status` | Print whether the server is running and its PID |
| `logs` | `tail -f` the log file |

## When to use this

- **After significant structural changes** (deleting files, changing middleware, removing packages) — HMR cannot always recover; restart to get a clean compile.
- **404 on `/` from a running server** — almost always a stale HMR state; restart fixes it.
- **Before running Playwright tests** — confirm `status` is running first.
- **After `npm install` / `npm uninstall`** — restart so the new module graph is picked up.

## Environment overrides (for worktrees)

### Frontend (dev-server.sh)

| Variable | Default | Purpose |
|---|---|---|
| `FENRIR_PORT` | `9653` | Port the Next.js dev server listens on |
| `FENRIR_DEV_DIR` | Auto-detected `development/src/` | Path to the Next.js project root |

```
.claude/scripts/dev-server.sh start                          # Main repo
FENRIR_PORT=9654 FENRIR_DEV_DIR=trees/my-branch/development/src .claude/scripts/dev-server.sh start  # Worktree
```

### Backend (backend-server.sh)

A separate script at `.claude/scripts/backend-server.sh` manages the Node/TS backend server.

| Variable | Default | Purpose |
|---|---|---|
| `FENRIR_BACKEND_PORT` | `9753` | Port the backend server listens on |
| `FENRIR_BACKEND_DIR` | Auto-detected `development/backend/` | Path to the backend project root |

```
.claude/scripts/backend-server.sh start                                  # Main repo
FENRIR_BACKEND_PORT=9754 FENRIR_BACKEND_DIR=trees/my-branch/development/backend .claude/scripts/backend-server.sh start  # Worktree
```

Backend port = frontend port + 100 (e.g., frontend 9654 → backend 9754).

## Log files

- Frontend: `<DEV_DIR>/logs/dev-server.log`
- Backend: `<BACKEND_DIR>/logs/backend-server.log`

Use `logs` action to stream, or read directly with the Read tool when diagnosing errors.

## Notes

- The script uses `lsof -sTCP:LISTEN` to find only the listening server process, not browser connections to the same port.
- `nohup` is used so the server survives the shell session that spawned it.
- The server runs from `development/src/` (or `FENRIR_DEV_DIR`) regardless of the working directory when the command is called.
