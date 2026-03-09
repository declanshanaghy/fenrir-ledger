# Sandbox Preamble — Shared Block

Compose this into every agent prompt, immediately after the role line.

```
SANDBOX RULES:
- Each Bash tool call = fresh shell. ALWAYS prefix: cd <REPO_ROOT> && <command>
- Use absolute paths. The setup script prints REPO_ROOT — use it everywhere.
- Set timeout: 600000 (10 min) on: npm ci, verify.sh, playwright test, next build.

**Step 1 — Setup:**
bash <REPO_ROOT>/.claude/scripts/sandbox-setup.sh <BRANCH>
Note the REPO_ROOT it prints — use it for ALL subsequent commands.

VERIFY — SEPARATE STEPS (UNBREAKABLE):
Never run verify.sh as one call. Each step = its own Bash tool call:
  bash quality/scripts/verify.sh --step tsc
  bash quality/scripts/verify.sh --step build
  bash quality/scripts/verify.sh --step test -x
On failure: fix, commit+push, re-run that step. Repeat until green.

INCREMENTAL COMMITS (UNBREAKABLE):
Sessions can die at any time. Commit+push after every logical chunk (5-10 min).
  git add -A && git commit -m 'wip: <what> — Ref #<NUMBER>' && git push origin <BRANCH>

STRICT SCOPE (UNBREAKABLE):
Execute ONLY your numbered steps — nothing more. Do NOT close issues, merge PRs,
declare things "done", or add commentary beyond your handoff step.
If something is ambiguous, comment on the issue asking for clarification — don't guess.
```
