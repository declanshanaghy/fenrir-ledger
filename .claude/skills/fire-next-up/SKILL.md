---
name: fire-next-up
description: "Pull the next 'Up Next' item from the GitHub Project board and run the full agent chain (design → build → validate) via Depot remote sandboxes (default) or local worktrees (--local). Use when the user says 'fire next up', 'pull next item', 'work on next issue', or wants to dispatch work from the project board. Supports --peek flag to show the queue without dispatching, and --resume to scan all in-flight chains, auto-advance ready ones, and report status."
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
| `research` | *(varies)* | -- | -- |

**Research:** Technical → FiremanDecko, Product → Freya. Sole agent, posts findings and creates PR. No Loki step. After PR merges, orchestrator presents findings to Odin for **Review** (plan into issues, shelve, or drop).

**Chain rules:** Same branch throughout. First agent creates PR with `Fixes #<NUMBER>` in the body (clean title, no issue ref). Loki adds tests on the same PR. If any agent fails, chain stops and orchestrator reports.

## Flags

| Flag | Effect |
|------|--------|
| `--peek` | Show the prioritized Up Next queue — do NOT spawn anything. |
| `--resume #N` | Resume an interrupted chain for issue #N. Read `templates/resume-flow.md`. |
| `--resume` | (no issue number) Full dashboard: scan ALL in-progress chains, **auto-advance ready ones** (dispatch next agents, merge PASS+CI green PRs, move completed to Done), and report status. **If no chains need advancing**, fall through to default dispatch: pick top Up Next item and present for refinement (always refine, even if `skip-refinement` is in body). |
| `--batch N` | Pull top N **unblocked** items from "Up Next", start chains in parallel. Max 5. |
| `--local` | Force local worktree execution instead of Depot. |
| `#N` | Start a fresh chain for a specific issue number (skip priority selection). |
| *(no flag)* | Default: pick the top item and start the agent chain via Depot. |

---

## Pack Status Script

All data queries go through the pack-status script. **Do not use `gh project item-list` or manual GraphQL.**

```bash
SCRIPT_DIR="$(git rev-parse --show-toplevel)/.claude/skills/fire-next-up/scripts"
node "$SCRIPT_DIR/pack-status.mjs" <subcommand>
```

| Subcommand | Returns |
|------------|---------|
| `--status` | Full dashboard JSON (in-flight chains, up-next queue, verdicts, actions) |
| `--peek` | Prioritized Up Next queue JSON (sorted by priority → type → issue number) |
| `--chain-status N` | Single issue chain analysis JSON |
| `--resume-detect N` | Chain position + next agent + completed steps JSON |
| `--move N <up-next\|in-progress\|done>` | Moves issue on project board |

`pack-status.mjs` is the sole source file — edit it directly. No build step needed.

### Dashboard Output Format

Render `--status` JSON as this markdown:

```
## Pack Status Dashboard

### In Flight (N issues)

| # | Title | Type | Chain Position | PR | Next Action |
|---|-------|------|----------------|-----|-------------|
| 269 | Back button | bug | Loki PASS | #286 | `gh pr merge 286 --squash --delete-branch` |
| 279 | Dashboard tabs | ux | Awaiting FiremanDecko | #288 | `/fire-next-up --resume #279` |

### Verdict Summary
- PASS, ready to merge: #X, #Y
- FAIL, needs attention: #Z
- Awaiting Loki: #A, #B
- No response (may need re-dispatch): #C

### Up Next Queue
N items queued. Top 3: #X (critical/bug), #Y (high/ux), #Z (normal/enhancement)

### Research Awaiting Review
- #168 Marketing campaign plan — `/fire-next-up --resume #168`

### Suggested Next Actions (copy-paste ready)
gh pr merge 286 --squash --delete-branch   # #269 Loki PASS — merge it
/fire-next-up --resume #277                # Loki QA needed
/fire-next-up --resume #279                # FiremanDecko needed
/fire-next-up --resume #168                # Research review needed
```

### Auto-Advance Rules (`--resume` without #N)

When `--resume` finds actions that are clearly ready, execute them immediately:

| Condition | Auto-Action |
|-----------|-------------|
| Luna done (handoff exists) | Dispatch FiremanDecko on same branch |
| FiremanDecko/Heimdall done (handoff exists) | Dispatch Loki on same branch |
| Loki PASS + CI green + PR open | Merge PR, move to Done |
| Loki PASS + no open PR (already merged) | Move to Done |
| Completed chain still in "In Progress" | Move to Done |
| Research handoff + PR merged + issue open | Present research review to Odin |

**Only pause for Odin's approval on:** ambiguous situations or FAIL verdicts.

**Do NOT pause for:** merges, Loki dispatches, board moves, or any other obvious action.
Execute all clear-cut actions immediately and report what was done in the dashboard output.

---

## Research Review Flow

When `--resume` detects a completed research chain (handoff comment exists, PR merged, issue still open), the orchestrator runs the review flow instead of spawning another agent.

### Detection

The dashboard and `resumeDetect()` identify research issues where:
- Has a `## Freya Handoff` or `## FiremanDecko Handoff` comment (without `→ Loki`)
- PR is merged (check via `gh pr list --state merged --head <branch>`)
- Issue is still open
- These show as `next_action: "review"` in the dashboard

