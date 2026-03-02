# Plan: Dev Setup Restructure

> **Status: COMPLETED** — All three stories shipped in Sprint 5. This spec is retained for historical reference.

## Task Description

Rename `development/src` to `development/frontend`, consolidate service management scripts, and sync all agent documentation. Three sequential stories touching 40+ files.

## Objective

Align the directory structure with the multi-service architecture (frontend at `development/frontend/`), unify service lifecycle scripts, and ensure all docs reference correct paths.

## Relevant Files

- `development/frontend/` — the renamed Next.js project root
- `.claude/scripts/frontend-server.sh` — renamed from `dev-server.sh`
- `.claude/scripts/services.sh` — unified service management
- `designs/` — all agent documentation directories

## Team Orchestration

### Team Members

- Builder
  - Name: fireman-decko
  - Role: Architecture, system design, implementation
  - Agent Type: fireman-decko-principal-engineer
- Validator
  - Name: loki
  - Role: QA testing, validation, ship/no-ship decision
  - Agent Type: loki-qa-tester

## Step by Step Tasks

### 1. Rename development/src to development/frontend
- **Task ID**: rename-frontend
- **Depends On**: none
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: false
- `git mv development/src development/frontend`
- Update all references across scripts, agents, commands, skills, docs, README, settings (~150+ occurrences in 40+ files)

### 2. Service Script Consolidation
- **Task ID**: service-scripts
- **Depends On**: rename-frontend
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: false
- Rename `dev-server.sh` to `frontend-server.sh`
- Create `services.sh` unified wrapper
- Update all worktree prompts

### 3. Doc-Sync All Agents + README
- **Task ID**: doc-sync-readme
- **Depends On**: service-scripts
- **Assigned To**: fireman-decko
- **Agent Type**: fireman-decko-principal-engineer
- **Parallel**: false
- Run `/doc-sync` for all 4 agents
- Update README with correct paths and ports

## Acceptance Criteria

- [x] `development/src/` no longer exists
- [x] `development/frontend/` contains the full Next.js project
- [x] All scripts, commands, agents, and docs reference the new path
- [x] `frontend-server.sh` and `services.sh` work correctly
- [x] `npm run build` passes in `development/frontend/`
- [x] All 4 agent directories have up-to-date docs
- [x] README references correct paths and ports

## Validation Commands

- `cd development/frontend && npx tsc --noEmit` — Type-check the codebase
- `cd development/frontend && npx next lint` — Lint the codebase
- `cd development/frontend && npm run build` — Verify the build succeeds

## Notes

- The rename in Story 1 was the highest-risk item (40+ files)
- Vercel dashboard config was updated separately (Root Directory → `development/frontend`)
- Existing worktrees were recreated after the rename
