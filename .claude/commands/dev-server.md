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

The script supports two env vars for running in git worktrees:

| Variable | Default | Purpose |
|---|---|---|
| `FENRIR_PORT` | `9653` | Port the Next.js dev server listens on |
| `FENRIR_DEV_DIR` | Auto-detected `development/src/` | Path to the Next.js project root |

**Main repo (default):**
```
.claude/scripts/dev-server.sh start
```

**Worktree example (port 9654, worktree directory):**
```
FENRIR_PORT=9654 FENRIR_DEV_DIR=trees/my-branch/development/src .claude/scripts/dev-server.sh start
```

## Log file

Log output is written to `<DEV_DIR>/logs/dev-server.log` (e.g. `development/src/logs/dev-server.log` for main, `trees/<branch>/development/src/logs/dev-server.log` for a worktree). Use `logs` to stream it, or read it directly with the Read tool when diagnosing build/runtime errors.

## Notes

- The script uses `lsof -sTCP:LISTEN` to find only the listening server process, not browser connections to the same port.
- `nohup` is used so the server survives the shell session that spawned it.
- The server runs from `development/src/` (or `FENRIR_DEV_DIR`) regardless of the working directory when the command is called.
