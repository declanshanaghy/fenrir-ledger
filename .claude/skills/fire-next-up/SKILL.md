---
name: fire-next-up
description: "Pull the next 'Up Next' item from the GitHub Project board and run the full agent chain (design → build → validate) in background worktrees. Use when the user says 'fire next up', 'pull next item', 'work on next issue', or wants to dispatch work from the project board. Supports --peek flag to show the queue without dispatching, and --resume #N to continue a chain that was interrupted."
---

# Fire Next Up — Pull, Dispatch, and Chain Agents

Pulls the next "Up Next" item from the GitHub Project board and runs the full agent chain for that issue type. Each agent in the chain works on the same branch, commits, and hands off to the next agent automatically.

---

## Agent Chains

Each issue type has a defined chain of agents. When one agent completes, the orchestrator automatically spawns the next agent in the chain on the same branch.

| Type | Step 1 | Step 2 | Step 3 |
|------|--------|--------|--------|
| `type:bug` | FiremanDecko (fix) | Loki (validate) | — |
| `type:feature` | FiremanDecko (implement) | Loki (validate) | — |
| `type:ux` | Luna (wireframes) | FiremanDecko (implement) | Loki (validate) |
| `type:security` | Heimdall (fix/audit) | Loki (validate) | — |
| `type:test` | Loki (write tests) | — | — |

**Chain execution rules:**
- All agents in a chain work on the **same branch** — each one commits and pushes before handing off.
- The orchestrator spawns Step 1 in the background. When it completes, the orchestrator spawns Step 2 on the same branch (and Step 3 if applicable).
- The **final agent** in every chain (Loki for multi-step, or the sole agent for `type:test`) creates the PR via `gh pr create`.
- Only Loki's `Fixes #<NUMBER>` in the PR body closes the issue — earlier agents use `Ref #<NUMBER>` in their commits.
- If any agent in the chain fails or reports a blocker, the chain stops and the orchestrator reports to the user.

---

## Flags

| Flag | Effect |
|------|--------|
| `--peek` | Show the prioritized Up Next queue with agent chains — do NOT spawn anything. |
| `--resume #N` | Resume an interrupted chain for issue #N. Detects where the chain left off and spawns the next agent. |
| `--batch N` | Pull the top N **unblocked** items from "Up Next" and start chains for all of them in parallel. Max 5. |
| `--remote` | Dispatch the agent chain to GitHub Actions instead of local worktrees. Can combine with `#N` or `--batch N`. |
| `#N` | Start a fresh chain for a specific issue number (skip priority selection). |
| *(no flag)* | Default behavior: pick the top item and start the agent chain. |

When `--peek` is passed, run **Step 1 only**, then display the full queue as a table with columns: `#`, `Title`, `Priority`, `Type`, `Chain`. Stop after the table — do not proceed further.

When `--resume #N` is passed, skip Steps 1–4 and jump directly to the **Resume Flow** section below.

When `--batch N` is passed, follow the **Batch Dispatch** section below.

When `--remote` is passed, follow the **Remote Dispatch** section below.

---

## Step 0 — Orphan PR Check

Before dispatching new work, check for orphaned PRs that need attention.

**An orphaned PR is one that:**
- Is open
- Has no agent chain actively working on it (no recent commits in the last 24h)
- Is missing a Loki QA verdict comment
- OR has a PASS verdict but was never merged

```bash
gh pr list --state open --json number,title,headRefName,updatedAt,labels --jq '.[] | {num: .number, title: .title, branch: .headRefName, updated: .updatedAt, labels: [.labels[].name]}'
```

For each open PR, check:

1. **Has a Loki verdict?** — scan PR comments for `## Loki QA Verdict`:
   ```bash
   gh pr view <NUMBER> --comments --json comments --jq '[.comments[].body | select(test("## Loki QA Verdict"))] | length'
   ```

2. **Verdict was PASS but not merged?** — Loki approved but merge didn't happen:
   ```bash
   gh pr view <NUMBER> --comments --json comments --jq '[.comments[].body | select(test("Verdict.*PASS"))] | length'
   ```

3. **Stale?** — last update was more than 24h ago (no active work):
   Compare `updatedAt` against current time.

### Orphan categories and actions

