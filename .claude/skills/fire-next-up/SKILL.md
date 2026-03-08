---
name: fire-next-up
description: "Pull the next 'Up Next' item from the GitHub Project board and run the full agent chain (design → build → validate) via Depot remote sandboxes (default) or local worktrees (--local). Use when the user says 'fire next up', 'pull next item', 'work on next issue', or wants to dispatch work from the project board. Supports --peek flag to show the queue without dispatching, --resume #N to continue a chain that was interrupted, and --status for a full dashboard of everything in flight."
---

# Fire Next Up — Pull, Dispatch, and Chain Agents

Pulls the next "Up Next" item from the GitHub Project board and runs the full agent chain for that issue type. By default, agents run in **Depot remote sandboxes** (fire-and-forget). Use `--local` to fall back to local worktrees.

## Agent Chains

| Type | Step 1 | Step 2 | Step 3 |
|------|--------|--------|--------|
| `bug` | FiremanDecko (fix) | Loki (validate) | -- |
| `enhancement` | FiremanDecko (implement) | Loki (validate) | -- |
| `ux` | Luna (wireframes) | FiremanDecko (implement) | Loki (validate) |
| `security` | Heimdall (fix/audit) | Loki (validate) | -- |
| `research` | *(varies — see below)* | -- | -- |

**Research chains** are flexible — the agent is determined by the issue body:
- Technical research → FiremanDecko (sole agent, posts findings as issue comment)
- Product research → Freya (sole agent, posts findings as issue comment)
- No Loki step — research issues produce recommendations, not code.

**Chain execution rules:**
- All agents work on the **same branch** — each commits and pushes before handing off.
- The **first agent** creates the PR with `Ref #<NUMBER>` in the body (does NOT close the issue).
- Subsequent agents push to the same branch — the PR updates automatically.
- The **final agent** (Loki) edits the PR body to replace `Ref` with `Fixes` so merging auto-closes the issue.
- If any agent fails or reports a blocker, the chain stops and the orchestrator reports to the user.

## Flags

| Flag | Effect |
|------|--------|
| `--peek` | Show the prioritized Up Next queue — do NOT spawn anything. |
| `--resume #N` | Resume an interrupted chain for issue #N. Read `templates/resume-flow.md` for detection and execution logic. |
| `--resume` | (no issue number) Scan ALL in-progress chains and report status for each. |
| `--status` | Full status dashboard: In Progress chains, Up Next queue, orphan PRs, and suggested next actions. |
| `--batch N` | Pull the top N **unblocked** items from "Up Next" and start chains for all in parallel. Max 5. |
| `--local` | Force local worktree execution instead of Depot remote sandboxes. |
| `#N` | Start a fresh chain for a specific issue number (skip priority selection). |
| *(no flag)* | Default: pick the top item and start the agent chain via Depot. |

When `--peek` is passed, run **Step 1 only**, then display the full queue as a table with columns: `#`, `Title`, `Priority`, `Type`, `Chain`. Stop after the table.

When `--status` is passed, run the **Status Dashboard** (see below). Do NOT dispatch anything.

---

## Status Dashboard (`--status`)

Gather data from the project board, open PRs, and issue comments, then output a structured report.

### Data Gathering (run in parallel)

```bash
# 1. All In Progress items
gh project item-list 1 --owner declanshanaghy --format json --limit 200 \
  | tr -d '\000-\037' \
  | jq '[.items[] | select(.status == "In Progress") | {num: .content.number, title: .content.title, labels: .labels}]'

# 2. All Up Next items (count only)
gh project item-list 1 --owner declanshanaghy --format json --limit 200 \
  | tr -d '\000-\037' \
  | jq '[.items[] | select(.status == "Up Next")] | length'

# 3. Open PRs
gh pr list --state open --json number,title,headRefName,updatedAt

# 4. For each In Progress issue, check latest comment for handoff/verdict
```

### For Each In Progress Issue, Determine Chain Position

