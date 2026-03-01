# Worktree Usage Examples

Real-world examples demonstrating how to handle different worktree management scenarios.

## Example 1: Create a new worktree

**User says:** "Create a worktree for the feature-authentication branch"

**Your action:**
1. Use SlashCommand: `/create_worktree_prompt feature-authentication`
2. Share the output showing access URL and port

**Result:** New worktree created at `trees/feature-authentication` with dev server running

**Sample response to user:**
> Created a new worktree for `feature-authentication`. It's running at http://localhost:9654

---

## Example 2: Create with specific port offset

**User says:** "Set up a parallel environment on branch hotfix-security with port offset 3"

**Your action:**
1. Use SlashCommand: `/create_worktree_prompt hotfix-security 3`
2. Share output (will use port 9656)

**Sample response to user:**
> Created worktree for `hotfix-security` at http://localhost:9656

---

## Example 3: List all worktrees

**User says:** "What worktrees do I have?"

**Your action:**
1. Use SlashCommand: `/list_worktrees_prompt`
2. Share the comprehensive overview

---

## Example 4: Remove a worktree

**User says:** "Delete the feature-auth worktree"

**Your action:**
1. Use SlashCommand: `/remove_worktree_prompt feature-auth`
2. Confirm removal completed

**Sample response to user:**
> Removed the `feature-auth` worktree. Dev server stopped, branch deleted.

---

## Example 5: Multiple worktrees

**User says:** "I need worktrees for branches: feature-a, feature-b, and feature-c"

**Your action:**
1. `/create_worktree_prompt feature-a`
2. `/create_worktree_prompt feature-b`
3. `/create_worktree_prompt feature-c`

**Sample response:**
> Created three worktrees:
> 1. feature-a — http://localhost:9654
> 2. feature-b — http://localhost:9655
> 3. feature-c — http://localhost:9656

---

## Pattern Recognition

### Create Keywords
"create", "new", "setup", "make", "start", "initialize", "I need a worktree for..."

### List Keywords
"list", "show", "display", "what", "which", "status", "check", "view"

### Remove Keywords
"remove", "delete", "cleanup", "destroy", "stop", "kill", "get rid of", "don't need"
