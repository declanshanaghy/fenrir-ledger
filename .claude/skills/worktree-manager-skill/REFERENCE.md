# Worktree Quick Reference

Technical details, command syntax, and configuration reference.

## Command Syntax

### Create Worktree
```bash
/create_worktree_prompt <branch-name> [port-offset]
```

**Parameters:**
- `branch-name` (required) - Name of the git branch
- `port-offset` (optional) - Port offset number (default: auto-calculated)

**Example:**
```bash
/create_worktree_prompt feature-auth
/create_worktree_prompt hotfix-bug 3
```

---

### List Worktrees
```bash
/list_worktrees_prompt
```

**Parameters:** None

---

### Remove Worktree
```bash
/remove_worktree_prompt <branch-name>
```

**Parameters:**
- `branch-name` (required) - Name of the worktree to remove

---

## Port Allocation

### Port Calculation Formula
```
FRONTEND_PORT = 9653 + offset
BACKEND_PORT  = 9753 + offset   (frontend + 100)
```

### Port Map

| Environment | Offset | Frontend Port | Backend Port |
|-------------|--------|---------------|--------------|
| Main Repo   | 0      | 9653          | 9753         |
| Worktree 1  | 1      | 9654          | 9754         |
| Worktree 2  | 2      | 9655          | 9755         |
| Worktree 3  | 3      | 9656          | 9756         |
| Worktree 4  | 4      | 9657          | 9757         |
| Worktree 5  | 5      | 9658          | 9758         |

### Auto-calculated Offsets
When no port offset is specified, the system:
1. Lists existing worktrees in `trees/`
2. Counts them
3. Uses (count + 1) as the new offset

---

## Directory Structure

### Main Repository
```
fenrir-ledger/
├── .claude/
│   ├── scripts/
│   │   ├── services.sh          # Unified: manages both servers
│   │   ├── frontend-server.sh   # Frontend (Next.js) only
│   │   └── backend-server.sh    # Backend (Node/TS) only
│   ├── commands/
│   └── skills/
├── development/
│   ├── frontend/        # Next.js app root
│   │   ├── .env.local
│   │   ├── package.json
│   │   ├── node_modules/
│   │   └── src/
│   └── backend/         # Node/TS backend root
│       ├── package.json
│       ├── node_modules/
│       └── src/
├── trees/               # Worktrees live here (gitignored)
└── .gitignore
```

### Worktree Structure
```
trees/
└── <branch-name>/
    ├── .claude/           # Inherited from main
    ├── development/
    │   ├── frontend/      # Isolated Next.js app
    │   │   ├── .env.local # Copied from main
    │   │   ├── package.json
    │   │   ├── node_modules/ # Independently installed
    │   │   └── src/
    │   └── backend/       # Isolated backend
    │       ├── package.json
    │       ├── node_modules/
    │       └── src/
    └── ...
```

---

## Server Management

Three scripts manage frontend and backend servers.

### Unified — `.claude/scripts/services.sh`

Manages both frontend and backend together. Recommended for most operations.

Main repo:
```bash
.claude/scripts/services.sh start|stop|restart|status|logs [frontend|backend]
```

Worktree:
```bash
FENRIR_FRONTEND_PORT=<FE_PORT> FENRIR_FRONTEND_DIR=<abs-path>/trees/<branch>/development/frontend \
FENRIR_BACKEND_PORT=<BE_PORT> FENRIR_BACKEND_DIR=<abs-path>/trees/<branch>/development/backend \
.claude/scripts/services.sh start|stop|status
```

### Frontend (Next.js) — `.claude/scripts/frontend-server.sh`

Main repo (default port 9653):
```bash
.claude/scripts/frontend-server.sh start|stop|restart|status|logs
```

Worktree:
```bash
FENRIR_FRONTEND_PORT=<FE_PORT> FENRIR_FRONTEND_DIR=<abs-path>/trees/<branch>/development/frontend .claude/scripts/frontend-server.sh start|stop|status
```

### Backend (Node/TS) — `.claude/scripts/backend-server.sh`

Main repo (default port 9753):
```bash
.claude/scripts/backend-server.sh start|stop|restart|status|logs
```

Worktree:
```bash
FENRIR_BACKEND_PORT=<BE_PORT> FENRIR_BACKEND_DIR=<abs-path>/trees/<branch>/development/backend .claude/scripts/backend-server.sh start|stop|status
```

### Environment Variables

| Variable | Default | Script | Purpose |
|---|---|---|---|
| `FENRIR_FRONTEND_PORT` | `9653` | frontend-server.sh, services.sh | Frontend port |
| `FENRIR_FRONTEND_DIR` | Auto-detected | frontend-server.sh, services.sh | Frontend project root |
| `FENRIR_BACKEND_PORT` | `9753` | backend-server.sh, services.sh | Backend port |
| `FENRIR_BACKEND_DIR` | Auto-detected | backend-server.sh, services.sh | Backend project root |

Deprecated aliases (still work as fallbacks in frontend-server.sh):
- `FENRIR_PORT` -> `FENRIR_FRONTEND_PORT`
- `FENRIR_DEV_DIR` -> `FENRIR_FRONTEND_DIR`

### Log Files
- Frontend main: `development/frontend/logs/frontend-server.log`
- Frontend worktree: `trees/<branch>/development/frontend/logs/frontend-server.log`
- Backend main: `development/backend/logs/backend-server.log`
- Backend worktree: `trees/<branch>/development/backend/logs/backend-server.log`

---

## Isolation Features

Each worktree has:

| Feature | Isolation Level | Notes |
|---------|----------------|-------|
| **File System** | Complete | Separate working directory |
| **Frontend Port** | Complete | Unique frontend port per worktree (9653+offset) |
| **Backend Port** | Complete | Unique backend port per worktree (9753+offset) |
| **Environment** | Complete | Own `.env.local` |
| **Dependencies** | Complete | Own `node_modules/` |
| **Git History** | Shared | Same repository |
| **Git Config** | Shared | Same git settings |
| **Data** | Per-browser | localStorage is per-origin (port) |

---

## Best Practices

### When to Create Worktrees
- Testing multiple features simultaneously
- Running parallel agent work on different branches
- Reviewing PRs while working on features
- Hot-fixing production while developing

### When NOT to Create Worktrees
- Simple branch switching (use git checkout)
- Temporary file viewing (use git show)
- Quick edits (stash and switch)

### Cleanup
- Remove worktrees when feature is merged
- Don't let unused worktrees accumulate
- Regular audit with `/list_worktrees_prompt`