Check issue comments for these markers (in priority order):
1. `## Loki QA Verdict` with `PASS` → **Chain complete — ready to merge**
2. `## Loki QA Verdict` with `FAIL` → **Chain blocked — needs fix**
3. `## FiremanDecko → Loki Handoff` or `## Heimdall → Loki Handoff` → **Awaiting Loki QA**
4. `## Luna → FiremanDecko Handoff` → **Awaiting FiremanDecko**
5. No handoff comment + has PR → **Step 1 agent still running or failed**
6. No handoff comment + no PR → **Step 1 agent still running or failed**

### Output Format

```
## Pack Status Dashboard

### In Flight (N issues)

| # | Title | Type | Chain Position | PR | Next Action |
|---|-------|------|----------------|-----|-------------|
| 269 | Back button | bug | Loki running | #286 | Wait / --resume #269 |
| 279 | Dashboard tabs | ux | Awaiting FiremanDecko | #288 | --resume #279 |

### Verdict Summary
- PASS, ready to merge: #X, #Y
- FAIL, needs attention: #Z
- Awaiting Loki: #A, #B
- No response (may need re-dispatch): #C

### Up Next Queue
N items queued. Top 3: #X (critical/bug), #Y (high/ux), #Z (normal/enhancement)

### Suggested Next Actions (copy-paste ready)

Generate exact commands for each action. Use this mapping:

| Situation | Command |
|-----------|---------|
| Needs Loki QA | `/fire-next-up --resume #<N>` |
| Needs FiremanDecko | `/fire-next-up --resume #<N>` |
| Loki PASS, ready to merge | `gh pr merge <PR_NUM> --squash --delete-branch` |
| No PR, may have failed | `/fire-next-up #<N> --local` |
| FAIL, needs re-dispatch | `/fire-next-up --resume #<N>` |
| Up Next, ready to start | `/fire-next-up #<N>` |

Example output:
```
gh pr merge 286 --squash --delete-branch   # #269 Loki PASS — merge it
/fire-next-up --resume #277                # Loki QA needed
/fire-next-up --resume #279                # FiremanDecko needed
/fire-next-up #272 --local                 # no PR after 3 attempts — try local
```
```

Stop after the report. Do NOT dispatch anything.

---

## Project Board Constants

| Constant | Value |
|----------|-------|
| Project Number | `1` |
| Project Node ID | `PVT_kwHOAAW5PM4BQ7LP` |
| Status Field ID | `PVTSSF_lAHOAAW5PM4BQ7LPzg-54RA` |
| Up Next | `6e492bcc` |
| In Progress | `1d9139d4` |
| Done | `c5fe053a` |

### How to Move an Issue

```bash
ITEM_ID=$(gh project item-list 1 --owner declanshanaghy --format json --limit 200 \
  | jq -r '.items[] | select(.content.number == <NUMBER>) | .id')
gh project item-edit \
  --project-id "PVT_kwHOAAW5PM4BQ7LP" \
  --id "$ITEM_ID" \
  --field-id "PVTSSF_lAHOAAW5PM4BQ7LPzg-54RA" \
  --single-select-option-id "<STATUS_OPTION_ID>"
```

### Board Transitions

| When | From | To | Who |
|------|------|----|-----|
| Agent dispatched | Up Next | **In Progress** | Orchestrator |
| Chain complete — Loki PASS + merged | In Progress | **Done** | Orchestrator |
| Chain blocked | *(stays)* | In Progress | *(needs attention)* |

---

## Pre-Flight — Worktree Health Check

```bash
REPO_ROOT=$(git worktree list --porcelain | head -1 | sed 's/^worktree //')
git worktree list --porcelain | grep '^worktree ' | sed 's/^worktree //' | while read -r wt; do
  [ "$wt" = "$REPO_ROOT" ] && continue
  COUNT=$(echo "$wt" | grep -o '\.claude/worktrees/' | wc -l)
  if [ "$COUNT" -gt 1 ]; then
    echo "WARNING: Nested worktree detected: $wt"
    git worktree remove "$wt" --force 2>/dev/null || rm -rf "$wt"
  fi
