---
model: claude-sonnet-4-5-20250929
description: List all git worktrees with their configuration and status
allowed-tools: Bash, Read, Glob, Grep
---

# Purpose

List all git worktrees in the trees directory (sibling to repo root) with comprehensive information including branch names, port configuration, dev server status, and access URLs.

## Variables

```
REPO_ROOT: $(git rev-parse --show-toplevel)
WORKTREE_BASE_DIR: ${REPO_ROOT}-trees
BASE_FRONTEND_PORT: 9653
BASE_BACKEND_PORT: 9753
FRONTEND_SERVER_SCRIPT: ${REPO_ROOT}/.claude/scripts/frontend-server.sh
BACKEND_SERVER_SCRIPT: ${REPO_ROOT}/.claude/scripts/backend-server.sh
SERVICES_SCRIPT: ${REPO_ROOT}/.claude/scripts/services.sh
```

## Instructions

- List all worktrees managed by git
- For each worktree in WORKTREE_BASE_DIR, gather configuration details
- Check dev server status using the frontend-server script
- Display comprehensive information in a clear, organized format
- Show which worktrees have running dev servers vs stopped
- Provide quick action commands for each worktree

## Workflow

### 1. List Git Worktrees

- Run: `git worktree list`
- Parse output to identify all worktrees
- Filter for worktrees in WORKTREE_BASE_DIR directory
- Extract:
  - Worktree path
  - Branch name
  - Commit hash (if available)

### 2. Gather Configuration for Each Worktree

For each worktree found in WORKTREE_BASE_DIR:

**Extract Branch/Directory Info:**
- Worktree directory: `${REPO_ROOT}-trees/<branch-name>`
- Branch name from git worktree list
- App directory: `${REPO_ROOT}-trees/<branch-name>/development/frontend`

**Determine Ports:**
- Infer from worktree order or check running processes
- Check frontend ports: `lsof -i TCP:965x -sTCP:LISTEN` for ports 9654-9663
- Check backend ports: `lsof -i TCP:975x -sTCP:LISTEN` for ports 9754-9763

**Check Environment:**
- Check if `<worktree>/development/frontend/.env.local` exists
- Note presence/absence (contains API keys, don't display values)

### 3. Check Dev Server Status

For each worktree:

- Check frontend ports 9654 through 9663 using: `FENRIR_FRONTEND_PORT=<port> .claude/scripts/frontend-server.sh status`
- Check backend ports 9754 through 9763 using: `FENRIR_BACKEND_PORT=<port> .claude/scripts/backend-server.sh status`
- Or check directly: `lsof -ti TCP:<port> -sTCP:LISTEN`
- Determine if process is running and extract PID for each server type

### 4. Check Dependencies

For each worktree:
- Check if `<worktree>/development/frontend/node_modules` exists
- Note if dependencies are installed or missing

### 5. Calculate Statistics

- Total number of worktrees
- Number with dev server running
- Number with dev server stopped
- Next available port (9653 + next offset)

### 6. Report

After gathering all information, provide a comprehensive report:

```
Git Worktrees Overview

Summary:
  Total Worktrees: <count>
  Running: <count> | Stopped: <count>
  Next Available Port: <port> (offset <N>)

---

Main Repository (Default)
  Location:        <project-root>
  Branch:          <current-branch>
  Frontend Port:   9653
  Backend Port:    9753
  Frontend Status: <RUNNING|STOPPED>
  Backend Status:  <RUNNING|STOPPED|NOT CONFIGURED>
  Frontend URL:    http://localhost:9653
  Backend URL:     http://localhost:9753
  Manage all:      .claude/scripts/services.sh <start|stop|status>
  Manage FE:       .claude/scripts/frontend-server.sh <start|stop|status>
  Manage BE:       .claude/scripts/backend-server.sh <start|stop|status>

---

Worktree: <branch-name>
  Location:        ${REPO_ROOT}-trees/<branch-name>
  Branch:          <branch-name>
  Commit:          <commit-hash-short>
  Frontend Port:   <FRONTEND_PORT>
  Backend Port:    <BACKEND_PORT>
  Frontend Status: <RUNNING (PID: xxxx)|STOPPED>
  Backend Status:  <RUNNING (PID: xxxx)|STOPPED|NOT CONFIGURED>
  Frontend URL:    http://localhost:<FRONTEND_PORT>
  Backend URL:     http://localhost:<BACKEND_PORT>
  Dependencies:    FE: <Installed|Missing> | BE: <Installed|Missing|N/A>
  Environment:     <.env.local present|Missing>
  FE Logs:         ${REPO_ROOT}-trees/<branch-name>/development/frontend/logs/frontend-server.log
  BE Logs:         ${REPO_ROOT}-trees/<branch-name>/development/backend/logs/backend-server.log
  Manage all:      FENRIR_FRONTEND_PORT=<FRONTEND_PORT> FENRIR_BACKEND_PORT=<BACKEND_PORT> ... .claude/scripts/services.sh <start|stop|status>
  Manage FE:       FENRIR_FRONTEND_PORT=<FRONTEND_PORT> FENRIR_FRONTEND_DIR=${REPO_ROOT}-trees/<branch>/development/frontend .claude/scripts/frontend-server.sh <start|stop|status>
  Manage BE:       FENRIR_BACKEND_PORT=<BACKEND_PORT> FENRIR_BACKEND_DIR=${REPO_ROOT}-trees/<branch>/development/backend .claude/scripts/backend-server.sh <start|stop|status>

---

[Repeat for each worktree]

Quick Commands:

  Create new worktree:  /create_worktree <branch-name> [port-offset]
  Remove worktree:      /remove_worktree <branch-name>
  List worktrees:       /list_worktrees
```

If no worktrees exist in WORKTREE_BASE_DIR:

```
Git Worktrees Overview

Main Repository (Default)
  Location: <project-root>
  Branch:   <current-branch>
  Port:     9653
  Status:   <RUNNING|STOPPED>

No worktrees found in ${REPO_ROOT}-trees/ directory.

Create your first worktree:
  /create_worktree <branch-name>

  This will:
  - Create isolated git worktree
  - Configure unique port (9654)
  - Install dependencies
  - Start dev server automatically
```
