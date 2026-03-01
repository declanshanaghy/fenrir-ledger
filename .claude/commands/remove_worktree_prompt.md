---
model: claude-sonnet-4-5-20250929
description: Remove a git worktree, delete its branch, and stop its running services
argument-hint: <branch-name>
allowed-tools: Bash, Read, Glob, Grep
---

# Purpose

Remove an existing git worktree from the `trees/` directory AND delete the associated git branch. This includes stopping the dev server, cleaning up processes, removing the worktree directory, and permanently deleting the branch.

## Variables

```
PROJECT_CWD: . (current working directory - the main project root)
BRANCH_NAME: $1 (required)
WORKTREE_DIR: trees/<BRANCH_NAME>
DEV_SERVER_SCRIPT: .claude/scripts/dev-server.sh
```

## Instructions

- This command safely removes a worktree and all associated resources
- Stops the dev server using the dev-server script
- Removes the git worktree using git's built-in removal command
- Deletes the git branch associated with the worktree (PERMANENT)
- Validates that the worktree and branch were completely removed
- WARNING: Both worktree and branch deletion are permanent and cannot be undone

## Workflow

### 1. Parse and Validate Arguments

- Read BRANCH_NAME from $1, error if missing
- Construct WORKTREE_DIR path: `PROJECT_CWD/trees/<BRANCH_NAME>`
- Validate branch name format

### 2. Check Worktree Existence

- List all worktrees: `git worktree list`
- Check if worktree exists at WORKTREE_DIR
- If worktree doesn't exist:
  - Check if directory exists anyway (orphaned directory)
  - If neither exists, error with message that worktree not found

### 3. Identify Ports

- Find which ports the worktree's servers are using:
  - Check running processes in the worktree dir: `ps aux | grep "trees/<BRANCH_NAME>"`
  - Scan frontend ports 9654-9663 for a process whose working dir matches the worktree
  - Scan backend ports 9754-9763 for a process whose working dir matches the worktree
- Note both ports for stopping servers

### 4. Stop Servers

**Stop Frontend Dev Server:**
- If frontend port was identified:
  ```
  FENRIR_PORT=<FRONTEND_PORT> FENRIR_DEV_DIR=<PROJECT_CWD>/trees/<BRANCH_NAME>/development/frontend .claude/scripts/dev-server.sh stop
  ```
- Verify stopped: `FENRIR_PORT=<FRONTEND_PORT> .claude/scripts/dev-server.sh status`

**Stop Backend Server:**
- If backend port was identified:
  ```
  FENRIR_BACKEND_PORT=<BACKEND_PORT> FENRIR_BACKEND_DIR=<PROJECT_CWD>/trees/<BRANCH_NAME>/development/backend .claude/scripts/backend-server.sh stop
  ```
- Verify stopped: `FENRIR_BACKEND_PORT=<BACKEND_PORT> .claude/scripts/backend-server.sh status`

- If ports couldn't be identified, try to find and kill any process in the worktree directory:
  - `lsof -t +D <WORKTREE_DIR>/development/frontend | xargs kill 2>/dev/null`
  - `lsof -t +D <WORKTREE_DIR>/development/backend | xargs kill 2>/dev/null`
- Wait 2 seconds for processes to fully terminate

### 5. Remove Git Worktree

- Remove worktree: `git worktree remove trees/<BRANCH_NAME>`
- If removal fails (uncommitted changes):
  - Try force removal: `git worktree remove trees/<BRANCH_NAME> --force`
  - Note the force removal in the report
- Verify worktree was removed: `git worktree list | grep trees/<BRANCH_NAME>` (should return nothing)

### 6. Delete Git Branch

- After worktree is removed, delete the branch:
  - Try safe delete: `git branch -d <BRANCH_NAME>`
  - If fails (unmerged changes), force delete: `git branch -D <BRANCH_NAME>`
  - Note in report if force delete was used
- Verify branch deleted: `git branch --list <BRANCH_NAME>` (should return nothing)

### 7. Validation

- Confirm worktree no longer in: `git worktree list`
- Confirm directory no longer exists at WORKTREE_DIR
- Confirm branch no longer exists: `git branch --list <BRANCH_NAME>`
- Confirm no process running on the identified port

### 8. Report

```
Worktree and Branch Removed

Location: trees/<BRANCH_NAME>
Branch:   <BRANCH_NAME>
Status:   REMOVED

Cleanup:
  Frontend server stopped (port <FRONTEND_PORT>)
  Backend server stopped (port <BACKEND_PORT>) [or: was not running]
  Git worktree removed
  Git branch deleted
  Directory removed from trees/

Note: Both the worktree AND branch '<BRANCH_NAME>' have been permanently deleted.
      To recreate: /create_worktree <BRANCH_NAME>
```

If any issues occurred:

```
Warnings:
- <e.g., Used --force to remove worktree (had uncommitted changes)>
- <e.g., Used -D to force delete branch (had unmerged changes)>
- <e.g., Port could not be identified (no running server found)>
```
