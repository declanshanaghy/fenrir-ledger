# QA Handoff -- Rename development/src to development/frontend

**From**: FiremanDecko (Principal Engineer)
**To**: Loki (QA Tester)
**Branch**: `chore/rename-frontend`
**Date**: 2026-03-01

---

## What Was Implemented

Renamed the frontend project directory from `development/src` to `development/frontend` for clarity and consistency with the existing `development/backend` directory. Updated all path references across the entire codebase (55 files, approximately 150+ occurrences).

---

## Files Modified

### Directory Rename
- `development/src/` -> `development/frontend/` (via `git mv`)

### Scripts (2 files)
- `.claude/scripts/dev-server.sh` -- updated `FENRIR_DEV_DIR` default path
- `development/scripts/setup-local.sh` -- updated `REPO_ROOT/development/src` references

### Agent Prompts (2 files)
- `.claude/agents/fireman-decko.md` -- updated Source Code path and Vercel Root Directory
- `.claude/agents/loki.md` -- updated Source Code path

### Commands (5 files)
- `.claude/commands/create_worktree_prompt.md` -- updated all worktree path references
- `.claude/commands/dev-server.md` -- updated dev server path references
- `.claude/commands/list_worktrees_prompt.md` -- updated worktree listing paths
- `.claude/commands/plan_w_team.md` -- updated build/lint/typecheck commands
- `.claude/commands/remove_worktree_prompt.md` -- updated worktree removal paths

### Skills (3 files)
- `.claude/skills/easter-egg-modal/SKILL.md` -- updated public asset and component paths
- `.claude/skills/worktree-manager-skill/REFERENCE.md` -- updated worktree reference paths
- `.claude/skills/worktree-manager-skill/TROUBLESHOOTING.md` -- updated troubleshooting paths

### CI/CD Workflows (2 files)
- `.github/workflows/vercel-preview.yml` -- updated path triggers and working directories
- `.github/workflows/vercel-production.yml` -- updated path triggers and working directories

### Configuration (2 files)
- `.claude/settings.local.json` -- updated build/typecheck command paths
- `.gitignore` -- updated ignore path

### Architecture and Design Docs (9 files)
- `architecture/adrs/ADR-001-tech-stack.md`
- `architecture/adrs/ADR-003-local-storage.md`
- `architecture/implementation-brief.md`
- `architecture/system-design.md`
- `designs/architecture/adr-backend-server.md`
- `designs/architecture/adr-clerk-auth.md`
- `designs/architecture/backend-implementation-plan.md`
- `designs/architecture/backend-ws-qa-report.md`
- `designs/architecture/clerk-implementation-plan.md`

### Backend References (3 files)
- `development/backend/src/lib/sheets/parse-url.ts` -- comment path references
- `development/backend/src/lib/sheets/prompt.ts` -- comment path references
- `development/backend/src/ws/handlers/import.ts` -- comment path references

### Frontend Docs (2 files)
- `development/frontend/LOKI-TEST-PLAN-anon-auth.md`
- `development/frontend/QA-SPRINT-5.md`

### Development Docs (3 files)
- `development/implementation-plan.md`
- `development/qa-handoff.md` -- this file
- `development/README.md`

### Product and Backlog Docs (6 files)
- `product-brief.md`
- `product/backlog/story-5.1-silent-auto-merge.md`
- `product/backlog/story-5.2-sheets-import-api-route.md`
- `product/backlog/story-5.3-sheets-import-wizard.md`
- `product/backlog/story-5.5-lcars-mode.md`
- `product/backlog/story-branch-based-ci-cd.md`

### Quality Docs (7 files)
- `quality/README.md`
- `quality/story-3.1-realm-utils-verdict.md`
- `quality/story-3.1-verdict.md`
- `quality/story-3.2-norse-copy-verdict.md`
- `quality/story-3.3-verdict.md`
- `quality/story-3.5-valhalla-verdict.md`
- `quality/story-3.5-verdict.md`
- `quality/test-plan.md`

### README and Other Docs (2 files)
- `README.md`
- `ux/handoff-to-fireman-anon-auth.md`
- `ux/theme-system.md`

### HTML Session Logs (5 files)
- `sessions/breaking-the-gleipnir.html`
- `sessions/the-wolf-signs-in-valhalla-opens.html`
- `sessions/vercel-wrangling.html`
- `sessions/wireframes-modals.html`
- `ux/wireframes/app/dashboard.html`

---

## How to Validate

### Test 1: No Remaining References
```bash
grep -r "development/src" . --include='*.md' --include='*.sh' --include='*.json' --include='*.ts' --include='*.yml' --include='*.html' | grep -v node_modules | grep -v '.git/' | grep -v '.next/'
```
**Expected**: Zero matches.

### Test 2: Build Succeeds
```bash
cd development/frontend && npm install && npm run build
```
**Expected**: Build completes with no errors.

### Test 3: TypeScript Check
```bash
cd development/frontend && npx tsc --noEmit
```
**Expected**: No type errors.

### Test 4: Dev Server Starts
```bash
.claude/scripts/dev-server.sh start
```
**Expected**: Dev server starts using `development/frontend/` as its root.

### Test 5: CI Workflow Paths
Verify that `.github/workflows/vercel-preview.yml` and `.github/workflows/vercel-production.yml` reference `development/frontend/**` in their path triggers and working-directory fields.

### Test 6: Git Status
```bash
git status
```
**Expected**: Shows rename from `development/src/` to `development/frontend/` plus modifications to all the files listed above. No untracked files that should have been updated.

---

## Known Considerations

- **Vercel Root Directory**: Must be updated in the Vercel dashboard from `development/src` to `development/frontend`. This is a manual step outside of code.
- **MEMORY.md**: Not updated in this PR -- the orchestrator handles memory file updates separately.
- **node_modules, .next, dist**: These directories are not tracked by git and were not modified.
