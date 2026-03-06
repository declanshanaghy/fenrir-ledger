# QA Handoff: Depot Remote Builder Integration

**Issue:** #192 -- Implement Depot remote builder integration for agent chains
**Branch:** `fix/issue-192-depot-remote-builders`
**Author:** FiremanDecko (Principal Engineer)
**Date:** 2026-03-06

---

## What Was Implemented

### 1. Fire Next Up Skill -- Remote Mode (Default)

Updated `.claude/skills/fire-next-up/SKILL.md` with:

- `--remote` is now the DEFAULT -- no flag needed for Depot execution
- `--local` flag added to fall back to local worktrees
- Depot Session Lifecycle section: spawn (fire-and-forget), poll (list-sessions), detect completion, kill stuck workers
- Session ID naming convention: `issue-<NUMBER>-step<N>-<agent-name>`
- Polling cadence: 60s initial, 30s subsequent, 30m timeout
- Mode selection logic: auto-fallback to local if Depot credentials missing
- Step 5 and Step 6 updated with both remote and local execution paths

### 2. Depot Setup Script

Created `.claude/scripts/depot-setup.sh`:

- Checks/installs Depot CLI
- Loads and validates DEPOT_ORG_ID and DEPOT_TOKEN from .env
- Masks token values in output (secret masking rule)
- Verifies Depot org access via list-sessions
- Checks for required Depot secrets (CLAUDE_CODE_OAUTH_TOKEN, GIT_CREDENTIALS)
- Provides manual test sandbox command
- Resolves repo root via `git worktree list` (never references .claude/worktrees/)

### 3. Environment Variables

Updated `development/frontend/.env.example` with:

- `DEPOT_ORG_ID=pqtm7s538l` -- Depot org ID (non-secret, hardcoded)
- `DEPOT_TOKEN=` -- Depot API token placeholder
- `CLAUDE_CODE_OAUTH_TOKEN=` -- Claude OAuth token placeholder

### 4. ADR-007 Status

Updated `architecture/adrs/ADR-007-remote-builder-platforms.md` from Proposed to Accepted.

### 5. README

Updated Operations row with links to Depot Setup script and Fire Next Up skill.

---

## Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `.claude/skills/fire-next-up/SKILL.md` | Modified | Added Depot remote mode, --local flag, session lifecycle |
| `.claude/scripts/depot-setup.sh` | Created | One-time Depot CLI setup script |
| `development/frontend/.env.example` | Modified | Added Depot env vars |
| `architecture/adrs/ADR-007-remote-builder-platforms.md` | Modified | Status: Proposed -> Accepted |
| `README.md` | Modified | Added Depot links to Operations |
| `development/qa-handoff.md` | Created | This handoff |

---

## How to Verify

1. Read SKILL.md -- verify --remote is default, --local flag exists, session lifecycle documented
2. Read depot-setup.sh -- verify it masks secrets, resolves repo root correctly
3. Read .env.example -- verify DEPOT_ORG_ID, DEPOT_TOKEN, CLAUDE_CODE_OAUTH_TOKEN present
4. Read ADR-007 -- verify status is Accepted
5. Read README -- verify Operations row has Depot links

---

## Known Limitations

- Depot CLI not installed in CI -- this is tooling/docs, not app code
- list-sessions JSON format inferred from docs; exact fields may vary
- No automated tests -- infrastructure/tooling deliverable
