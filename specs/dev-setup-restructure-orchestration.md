# Dev Setup Restructure — Orchestration Plan

**Work type:** chore
**Pipeline:** Phase 3 → 4 (no design phase)
**Execution mode:** Sequential (linear dependency chain)

## Task Description

Restructure the development environment layout by renaming `development/src` to `development/frontend`, consolidating service management scripts, and running a full doc-sync across all team agent directories. This is a housekeeping sprint to make the repo layout match conventions established in Sprint 5 and beyond.

## Objective

After this work is complete:
- `development/frontend/` contains the Next.js project (was `development/src/`)
- All scripts, commands, agents, and docs reference the new path
- A unified `services.sh` script manages both frontend and backend services
- All four team agent documentation directories are up-to-date
- The top-level `README.md` reflects correct paths and ports

## Relevant Files

### Story 1 — Rename `development/src` → `development/frontend`

- `development/src/` → `development/frontend/` (git mv)
- `.claude/scripts/dev-server.sh` — references to update
- `.claude/scripts/backend-server.sh` — references to update
- `.claude/scripts/setup-local.sh` — references to update
- `.claude/agents/fireman-decko.md` — path references
- `.claude/agents/loki.md` — path references
- `.claude/commands/create_worktree_prompt.md` — path references
- `.claude/commands/dev-server.md` — path references
- `.claude/commands/list_worktrees_prompt.md` — path references
- `.claude/commands/remove_worktree_prompt.md` — path references
- `.claude/commands/plan_w_team.md` — path references
- `.claude/skills/easter-egg-modal/SKILL.md` — path references
- `.claude/skills/worktree-manager-skill/*.md` — path references
- `designs/architecture/*.md` — ~25 ADR and design docs
- `README.md` — root readme
- `development/README.md` — dev readme
- `.claude/settings.local.json` — build/typecheck commands
- `memory/MEMORY.md` — key paths section

### Story 2 — Service Script Consolidation

- `.claude/scripts/dev-server.sh` → renamed to `frontend-server.sh`
- `.claude/scripts/frontend-server.sh` — new name after rename
- `.claude/scripts/backend-server.sh` — interface parity changes
- `.claude/scripts/services.sh` — new unified script to create
- `.claude/commands/dev-server.md` — updated to reference new script
- `.claude/commands/create_worktree_prompt.md` — reference new scripts
- `.claude/commands/remove_worktree_prompt.md` — reference new scripts
- `.claude/commands/list_worktrees_prompt.md` — reference new scripts

### Story 3 — Doc-Sync All Agents + README Consolidation

- `designs/product/` — Freya's docs
- `designs/ux-design/` — Luna's docs
- `designs/architecture/` — FiremanDecko's docs
- `designs/quality/` — Loki's docs (if exists)
- `README.md` — root readme (fix port, paths, quick-start)
- `memory/MEMORY.md` — update paths and sprint info

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. You use `Task` and `Task*` tools to deploy team members to do the building, validating, testing, deploying, and other tasks.
- Take note of the session id of each team member. This is how you'll reference them.

### Team Members

- Builder
  - Name: fireman-decko
  - Role: Architecture, system design, implementation
  - Agent Type: fireman-decko-principal-engineer
  - Resume: true
- Validator
  - Name: loki
  - Role: QA testing, validation, ship/no-ship decision
  - Agent Type: loki-qa-tester
  - Resume: true

## Step by Step Tasks

### 1. Rename `development/src` → `development/frontend` + Update All References

- **Task ID**: rename-frontend-dir
- **Depends On**: none
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: false
- **Branch**: `chore/rename-frontend`

Steps:
1. `git mv development/src development/frontend`
2. Update **all** references to `development/src` across the codebase (~150+ occurrences in 40+ files):
   - **Scripts** (5 files): `dev-server.sh`, `backend-server.sh`, `setup-local.sh`, worktree commands
   - **Agent prompts** (2 files): `fireman-decko.md`, `loki.md`
   - **Commands** (5 files): `create_worktree_prompt.md`, `dev-server.md`, `list_worktrees_prompt.md`, `remove_worktree_prompt.md`, `plan_w_team.md`
   - **Skills** (3+ files): `easter-egg-modal/SKILL.md`, `worktree-manager-skill/*.md`
   - **Architecture & design docs** (~25 files): ADRs, system-design, implementation briefs
   - **README files** (2 files): root `README.md`, `development/README.md`
   - **Settings** (1 file): `.claude/settings.local.json` build/typecheck commands
3. Update `MEMORY.md` key paths section
4. Verify build still passes: `cd development/frontend && npm run build`
5. Verify TypeScript: `npx tsc --noEmit`

- **Acceptance Criteria**:
  - `development/src/` no longer exists
  - `development/frontend/` contains the full Next.js project
  - All scripts, commands, agents, and docs reference the new path
  - `npm run build` passes in `development/frontend/`
  - `npm run dev` starts on port 9653 from `development/frontend/`

