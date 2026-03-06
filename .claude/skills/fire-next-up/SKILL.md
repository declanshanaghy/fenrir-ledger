---
name: fire-next-up
description: "Pull the next 'Up Next' item from the GitHub Project board and spawn the appropriate agent (FiremanDecko, Heimdall, or Loki) in a background worktree to do the work. Use when the user says 'fire next up', 'pull next item', 'work on next issue', or wants to dispatch work from the project board. Supports --peek flag to show the queue without dispatching."
---

# Fire Next Up — Pull and Dispatch from Project Board

Pulls the next "Up Next" item from the GitHub Project board and spawns the appropriate agent in a background worktree to do the work.

---

## Flags

| Flag | Effect |
|------|--------|
| `--peek` | Show the prioritized Up Next queue and what agent each item would get — but do NOT spawn anything. Just report and stop. |
| *(no flag)* | Default behavior: pick the top item and dispatch an agent. |

When `--peek` is passed, run **Step 1 only**, then display the full queue as a table with columns: `#`, `Title`, `Priority`, `Type`, `Agent`. Stop after the table — do not proceed to Steps 2–6.

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

## Step 3 — Determine the Agent

Map the issue type label to the correct agent:

| Label | Agent | Notes |
|-------|-------|-------|
| `type:bug` | `fireman-decko-principal-engineer` | Code fixes |
| `type:ux` | `fireman-decko-principal-engineer` | UI/layout changes |
| `type:feature` | `fireman-decko-principal-engineer` | New functionality |
| `type:security` | `heimdall` | Security fixes and audits |
| `type:test` | `loki-qa-tester` | Test coverage gaps |

If the issue has multiple type labels, use the first match in the table above.

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

## Step 5 — Spawn the Agent

Launch the selected agent in a **background worktree** using the Agent tool:

- `subagent_type`: from Step 3
- `isolation`: `worktree`
- `run_in_background`: `true`
- `description`: `Fix #<NUMBER>: <short summary>`

The prompt to the agent MUST include:

1. **Role reminder**: "You are <AgentName>."
2. **Branch name**: from Step 4
3. **Issue number and title**
4. **Full issue body** (from `gh issue view`)
5. **Acceptance criteria** (extracted from issue body)
6. **Commit message requirement**: Include `Fixes #<NUMBER>` in the commit message
7. **Team norms reminders** relevant to the issue type:
   - For UI work: mobile-friendly (min 375px), two-col collapse pattern
   - For security: secret masking, OWASP Top 10
   - For all: read existing code first, follow git-commit skill, structured logging on backend code

### Prompt Template

```
You are <AgentName>. Fix GitHub Issue #<NUMBER>: <TITLE>

**Branch name:** `<BRANCH>`

**Issue details:**

<FULL ISSUE BODY>

**Key reminders:**
- Read the existing code first before making changes.
- Include `Fixes #<NUMBER>` in your commit message.
- Follow the git-commit skill for branch workflow and commit format.
- <Type-specific norms from team-norms.md>

Start by reading the affected files listed in the issue, then implement the fix.
```

---

## Step 6 — Report

After spawning, report to the user:

```
<AgentName> is working on **#<NUMBER>** (<title>) in a background worktree.

**Remaining Up Next items:**
| # | Issue | Status |
|---|-------|--------|
| ... | ... | Available |
```

List remaining "Up Next" items so the user can decide whether to spawn more agents.

---

## Notes

- Only spawn **one agent per invocation** unless the user explicitly asks for parallel agents.
- If the selected issue depends on an in-progress PR (check `gh pr list --state open`), warn the user about potential merge conflicts.
- The agent handles its own commits and pushes. Do NOT duplicate its work in the main context.
- After the agent completes, the user can review the worktree branch and create a PR.