| Category | Condition | Action |
|----------|-----------|--------|
| **PASS but unmerged** | Loki PASS verdict exists, PR still open | Attempt auto-merge: check CI, `needs-review` label, mergeability. Merge if clear. |
| **No verdict** | PR open, no Loki verdict comment, stale >24h | Resume the chain: run `/fire-next-up --resume #N` for the linked issue. |
| **FAIL verdict** | Loki FAIL verdict, no subsequent fix commits | Report to user: `PR #N failed QA and is stale. Needs attention.` |
| **No linked issue** | PR has no `Fixes #N` or `Ref #N` in body | Report to user: `PR #N has no linked issue. Review manually.` |

### Report format

If orphans are found, report them BEFORE proceeding to Step 1:

```
**Orphaned PRs detected:**

| PR | Title | Status | Action Taken |
|----|-------|--------|-------------|
| #N | ... | PASS but unmerged | Merged |
| #M | ... | No QA verdict, stale 3d | Resuming chain for #X |
| #K | ... | FAIL verdict, stale 2d | Needs manual attention |

Proceeding to dispatch next issue...
```

If no orphans are found, proceed silently to Step 1.

---

## Step 1 — Query the Project Board

Fetch all items from GitHub Project #1 and filter for the "Up Next" status column:

```bash
gh project item-list 1 --owner declanshanaghy --format json \
  --jq '[.items[] | select(.status == "Up Next") | {num: .content.number, title: .content.title}]'
```

If no items are in "Up Next", tell the user:
> No items in "Up Next". Add items to the column at https://github.com/users/declanshanaghy/projects/1 or promote from Todo.

---

## Step 2 — Select the Item

From the "Up Next" list, select the highest-priority item using these rules (in order):

1. **P1-critical** before P2-high before P3-medium before P4-low (read from labels)
2. Within the same priority, prefer **bugs** over **security** over **UX** over **features** over **tests**
3. Within the same priority and type, prefer the **lowest issue number** (oldest first)

Fetch the full issue details:

```bash
gh issue view <NUMBER> --json number,title,body,labels
```

---

## Step 3 — Determine the Chain

Map the issue type label to its agent chain using the table above. Record the full chain — you will execute it step by step.

If the issue has multiple type labels, use the first match in priority order: bug > security > ux > feature > test.

---

## Step 4 — Build the Branch Name

Construct the branch name from the issue:

```
fix/issue-<NUMBER>-<kebab-description>
```

Where `<kebab-description>` is a 3-5 word kebab-case summary derived from the issue title. Max 50 characters total.

Examples:
- `fix/issue-151-settings-two-column`
- `fix/issue-157-llm-prompt-injection`
- `fix/issue-154-howl-overlaps-menu`

---

## Step 5 — Spawn Step 1 Agent

Launch the first agent in the chain in a **background worktree** using the Agent tool:

- `subagent_type`: first agent in the chain
- `isolation`: `worktree`
- `run_in_background`: `true`
- `description`: `[Step 1/<N>] #<NUMBER>: <short summary>`

### Agent-Specific Prompt Templates

Use the appropriate template based on which agent is being spawned.

#### Luna (UX Designer) — Step 1 for `type:ux`

```
You are Luna, the UX Designer. Design wireframes for GitHub Issue #<NUMBER>: <TITLE>

**Branch name:** `<BRANCH>`

**Issue details:**

<FULL ISSUE BODY>

**Your deliverables:**
- Create HTML wireframe(s) in `ux/wireframes/` for the feature described in the issue.
- Keep wireframes free of theme styling (no colors, no fonts) — structure only.
- Update `ux/wireframes.md` if adding new wireframes.
- Write a brief interaction spec if the feature has non-obvious interactions.
- Commit with message: `design: wireframes for #<NUMBER> — <short description>`
- Use `Ref #<NUMBER>` (not Fixes) — you are not the final agent.
- Push to the branch when done.

**Handoff — REQUIRED before you finish:**
After pushing, comment on the issue with handoff notes for FiremanDecko:
```bash
gh issue comment <NUMBER> --body "## Luna → FiremanDecko Handoff

**Wireframes committed** on branch \`<BRANCH>\`.

**Files created:**
- \`ux/wireframes/<file1>.html\`
- \`ux/wireframes/<file2>.html\` (if applicable)

**Key design decisions:**
- <Brief summary of layout choices, responsive behavior, interactions>

**Implementation notes for FiremanDecko:**
- <Any specific component suggestions, existing patterns to reuse, edge cases to handle>

Ready for implementation. 🔨"
```

