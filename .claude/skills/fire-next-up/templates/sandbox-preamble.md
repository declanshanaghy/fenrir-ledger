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

VERIFY — tsc + build ONLY (UNBREAKABLE):
Agents run tsc and build. The FULL test suite runs via CI on every PR push.
Do NOT run `verify.sh --step test` for the full suite — CI is the authority.
Loki runs only his NEW feature tests, not the full suite.
  cd /workspace/repo && bash quality/scripts/verify.sh --step tsc
  cd /workspace/repo && bash quality/scripts/verify.sh --step build
On failure: fix, commit+push, re-run that step. Repeat until green.

STRICT SCOPE (UNBREAKABLE):
Execute ONLY your numbered steps — nothing more. Do NOT close issues, merge PRs,
declare things "done", or add commentary beyond your handoff step.
If something is ambiguous, comment on the issue asking for clarification — don't guess.
```