### Review Presentation

Read the deliverable file(s) from the merged PR, then present to Odin:

```
**Research Complete: #<N> — <TITLE>**
**Agent:** <Freya/FiremanDecko>
**Deliverable:** `<file path>`

**Key findings:**
- <3-5 bullet summary from the deliverable>

**Odin — what's the call?**
1. **Plan it** → Break findings into actionable issues via /plan-w-team
2. **Shelve it** → Close issue, findings stay in repo for future reference
3. **Drop it** → Close issue, delete the deliverable file
```

### Odin's Decision

| Response | Action |
|----------|--------|
| **Plan it** | Read the deliverable, invoke `/plan-w-team` with the research as input context. Close the research issue with a comment linking to the new issues. Move to **Done**. |
| **Shelve it** | Close the issue with comment: "Shelved — deliverable at `<path>` for future reference." Move to **Done**. |
| **Drop it** | Delete the deliverable file, commit, close issue. Move to **Done**. |

---

## Dispatch Flow

### Step 1 — Select the Issue

For default dispatch: run `--peek`, pick top item. For `#N`: use that issue directly.

```bash
gh issue view <NUMBER> --json number,title,body,labels
```

Before dispatching, check body for `Blocked by #N` — if blocking issue is open, warn and ask (single) or skip (batch).

### Step 2 — Refine with Odin

Present the selected issue:

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
| Approval | Proceed to spawn. |
| Scope adjustment | Update agent prompt. |
| Rejection | Skip, pick next. |
| Different issue | Switch issue. |
| Interview request | Run **local design interview** (Step 2b). |

**Skip refinement when:** `--batch`, `skip-refinement` in body, or `--resume`.
**Always refine when:** First dispatch (Up Next → In Progress).

#### Step 2b — Local Design Interview

When Odin requests: adopt agent persona locally, ask 4-6 questions, post summary comment on issue. Return to remote execution.

### Step 3 — Dispatch via /dispatch

After refinement, delegate all spawning to `/dispatch`:

**Fresh dispatch:**
```
/dispatch #<NUMBER> --agent <agent> --step 1
```

**Chain continuation (resume):**
```
/dispatch #<NUMBER> --agent <next-agent> --step <N> --branch <existing-branch>
```

**Batch dispatch:**
```
/dispatch #N1 #N2 #N3 --parallel
```

**Refinement re-dispatch:**
```
/dispatch #<NUMBER> --agent <same-agent> --step <N> --branch <branch> --prompt-extra "<Odin's notes>"
```

**CI bounce-back:**
```
/dispatch #<NUMBER> --agent loki --step <N> --branch <branch> --template loki-bounce-back --prompt-extra "<CI failure details>"
```

**Local execution:**
Add `--local` to any of the above.

**Dry run (preview prompt without spawning):**
```
/dispatch #<NUMBER> --agent <agent> --dry-run
```

---

## Chain Continuation

Depot: fire-and-forget. User continues with `/fire-next-up --resume #N`. Read `templates/resume-flow.md`.

Local: when background agent completes, check result → spawn next agent on same branch → Loki = final step, report PR URL.

---

## Reports

Read `templates/reports.md` for dispatch summary, step transition, and chain completion report formats.

---

## Pre-Flight (Local Mode)

```bash
REPO_ROOT=$(git worktree list --porcelain | head -1 | sed 's/^worktree //')
git worktree list --porcelain | grep '^worktree ' | sed 's/^worktree //' | while read -r wt; do
  [ "$wt" = "$REPO_ROOT" ] && continue
  echo "$wt" | grep -q '\.claude/worktrees/.*\.claude/worktrees/' && \
    git worktree remove "$wt" --force 2>/dev/null || rm -rf "$wt"
done
git worktree prune
```

After chain completes, clean up worktrees for the issue:

```bash
for wt in "$REPO_ROOT/.claude/worktrees/issue-<NUMBER>-"*; do
  [ -d "$wt" ] && git worktree remove "$wt" --force 2>/dev/null || rm -rf "$wt"
done
git worktree prune
```

---

## Rules

- One chain per invocation unless `--batch`.
- The orchestrator **coordinates** — never do an agent's work yourself.
- Each agent handles its own commits and pushes.
- For `test` issues, Loki is both first and final agent.
- Board transitions: dispatched → **In Progress**, Loki PASS + merged → **Done**.
- **All agent spawning goes through `/dispatch`.** Never call `depot claude` directly.
