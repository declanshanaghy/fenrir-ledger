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
  1. git add -A && git commit -m 'wip: <what> — issue:<NUMBER>' && git push origin <BRANCH>
  2. bash quality/scripts/verify.sh --step tsc
  3. If tsc fails: fix immediately, commit+push, re-run tsc.
  4. Update your todo progress.
Do NOT batch all changes into one commit at the end. Sessions can die at any time —
uncommitted work is lost work.

VERIFY — tsc + build ONLY (UNBREAKABLE):
Agents run tsc and build. The FULL test suite runs via CI on every PR push.
Do NOT run `verify.sh --step test` for the full suite — CI is the authority.
Loki runs only his NEW feature tests, not the full suite.
  bash quality/scripts/verify.sh --step tsc
  bash quality/scripts/verify.sh --step build
On failure: fix, commit+push, re-run that step. Repeat until green.

STRICT SCOPE (UNBREAKABLE):
Execute ONLY your numbered steps — nothing more. Do NOT close issues, merge PRs,
declare things "done", or add commentary beyond your handoff step.
If something is ambiguous, comment on the issue asking for clarification — don't guess.
```
