---
name: worktree-manager-skill
description: Comprehensive git worktree management. Use when the user wants to create, remove, list, or manage worktrees. Handles all worktree operations including creation, deletion, and status checking.
allowed-tools: SlashCommand, Bash, Read, Write, Edit, Glob, Grep
---

# Worktree Manager Skill

Complete worktree lifecycle management for parallel development of the Fenrir Ledger Next.js app. Each worktree gets an isolated branch, port, dependencies, and dev server instance.

## When to use this skill

Use this skill when the user wants to:
- **Create** a new worktree for parallel development
- **Remove** an existing worktree
- **List** all worktrees and their status
- **Check** worktree configuration or status
- **Manage** multiple parallel development environments

**Do NOT use this skill when:**
- User asks for a specific subagent or skill delegation
- User wants to manually use git commands directly
- The task is unrelated to worktree management

## Operations Overview

| Operation | Command | When to Use |
|-----------|---------|-------------|
| **Create** | `/create_worktree_prompt` | User wants a new parallel environment |
| **List** | `/list_worktrees_prompt` | User wants to see existing worktrees |
| **Remove** | `/remove_worktree_prompt` | User wants to delete a worktree |

## Decision Tree

### 1. User wants to CREATE a worktree
**Keywords:** create, new, setup, make, build, start, initialize
**Action:** Use `/create_worktree_prompt <branch-name> [port-offset]`

### 2. User wants to LIST worktrees
**Keywords:** list, show, display, what, which, status, check, view
**Action:** Use `/list_worktrees_prompt`

### 3. User wants to REMOVE a worktree
**Keywords:** remove, delete, cleanup, destroy, stop, kill, terminate
**Action:** Use `/remove_worktree_prompt <branch-name>`

## Quick Start

For step-by-step operation instructions, see [OPERATIONS.md](OPERATIONS.md).
For detailed examples and usage patterns, see [EXAMPLES.md](EXAMPLES.md).
For troubleshooting and common issues, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
For technical details and quick reference, see [REFERENCE.md](REFERENCE.md).

## Important Notes

### Do NOT attempt to:
- Create worktrees manually with git commands
- Manually configure ports or environment files
- Use bash to remove directories directly
- Manage dev server processes manually (use the dev-server script)

### Always use the slash commands because they:
- Handle all configuration automatically
- Ensure port uniqueness
- Validate operations
- Use the dev-server skill for server management
- Clean up properly on removal