---

### 2. Service Script Consolidation

- **Task ID**: consolidate-service-scripts
- **Depends On**: rename-frontend-dir
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: false
- **Branch**: `chore/service-scripts`

Steps:
1. Rename `.claude/scripts/dev-server.sh` → `.claude/scripts/frontend-server.sh`
2. Ensure both `frontend-server.sh` and `backend-server.sh` have **identical interfaces**:
   - Same actions: `start | stop | restart | status | logs`
   - Same env-var override pattern: `FENRIR_FRONTEND_PORT`, `FENRIR_BACKEND_PORT`, `FENRIR_FRONTEND_DIR`, `FENRIR_BACKEND_DIR`
   - Same log format and location pattern
3. Create `.claude/scripts/services.sh` — unified script:
   - `services.sh start` — starts both frontend and backend
   - `services.sh stop` — stops both
   - `services.sh restart` — restarts both
   - `services.sh status` — shows status of both
   - `services.sh logs [frontend|backend]` — tails logs for one or both
   - Delegates to `frontend-server.sh` and `backend-server.sh` internally
4. Update `.claude/commands/dev-server.md` to reference new script name and add unified option
5. Update all worktree prompts to use `frontend-server.sh` and `services.sh`

- **Acceptance Criteria**:
  - `frontend-server.sh start` starts the frontend dev server on 9653
  - `backend-server.sh start` starts the backend dev server on 9753
  - `services.sh start` starts both services
  - `services.sh stop` stops both services
  - `services.sh status` reports status of both
  - Worktree creation starts services via the new scripts
  - Worktree removal stops services via the new scripts

---

### 3. Doc-Sync All Agents + README Consolidation

- **Task ID**: doc-sync-all-agents
- **Depends On**: consolidate-service-scripts
- **Assigned To**: fireman-decko (orchestrates), loki (validates)
- **Agent Type**: fireman-decko-principal-engineer, loki-qa-tester
- **Parallel**: false
- **Branch**: `chore/doc-sync-all`

Steps (fireman-decko):
1. Run `/doc-sync` for each agent in **parallel** (4 agents):
   - `doc-sync product-owner` → updates `designs/product/`
   - `doc-sync ux-designer` → updates `designs/ux-design/`
   - `doc-sync principal-engineer` → updates `designs/architecture/`
   - `doc-sync qa-tester` → updates `designs/quality/`
2. Collect `.sync-report.md` from each agent's directory
3. Update top-level `README.md`:
   - Fix quick-start instructions (currently says port 9999, should be 9653)
   - Update all `development/src` references to `development/frontend`
   - Reference new `services.sh` in the "Quick Start" section
4. Update `MEMORY.md` with new paths and sprint info

Steps (loki, after fireman-decko merges):
- Validate all four agent doc directories are up to date
- Verify README quick-start instructions work end-to-end
- Check no stale `development/src` references remain
- Report: SHIP / FIX REQUIRED

- **Acceptance Criteria**:
  - All 4 agent directories have up-to-date docs
  - Top-level `README.md` references correct paths and ports
  - Quick-start instructions work end-to-end
  - No remaining references to `development/src` in any file

## Acceptance Criteria

### Story 1 — Rename
- [ ] `development/src/` no longer exists; `development/frontend/` is the Next.js project root
- [ ] `npm run build` passes in `development/frontend/`
- [ ] `npx tsc --noEmit` passes in `development/frontend/`
- [ ] Zero remaining references to `development/src` in scripts, agents, commands, skills, or docs
- [ ] `MEMORY.md` updated with new key file paths

### Story 2 — Scripts
- [ ] `frontend-server.sh start|stop|restart|status|logs` all work correctly
- [ ] `backend-server.sh start|stop|restart|status|logs` all work correctly
- [ ] `services.sh start` starts both frontend (9653) and backend (9753)
- [ ] `services.sh stop` stops both services cleanly
- [ ] `services.sh status` correctly reports running/stopped state for both
- [ ] Worktree creation and removal use the new script names

### Story 3 — Docs
- [ ] All 4 agent doc directories refreshed by doc-sync
- [ ] Root `README.md` references `development/frontend/` and port 9653
- [ ] Quick-start: `services.sh start` documented in README
- [ ] No stale content or broken links in any agent directory

### General
- [ ] All three PRs pass CI (build + TypeScript checks)
- [ ] No regressions to existing dev workflow

## Dependency Graph

```
Story 1 (rename)
    └──→ Story 2 (scripts)
              └──→ Story 3 (doc-sync + README)
```

**Execution:** Sequential — each story creates a PR, gets validated, then the next begins.

## Risk Notes

- The rename in Story 1 is the highest-risk item (touches 40+ files)
- Vercel dashboard config must be updated separately (Root Directory → `development/frontend`)
- Existing worktrees may break after rename — warn users to recreate
