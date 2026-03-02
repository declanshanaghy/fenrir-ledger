---
description: Start, stop, restart, check status of, or tail logs for the Fenrir Ledger frontend (port 9653).
---

Manage the Fenrir Ledger frontend using scripts in `.claude/scripts/`:

| Script | Purpose |
|--------|---------|
| `services.sh` | Convenience wrapper around frontend-server.sh |
| `frontend-server.sh` | Frontend (Next.js) dev server |

## Usage

```
.claude/scripts/services.sh <action>
```

| Action | Effect |
|--------|--------|
| `start` | Start frontend server |
| `stop` | Stop frontend server |
| `restart` | Restart frontend server |
| `status` | Show status of frontend server |
| `logs` | Tail frontend log file |

## Individual Script

### Frontend -- `frontend-server.sh`

```
.claude/scripts/frontend-server.sh <action>
```

Accepts: `start`, `stop`, `restart`, `status`, `logs`.

## When to use this

- **After significant structural changes** (deleting files, changing middleware, removing packages) -- HMR cannot always recover; restart to get a clean compile.
- **404 on `/` from a running server** -- almost always a stale HMR state; restart fixes it.
- **Before running Playwright tests** -- confirm `status` is running first.
- **After `npm install` / `npm uninstall`** -- restart so the new module graph is picked up.

## Environment overrides (for worktrees)

| Variable | Default | Purpose |
|---|---|---|
| `FENRIR_FRONTEND_PORT` | `9653` | Port the Next.js dev server listens on |
| `FENRIR_FRONTEND_DIR` | Auto-detected `development/frontend/` | Path to the Next.js project root |

Backward-compatible aliases (deprecated): `FENRIR_PORT`, `FENRIR_DEV_DIR`.

```
.claude/scripts/frontend-server.sh start                          # Main repo
FENRIR_FRONTEND_PORT=9654 FENRIR_FRONTEND_DIR=trees/my-branch/development/frontend .claude/scripts/frontend-server.sh start  # Worktree
```

## Log files

- Frontend: `<FRONTEND_DIR>/logs/frontend-server.log`

Use `logs` action to stream, or read directly with the Read tool when diagnosing errors.

## Notes

- The scripts use `lsof -sTCP:LISTEN` to find only the listening server process, not browser connections to the same port.
- `nohup` is used so the server survives the shell session that spawned it.
- The server runs from the configured directory regardless of the working directory when the command is called.
- **Migration note**: `dev-server.sh` was renamed to `frontend-server.sh`. The old `FENRIR_PORT` and `FENRIR_DEV_DIR` env vars still work as fallbacks.
- **Migration note**: The dedicated backend server (port 9753) was removed. All import functionality runs as a Vercel serverless function.
