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
| `stop` | Kill the listening process on port 9653 |
| `restart` | Stop then start (use after code changes that confuse HMR) |
| `status` | Print whether the server is running and its PID |
| `logs` | `tail -f` the log file at `/tmp/fenrir-dev-server.log` |

## When to use this

- **After significant structural changes** (deleting files, changing middleware, removing packages) — HMR cannot always recover; restart to get a clean compile.
- **404 on `/` from a running server** — almost always a stale HMR state; restart fixes it.
- **Before running Playwright tests** — confirm `status` is running first.
- **After `npm install` / `npm uninstall`** — restart so the new module graph is picked up.

## Log file

All server output is written to `/tmp/fenrir-dev-server.log`. Use `logs` to stream it, or read it directly with the Read tool when diagnosing build/runtime errors.

## Notes

- The script uses `lsof -sTCP:LISTEN` to find only the listening server process, not browser connections to the same port.
- `nohup` is used so the server survives the shell session that spawned it.
- The server runs from `development/src/` regardless of the working directory when the command is called.
