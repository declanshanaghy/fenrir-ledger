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
| `research` | *(varies)* | -- | -- |

**Research:** Technical → FiremanDecko, Product → Freya. Sole agent, posts findings and creates PR. No Loki step. After PR merges, orchestrator presents findings to Odin for **Review** (plan into issues, shelve, or drop).

**Chain rules:** Same branch throughout. First agent creates PR with `Ref #<NUMBER>`. Final agent (Loki) changes `Ref` to `Fixes`. If any agent fails, chain stops and orchestrator reports.

## Flags

| Flag | Effect |
|------|--------|
| `--peek` | Show the prioritized Up Next queue — do NOT spawn anything. |
| `--resume #N` | Resume an interrupted chain for issue #N. Read `templates/resume-flow.md`. |
| `--resume` | (no issue number) Scan ALL in-progress chains and report status. |
| `--status` | Full status dashboard. Do NOT dispatch anything. |
| `--batch N` | Pull top N **unblocked** items from "Up Next", start chains in parallel. Max 5. |
| `--local` | Force local worktree execution instead of Depot. |
| `--skip-tests` | Skip `verify.sh --step test` in agent prompt. tsc+build still required. Use with `--resume` after repeated test failures. Handoff gets "⚠️ Tests skipped by Odin" marker. |
| `#N` | Start a fresh chain for a specific issue number (skip priority selection). |
| *(no flag)* | Default: pick the top item and start the agent chain via Depot. |

---

## Pack Status Script

All data queries go through the pre-compiled script. **Do not use `gh project item-list` or manual GraphQL.**

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

**Fallback:** `npx tsx pack-status.ts` (if `.mjs` is stale)
**After editing `pack-status.ts`:** run `scripts/build.sh` to rebuild the `.mjs`

### Status Dashboard Output Format

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

---

## Research Review Flow

When `--resume` detects a completed research chain (handoff comment exists, PR merged, issue still open), the orchestrator runs the review flow instead of spawning another agent.

### Detection

The `--status` dashboard and `resumeDetect()` identify research issues where:
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

### Step 3 — Build Branch Name

```
fix/issue-<NUMBER>-<kebab-description>
```

Max 50 chars. The orchestrator does NOT create the branch — the agent does inside the sandbox.

### Step 4 — Spawn Agent

#### Agent Model Mapping

| Agent | Remote (Depot) | Local (`--local`) |
|-------|----------------|-------------------|
| Luna | `claude-sonnet-4-6` | `sonnet` |
| FiremanDecko | `claude-opus-4-6` | `opus` |
| Freya | `claude-sonnet-4-6` | `sonnet` |
| Loki | `claude-haiku-4-5-20251001` | `haiku` |
| Heimdall | `claude-haiku-4-5-20251001` | `haiku` |

#### Agent Prompt Templates (read on demand)

| Agent | Template |
|-------|----------|
| Luna | `templates/luna.md` |
| FiremanDecko | `templates/firemandecko.md` |
| Heimdall | `templates/heimdall.md` |
| Loki | `templates/loki.md` |
| Loki (CI bounce-back) | `templates/loki-bounce-back.md` |

All templates use `{{SANDBOX_PREAMBLE}}` — replace with content from `templates/sandbox-preamble.md`.

#### Remote Mode (Default — Depot)

```bash
depot claude \
  --org "$DEPOT_ORG_ID" \
  --session-id "issue-<NUMBER>-step<N>-<agent-name>-<UUID8>" \
  --repository "https://github.com/declanshanaghy/fenrir-ledger" \
  --branch "main" \
  --model "<MODEL FROM TABLE>" \
  --dangerously-skip-permissions \
  -p "<AGENT PROMPT>"
```

Session ID: `issue-<NUMBER>-step<N>-<agent-name>-<UUID8>` where UUID8 = `uuidgen | cut -c1-8 | tr 'A-Z' 'a-z'`.

**CRITICAL: Always use `--branch "main"`** — even for resume/refinement dispatches on existing
branches. The `sandbox-setup.sh` script handles branch checkout. Passing a feature branch
directly can cause path mismatches in the sandbox (the repo root may differ).

After spawning: move issue to **In Progress** via `--move`. **Do NOT poll, wait, or block.**

#### Local Mode (`--local`)

Launch via Agent tool with `isolation: worktree`, `run_in_background: true`.

#### Mode Selection

- No `--local` → check `DEPOT_ORG_ID` in `.env` → Depot
- `--local` → local worktree
- Depot auth fails without `--local` → **ERROR**, do NOT fall back silently

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
