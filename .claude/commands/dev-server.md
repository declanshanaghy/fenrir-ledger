---
description: Start, stop, restart, check status of, or tail logs for the Fenrir Ledger services (frontend port 9653, backend port 9753).
---

Manage Fenrir Ledger services using three scripts in `.claude/scripts/`:

| Script | Purpose |
|--------|---------|
| `services.sh` | Unified — manages both frontend and backend together |
| `frontend-server.sh` | Frontend (Next.js) dev server only |
| `backend-server.sh` | Backend (Node/TS) server only |

## Unified Script (recommended)

```
.claude/scripts/services.sh <action>
```

| Action | Effect |
|--------|--------|
| `start` | Start backend first, then frontend |
| `stop` | Stop both services |
| `restart` | Restart both services |
| `status` | Show status of both services |
| `logs` | Tail both log files interleaved |
| `logs frontend` | Tail frontend logs only |
| `logs backend` | Tail backend logs only |

## Individual Scripts

### Frontend — `frontend-server.sh`

```
.claude/scripts/frontend-server.sh <action>
```

### Backend — `backend-server.sh`

```
.claude/scripts/backend-server.sh <action>
```

Both accept: `start`, `stop`, `restart`, `status`, `logs`.

## When to use this

- **After significant structural changes** (deleting files, changing middleware, removing packages) — HMR cannot always recover; restart to get a clean compile.
- **404 on `/` from a running server** — almost always a stale HMR state; restart fixes it.
- **Before running Playwright tests** — confirm `status` is running first.
- **After `npm install` / `npm uninstall`** — restart so the new module graph is picked up.

## Environment overrides (for worktrees)

### Frontend (frontend-server.sh)

| Variable | Default | Purpose |
|---|---|---|
| `FENRIR_FRONTEND_PORT` | `9653` | Port the Next.js dev server listens on |
| `FENRIR_FRONTEND_DIR` | Auto-detected `development/frontend/` | Path to the Next.js project root |

Backward-compatible aliases (deprecated): `FENRIR_PORT`, `FENRIR_DEV_DIR`.

```
.claude/scripts/frontend-server.sh start                          # Main repo
FENRIR_FRONTEND_PORT=9654 FENRIR_FRONTEND_DIR=trees/my-branch/development/frontend .claude/scripts/frontend-server.sh start  # Worktree
```

### Backend (backend-server.sh)

| Variable | Default | Purpose |
|---|---|---|
| `FENRIR_BACKEND_PORT` | `9753` | Port the backend server listens on |
| `FENRIR_BACKEND_DIR` | Auto-detected `development/backend/` | Path to the backend project root |

```
.claude/scripts/backend-server.sh start                                  # Main repo
FENRIR_BACKEND_PORT=9754 FENRIR_BACKEND_DIR=trees/my-branch/development/backend .claude/scripts/backend-server.sh start  # Worktree
```

### Unified (services.sh)

`services.sh` reads the same environment variables and delegates to the individual scripts.

```
.claude/scripts/services.sh start                          # Main repo — starts both
FENRIR_FRONTEND_PORT=9654 FENRIR_BACKEND_PORT=9754 .claude/scripts/services.sh status  # Worktree
```

Backend port = frontend port + 100 (e.g., frontend 9654 -> backend 9754).

## Log files

- Frontend: `<FRONTEND_DIR>/logs/frontend-server.log`
- Backend: `<BACKEND_DIR>/logs/backend-server.log`

Use `logs` action to stream, or read directly with the Read tool when diagnosing errors.

## Notes

- The scripts use `lsof -sTCP:LISTEN` to find only the listening server process, not browser connections to the same port.
- `nohup` is used so the server survives the shell session that spawned it.
- The server runs from the configured directory regardless of the working directory when the command is called.
- **Migration note**: `dev-server.sh` was renamed to `frontend-server.sh`. The old `FENRIR_PORT` and `FENRIR_DEV_DIR` env vars still work as fallbacks.
