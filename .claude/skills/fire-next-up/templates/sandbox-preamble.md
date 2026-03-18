# Sandbox Preamble — Shared Block

Compose this into every agent prompt, immediately after the role line.

```
SANDBOX RULES (GKE Autopilot):
- REPO_ROOT is /workspace/repo — hardcoded, no discovery needed.
- Each Bash tool call = fresh shell. ALWAYS prefix: cd /workspace/repo && <command>
- Set timeout: 600000 (10 min) on long-running commands (verify.sh, playwright, next build).
- The entrypoint already handled: git clone, branch checkout, npm ci, git identity.

**Step 1 — Verify environment (quick sanity check):**
cd /workspace/repo && git branch --show-current && node -v && ls package.json 2>/dev/null || ls development/frontend/package.json
If Playwright tests are needed:
  cd /workspace/repo && npx playwright install chromium 2>/dev/null || true
  ln -sf /workspace/repo/development/frontend/node_modules /workspace/repo/quality/node_modules 2>/dev/null || true

**Step 1b — Check for prior work on this branch (UNBREAKABLE):**
cd /workspace/repo && git fetch origin && git log origin/main..HEAD --oneline
If commits exist beyond main:
  - A previous agent session already did work on this branch.
  - Read ALL changed files: cd /workspace/repo && git diff origin/main --name-only
  - Read each changed file before writing a single line of new code.
  - Understand what was already implemented, then continue from where it left off.
  - DO NOT rewrite or redo work that is already committed. Pick up from the current state.
If no commits beyond main: branch is fresh, proceed with full implementation.

TODO TRACKING (UNBREAKABLE):
Use TodoWrite to plan and track ALL work. Create todos at the START of the session
covering every numbered step. Update each todo to in_progress when you start it and
completed when done. This is your progress ledger — if the session dies, the todo
state shows exactly where you stopped.

INCREMENTAL COMMIT + VERIFY LOOP (UNBREAKABLE):
After every logical chunk of implementation work (~5-10 min or 1-3 files changed):
  1. cd /workspace/repo && git add -A && git commit -m 'wip: <what> — issue:<NUMBER>' && git push origin <BRANCH>
  2. cd /workspace/repo && bash quality/scripts/verify.sh --step tsc
  3. If tsc fails: fix immediately, commit+push, re-run tsc.
  4. Update your todo progress.
Do NOT batch all changes into one commit at the end. Sessions can die at any time —
uncommitted work is lost work.

VERIFY — tsc + build + Vitest (UNBREAKABLE):
All agents run tsc, build, AND the full Vitest suite before handoff.
Do NOT run Playwright E2E tests — Vitest only. E2E runs via CI.
  cd /workspace/repo && bash quality/scripts/verify.sh --step tsc
  cd /workspace/repo && bash quality/scripts/verify.sh --step build
  cd /workspace/repo/development/frontend && npx vitest run --reporter=verbose
On failure: fix, commit+push, re-run that step. Repeat until green.
Do NOT proceed to handoff with ANY failing Vitest tests.

STRICT SCOPE (UNBREAKABLE):
Execute ONLY your numbered steps — nothing more. Do NOT close issues, merge PRs,
declare things "done", or add commentary beyond your handoff step.
If something is ambiguous, comment on the issue asking for clarification — don't guess.

CHAIN CONTINUATION (UNBREAKABLE):
Every agent template includes a final chain continuation step. It is MANDATORY when
conditions are met (success verdict) and FORBIDDEN when they are not (failure/partial).

- Non-final agents (Luna, FiremanDecko, Heimdall): run `/fire-next-up --resume #<NUMBER>`
  as the final step ONLY when all verify steps pass and the handoff comment is posted.
  This dispatches the next agent in the chain on the same branch.
- Final agent (Loki): merge and close ONLY on a clean PASS verdict:
  `gh pr merge <PR_NUMBER> --squash --delete-branch && gh issue close <NUMBER>`
- If verdict is FAIL or any verify step failed: do NOT run chain continuation.
  Stop immediately and leave the issue open for manual triage.
- Chain continuation is the ONLY authorized merge path — do not merge any other way.
```
