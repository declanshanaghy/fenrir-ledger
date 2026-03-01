# Dev Setup Restructure — Orchestration Plan

**Work type:** chore
**Pipeline:** Phase 3 → 4 (no design phase)
**Execution mode:** Sequential (linear dependency chain)

---

## Stories

### Story 1: Rename `development/src` → `development/frontend` + Update All References

**Branch:** `chore/rename-frontend`
**Depends on:** nothing

**Scope:**
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

**Acceptance criteria:**
- `development/src/` no longer exists
- `development/frontend/` contains the full Next.js project
- All scripts, commands, agents, and docs reference the new path
- `npm run build` passes in `development/frontend/`
- `npm run dev` starts on port 9653 from `development/frontend/`

---

### Story 2: Service Script Consolidation

**Branch:** `chore/service-scripts`
**Depends on:** Story 1

**Scope:**
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
5. Update all worktree prompts (`create_worktree_prompt.md`, `remove_worktree_prompt.md`, `list_worktrees_prompt.md`) to:
   - Reference `frontend-server.sh` instead of `dev-server.sh`
   - Use the new `services.sh` for combined start/stop
   - Ensure port offset logic works with new env var names

**Acceptance criteria:**
- `frontend-server.sh start` starts the frontend dev server on 9653
- `backend-server.sh start` starts the backend dev server on 9753
- `services.sh start` starts both services
- `services.sh stop` stops both services
- `services.sh status` reports status of both
- Worktree creation starts services via the new scripts
- Worktree removal stops services via the new scripts

---

### Story 3: Doc-Sync All Agents + README Consolidation

**Branch:** `chore/doc-sync-all`
**Depends on:** Story 2

**Scope:**
1. Run `/doc-sync` for each agent in **parallel** (4 agents):
   - `doc-sync product-owner` → updates `designs/product/`
   - `doc-sync ux-designer` → updates `designs/ux-design/` (mapped as `ux/`)
   - `doc-sync principal-engineer` → updates `designs/architecture/`
   - `doc-sync qa-tester` → updates `designs/quality/` (if it exists, or `quality/`)
2. Collect `.sync-report.md` from each agent's directory
3. Update top-level `README.md`:
   - Fix quick-start instructions (currently says port 9999, should be 9653)
   - Update all `development/src` references to `development/frontend`
   - Reference new `services.sh` in the "Quick Start" section
   - Incorporate any structural changes from doc-sync reports
4. Update `MEMORY.md` with new paths and sprint info

**Acceptance criteria:**
- All 4 agent directories have up-to-date docs
- Top-level `README.md` references correct paths and ports
- Quick-start instructions work end-to-end

---

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
