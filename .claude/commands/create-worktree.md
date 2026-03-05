---
model: claude-sonnet-4-5-20250929
description: Create a git worktree with isolated configuration for parallel development
argument-hint: [branch-name]
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

# Purpose

Create a new git worktree in the trees directory (sibling to repo root) with completely isolated configuration for parallel execution. Each worktree gets its own branch, OS-assigned port, dependencies, and dev server instance so multiple agents can work independently and simultaneously.

**Worktrees are created OUTSIDE the repo** to prevent nesting and pollution. The trees directory is always `$(git rev-parse --show-toplevel)-trees` — a sibling directory to the repo root with `-trees` appended.

**Ports are auto-assigned by the OS** (port 0). The frontend-server.sh script starts Next.js with `--port 0`, parses the assigned port from stdout, and writes it to `development/frontend/.port`. Agents read this file to discover their server URL.

## Variables

```
REPO_ROOT: $(git rev-parse --show-toplevel)
BRANCH_NAME: $1 (required)
WORKTREE_BASE_DIR: ${REPO_ROOT}-trees
WORKTREE_DIR: ${REPO_ROOT}-trees/<BRANCH_NAME>
APP_DIR: <WORKTREE_DIR>/development/frontend
BACKEND_DIR: <WORKTREE_DIR>/development/backend
FRONTEND_PORT: 0 (OS-assigned, actual port written to .port file)
FRONTEND_SERVER_SCRIPT: ${REPO_ROOT}/.claude/scripts/frontend-server.sh
BACKEND_SERVER_SCRIPT: ${REPO_ROOT}/.claude/scripts/backend-server.sh

NOTE: Main repo uses frontend port 9653 (fixed)
      Worktrees use port 0 (OS-assigned) — no collisions possible
      WORKTREE_BASE_DIR is a sibling to the repo, NOT inside it
```

## Instructions

- This is a ONE-SHOT command that creates AND starts a worktree automatically
- Creates a fully functional, isolated clone of the codebase in a separate worktree
- Each worktree gets an OS-assigned port (no manual port management needed)
- The actual port is written to `development/frontend/.port` after startup
- Dependencies are installed automatically via npm
- After setup, the dev server is started using the frontend-server script
- If branch doesn't exist locally, create it from current HEAD
- If branch exists but isn't checked out, create worktree from it
- Provide clear access URL so user can immediately use the running instance

## Workflow

### 1. Parse and Validate Arguments

- Read BRANCH_NAME from $1, error if missing
- Validate branch name format (no spaces, valid git branch name)

### 2. Pre-Creation Validation

- Check if WORKTREE_BASE_DIR exists, create if not: `mkdir -p "${REPO_ROOT}-trees"`
- Check if worktree already exists at WORKTREE_DIR
- Check if branch exists: `git branch --list <BRANCH_NAME>`
  - If branch doesn't exist, will create it in next step
  - If branch exists, will checkout to create worktree

### 3. Create Git Worktree

- From REPO_ROOT, create worktree with: `git worktree add ${REPO_ROOT}-trees/<BRANCH_NAME> <BRANCH_NAME>`
  - If branch doesn't exist, use: `git worktree add -b <BRANCH_NAME> ${REPO_ROOT}-trees/<BRANCH_NAME>`
  - This creates WORKTREE_DIR at ${REPO_ROOT}-trees/<BRANCH_NAME>
- Verify worktree was created: `git worktree list | grep ${REPO_ROOT}-trees/<BRANCH_NAME>`

### 4. Setup Environment

- Check if `development/frontend/.env.local` exists in main project
- If it exists:
  - Copy it to worktree: `cp development/frontend/.env.local <WORKTREE_DIR>/development/frontend/.env.local`
  - Note: This preserves API keys and service configuration
- If it doesn't exist:
  - Check for `.env.example`: `cp development/frontend/.env.example <WORKTREE_DIR>/development/frontend/.env.local`
  - Add warning to report that user needs to configure env vars

### 5. Install Dependencies

- Install dependencies:
  - `cd <WORKTREE_DIR>/development/frontend && npm install`
  - Verify `<WORKTREE_DIR>/development/frontend/node_modules` directory was created

### 6. Start Dev Servers

**Frontend (Next.js):**
- Use the frontend-server script with PORT=0 for OS-assigned port:
  ```
  FENRIR_FRONTEND_PORT=0 FENRIR_FRONTEND_DIR=<WORKTREE_DIR>/development/frontend <REPO_ROOT>/.claude/scripts/frontend-server.sh start
  ```
- The script waits for Next.js to start, parses the assigned port, and writes it to `<WORKTREE_DIR>/development/frontend/.port`
- Read the assigned port: `cat <WORKTREE_DIR>/development/frontend/.port`
- Verify server is running:
  - Health check: `curl -s -o /dev/null -w "%{http_code}" http://localhost:$(cat <WORKTREE_DIR>/development/frontend/.port)`

**Backend (Node/TS):**
- If `<WORKTREE_DIR>/development/backend` exists and has a `package.json`:
  - Install dependencies: `cd <WORKTREE_DIR>/development/backend && npm install`
  - Start the backend server (use similar PORT=0 approach if backend-server.sh supports it)
- If backend directory does not exist, skip and note "Backend: not configured" in report

### 7. Validation

- Verify directory structure:
  - Confirm WORKTREE_DIR exists
  - Confirm `<WORKTREE_DIR>/development/frontend/.env.local` exists (or warn)
  - Confirm `<WORKTREE_DIR>/development/frontend/node_modules` exists
  - Confirm `<WORKTREE_DIR>/development/frontend/.port` exists and contains a port number
  - If backend exists: confirm `<WORKTREE_DIR>/development/backend/node_modules` exists
- List worktrees to confirm: `git worktree list`
- Read actual port: `cat <WORKTREE_DIR>/development/frontend/.port`
- Confirm frontend dev server is responding on the assigned port

### 8. Report

Follow the Report section format below to provide comprehensive setup information.

## Report

After successful worktree creation, validation, and startup, provide a detailed report:

```
Worktree Created and Running

Location:   ${REPO_ROOT}-trees/<BRANCH_NAME>
Branch:     <BRANCH_NAME>
Frontend:   port <ACTUAL_PORT> (OS-assigned)
Backend:    not configured
Status:     RUNNING

Access URL:
  Frontend: http://localhost:<ACTUAL_PORT>

Port file: <WORKTREE_DIR>/development/frontend/.port

Dependencies:
  Frontend: npm packages installed at <WORKTREE_DIR>/development/frontend/node_modules

Environment:
  .env.local copied from main project (or: WARNING - needs manual setup)

Frontend Dev Server:
  Started via frontend-server.sh (port auto-assigned by OS)
  Logs: <WORKTREE_DIR>/development/frontend/logs/frontend-server.log

To discover the port:
  cat <WORKTREE_DIR>/development/frontend/.port
  # or
  FENRIR_FRONTEND_DIR=<WORKTREE_DIR>/development/frontend .claude/scripts/frontend-server.sh port

To manage this worktree's frontend:
  FENRIR_FRONTEND_DIR=<WORKTREE_DIR>/development/frontend .claude/scripts/frontend-server.sh status|restart|stop|logs

To remove this worktree:
  /remove_worktree <BRANCH_NAME>
```

If any validation steps failed or warnings occurred, include:

```
Warnings / Action Required:
- <List any warnings or actions the user needs to take>
```
