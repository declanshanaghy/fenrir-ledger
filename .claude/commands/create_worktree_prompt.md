---
model: claude-sonnet-4-5-20250929
description: Create a git worktree with isolated configuration for parallel development
argument-hint: [branch-name] [port-offset]
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

# Purpose

Create a new git worktree in the `trees/` directory with completely isolated configuration for parallel execution. Each worktree gets its own branch, port, dependencies, and dev server instance so multiple agents can work independently and simultaneously.

## Variables

```
PROJECT_CWD: . (current working directory - the main project root)
BRANCH_NAME: $1 (required)
PORT_OFFSET: $2 (optional, defaults to auto-calculated based on existing worktrees, starts at 1)
WORKTREE_BASE_DIR: trees/
WORKTREE_DIR: trees/<BRANCH_NAME>
APP_DIR: <WORKTREE_DIR>/development/src
BASE_PORT: 9653
PORT: 9653 + PORT_OFFSET  # First worktree: 9654, Second: 9655, etc.
DEV_SERVER_SCRIPT: .claude/scripts/dev-server.sh

NOTE: Main repo uses port 9653 (no offset)
      Worktrees start at offset 1 to avoid conflicts with main repo
```

## Instructions

- This is a ONE-SHOT command that creates AND starts a worktree automatically
- Creates a fully functional, isolated clone of the codebase in a separate worktree
- Each worktree runs on a unique port to prevent conflicts when running in parallel
- Port offsets start at 1 and increment (1 -> 9654, 2 -> 9655, 3 -> 9656...)
- Main repo preserves default port 9653 for primary development work
- Dependencies are installed automatically via npm
- After setup, the dev server is started using the dev-server skill/script
- If branch doesn't exist locally, create it from current HEAD
- If branch exists but isn't checked out, create worktree from it
- Provide clear access URL so user can immediately use the running instance

## Workflow

### 1. Parse and Validate Arguments

- Read BRANCH_NAME from $1, error if missing
- Read PORT_OFFSET from $2 if provided
- If PORT_OFFSET not provided, calculate next available offset:
  - List all existing worktrees: `git worktree list`
  - Check PROJECT_CWD/trees/ directory for existing worktrees
  - Count existing worktrees and use (count + 1) as offset (1, 2, 3, 4...)
  - IMPORTANT: Offset starts at 1 to preserve main repo port (9653)
  - First worktree gets offset 1 -> port 9654
  - Second worktree gets offset 2 -> port 9655
- Calculate PORT = 9653 + PORT_OFFSET
- Validate branch name format (no spaces, valid git branch name)

### 2. Pre-Creation Validation

- Check if PROJECT_CWD/trees/ directory exists, create if not: `mkdir -p trees`
- Verify trees/ is in PROJECT_CWD/.gitignore (should be there already)
- Check if worktree already exists at WORKTREE_DIR
- Check if branch exists: `git branch --list <BRANCH_NAME>`
  - If branch doesn't exist, will create it in next step
  - If branch exists, will checkout to create worktree
- Check if calculated port is available:
  - Check PORT: `lsof -i :<PORT>` (should return nothing)
  - If port is in use, error with message to try different offset

### 3. Create Git Worktree

- From PROJECT_CWD, create worktree with: `git worktree add trees/<BRANCH_NAME> <BRANCH_NAME>`
  - If branch doesn't exist, use: `git worktree add -b <BRANCH_NAME> trees/<BRANCH_NAME>`
  - This creates WORKTREE_DIR at PROJECT_CWD/trees/<BRANCH_NAME>
- Verify worktree was created: `git worktree list | grep trees/<BRANCH_NAME>`

### 4. Setup Environment

- Check if `development/src/.env.local` exists in main project
- If it exists:
  - Copy it to worktree: `cp development/src/.env.local <WORKTREE_DIR>/development/src/.env.local`
  - Note: This preserves API keys and service configuration
- If it doesn't exist:
  - Check for `.env.example`: `cp development/src/.env.example <WORKTREE_DIR>/development/src/.env.local`
  - Add warning to report that user needs to configure env vars

### 5. Install Dependencies

- Install dependencies:
  - `cd <WORKTREE_DIR>/development/src && npm install`
  - Verify `<WORKTREE_DIR>/development/src/node_modules` directory was created

### 6. Start Dev Server

- Use the dev-server script with environment overrides:
  ```
  FENRIR_PORT=<PORT> FENRIR_DEV_DIR=<PROJECT_CWD>/trees/<BRANCH_NAME>/development/src <PROJECT_CWD>/.claude/scripts/dev-server.sh start
  ```
- Wait 5 seconds for the server to start: `sleep 5`
- Verify server is running:
  - Check status: `FENRIR_PORT=<PORT> <PROJECT_CWD>/.claude/scripts/dev-server.sh status`
  - Health check: `curl -s -o /dev/null -w "%{http_code}" http://localhost:<PORT>`

### 7. Validation

- Verify directory structure:
  - Confirm WORKTREE_DIR exists
  - Confirm `<WORKTREE_DIR>/development/src/.env.local` exists (or warn)
  - Confirm `<WORKTREE_DIR>/development/src/node_modules` exists
- List worktrees to confirm: `git worktree list`
- Confirm dev server is responding on PORT

### 8. Report

Follow the Report section format below to provide comprehensive setup information.

## Report

After successful worktree creation, validation, and startup, provide a detailed report:

```
Worktree Created and Running

Location:   trees/<BRANCH_NAME>
Branch:     <BRANCH_NAME>
Port:       <PORT> (offset <PORT_OFFSET>)
Status:     RUNNING

Access URL:
  http://localhost:<PORT>

Dependencies:
  npm packages installed at <WORKTREE_DIR>/development/src/node_modules

Environment:
  .env.local copied from main project (or: WARNING - needs manual setup)

Dev Server:
  Started via dev-server.sh on port <PORT>
  Logs: <WORKTREE_DIR>/development/src/logs/dev-server.log

To manage this worktree's dev server:
  FENRIR_PORT=<PORT> FENRIR_DEV_DIR=<PROJECT_CWD>/trees/<BRANCH_NAME>/development/src .claude/scripts/dev-server.sh status
  FENRIR_PORT=<PORT> FENRIR_DEV_DIR=<PROJECT_CWD>/trees/<BRANCH_NAME>/development/src .claude/scripts/dev-server.sh restart
  FENRIR_PORT=<PORT> FENRIR_DEV_DIR=<PROJECT_CWD>/trees/<BRANCH_NAME>/development/src .claude/scripts/dev-server.sh stop
  FENRIR_PORT=<PORT> FENRIR_DEV_DIR=<PROJECT_CWD>/trees/<BRANCH_NAME>/development/src .claude/scripts/dev-server.sh logs

To remove this worktree:
  /remove_worktree <BRANCH_NAME>
```

If any validation steps failed or warnings occurred, include:

```
Warnings / Action Required:
- <List any warnings or actions the user needs to take>
```