done
git worktree prune
```

---

## Step 0 — Orphan PR Check

Before dispatching new work, check for orphaned PRs that need attention.

```bash
gh pr list --state open --json number,title,headRefName,updatedAt,labels --jq '.[] | {num: .number, title: .title, branch: .headRefName, updated: .updatedAt, labels: [.labels[].name]}'
```

For each open PR, check:
1. **Has a Loki verdict?** `gh pr view <N> --comments --json comments --jq '[.comments[].body | select(test("## Loki QA Verdict"))] | length'`
2. **Verdict was PASS but not merged?** `gh pr view <N> --comments --json comments --jq '[.comments[].body | select(test("Verdict.*PASS"))] | length'`
3. **Stale?** Last update >24h ago.

| Category | Action |
|----------|--------|
| PASS but unmerged | Attempt auto-merge. Move to **Done**. |
| No verdict, stale >24h | Resume chain via `--resume`. |
| FAIL verdict, stale | Report to user: needs attention. |
| No linked issue | Report to user: review manually. |

Report orphans before proceeding. If none found, proceed silently.

---

## Step 1 — Query the Project Board

```bash
gh project item-list 1 --owner declanshanaghy --format json --limit 200 \
  | jq '[.items[] | select(.status == "Up Next") | {num: .content.number, title: .content.title}]'
```

**IMPORTANT:** `gh project item-list` returns ALL columns. Always use `--limit 200`.

---

## Step 2 — Select the Item

Priority rules (in order):
1. **critical** > high > normal > low (from labels)
2. **bugs** > security > UX > features > tests > research
3. **Lowest issue number** (oldest first)

```bash
gh issue view <NUMBER> --json number,title,body,labels
```

---

## Step 3 — Refine with Odin

Present the selected issue for refinement:

```
**Issue #<NUMBER>**: <TITLE>
**Type:** <type label> | **Priority:** <priority label>
**Chain:** <Agent1> → <Agent2> [→ <Agent3>]

**Summary:** <3-4 sentences>
**Proposed approach:** <1-2 sentences>
**Acceptance criteria:** <bullet list>

Odin — does this look right? Any adjustments before I fire it off?
```

| Response | Action |
|----------|--------|
| Approval | Proceed to Step 4. |
| Scope adjustment | Update agent prompt, note adjustment. |
| Rejection | Skip, pick next item. |
| Different issue | Switch and restart from Step 2. |
| Question | Answer from context, re-ask. |
| Interview request | Run **local design interview** (Step 3b). |

**Skip refinement when:** `--batch` flag, issue body contains `skip-refinement`, OR `--resume` (issue is already in progress).

**Always refine when:** The issue is being dispatched for the first time (moving from Up Next → In Progress). This is the default — Odin must approve before any wolf runs.

### Step 3b — Local Design Interview

When Odin requests an agent interview, run it **locally** (interactive, not Depot).
Adopt the agent persona, ask 4-6 targeted questions, then post a summary comment
on the issue. Return to remote execution for Steps 4-6.

---

## Step 4 — Determine the Chain

Map the issue type label to its agent chain. If multiple type labels, use priority order: bug > security > ux > feature > test.

---

## Step 5 — Build the Branch Name

```
fix/issue-<NUMBER>-<kebab-description>
```

Max 50 characters. The orchestrator does NOT create the branch — the agent does inside the sandbox.

---

## Step 6 — Spawn Step 1 Agent

### Agent Model Mapping

#### Remote (Depot) — use full model IDs (aliases may resolve to deprecated versions)

| Agent | `--model` flag |
|-------|----------------|
| Luna | `--model claude-sonnet-4-6` |
| FiremanDecko | `--model claude-sonnet-4-6` |
| Freya | `--model claude-sonnet-4-6` |
| Loki | `--model claude-haiku-4-5-20251001` |
| Heimdall | `--model claude-haiku-4-5-20251001` |

#### Local (`--local`) — aliases are fine

| Agent | `--model` flag |
|-------|----------------|
| Luna | `--model sonnet` |
| FiremanDecko | `--model sonnet` |
| Freya | `--model sonnet` |
| Loki | `--model haiku` |
| Heimdall | `--model haiku` |

### Agent Prompt Templates (read on demand)

Each agent has a prompt template in `templates/`. Read the appropriate one when spawning:

| Agent | Template file |
|-------|--------------|
| Luna | `templates/luna.md` |
| FiremanDecko | `templates/firemandecko.md` |
| Heimdall | `templates/heimdall.md` |
| Loki | `templates/loki.md` |
| Loki (CI bounce-back) | `templates/loki-bounce-back.md` |

All templates use `{{SANDBOX_PREAMBLE}}` — replace with the content from `templates/sandbox-preamble.md`.

### Remote Mode (Default — Depot)

```bash
depot claude \
  --org "$DEPOT_ORG_ID" \
  --session-id "issue-<NUMBER>-step<N>-<agent-name>-<UUID8>" \
  --repository "https://github.com/declanshanaghy/fenrir-ledger" \
  --branch "main" \
  --model "<MODEL FROM TABLE ABOVE>" \
  --dangerously-skip-permissions \
  -p "<AGENT PROMPT — composed from template>"
