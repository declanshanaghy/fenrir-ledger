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
PORT = 9653 + offset
```

### Port Map

| Environment | Offset | Port |
|-------------|--------|------|
| Main Repo   | 0      | 9653 |
| Worktree 1  | 1      | 9654 |
| Worktree 2  | 2      | 9655 |
| Worktree 3  | 3      | 9656 |
| Worktree 4  | 4      | 9657 |
| Worktree 5  | 5      | 9658 |

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
│   ├── scripts/dev-server.sh
│   ├── commands/
│   └── skills/
├── development/
│   └── src/           # Next.js app root
│       ├── .env.local
│       ├── package.json
│       ├── node_modules/
│       └── src/
├── trees/             # Worktrees live here (gitignored)
└── .gitignore
```

### Worktree Structure
```
trees/
└── <branch-name>/
    ├── .claude/           # Inherited from main
    ├── development/
    │   └── src/           # Isolated Next.js app
    │       ├── .env.local # Copied from main
    │       ├── package.json
    │       ├── node_modules/ # Independently installed
    │       └── src/
    └── ...
```

---

## Dev Server Management

All dev server management uses `.claude/scripts/dev-server.sh` with environment overrides.

### Main repo (default port 9653):
```bash
.claude/scripts/dev-server.sh start
.claude/scripts/dev-server.sh stop
.claude/scripts/dev-server.sh status
.claude/scripts/dev-server.sh restart
.claude/scripts/dev-server.sh logs
```

### Worktree (custom port):
```bash
FENRIR_PORT=<PORT> FENRIR_DEV_DIR=<abs-path>/trees/<branch>/development/src .claude/scripts/dev-server.sh start
FENRIR_PORT=<PORT> FENRIR_DEV_DIR=<abs-path>/trees/<branch>/development/src .claude/scripts/dev-server.sh stop
FENRIR_PORT=<PORT> FENRIR_DEV_DIR=<abs-path>/trees/<branch>/development/src .claude/scripts/dev-server.sh status
```

### Log Files
- Main: `development/src/logs/dev-server.log`
- Worktree: `trees/<branch>/development/src/logs/dev-server.log`

---

## Isolation Features

Each worktree has:

| Feature | Isolation Level | Notes |
|---------|----------------|-------|
| **File System** | Complete | Separate working directory |
| **Port** | Complete | Unique port per worktree |
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