**Key reminders:**
- Read the existing wireframes first to match conventions.
- Mobile-first: 375px minimum viewport.
- Follow the git-commit skill for branch workflow and commit format.

Start by reading the issue, then review existing wireframes in ux/wireframes/ for conventions.
```

#### FiremanDecko (Principal Engineer) — for bugs, features, and UX Step 2

```
You are FiremanDecko, the Principal Engineer. Fix GitHub Issue #<NUMBER>: <TITLE>

**Branch name:** `<BRANCH>`

**Issue details:**

<FULL ISSUE BODY>

**Before you start — read the handoff context:**
1. Read all comments on the issue for handoff notes from previous agents:
   `gh issue view <NUMBER> --comments`
2. Read the commits already on this branch:
   `git log origin/main..HEAD --oneline`
3. <If UX chain: Luna's wireframes are on this branch. Read them: `ux/wireframes/`>
4. Use the previous agent's handoff comment to understand design decisions and what they built.

**Your deliverables:**
- Implement the fix/feature described in the issue.
- <If UX Step 2: Follow Luna's wireframes for layout and structure.>
- Ensure `cd development/frontend && npx tsc --noEmit` passes.
- Ensure `cd development/frontend && npx next build` succeeds.
- Commit with message: `fix: <description> — Ref #<NUMBER>`
- Use `Ref #<NUMBER>` (not Fixes) — Loki will close the issue after validation.
- Push to the branch when done.

**Handoff — REQUIRED before you finish:**
After pushing, comment on the issue with handoff notes for Loki:
```bash
gh issue comment <NUMBER> --body "## FiremanDecko → Loki Handoff

**Implementation committed** on branch \`<BRANCH>\`.

**What changed:**
- \`<file1>\` — <brief description of change>
- \`<file2>\` — <brief description of change>

**How to verify:**
- <Step-by-step verification that maps to acceptance criteria>
- <Key user flows to test>

**Edge cases to cover in tests:**
- <Any tricky scenarios Loki should write tests for>

**Build status:** tsc clean, next build clean.
Ready for QA. 🧪"
```

**Key reminders:**
- Read the existing code first before making changes.
- Follow the git-commit skill for branch workflow and commit format.
- Mobile-friendly: min 375px, two-col collapse pattern.
- Structured logging on backend code (fenrir logger, not raw console.*).

Start by reading the issue comments for handoff context, then the affected files, then implement.
```

#### Heimdall (Security Specialist) — Step 1 for `type:security`

```
You are Heimdall, the Security Specialist. Fix GitHub Issue #<NUMBER>: <TITLE>

**Branch name:** `<BRANCH>`

**Issue details:**

<FULL ISSUE BODY>

**Your deliverables:**
- Implement the security fix described in the issue.
- Update security documentation if the fix changes auth flows, trust boundaries, or threat model.
- Commit with message: `security: <description> — Ref #<NUMBER>`
- Use `Ref #<NUMBER>` (not Fixes) — Loki will close the issue after validation.
- Push to the branch when done.

**Handoff — REQUIRED before you finish:**
After pushing, comment on the issue with handoff notes for Loki:
```bash
gh issue comment <NUMBER> --body "## Heimdall → Loki Handoff

**Security fix committed** on branch \`<BRANCH>\`.

**What changed:**
- \`<file1>\` — <brief description of change>

**Security context for tests:**
- <What the vulnerability was and how it was fixed>
- <What to test: input validation, auth checks, error handling>

**Verification steps:**
- <Specific requests or payloads Loki should test>

Ready for QA. 🧪"
```

**Key reminders:**
- Read the existing code first before making changes.
- Follow the git-commit skill for branch workflow and commit format.
- Secret masking (UNBREAKABLE RULE), OWASP Top 10 awareness.
- Never log secrets, tokens, or credentials.

Start by reading the affected files listed in the issue, then implement the fix.
```

#### Loki (QA Tester) — Final agent in chain (or sole agent for `type:test`)

```
You are Loki, the QA Tester. Validate GitHub Issue #<NUMBER>: <TITLE>

**Branch name:** `<BRANCH>`
**Previous agents have already committed their work on this branch.**

