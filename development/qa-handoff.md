# QA Handoff: Service Script Consolidation

**Story:** Story 2 -- Service Script Consolidation
**Branch:** `chore/service-scripts`
**Engineer:** FiremanDecko
**Date:** 2026-03-01

---

## What Was Implemented

1. **Renamed `dev-server.sh` to `frontend-server.sh`** for naming consistency with `backend-server.sh`.
2. **Standardized env var names** -- `FENRIR_FRONTEND_PORT` and `FENRIR_FRONTEND_DIR` are now the primary names. Old names (`FENRIR_PORT`, `FENRIR_DEV_DIR`) still work as fallbacks.
3. **Created `services.sh`** -- unified script that manages both frontend and backend servers together.
4. **Updated all documentation** -- commands, worktree prompts, worktree skill files, and subagent definition all reference `frontend-server.sh` and `services.sh`.
5. **Standardized output prefixes** -- both scripts now prefix output with their service name (e.g., `Frontend: running (pid 12345) on port 9653`).
6. **Cleaned up stale worktrees** -- removed `agent-aed8f05d` and its nested worktrees.

## Files Created / Modified

| File | Change |
|------|--------|
| `.claude/scripts/frontend-server.sh` | RENAMED from `dev-server.sh`. Updated env vars, header, output prefixes, log filename. |
| `.claude/scripts/backend-server.sh` | Updated output prefixes to include `Backend:` prefix for consistency. |
| `.claude/scripts/services.sh` | NEW -- unified script delegating to frontend-server.sh and backend-server.sh. |
| `.claude/commands/dev-server.md` | Rewritten to cover all three scripts with migration note. |
| `.claude/commands/create_worktree_prompt.md` | Updated all script refs and env var names. |
| `.claude/commands/remove_worktree_prompt.md` | Updated all script refs and env var names. |
| `.claude/commands/list_worktrees_prompt.md` | Updated all script refs and env var names. |
| `.claude/skills/worktree-manager-skill/REFERENCE.md` | Updated directory tree, script names, env var table. |
| `.claude/skills/worktree-manager-skill/TROUBLESHOOTING.md` | Updated all script refs. |
| `.claude/skills/worktree-manager-skill/OPERATIONS.md` | Updated all script refs. |
| `.claude/skills/worktree-manager-skill/SKILL.md` | Updated script reference in notes section. |
| `.claude/agents/create_worktree_subagent.md` | Updated script references. |
| `development/frontend/LOKI-TEST-PLAN-anon-auth.md` | Updated stale `dev-server.sh` reference. |
| `development/qa-handoff.md` | This file (replaces previous handoff). |

## How to Verify

### 1. Script Execution

All three scripts should work from the repo root:

```bash
.claude/scripts/frontend-server.sh status
.claude/scripts/backend-server.sh status
.claude/scripts/services.sh status
```

### 2. Unified Script Actions

```bash
# Start both services (backend first, then frontend)
.claude/scripts/services.sh start

# Check status of both
.claude/scripts/services.sh status

# Stop both
.claude/scripts/services.sh stop

# Restart both
.claude/scripts/services.sh restart

# Tail logs
.claude/scripts/services.sh logs frontend
.claude/scripts/services.sh logs backend
.claude/scripts/services.sh logs          # both interleaved
```

### 3. Backward Compatibility

Old env var names should still work:

```bash
FENRIR_PORT=9654 .claude/scripts/frontend-server.sh status
FENRIR_DEV_DIR=/some/path .claude/scripts/frontend-server.sh status
```

New env var names take precedence:

```bash
FENRIR_FRONTEND_PORT=9654 FENRIR_PORT=9999 .claude/scripts/frontend-server.sh status
# Should use 9654, not 9999
```

### 4. No Stale References

```bash
grep -r "dev-server\.sh" .claude/ --include="*.md" --include="*.sh"
```

Should return ONLY the migration note in `dev-server.md` (intentional documentation).

### 5. Stale Worktree Cleanup

```bash
git worktree list
```

Should NOT contain `agent-aed8f05d` or its nested worktrees.

## Known Limitations

- `sessions/super-wolf.html` still references `dev-server.sh` in historical session text. This is an archived session log and should not be modified.
- The `dev-server.md` command file retains its filename for backward compatibility with existing slash command muscle memory. Its content has been updated to document all three scripts.

## Suggested Test Focus

1. **services.sh start/stop/restart** -- verify backend starts before frontend on `start`, both stop on `stop`.
2. **Backward compat** -- old `FENRIR_PORT` / `FENRIR_DEV_DIR` env vars still work.
3. **Precedence** -- new `FENRIR_FRONTEND_PORT` overrides old `FENRIR_PORT`.
4. **Output format** -- verify service name prefixes in output (e.g., `Frontend: running`, `Backend: not running`).
5. **Log file paths** -- frontend logs now go to `frontend-server.log` (not `dev-server.log`).

---

*FiremanDecko -- Principal Engineer*
