# Sandbox Preamble — Shared Block

Compose this into every agent prompt, immediately after the role line.

```
SANDBOX RULES:
- Each Bash tool call = fresh shell. ALWAYS prefix: cd <REPO_ROOT> && <command>
- Use absolute paths. The setup script prints REPO_ROOT — use it everywhere.
- Set timeout: 600000 (10 min) on: npm ci, verify.sh, playwright test, next build.

**Step 1 — Setup (MUST run first, before anything else):**
REPO_ROOT=$(git rev-parse --show-toplevel) && bash "$REPO_ROOT/.claude/scripts/sandbox-setup.sh" <BRANCH>
Note the REPO_ROOT it prints — use it for ALL subsequent commands.

TODO TRACKING (UNBREAKABLE):
Use TodoWrite to plan and track ALL work. Create todos at the START of the session
covering every numbered step. Update each todo to in_progress when you start it and
completed when done. This is your progress ledger — if the session dies, the todo
state shows exactly where you stopped.

INCREMENTAL COMMIT + VERIFY LOOP (UNBREAKABLE):
After every logical chunk of implementation work (~5-10 min or 1-3 files changed):
  1. git add -A && git commit -m 'wip: <what> — Ref #<NUMBER>' && git push origin <BRANCH>
  2. bash quality/scripts/verify.sh --step tsc
  3. If tsc fails: fix immediately, commit+push, re-run tsc.
  4. Update your todo progress.
Do NOT batch all changes into one commit at the end. Sessions can die at any time —
uncommitted work is lost work.

FULL VERIFY — SEPARATE STEPS (UNBREAKABLE):
At the end, run each verify step as its own Bash tool call:
  bash quality/scripts/verify.sh --step tsc
  bash quality/scripts/verify.sh --step build
  bash quality/scripts/verify.sh --step test -x
On failure: fix, commit+push, re-run that step. Repeat until green.

VERIFY BUDGET (3-STRIKE RULE):
If you fail the SAME verify step 3 times (3 fix attempts, still failing):
  1. Commit+push your current state: git add -A && git commit -m 'wip: verify incomplete — Ref #<NUMBER>' && git push origin <BRANCH>
  2. Stop trying to fix that step. Proceed to PR/handoff.
  3. In the handoff comment, add: "⚠️ VERIFY INCOMPLETE: <step> failed after 3 attempts. Failures: <summary>"
  4. tsc and build are NEVER skippable — only test can be abandoned after 3 strikes.
This prevents burning the entire session on pre-existing or intractable test failures.

STRICT SCOPE (UNBREAKABLE):
Execute ONLY your numbered steps — nothing more. Do NOT close issues, merge PRs,
declare things "done", or add commentary beyond your handoff step.
If something is ambiguous, comment on the issue asking for clarification — don't guess.
```
