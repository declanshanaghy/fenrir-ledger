---
name: fire-next-up
description: "Pull the next 'Up Next' item from the GitHub Project board and run the full agent chain (design → build → validate) in background worktrees. Use when the user says 'fire next up', 'pull next item', 'work on next issue', or wants to dispatch work from the project board. Supports --peek flag to show the queue without dispatching."
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
| *(no flag)* | Default behavior: pick the top item and start the agent chain. |

When `--peek` is passed, run **Step 1 only**, then display the full queue as a table with columns: `#`, `Title`, `Priority`, `Type`, `Chain`. Stop after the table — do not proceed to Steps 2–7.

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
<If UX Step 2: **Luna's wireframes are already committed on this branch. Read them first: `ux/wireframes/`**>

**Issue details:**

<FULL ISSUE BODY>

**Your deliverables:**
- Implement the fix/feature described in the issue.
- <If UX Step 2: Follow Luna's wireframes for layout and structure.>
- Ensure `cd development/frontend && npx tsc --noEmit` passes.
- Ensure `cd development/frontend && npx next build` succeeds.
- Commit with message: `fix: <description> — Ref #<NUMBER>`
- Use `Ref #<NUMBER>` (not Fixes) — Loki will close the issue after validation.
- Push to the branch when done.

**Key reminders:**
- Read the existing code first before making changes.
- Follow the git-commit skill for branch workflow and commit format.
- Mobile-friendly: min 375px, two-col collapse pattern.
- Structured logging on backend code (fenrir logger, not raw console.*).

Start by reading the affected files listed in the issue, then implement the fix.
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

**Your deliverables:**
- Write new Playwright tests in `quality/test-suites/<feature-slug>/` covering the acceptance criteria.
- Run the new tests: `cd development/frontend && SERVER_URL=http://localhost:9653 npx playwright test ../../quality/test-suites/<feature-slug>/ --reporter=list`
- Verify build passes: `cd development/frontend && npx tsc --noEmit && npx next build`
- Commit tests with message: `test: validate #<NUMBER> — <short description>`
- Create the PR: `gh pr create --title "<title>" --body "Fixes #<NUMBER>\n\n<summary>"`
- The PR body MUST contain `Fixes #<NUMBER>` to auto-close the issue on merge.
- Push to the branch when done.

**Key reminders:**
- Read the existing code AND the previous commits on this branch to understand what was built.
- Assertions derive from acceptance criteria, not from what the code currently does.
- Each test clears relevant localStorage before running — idempotent by design.
- Follow the git-commit skill for branch workflow and commit format.
- Do NOT run the full regression suite — CI handles that. Only run your new tests.

Start by reading the issue acceptance criteria, then review the commits on this branch, then write and run tests.
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

## Notes

- Only spawn **one chain per invocation** unless the user explicitly asks for parallel chains.
- If the selected issue depends on an in-progress PR (check `gh pr list --state open`), warn the user about potential merge conflicts.
- Each agent in the chain handles its own commits and pushes. Do NOT duplicate their work in the main context.
- The orchestrator's job is to **coordinate the chain**, not to build. Never do an agent's work yourself.
- If an agent goes idle (no completion after a reasonable time), kill and respawn per team norms.
- For `type:test` issues, Loki is both the first and final agent — he writes tests AND creates the PR.