**Issue details:**

<FULL ISSUE BODY>

**Before you start — read the handoff context:**
1. Read all comments on the issue for handoff notes from previous agents:
   `gh issue view <NUMBER> --comments`
2. Read the commits already on this branch:
   `git log origin/main..HEAD --oneline`
3. Use the previous agent's handoff comment to understand what was built, how to verify, and edge cases to test.

**Your deliverables:**
- Write new Playwright tests in `quality/test-suites/<feature-slug>/` covering the acceptance criteria.
- Use the previous agent's "How to verify" and "Edge cases" sections to guide your test design.
- Run the new tests: `cd development/frontend && SERVER_URL=http://localhost:9653 npx playwright test ../../quality/test-suites/<feature-slug>/ --reporter=list`
- Verify build passes: `cd development/frontend && npx tsc --noEmit && npx next build`
- Commit tests with message: `test: validate #<NUMBER> — <short description>`
- Create the PR: `gh pr create --title "<title>" --body "Fixes #<NUMBER>\n\n<summary>"`
- The PR body MUST contain `Fixes #<NUMBER>` to auto-close the issue on merge.
- Push to the branch when done.

**Auto-merge — REQUIRED after creating the PR:**
If your verdict is PASS, attempt to merge the PR automatically:

1. Wait for CI to finish: `gh pr checks <PR_NUMBER> --watch --fail-fast`
2. Check for the `needs-review` label (Odin's veto flag):
   `gh issue view <NUMBER> --json labels --jq '[.labels[].name] | any(. == "needs-review")'`
3. Check the PR is mergeable:
   `gh pr view <PR_NUMBER> --json mergeable --jq '.mergeable'`
4. **If CI green AND no `needs-review` label AND mergeable:**
   `gh pr merge <PR_NUMBER> --squash --delete-branch`
5. **If blocked by any condition**, skip the merge and note it in the verdict comment:
   - CI failing: `Merge blocked — CI failing. Manual review needed.`
   - `needs-review` label: `Merge blocked — needs-review label present. Awaiting Odin's review.`
   - Not mergeable: `Merge blocked — merge conflicts. Rebase needed.`

**Handoff — REQUIRED before you finish:**
After creating the PR (and merging if auto-merge succeeded), comment on the issue with your QA verdict:
```bash
gh issue comment <NUMBER> --body "## Loki QA Verdict

**PR created:** <PR_URL>
**Branch:** \`<BRANCH>\`
**Verdict:** PASS / FAIL

**Tests written:** <N> tests in \`quality/test-suites/<slug>/\`
**Tests passing:** <N>/<N>

**What was validated:**
- <AC-1 result>
- <AC-2 result>

**Build status:** tsc clean, next build clean.

<If PASS and merged: Merged to main. ✅>
<If PASS but merge blocked: Ready for merge — <reason for block>. ⏳>
<If FAIL: Blocked — see failures above. ❌>"
```

**Key reminders:**
- Read the existing code AND the previous commits on this branch to understand what was built.
- Assertions derive from acceptance criteria, not from what the code currently does.
- Each test clears relevant localStorage before running — idempotent by design.
- Follow the git-commit skill for branch workflow and commit format.
- Do NOT run the full regression suite — CI handles that. Only run your new tests.

Start by reading the issue comments for handoff context, then the acceptance criteria, then write and run tests.
```

---

## Step 6 — Chain Execution

When a background agent completes (you receive a task notification):

1. **Check the result.** If the agent reported a failure or blocker, stop the chain and tell the user.
2. **If more steps remain in the chain**, spawn the next agent:
   - Same `isolation: worktree` — but resume on the **same branch** (the previous agent already pushed).
   - `run_in_background: true`
   - `description`: `[Step N/<Total>] #<NUMBER>: <short summary>`
   - Use the appropriate prompt template from Step 5.
3. **If this was the final step** (Loki), report completion to the user with the PR URL.

### Chain state tracking

Track the chain progress in your conversation context:

```
Issue #<NUMBER>: <TITLE>
Branch: <BRANCH>
Chain: Luna → FiremanDecko → Loki
Status: Step 2/3 — FiremanDecko running
```

Update this after each agent completes.

---

## Step 7 — Report

After spawning Step 1, report to the user:

```
**#<NUMBER>**: <title>
**Chain:** <Agent1> → <Agent2> → <Agent3>
**Status:** Step 1/<N> — <AgentName> running in background

**Remaining Up Next items:**
| # | Issue | Chain |
|---|-------|-------|
| ... | ... | ... |
```

After each chain step completes, update the user:

```
**#<NUMBER>**: Step <N>/<Total> complete (<AgentName>).
Spawning Step <N+1>: <NextAgentName>...
```

After the final step:

```
**#<NUMBER>**: Chain complete. PR created: <PR_URL>
```

---

## Resume Flow (`--resume #N`)

When a chain is interrupted (session ended, agent failed, context lost), use `--resume #N` to pick up where it left off.

### Detection Steps

1. **Fetch issue details** to determine the chain type:
   ```bash
   gh issue view <N> --json number,title,body,labels
   ```

2. **Find the existing branch** by looking for the issue number:
   ```bash
   git branch -r | grep "issue-<N>"
   ```
   If no branch exists, the chain never started — run a fresh chain instead (same as `/fire-next-up #N`).

3. **Read issue comments** to determine which agents have completed their handoffs:
   ```bash
   gh issue view <N> --comments
   ```

   Look for handoff comment headers to identify completed steps:

   | Comment header | Agent completed | Next agent |
   |----------------|-----------------|------------|
   | `## Luna → FiremanDecko Handoff` | Luna | FiremanDecko |
   | `## FiremanDecko → Loki Handoff` | FiremanDecko | Loki |
   | `## Heimdall → Loki Handoff` | Heimdall | Loki |
   | `## Loki QA Verdict` | Loki (chain complete) | — |

   The **last handoff comment** tells you exactly where the chain stopped and who's next.

4. **Check if a PR already exists** for the branch:
   ```bash
   gh pr list --head "<BRANCH>" --json number,state
   ```
   If a PR exists and Loki's verdict comment is present → chain is complete.

5. **Determine the next step:**
   - No handoff comments → Step 1 agent failed before completing. Re-run Step 1.
   - `Luna → FiremanDecko Handoff` exists but no further → spawn FiremanDecko.
   - `FiremanDecko → Loki Handoff` or `Heimdall → Loki Handoff` exists but no verdict → spawn Loki.
   - `Loki QA Verdict` exists → chain is complete, tell the user.

6. **Fallback — inspect commits** if no handoff comments exist (agent forgot to comment):
   ```bash
   git log origin/main..origin/<BRANCH> --oneline
   ```
   Use commit prefixes (`design:`, `fix:`, `security:`, `test:`) as a secondary signal.

### Resume Execution

Once the next agent is identified:

1. Report to the user what was detected:
   ```
   **Resuming #<N>**: <title>
   **Chain:** <full chain>
   **Completed:** Step 1 (<AgentName>) — found `<commit prefix>` commits
   **Resuming at:** Step <X>/<Total> — spawning <NextAgentName>
   ```

2. Spawn the next agent using the same prompt templates from Step 5, on the **existing branch**.

3. Continue normal chain execution from Step 6 onward.

### Edge Cases

- **Branch exists but no commits beyond main** — the previous agent failed before committing. Re-run that step (same agent, same branch).
- **Multiple agents' commits exist but chain isn't complete** — skip to the next incomplete step.
- **PR exists but CI failed** — tell the user. They may want to fix CI issues manually or re-run the failing agent.
- **Issue is closed** — tell the user the issue is already closed. Do not spawn agents.

---

## Batch Dispatch (`--batch N`)

Pull the top N unblocked items from "Up Next" and start chains for all in parallel. Max 5.

### Steps

1. **Query the board** — same as Step 1.
2. **Prioritize and filter** — same as Step 2, but select the top N items instead of 1.
3. **Check for blocked issues** — for each candidate, scan its body for `Blocked by #N`:

   ```bash
   gh issue view <NUMBER> --json body --jq '.body' | grep -oP 'Blocked by #\K\d+'
   ```

   For each blocking issue number, check if it's still open:

   ```bash
   gh issue view <BLOCKING_NUMBER> --json state --jq '.state'
   ```

   If ANY blocking issue is still `OPEN`, **skip this item** and move to the next in priority order. Report skipped items in the output.

4. **Spawn chains** — for each unblocked item, run Steps 3–5 (determine chain, build branch, spawn Step 1 agent). All chains run in parallel background worktrees.

5. **Report** — show all dispatched chains and any skipped (blocked) items:

   ```
   **Batch dispatched:** N chains

   | # | Title | Chain | Status |
   |---|-------|-------|--------|
   | #A | ... | Decko -> Loki | Running |
   | #B | ... | Luna -> Decko -> Loki | Running |
   | #C | ... | Decko -> Loki | Blocked by #A — skipped |
   ```

6. **Chain execution** — each chain runs independently per Step 6. When a chain completes, report it. When all chains complete, report the batch summary.

### Batch rules

- Max 5 parallel chains — if N > 5, cap at 5 and tell the user.
- Each chain is independent — a failure in one does not stop others.
- Blocked items are skipped, not queued. Run `/fire-next-up` again after blockers resolve.
- If fewer than N unblocked items exist, dispatch whatever is available and report the shortfall.

---

## Dependency Checking

Before dispatching ANY issue (single or batch), check if it's blocked:

1. Read the issue body for `Blocked by #N` references.
2. For each referenced issue, check if it's still open.
3. If blocked:
   - **Single dispatch**: warn the user and ask if they want to proceed anyway or pick the next unblocked item.
   - **Batch dispatch**: skip silently and pick the next unblocked item.

---

## Remote Dispatch (`--remote`)

Instead of spawning agents in local worktrees, dispatch the entire agent chain to a GitHub Actions workflow. The local orchestrator stays lightweight — it only selects the issue, determines the chain, and triggers the remote workflow.

### Prerequisites

- The `ANTHROPIC_API_KEY` secret must be configured in the repository's GitHub Actions secrets.
- The workflow `.github/workflows/agent-chain.yml` must exist on the default branch (or the branch being dispatched).

### How it works

1. **Steps 1–4 run locally** — query the board, select the item, determine the chain, build the branch name. These are lightweight and instant.

2. **Step 5 dispatches remotely** instead of spawning a local worktree agent:

   ```bash
   gh workflow run agent-chain.yml \
     -f issue_number="<NUMBER>" \
     -f branch_name="<BRANCH>" \
     -f chain_type="<TYPE>"
   ```

   Where `<TYPE>` is one of: `bug`, `feature`, `ux`, `security`, `test`.

3. **Report the dispatch** to the user with the run URL:

   ```
   **#<NUMBER>**: <title>
   **Chain:** <Agent1> → <Agent2> → <Agent3>
   **Dispatched to:** GitHub Actions (remote)
   **Monitor:** https://github.com/<owner>/<repo>/actions/runs/<run_id>

   The chain will execute remotely. Each agent posts handoff comments on the issue.
   Use `--resume #N` if the remote chain fails and needs local intervention.
   ```

4. **No local waiting.** The orchestrator returns immediately after dispatch. The remote workflow handles chain execution, handoff comments, PR creation, and auto-merge.

### Combining with other flags

- `--remote #N` — dispatch a specific issue remotely.
- `--remote --batch N` — dispatch N issues remotely. Each gets its own workflow run.
- `--remote --resume #N` — not supported. Use `--resume #N` (local) to recover from remote failures.

### Monitoring remote chains

After dispatch, the user can monitor via:
- GitHub Actions UI: workflow runs show each step as a separate job
- Issue comments: each agent posts handoff comments as it completes
- `gh run list --workflow=agent-chain.yml` to see active/recent runs

### Cost awareness

Remote dispatch uses GitHub Actions minutes and Anthropic API credits:
- Each agent step runs for up to 30 minutes (configurable via `timeout_minutes` input)
- Estimated cost: ~$5.25/issue (Opus build + Sonnet QA + runner time)
- Monitor spending via GitHub Settings > Billing > Actions
- Consider using `--remote` for heavy builds and local dispatch for quick fixes

---

## Notes

- Only spawn **one chain per invocation** unless `--batch` is used.
- Each agent in the chain handles its own commits and pushes. Do NOT duplicate their work in the main context.
- The orchestrator's job is to **coordinate the chain**, not to build. Never do an agent's work yourself.
- If an agent goes idle (no completion after a reasonable time), kill and respawn per team norms.
- For `type:test` issues, Loki is both the first and final agent — he writes tests AND creates the PR.
