# Worktree Operations Guide

Detailed step-by-step instructions for each worktree operation.

## CREATE Operations

**When user wants to create a worktree:**

### Step 1: Extract information
- **Branch name** (required) - The git branch to create the worktree from
- **Port offset** (optional) - Custom port offset, defaults to auto-calculated

### Step 2: Invoke command
```
/create_worktree_prompt <branch-name> [port-offset]
```

### Step 3: What happens automatically
The command handles:
- Creates git worktree in `trees/<branch-name>`
- Configures a unique port (9653 + offset)
- Copies `.env.local` from main project
- Installs npm dependencies
- Starts the dev server using `.claude/scripts/dev-server.sh`
- Provides access URL

### Step 4: Share results with user
Include:
- App URL (e.g., http://localhost:9654)
- Configured port
- How to manage the dev server
- Location of worktree directory

---

## LIST Operations

**When user wants to see worktrees:**

### Step 1: Invoke command
```
/list_worktrees_prompt
```

### Step 2: What the command shows
- All existing worktrees with their paths
- Port configuration for each
- Dev server status (running/stopped with PIDs)
- Access URLs for each worktree
- Quick action commands

### Step 3: Share the overview with user
Highlight:
- Which worktrees have running dev servers
- How to access each one
- Any issues or conflicts

---

## REMOVE Operations

**When user wants to remove a worktree:**

### Step 1: Extract information
- **Branch name** (required) - The name of the worktree to remove

### Step 2: Invoke command
```
/remove_worktree_prompt <branch-name>
```

### Step 3: What happens automatically
- Stops the dev server using `.claude/scripts/dev-server.sh`
- Removes the git worktree
- Deletes the git branch
- Validates complete removal

### Step 4: Confirm removal with user
Share:
- Confirmation that worktree was removed
- Dev server that was stopped
- Any cleanup actions performed
