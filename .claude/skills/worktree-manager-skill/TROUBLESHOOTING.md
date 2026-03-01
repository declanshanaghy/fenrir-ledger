# Worktree Troubleshooting Guide

Common issues and their solutions when managing worktrees.

## Issue 1: "My worktree isn't working"

### Diagnosis Steps
1. Run `/list_worktrees_prompt` to check status
2. Look for dev server status (running/stopped)
3. Check port configuration

### Solutions
- If dev server is stopped, restart it using the dev-server script
- If port conflicts, use a different port offset
- Check logs: `FENRIR_PORT=<port> FENRIR_DEV_DIR=<dev-dir> .claude/scripts/dev-server.sh logs`

---

## Issue 2: "I can't create a worktree"

### Common Causes
1. **Worktree already exists** - Branch already has a worktree
2. **Invalid branch name** - Branch doesn't exist in repository
3. **Port already in use** - Another process using the port

### Solutions
1. Check existing worktrees: `/list_worktrees_prompt`
2. Verify branch exists: `git branch -a`
3. Try a different port offset if port conflicts
4. Remove old worktree first if recreating

---

## Issue 3: "How do I access my worktree?"

### Solution
1. Run `/list_worktrees_prompt` to see access URLs
2. Open `http://localhost:<PORT>` in your browser
3. Port scheme: main = 9653, worktrees = 9654, 9655, 9656...

---

## Issue 4: "Dev server won't stop"

### Solutions
1. Use `/remove_worktree_prompt` which stops the server first
2. Manually stop: `FENRIR_PORT=<port> .claude/scripts/dev-server.sh stop`
3. Force kill if stuck: `lsof -ti TCP:<port> -sTCP:LISTEN | xargs kill -9`

---

## Issue 5: "Port conflicts"

### Solutions
1. List existing worktrees to see port allocation
2. Use explicit port offset: `/create_worktree_prompt branch-name 4`
3. Remove unused worktrees to free up ports

### Port Allocation Reference
- Main: 9653
- Offset 1: 9654
- Offset 2: 9655
- Offset 3: 9656
- Pattern: 9653 + offset

---

## Issue 6: "Worktree directory exists but not listed"

### Likely Cause
Incomplete removal or manual deletion

### Solutions
1. Check `git worktree list` to see git's view
2. If orphaned, prune: `git worktree prune`
3. Remove directory if needed and re-prune

---

## Issue 7: "Dependencies not installing"

### Solutions
1. Check the creation output for install errors
2. Manually run: `cd trees/<branch-name>/development/frontend && npm install`
3. Verify package.json exists in worktree

---

## General Debugging

1. **Gather info** — Run `/list_worktrees_prompt` first
2. **Check logs** — `FENRIR_PORT=<port> FENRIR_DEV_DIR=<dev-dir> .claude/scripts/dev-server.sh logs`
3. **Check dev server** — `FENRIR_PORT=<port> .claude/scripts/dev-server.sh status`
4. **Resolve** — Use appropriate command
5. **Verify** — Re-run status/list to confirm fix

## Quick Diagnostic Checklist

- Does worktree directory exist? (`ls trees/`)
- Is git aware of it? (`git worktree list`)
- Is the dev server running? (check status via dev-server script)
- Is the port available? (`lsof -i TCP:<port>`)
- Is `.env.local` present? (`ls trees/<branch>/development/frontend/.env.local`)
- Did dependencies install? (`ls trees/<branch>/development/frontend/node_modules`)
