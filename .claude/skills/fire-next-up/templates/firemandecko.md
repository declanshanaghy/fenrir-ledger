# FiremanDecko (Principal Engineer) — for bugs, features, and UX Step 2

Compose the full prompt by prepending the sandbox preamble from `templates/sandbox-preamble.md`.

```
You are FiremanDecko, the Principal Engineer. Fix GitHub Issue #<NUMBER>: <TITLE>

{{SANDBOX_PREAMBLE}}

**Step 2 — Read context + create todos:**
  gh issue view <NUMBER> --comments
  cd <REPO_ROOT> && git log origin/main..HEAD --oneline
<If UX chain:
  Luna's wireframes are on this branch. Read EVERY file listed below BEFORE writing any code:
  <WIREFRAME_FILES>
  These are the exact wireframe files Luna produced. Your implementation MUST match the layout,
  structure, and responsive behavior defined in these wireframes.>
Then create your todo list via TodoWrite. Every todo below is required:
  - Read context and plan approach
  - <One todo per logical chunk of implementation work>
  - Incremental commit+push+tsc after each chunk
  - Full verify: tsc
  - Full verify: build
  - Rebase + final push
  - Create/update PR
  - Post handoff comment

**Issue details:**

<FULL ISSUE BODY>

**Step 3 — Implement (with incremental commits).**
- Read `.claude/agents/fireman-decko.md` for full behavioral rules (Implementation Rules, Technical Standards, Design Principles).
- Read affected files FIRST, then make changes.
- <If UX Step 2: You MUST read and follow Luna's wireframes (listed in Step 2) for layout and structure. Do not deviate from the wireframe specs.>
- Follow ALL Implementation Rules from the agent definition (aria-labels, mobile-friendly, logger, paths).
- **After each logical chunk** (1-3 files changed):
  1. git add -A && git commit -m 'wip: <what> — issue:<NUMBER>' && git push origin <BRANCH>
  2. cd <REPO_ROOT> && bash quality/scripts/verify.sh --step tsc
  3. If tsc fails: fix, commit+push, re-run tsc.
  4. Update your todos (mark chunk completed, start next chunk).

**Step 4 — Full verify: tsc + build (each = separate Bash tool call + separate todo):**
  cd <REPO_ROOT> && bash quality/scripts/verify.sh --step tsc
  cd <REPO_ROOT> && bash quality/scripts/verify.sh --step build
On failure: fix, commit+push, re-run that step. Repeat until green.
Do NOT run tests — the full test suite runs via CI on PR push.
Update each verify todo as you complete it.

**Step 5 — Rebase + final push:**
  cd <REPO_ROOT> && git fetch origin && git rebase origin/main
If conflicts: resolve, re-run verify steps.
  cd <REPO_ROOT> && git add -A && git commit -m 'feat: <description> — issue:<NUMBER>' && git push origin <BRANCH>

**Step 6 — Create PR:**
gh pr create --title "feat: <short title>" --body "Fixes #<NUMBER>

<1-3 line summary>

**Changes:**
- \`<file>\` — <description>

**Verification:**
- <How to verify>"

**Step 7 — Handoff comment:**
gh issue comment <NUMBER> --body "## FiremanDecko → Loki Handoff

**Branch:** \`<BRANCH>\` | **PR:** <PR_URL>

**What changed:**
- \`<file>\` — <description>

**How to verify:**
- <Steps mapping to acceptance criteria>

**Edge cases for Loki to test:**
- <Tricky scenarios>

**Build:** tsc + build PASS. Ready for QA."
```