```

**Always use `--branch main`** — the sandbox clones main and the agent creates its own feature branch.

Session ID: `issue-<NUMBER>-step<N>-<agent-name>-<UUID8>` where UUID8 = `uuidgen | cut -c1-8 | tr 'A-Z' 'a-z'`.

After spawning, move the issue to **In Progress** on the project board.

**Do NOT poll, wait, or block.** Report the dispatch summary and stop.

### Local Mode (`--local`)

Launch via Agent tool with `isolation: worktree`, `run_in_background: true`.

### Mode Selection

- No `--local` flag → check `DEPOT_ORG_ID` in `.env` → check `depot claude` auth → Depot
- `--local` flag → local worktree
- Depot auth fails without `--local` → **ERROR**, do NOT fall back silently

---

## Step 7 — Chain Continuation

Depot sessions are fire-and-forget. After spawning Step 1, the orchestrator's job is done.

The user continues the chain with `/fire-next-up --resume #N`. Read `templates/resume-flow.md` for the full resume detection and execution logic.

### Local Mode (`--local`)

When a background agent completes:
1. Check result. If failure/blocker, stop and report.
2. If more steps remain, spawn next agent on same branch.
3. If final step (Loki), report completion with PR URL.

---

## Step 8 — Report

Read `templates/reports.md` for the dispatch summary, step transition, and chain completion report formats.

---

## Batch Dispatch (`--batch N`)

Pull the top N unblocked items from "Up Next" and start chains in parallel. Max 5.

1. Query the board (Step 1).
2. Prioritize and filter (Step 2), select top N.
3. Check for blocked issues: scan body for `Blocked by #N`, check if blocking issue is open.
4. Spawn chains for unblocked items (Steps 4-6 for each).
5. Report all dispatched chains and skipped (blocked) items.

Rules:
- Max 5 parallel chains.
- Each chain is independent — failure in one does not stop others.
- Blocked items are skipped, not queued.

---

## Dependency Checking

Before dispatching ANY issue:
1. Read body for `Blocked by #N`.
2. Check if blocking issues are still open.
3. Single dispatch: warn and ask. Batch: skip silently.

---

## Worktree Cleanup (Local Mode Only)

After a chain completes, clean up:

```bash
REPO_ROOT=$(git worktree list --porcelain | head -1 | sed 's/^worktree //')
for wt in "$REPO_ROOT/.claude/worktrees/issue-<NUMBER>-"*; do
  [ -d "$wt" ] && git worktree remove "$wt" --force 2>/dev/null || rm -rf "$wt"
done
git worktree prune
```

---

## Notes

- Only spawn **one chain per invocation** unless `--batch` is used.
- The orchestrator **coordinates** — never do an agent's work yourself.
- Each agent handles its own commits and pushes.
- For `test` issues, Loki is both the first and final agent.
