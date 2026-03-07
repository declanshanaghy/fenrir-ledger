---
name: fire-next-up
description: "Pull the next 'Up Next' item from the GitHub Project board and run the full agent chain (design → build → validate) via Depot remote sandboxes (default) or local worktrees (--local). Use when the user says 'fire next up', 'pull next item', 'work on next issue', or wants to dispatch work from the project board. Supports --peek flag to show the queue without dispatching, and --resume #N to continue a chain that was interrupted."
---

# Fire Next Up — Pull, Dispatch, and Chain Agents

Pulls the next "Up Next" item from the GitHub Project board and runs the full agent chain for that issue type. By default, agents run in **Depot remote sandboxes** (fire-and-forget). Use `--local` to fall back to local worktrees. Each agent in the chain works on the same branch, commits, and hands off to the next agent automatically.

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
- The **first agent** in every chain creates the PR via `gh pr create` with `Ref #<NUMBER>` in the body (does NOT close the issue).
- Subsequent agents push commits to the same branch — the PR updates automatically.
- The **final agent** (Loki) edits the PR body to replace `Ref #<NUMBER>` with `Fixes #<NUMBER>` so merging auto-closes the issue.
- If any agent in the chain fails or reports a blocker, the chain stops and the orchestrator reports to the user.

---

## Flags

| Flag | Effect |
|------|--------|
| `--peek` | Show the prioritized Up Next queue with agent chains — do NOT spawn anything. |
| `--resume #N` | Resume an interrupted chain for issue #N. Detects where the chain left off and spawns the next agent. |
| `--batch N` | Pull the top N **unblocked** items from "Up Next" and start chains for all of them in parallel. Max 5. |
| `--local` | Force local worktree execution instead of Depot remote sandboxes. |
| `#N` | Start a fresh chain for a specific issue number (skip priority selection). |
| *(no flag)* | Default behavior: pick the top item and start the agent chain via **Depot remote sandbox**. |

When `--peek` is passed, run **Step 1 only**, then display the full queue as a table with columns: `#`, `Title`, `Priority`, `Type`, `Chain`. Stop after the table — do not proceed further.

When `--resume #N` is passed, skip Steps 1-4 and jump directly to the **Resume Flow** section below.

When `--batch N` is passed, follow the **Batch Dispatch** section below.

When `--local` is passed, use local worktrees instead of Depot for all agent spawning. All other behavior remains the same.

---

## Execution Modes: Remote (Default) vs Local

### Remote Mode (Default) — Depot Sandboxes

By default, all agent spawning uses **Depot remote sandboxes**. This offloads CPU/memory
from the local machine and allows true parallel execution. The orchestrator stays local,
holds all secrets, and manages the agent chain lifecycle.

**Prerequisites (one-time setup):**

1. Depot CLI installed: `curl -L https://depot.dev/install-cli.sh | sh`
2. Depot login: `depot login` (browser OAuth — no env var token needed)
3. Depot org configured: `DEPOT_ORG_ID` in `.env` (value: `pqtm7s538l`)
4. Claude OAuth token: run `claude setup-token` on a machine with a browser, then
   add via `depot claude secrets add CLAUDE_CODE_OAUTH_TOKEN`
5. Git credentials: `depot claude secrets add GIT_CREDENTIALS` for repo access

See `.claude/scripts/depot-setup.sh` for the automated setup flow.

**How Depot remote execution works:**

```mermaid
sequenceDiagram
    participant 🐺 as Orchestrator<br/>(local)
    participant ☁️ as Depot Cloud
    participant 🌿 as Git Remote

    Note over 🐺,☁️: ᚠ DISPATCH — Fire & Forget

    🐺->>+☁️: depot claude --org ... --branch main<br/>--dangerously-skip-permissions<br/>-p "agent prompt"
    ☁️-->>🐺: (returns immediately)

    Note over ☁️: ⚒️ Sandbox provisioned<br/>Claude Code runs task

    ☁️->>🌿: git push (commits on feature branch)

    Note over 🐺,🌿: ᚱ COMPLETION — User checks with<br/>/depot-logs or /fire-next-up --resume
```

### Depot Session Lifecycle

Each agent step in a chain maps to **one Depot session**. Depot sessions are
**fire-and-forget** — the orchestrator spawns them and returns immediately.

#### Spawn

Launch a Depot session. The command returns immediately with a session ID and link.

```bash
depot claude \
  --org "$DEPOT_ORG_ID" \
  --session-id "issue-<NUMBER>-step<N>-<agent>-<UUID8>" \
  --repository "https://github.com/declanshanaghy/fenrir-ledger" \
  --branch "main" \
  --dangerously-skip-permissions \
  -p "<AGENT PROMPT>"
```

Session ID naming convention: `issue-<NUMBER>-step<N>-<agent-name>-<UUID8>`
where `<UUID8>` is the first 8 characters of a random UUID (generate via `uuidgen | cut -c1-8 | tr 'A-Z' 'a-z'`).
This ensures session IDs are unique across retries of the same issue/step.
Examples: `issue-42-step1-firemandecko-a1b2c3d4`, `issue-42-step2-loki-e5f6a7b8`

#### After Spawning

**Do NOT poll, wait, or block.** Report the dispatch summary to the user and stop.

The user will check on the session later using:
- `/depot-logs <session-id>` — view the session transcript
- `/depot-logs <session-id> --critique` — audit agent compliance
- `/fire-next-up --resume #N` — continue the chain once the agent completes

The orchestrator does NOT manage the session lifecycle. Depot sessions complete
on their own. The user drives the chain forward manually.

### Local Mode (`--local`)

When `--local` is passed, the orchestrator uses **local git worktrees** instead of Depot.
This is the original behavior — agents run as background Claude Code sessions on the
local machine using the Agent tool with `isolation: worktree`.

Use `--local` when:
- Depot is down or unreachable
- Debugging an agent prompt locally
- Working offline
- Quick single-issue fixes where remote overhead is not worth it

All chain logic, handoff detection, and PR creation remain identical. Only the spawning
mechanism differs.

### Mode Selection Logic

```mermaid
flowchart TD
    A{"🐺 --local flag?"}
    A -->|Yes| B["⚒️ Local worktree spawning<br/>(Agent tool, isolation: worktree)"]
    A -->|No| C{"ᚠ DEPOT_ORG_ID<br/>set in .env?"}
    C -->|No| E
    C -->|Yes| D{"ᛉ depot claude<br/>auth check"}
    D -->|Pass| F["☁️ Depot remote spawning<br/>(fire-and-forget)"]
    D -->|Fail| E["🚫 ERROR — Do NOT fall back<br/>Run depot login + set DEPOT_ORG_ID<br/>or use --local explicitly"]

    style A fill:#07070d,stroke:#c9920a,color:#c9920a
    style B fill:#07070d,stroke:#4a9eff,color:#4a9eff
    style C fill:#07070d,stroke:#c9920a,color:#c9920a
    style D fill:#07070d,stroke:#c9920a,color:#c9920a
    style E fill:#07070d,stroke:#ff4444,color:#ff4444
    style F fill:#07070d,stroke:#44ff44,color:#44ff44
```

---

## Pre-Flight — Worktree Health Check

Before any dispatch, verify that no nested or stale worktrees exist. Nested worktrees
are a bug — they occur when a subagent creates `.claude/worktrees/` relative to its
CWD (which is itself a worktree) instead of the repo root.

```bash
REPO_ROOT=$(git worktree list --porcelain | head -1 | sed 's/^worktree //')

# List all worktrees and check for nesting
git worktree list --porcelain | grep '^worktree ' | sed 's/^worktree //' | while read -r wt; do
  # Skip the main worktree
  [ "$wt" = "$REPO_ROOT" ] && continue
  # Count occurrences of .claude/worktrees/ in the path
  COUNT=$(echo "$wt" | grep -o '\.claude/worktrees/' | wc -l)
  if [ "$COUNT" -gt 1 ]; then
    echo "WARNING: Nested worktree detected: $wt"
    echo "Removing nested worktree..."
    git worktree remove "$wt" --force 2>/dev/null || rm -rf "$wt"
  fi
done

# Prune any worktrees whose directories no longer exist
git worktree prune
```

If nested worktrees were found and cleaned, report before continuing:

```
**Worktree health check:** Cleaned up N nested worktree(s). All worktrees now flat under $REPO_ROOT/.claude/worktrees/.
```

If no issues found, proceed silently.

**IMPORTANT:** When spawning agents in `--local` mode, always follow the
`create-worktree` skill to resolve the repo root first. Never create worktrees
relative to CWD.

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

Fetch all items from GitHub Project #1 and filter for the "Up Next" status column.

**IMPORTANT:** `gh project item-list` returns items from ALL columns (Todo, Up Next,
In Progress, Done) — not just "Up Next". The default page size is 30, which can miss
recently added items. Always use `--limit 200` to ensure all items are fetched:

```bash
gh project item-list 1 --owner declanshanaghy --format json --limit 200 \
  | jq '[.items[] | select(.status == "Up Next") | {num: .content.number, title: .content.title}]'
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

## Step 3 — Refine with Odin

Before dispatching, present the selected issue to Odin for refinement. This ensures the
approach is correct and avoids wasted agent cycles on misunderstood requirements.

**Present to Odin:**

```
**Issue #<NUMBER>**: <TITLE>
**Type:** <type label>
**Priority:** <priority label>
**Chain:** <Agent1> → <Agent2> [→ <Agent3>]

**Summary:**
<First 3-4 sentences of the issue body — the problem statement>

**Proposed approach:**
<1-2 sentence summary of what the first agent will do, derived from the issue body and acceptance criteria>

**Acceptance criteria:**
<Bullet list of ACs from the issue>

Odin — does this look right? Any adjustments to the approach, scope, or ACs before I fire it off?
```

**Wait for Odin's response.** Odin may:

| Response | Action |
|----------|--------|
| Approval (e.g. "go", "looks good", "fire it") | Proceed to Step 4. |
| Scope adjustment (e.g. "also fix X", "skip the toggle removal") | Update the agent prompt to reflect Odin's direction. Note the adjustment. |
| Rejection (e.g. "skip this one", "not now") | Skip this issue. Pick the next Up Next item and return to Step 2. |
| Different issue (e.g. "do #154 instead") | Switch to the requested issue and restart from Step 2. |
| Question back | Answer from the issue context, then re-ask for approval. |

**Skip refinement when:**
- `--batch` flag is used (too many items for interactive review)
- Issue body contains `skip-refinement` tag

---

## Step 4 — Determine the Chain

Map the issue type label to its agent chain using the table above. Record the full chain — you will execute it step by step.

If the issue has multiple type labels, use the first match in priority order: bug > security > ux > feature > test.

---

## Step 5 — Build the Branch Name

Construct the branch name from the issue:

```
fix/issue-<NUMBER>-<kebab-description>
```

Where `<kebab-description>` is a 3-5 word kebab-case summary derived from the issue title. Max 50 characters total.

Examples:
- `fix/issue-151-settings-two-column`
- `fix/issue-157-llm-prompt-injection`
- `fix/issue-154-howl-overlaps-menu`

**IMPORTANT:** The orchestrator does NOT create or push this branch. The branch name is
passed to the agent via the prompt. The agent creates the branch itself inside the sandbox
(or worktree) from `main`. This avoids the problem where Depot fails to checkout a
non-existent remote branch.

---

## Step 6 — Spawn Step 1 Agent

### Remote Mode (Default — Depot)

Launch the first agent in the chain as a **Depot remote session** (fire-and-forget):

```bash
depot claude \
  --org "$DEPOT_ORG_ID" \
  --session-id "issue-<NUMBER>-step1-<agent-name>-<UUID8>" \
  --repository "https://github.com/declanshanaghy/fenrir-ledger" \
  --branch "main" \
  --dangerously-skip-permissions \
  -p "<AGENT PROMPT FROM TEMPLATES BELOW>"
```

**Always use `--branch main`** — the sandbox clones main and the agent creates its own
feature branch. Passing a non-existent branch causes Depot to fail on checkout.

**Do NOT poll, wait, or block after spawning.** Report the dispatch summary (Step 8)
and stop. The user will check on the session with `/depot-logs` and continue the
chain with `/fire-next-up --resume #N` when ready.

### Local Mode (`--local`)

Launch the first agent in a **local background worktree** using the Agent tool:

- `subagent_type`: first agent in the chain
- `isolation`: `worktree`
- `run_in_background`: `true`
- `description`: `[Step 1/<N>] #<NUMBER>: <short summary>`

### Agent-Specific Prompt Templates

Use the appropriate template based on which agent is being spawned.

**IMPORTANT — All agent prompts include a mandatory setup preamble** that runs
before any task work. This preamble:
1. Runs `.claude/scripts/sandbox-setup.sh <BRANCH>` — handles git identity, credentials,
   branch creation/checkout, and `npm ci`. The branch name is passed as an argument.
2. The setup script prints `REPO_ROOT=<path>` — agents MUST use this path as a prefix
   for ALL subsequent bash commands because shell state does not persist between tool calls.

The setup script handles `gh auth setup-git` which configures the git credential
helper so `git push` can authenticate using the `GITHUB_TOKEN` env var.

**IMPORTANT — All agent prompts include this strict scope rule.** Insert the following
block into every agent prompt, immediately after the SANDBOX ENVIRONMENT RULES block:

```
STRICT SCOPE — DO NOT DEVIATE:
You are a worker in a chain. Execute ONLY the numbered steps listed below — nothing
more, nothing less. Do not improvise, ad-lib, or take actions not explicitly listed.
- Do NOT declare the issue "resolved", "fixed", or "done" — only the final agent
  in the chain (Loki) determines the outcome after QA.
- Do NOT close issues, merge PRs, or take any action beyond your listed steps.
- Do NOT add summary messages, status updates, or conclusions beyond what the
  handoff step requires.
- If something is ambiguous or unclear, stop and comment on the issue asking for
  clarification — do not guess.
- Your ONLY outputs are: code changes, commits, pushes, and the handoff comment
  specified in your steps. Nothing else.
```

#### Luna (UX Designer) — Step 1 for `type:ux`

```
You are Luna, the UX Designer. Design wireframes for GitHub Issue #<NUMBER>: <TITLE>

CRITICAL — SANDBOX ENVIRONMENT RULES:
You are running in a Depot sandbox. Each Bash tool call starts in a FRESH shell.
Shell state (cd, env vars, aliases) does NOT persist between tool calls.
ALWAYS prefix commands with: cd <REPO_ROOT> && <command>
Use absolute paths for everything. The setup script prints REPO_ROOT — use it.

STRICT SCOPE — DO NOT DEVIATE:
You are a worker in a chain. Execute ONLY the numbered steps listed below — nothing
more, nothing less. Do not improvise, ad-lib, or take actions not explicitly listed.
- Do NOT declare the issue "resolved", "fixed", or "done" — only the final agent
  in the chain (Loki) determines the outcome after QA.
- Do NOT close issues, merge PRs, or take any action beyond your listed steps.
- Do NOT add summary messages, status updates, or conclusions beyond what the
  handoff step requires.
- If something is ambiguous or unclear, stop and comment on the issue asking for
  clarification — do not guess.
- Your ONLY outputs are: code changes, commits, pushes, and the handoff comment
  specified in your steps. Nothing else.

**Step 1 — Setup (run this single command):**
bash <REPO_ROOT>/.claude/scripts/sandbox-setup.sh <BRANCH>

This handles git identity, credentials, branch creation, and npm ci.
Note the REPO_ROOT it prints — use it as a prefix for ALL subsequent commands.

**Issue details:**

<FULL ISSUE BODY>

**Step 2 — Design wireframes:**
- Create HTML wireframe(s) in `ux/wireframes/` for the feature described in the issue.
- Keep wireframes free of theme styling (no colors, no fonts) — structure only.
- Update `ux/wireframes.md` if adding new wireframes.
- Write a brief interaction spec if the feature has non-obvious interactions.

**Step 3 — Commit and push:**
cd <REPO_ROOT> && git add -A && git commit -m 'design: wireframes for #<NUMBER> — <short description>' && git push origin <BRANCH>

Use Ref (not Fixes) — you are not the final agent.

**Step 4 — Create the PR:**
gh pr create --title "design: wireframes for #<NUMBER> — <short description>" --body "Ref #<NUMBER>

<summary of wireframes created>"

**Step 5 — Handoff comment on the issue:**
gh issue comment <NUMBER> --body "## Luna → FiremanDecko Handoff

**Wireframes committed** on branch \`<BRANCH>\`.
**PR created:** <PR_URL>

**Files created:**
- \`ux/wireframes/<file1>.html\`

**Key design decisions:**
- <Brief summary of layout choices, responsive behavior, interactions>

**Implementation notes for FiremanDecko:**
- <Any specific component suggestions, existing patterns to reuse, edge cases to handle>

Ready for implementation. 🔨"

**Key reminders:**
- EVERY bash command must start with cd <REPO_ROOT>.
- Read the existing wireframes first to match conventions.
- Mobile-first: 375px minimum viewport.

Start by running the setup script, then read the issue, then review existing wireframes.
```

#### FiremanDecko (Principal Engineer) — for bugs, features, and UX Step 2

```
You are FiremanDecko, the Principal Engineer. Fix GitHub Issue #<NUMBER>: <TITLE>

CRITICAL — SANDBOX ENVIRONMENT RULES:
You are running in a Depot sandbox. Each Bash tool call starts in a FRESH shell.
Shell state (cd, env vars, aliases) does NOT persist between tool calls.
ALWAYS prefix commands with: cd <REPO_ROOT> && <command>
Use absolute paths for everything. The setup script prints REPO_ROOT — use it.

STRICT SCOPE — DO NOT DEVIATE:
You are a worker in a chain. Execute ONLY the numbered steps listed below — nothing
more, nothing less. Do not improvise, ad-lib, or take actions not explicitly listed.
- Do NOT declare the issue "resolved", "fixed", or "done" — only the final agent
  in the chain (Loki) determines the outcome after QA.
- Do NOT close issues, merge PRs, or take any action beyond your listed steps.
- Do NOT add summary messages, status updates, or conclusions beyond what the
  handoff step requires.
- If something is ambiguous or unclear, stop and comment on the issue asking for
  clarification — do not guess.
- Your ONLY outputs are: code changes, commits, pushes, and the handoff comment
  specified in your steps. Nothing else.

**Step 1 — Setup (run this single command):**
bash <REPO_ROOT>/.claude/scripts/sandbox-setup.sh <BRANCH>

This handles git identity, credentials, branch creation/checkout, and npm ci.
Note the REPO_ROOT it prints — use it as a prefix for ALL subsequent commands.

**Step 2 — Read the issue and handoff context:**
Read all comments on the issue for handoff notes from previous agents:
  gh issue view <NUMBER> --comments
Read the commits already on this branch (if any):
  cd <REPO_ROOT> && git log origin/main..HEAD --oneline
<If UX chain: Luna's wireframes are on this branch. Read them.>

**Issue details:**

<FULL ISSUE BODY>

**Step 3 — Implement the fix/feature.**
- Read the affected files FIRST, then make changes.
- <If UX Step 2: Follow Luna's wireframes for layout and structure.>
- All file paths are relative to REPO_ROOT. Do NOT double-nest paths.

**Step 4 — Verify:**
cd <REPO_ROOT>/development/frontend && npx tsc --noEmit
cd <REPO_ROOT>/development/frontend && npx next build

**Step 5 — Commit and push:**
cd <REPO_ROOT> && git add -A && git commit -m 'fix: <description> — Ref #<NUMBER>' && git push origin <BRANCH>

**Step 6 — Create the PR:**
gh pr create --title "fix: <short title> — Ref #<NUMBER>" --body "Ref #<NUMBER>

<1-3 line summary of changes>

**Changes:**
- \`<file1>\` — <brief description>

**Verification:**
- <How to verify the fix>"

Use Ref (not Fixes) — Loki will update the PR to close the issue after QA.

**Step 7 — Handoff comment on the issue:**
gh issue comment <NUMBER> --body "## FiremanDecko → Loki Handoff

**Implementation committed** on branch \`<BRANCH>\`.
**PR created:** <PR_URL>

**What changed:**
- \`<file1>\` — <brief description of change>

**How to verify:**
- <Step-by-step verification that maps to acceptance criteria>

**Edge cases to cover in tests:**
- <Any tricky scenarios Loki should write tests for>

**Build status:** tsc clean, next build clean.
Ready for QA. 🧪"

**Key reminders:**
- EVERY bash command must start with cd <REPO_ROOT>.
- Read the existing code first before making changes.
- Mobile-friendly: min 375px, two-col collapse pattern.
- Structured logging on backend code (fenrir logger, not raw console.*).

Start by running the setup script, then read the affected files, then implement.
```

#### Heimdall (Security Specialist) — Step 1 for `type:security`

```
You are Heimdall, the Security Specialist. Fix GitHub Issue #<NUMBER>: <TITLE>

CRITICAL — SANDBOX ENVIRONMENT RULES:
You are running in a Depot sandbox. Each Bash tool call starts in a FRESH shell.
Shell state (cd, env vars, aliases) does NOT persist between tool calls.
ALWAYS prefix commands with: cd <REPO_ROOT> && <command>
Use absolute paths for everything. The setup script prints REPO_ROOT — use it.

STRICT SCOPE — DO NOT DEVIATE:
You are a worker in a chain. Execute ONLY the numbered steps listed below — nothing
more, nothing less. Do not improvise, ad-lib, or take actions not explicitly listed.
- Do NOT declare the issue "resolved", "fixed", or "done" — only the final agent
  in the chain (Loki) determines the outcome after QA.
- Do NOT close issues, merge PRs, or take any action beyond your listed steps.
- Do NOT add summary messages, status updates, or conclusions beyond what the
  handoff step requires.
- If something is ambiguous or unclear, stop and comment on the issue asking for
  clarification — do not guess.
- Your ONLY outputs are: code changes, commits, pushes, and the handoff comment
  specified in your steps. Nothing else.

**Step 1 — Setup (run this single command):**
bash <REPO_ROOT>/.claude/scripts/sandbox-setup.sh <BRANCH>

This handles git identity, credentials, branch creation, and npm ci.
Note the REPO_ROOT it prints — use it as a prefix for ALL subsequent commands.

**Issue details:**

<FULL ISSUE BODY>

**Step 2 — Implement the security fix.**
- Read the affected files FIRST, then make changes.
- Update security documentation if the fix changes auth flows, trust boundaries, or threat model.

**Step 3 — Verify:**
cd <REPO_ROOT>/development/frontend && npx tsc --noEmit
cd <REPO_ROOT>/development/frontend && npx next build

**Step 4 — Commit and push:**
cd <REPO_ROOT> && git add -A && git commit -m 'security: <description> — Ref #<NUMBER>' && git push origin <BRANCH>

**Step 5 — Create the PR:**
gh pr create --title "security: <short title> — Ref #<NUMBER>" --body "Ref #<NUMBER>

<summary of security fix>"

Use Ref (not Fixes) — Loki will update the PR to close the issue after QA.

**Step 6 — Handoff comment on the issue:**
gh issue comment <NUMBER> --body "## Heimdall → Loki Handoff

**Security fix committed** on branch \`<BRANCH>\`.
**PR created:** <PR_URL>

**What changed:**
- \`<file1>\` — <brief description of change>

**Security context for tests:**
- <What the vulnerability was and how it was fixed>
- <What to test: input validation, auth checks, error handling>

**Verification steps:**
- <Specific requests or payloads Loki should test>

Ready for QA. 🧪"

**Key reminders:**
- EVERY bash command must start with cd <REPO_ROOT>.
- Read the existing code first before making changes.
- Follow the git-commit skill for branch workflow and commit format.
- Secret masking (UNBREAKABLE RULE), OWASP Top 10 awareness.
- Never log secrets, tokens, or credentials.

Start by reading the affected files listed in the issue, then implement the fix.
```

#### Loki (QA Tester) — Final agent in chain (or sole agent for `type:test`)

```
You are Loki, the QA Tester. Validate GitHub Issue #<NUMBER>: <TITLE>

CRITICAL — SANDBOX ENVIRONMENT RULES:
You are running in a Depot sandbox. Each Bash tool call starts in a FRESH shell.
Shell state (cd, env vars, aliases) does NOT persist between tool calls.
ALWAYS prefix commands with: cd <REPO_ROOT> && <command>
Use absolute paths for everything. The setup script prints REPO_ROOT — use it.

STRICT SCOPE — DO NOT DEVIATE:
You are a worker in a chain. Execute ONLY the numbered steps listed below — nothing
more, nothing less. Do not improvise, ad-lib, or take actions not explicitly listed.
- Do NOT declare the issue "resolved", "fixed", or "done" — only the final agent
  in the chain (Loki) determines the outcome after QA.
- Do NOT close issues, merge PRs, or take any action beyond your listed steps.
- Do NOT add summary messages, status updates, or conclusions beyond what the
  handoff step requires.
- If something is ambiguous or unclear, stop and comment on the issue asking for
  clarification — do not guess.
- Your ONLY outputs are: code changes, commits, pushes, and the handoff comment
  specified in your steps. Nothing else.

**Step 1 — Setup (run this single command):**
bash <REPO_ROOT>/.claude/scripts/sandbox-setup.sh <BRANCH>

This handles git identity, credentials, branch checkout, and npm ci.
Note the REPO_ROOT it prints — use it as a prefix for ALL subsequent commands.

**Step 2 — Read the handoff context:**
gh issue view <NUMBER> --comments
cd <REPO_ROOT> && git log origin/main..HEAD --oneline
Use the previous agent's handoff comment to understand what was built, how to verify, and edge cases to test.

**Issue details:**

<FULL ISSUE BODY>

**Step 3 — Write and run tests:**
- Write new Playwright tests in `quality/test-suites/<feature-slug>/` covering the acceptance criteria.
- Use the previous agent's "How to verify" and "Edge cases" sections to guide your test design.
- Run the new tests: `cd <REPO_ROOT>/development/frontend && SERVER_URL=http://localhost:9653 npx playwright test ../../quality/test-suites/<feature-slug>/ --reporter=list`
- Verify build passes: `cd <REPO_ROOT>/development/frontend && npx tsc --noEmit && npx next build`

**Step 3b — Run the FULL test suite and fix ANY failures:**
- Run ALL Playwright tests: `cd <REPO_ROOT>/development/frontend && SERVER_URL=http://localhost:9653 npx playwright test --reporter=list`
- If ANY tests fail — whether your new tests or pre-existing tests — you MUST fix them.
- Pre-existing test failures are NOT acceptable. They block CI and prevent merging.
- Read each failing test file, understand what it expects, read the actual page/component
  it tests, and fix either the test or the code to make it pass.
- Re-run the full suite after each fix until ALL tests pass (0 failures).
- Do NOT skip this step. Do NOT mark your verdict as PASS if any test is failing.
- Do NOT dismiss failures as "pre-existing" or "unrelated" — if it fails in CI, fix it.

**Step 4 — Commit and push:**
cd <REPO_ROOT> && git add -A && git commit -m 'test: validate #<NUMBER> — <short description>' && git push origin <BRANCH>

**Step 5 — Update the PR to close the issue:**
A PR already exists for this branch (created by the previous agent). Update its body
to replace `Ref #<NUMBER>` with `Fixes #<NUMBER>` so merging auto-closes the issue:
  gh pr view <BRANCH> --json number --jq '.number'
  gh pr edit <PR_NUMBER> --body "Fixes #<NUMBER>

<existing PR body content — keep the summary, add test results>"

If NO PR exists (e.g. you are the sole agent for `type:test`), create one:
  gh pr create --title "<title>" --body "Fixes #<NUMBER>\n\n<summary>"

**Step 6 — Auto-merge (if verdict is PASS):**

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

**IMPORTANT: If CI is failing, your verdict MUST be FAIL — not PASS.**
A PASS verdict means the PR is ready to merge. If CI is red, it is NOT ready.
You should have already fixed all test failures in Step 3b. If CI still fails
after your fixes, your verdict is FAIL and you must explain what is still broken.

**Step 7 — QA verdict comment on the issue:**
gh issue comment <NUMBER> --body "## Loki QA Verdict

**PR:** <PR_URL>
**Branch:** \`<BRANCH>\`
**Verdict:** PASS / FAIL

**Tests written:** <N> tests in \`quality/test-suites/<slug>/\`
**Tests passing:** <N>/<N>
**Full suite:** <N>/<N> (all Playwright tests)

**What was validated:**
- <AC-1 result>
- <AC-2 result>

**Build status:** tsc clean, next build clean.

<If PASS and merged: Merged to main. ✅>
<If PASS but merge blocked: Ready for merge — <reason for block>. ⏳>
<If FAIL: Blocked — see failures above. ❌>"

**Key reminders:**
- EVERY bash command must start with cd <REPO_ROOT>.
- Read the existing code AND the previous commits on this branch to understand what was built.
- Assertions derive from acceptance criteria, not from what the code currently does.
- Each test clears relevant localStorage before running — idempotent by design.
- Follow the git-commit skill for branch workflow and commit format.
- You MUST run the full test suite (Step 3b) and fix ALL failures. No exceptions.

Start by reading the issue comments for handoff context, then the acceptance criteria, then write and run tests.
```

---

## Step 7 — Chain Continuation

Depot sessions are fire-and-forget. The orchestrator does NOT poll or wait.

**After spawning Step 1, the orchestrator's job is done for this invocation.**

The user continues the chain manually using `/fire-next-up --resume #N`, which:
1. Detects which agents have completed (via handoff comments on the issue)
2. Spawns the next agent in the chain
3. Reports the dispatch summary and stops again

The user can inspect any session with `/depot-logs <session-id>` or
`/depot-logs <session-id> --critique`.

### Local Mode (`--local`)

When a background agent completes (you receive a task notification):

1. **Check the result.** If the agent reported a failure or blocker, stop the chain and tell the user.
2. **If more steps remain in the chain**, spawn the next agent:
   - Same `isolation: worktree` — but resume on the **same branch** (the previous agent already pushed).
   - `run_in_background: true`
   - `description`: `[Step N/<Total>] #<NUMBER>: <short summary>`
   - Use the appropriate prompt template from Step 6.
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

## Step 8 — Report

After spawning Step 1, report a **dispatch summary** to the user:

```
## Dispatch Summary

| Field | Value |
|-------|-------|
| **Issue** | #<NUMBER>: <TITLE> |
| **Type** | <type label> |
| **Priority** | <priority label> |
| **Chain** | <Agent1> → <Agent2> [→ <Agent3>] |
| **Branch** | `<BRANCH>` |
| **Step** | 1/<TOTAL> — <AgentName> |
| **Session** | `<SESSION_ID>` |
| **Depot** | [View session](https://depot.dev/orgs/pqtm7s538l/claude/<SESSION_ID>) |
| **Issue** | [#<NUMBER>](https://github.com/declanshanaghy/fenrir-ledger/issues/<NUMBER>) |
| **Mode** | Remote (Depot) / Local (worktree) |
| **Spawned** | <UTC timestamp> |

**Remaining Up Next items:**
| # | Title | Priority | Type | Chain |
|---|-------|----------|------|-------|
| ... | ... | ... | ... | ... |
```

After each chain step completes, report a **step transition**:

```
## Step Transition — #<NUMBER>

| Field | Value |
|-------|-------|
| **Completed** | Step <N>/<TOTAL> — <AgentName> |
| **Session** | [<PREV_SESSION_ID>](https://depot.dev/orgs/pqtm7s538l/claude/<PREV_SESSION_ID>) |
| **Commits** | <N> commits on `<BRANCH>` |
| **Handoff** | <Found / Missing> |
| **Next** | Step <N+1>/<TOTAL> — <NextAgentName> |
| **New Session** | [<NEW_SESSION_ID>](https://depot.dev/orgs/pqtm7s538l/claude/<NEW_SESSION_ID>) |
| **Spawned** | <UTC timestamp> |
```

After the final step, report **chain completion**:

```
## Chain Complete — #<NUMBER>

| Field | Value |
|-------|-------|
| **Issue** | #<NUMBER>: <TITLE> |
| **Chain** | <Agent1> → <Agent2> [→ <Agent3>] — ALL DONE |
| **Branch** | `<BRANCH>` |
| **PR** | [#<PR_NUMBER>](<PR_URL>) |
| **Verdict** | PASS / FAIL |
| **Total commits** | <N> |
| **Duration** | ~<minutes> min (first spawn to PR) |

### Session History
| Step | Agent | Session | Status |
|------|-------|---------|--------|
| 1 | <Agent1> | [<SID>](https://depot.dev/orgs/pqtm7s538l/claude/<SID>) | Complete |
| 2 | <Agent2> | [<SID>](https://depot.dev/orgs/pqtm7s538l/claude/<SID>) | Complete |
```

### Worktree Cleanup (Local Mode Only)

After a chain completes (Loki merges or chain fails), clean up the worktrees used
by that chain. This prevents stale worktrees from accumulating.

```bash
REPO_ROOT=$(git worktree list --porcelain | head -1 | sed 's/^worktree //')

# Remove worktrees for this chain's agents
# Pattern: issue-<NUMBER>-* matches all agent worktrees for this issue
for wt in "$REPO_ROOT/.claude/worktrees/issue-<NUMBER>-"*; do
  if [ -d "$wt" ]; then
    echo "Cleaning up worktree: $wt"
    git worktree remove "$wt" --force 2>/dev/null || rm -rf "$wt"
  fi
done

# Prune git's worktree registry for any removed directories
git worktree prune
```

For batch dispatch cleanup (after ALL chains complete):

```bash
REPO_ROOT=$(git worktree list --porcelain | head -1 | sed 's/^worktree //')

# Remove all agent worktrees (keeps the directory structure)
for wt in "$REPO_ROOT/.claude/worktrees/"*; do
  if [ -d "$wt" ]; then
    git worktree remove "$wt" --force 2>/dev/null || rm -rf "$wt"
  fi
done

git worktree prune
```

**Note:** Remote mode (Depot) does not create local worktrees, so cleanup is not
needed. Depot sandboxes are ephemeral and self-destruct after the session ends.

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
   - `Loki QA Verdict` exists → check CI status (see Step 5b below).

5b. **If Loki QA Verdict exists — check CI before declaring complete:**

   A Loki verdict does NOT mean the chain is complete. CI must also be green.

   ```bash
   # Find the PR number
   PR_NUM=$(gh pr list --head "<BRANCH>" --json number --jq '.[0].number')
   # Check CI status
   gh pr checks "$PR_NUM" 2>&1
   ```

   | Condition | Action |
   |-----------|--------|
   | CI green + verdict PASS + merged | Chain is complete. Tell the user. |
   | CI green + verdict PASS + not merged | Attempt auto-merge (check `needs-review` label first). |
   | **CI failing + verdict PASS or FAIL** | **Bounce back to Loki** with the CI failure details. See **CI Failure Bounce-Back** below. |
   | Verdict FAIL (regardless of CI) | Chain is blocked. Report to user: needs manual intervention or re-dispatch. |

   **CI Failure Bounce-Back:**

   When Loki posted a verdict but CI is still failing, the chain is NOT complete.
   The orchestrator must:

   1. **Gather CI failure details** — run `gh run view <RUN_ID> --log-failed` and
      extract the specific test failures (file names, line numbers, error messages,
      expected vs actual values).
   2. **Read the failing test files** locally to understand what they test.
   3. **Build a detailed bounce-back prompt** using the **Loki Bounce-Back Template**
      below. Include ALL of the following in the prompt:
      - The exact error output from CI (copy-paste the failure lines)
      - Which test files are failing and at which line numbers
      - The expected vs actual values from each assertion
      - Any context about what changed (e.g. "the page title was renamed from
        'Session Archive' to 'The Dev Blog' but the test still expects the old name")
      - Whether the fix should be in the test or in the code (the agent must determine
        this, but give it enough context to decide correctly)
   4. **Spawn a new Loki session** on the same branch with the bounce-back prompt.
   5. Report a **step transition** showing the bounce-back.

6. **Fallback — inspect commits** if no handoff comments exist (agent forgot to comment):
   ```bash
   git log origin/main..origin/<BRANCH> --oneline
   ```
   Use commit prefixes (`design:`, `fix:`, `security:`, `test:`) as a secondary signal.

### Loki Bounce-Back Template

Use this template when CI is failing and Loki needs to be re-dispatched to fix tests.
The orchestrator MUST fill in the CI failure details — do not send Loki in blind.

```
You are Loki, the QA Tester. CI is FAILING on PR #<PR_NUMBER> for Issue #<NUMBER>: <TITLE>

Your previous session posted a QA verdict, but CI is red. The chain cannot complete
until ALL tests pass. You must fix the failing tests before posting a new verdict.

CRITICAL — SANDBOX ENVIRONMENT RULES:
You are running in a Depot sandbox. Each Bash tool call starts in a FRESH shell.
Shell state (cd, env vars, aliases) does NOT persist between tool calls.
ALWAYS prefix commands with: cd <REPO_ROOT> && <command>
Use absolute paths for everything. The setup script prints REPO_ROOT — use it.

STRICT SCOPE — DO NOT DEVIATE:
You are a worker in a chain. Execute ONLY the numbered steps listed below — nothing
more, nothing less. Do not improvise, ad-lib, or take actions not explicitly listed.
- Do NOT declare the issue "resolved", "fixed", or "done" — only the final agent
  in the chain (Loki) determines the outcome after QA.
- Do NOT close issues, merge PRs, or take any action beyond your listed steps.
- Do NOT add summary messages, status updates, or conclusions beyond what the
  handoff step requires.
- If something is ambiguous or unclear, stop and comment on the issue asking for
  clarification — do not guess.
- Your ONLY outputs are: code changes, commits, pushes, and the verdict comment
  specified in your steps. Nothing else.

**Step 1 — Setup (run this single command):**
bash <REPO_ROOT>/.claude/scripts/sandbox-setup.sh <BRANCH>

**Step 2 — Understand the CI failures:**

The following tests are failing in CI. You MUST fix ALL of them.

<FOR EACH FAILING TEST, INCLUDE ALL OF THE FOLLOWING:>

**Failure <N>:**
- **File:** `<test-file-path>:<line-number>`
- **Test name:** `<describe block> › <test name>`
- **Error:** `<exact error message from CI>`
- **Expected:** `<expected value>`
- **Actual:** `<actual value>`
- **Context:** <explanation of why it's failing — e.g. "the page title was changed
  from 'X' to 'Y' but the test still asserts the old title">

</FOR EACH>

**Step 3 — Read the failing test files and the code they test:**
- Read each failing test file listed above.
- Read the actual page/component the test is asserting against.
- Determine whether the fix belongs in the TEST (wrong assertion) or in the CODE
  (regression introduced by this PR).
- If the test expects old behavior that was intentionally changed, update the test.
- If the test catches a real regression, fix the code.

**Step 4 — Fix all failures:**
- Make the minimum changes needed to make all tests pass.
- After fixing, run the FULL test suite to verify zero failures:
  `cd <REPO_ROOT>/development/frontend && npx playwright test --reporter=list`
- Also verify build: `cd <REPO_ROOT>/development/frontend && npx tsc --noEmit && npx next build`
- If any tests still fail, keep fixing until ALL pass. Do not stop with failures remaining.

**Step 5 — Commit and push:**
cd <REPO_ROOT> && git add -A && git commit -m 'fix: repair failing tests — Ref #<NUMBER>' && git push origin <BRANCH>

**Step 6 — Post updated verdict:**
gh issue comment <NUMBER> --body "## Loki QA Verdict (Revised)

**PR:** <PR_URL>
**Branch:** \`<BRANCH>\`
**Verdict:** PASS / FAIL

**Tests fixed:** <list of tests that were fixed and how>
**Full suite:** <N>/<N> (all Playwright tests)

**What was validated:**
- <AC results>

**Build status:** tsc clean, next build clean.

<If all tests pass: All CI failures resolved. Ready for merge. ✅>
<If still failing: FAIL — <what is still broken>. ❌>"

**Step 7 — Auto-merge (if verdict is PASS):**
1. Wait for CI: `gh pr checks <PR_NUMBER> --watch --fail-fast`
2. Check needs-review: `gh issue view <NUMBER> --json labels --jq '[.labels[].name] | any(. == "needs-review")'`
3. Check mergeable: `gh pr view <PR_NUMBER> --json mergeable --jq '.mergeable'`
4. If all clear: `gh pr merge <PR_NUMBER> --squash --delete-branch`

**Key reminders:**
- EVERY bash command must start with cd <REPO_ROOT>.
- You MUST fix ALL failing tests, not just the ones related to this issue.
- Run the FULL suite after fixing — do not stop until 0 failures.
- A PASS verdict requires ALL tests green. No exceptions.
```

### Resume Execution

Once the next agent is identified:

1. Report to the user what was detected:
   ```
   **Resuming #<N>**: <title>
   **Chain:** <full chain>
   **Completed:** Step 1 (<AgentName>) — found `<commit prefix>` commits
   **Resuming at:** Step <X>/<Total> — spawning <NextAgentName>
   ```

2. Spawn the next agent using the same prompt templates from Step 6, on the **existing branch**.

3. Continue normal chain execution from Step 7 onward.

### Edge Cases

- **Branch exists but no commits beyond main** — the previous agent failed before committing. Re-run that step (same agent, same branch).
- **Multiple agents' commits exist but chain isn't complete** — skip to the next incomplete step.
- **PR exists but CI failed** — bounce back to Loki with CI failure details (see Step 5b).
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

4. **Spawn chains** — for each unblocked item, run Steps 4–6 (determine chain, build branch, spawn Step 1 agent). All chains run in parallel background worktrees.

5. **Report** — show all dispatched chains and any skipped (blocked) items:

   ```
   **Batch dispatched:** N chains

   | # | Title | Chain | Status |
   |---|-------|-------|--------|
   | #A | ... | Decko -> Loki | Running |
   | #B | ... | Luna -> Decko -> Loki | Running |
   | #C | ... | Decko -> Loki | Blocked by #A — skipped |
   ```

6. **Chain execution** — each chain runs independently per Step 7. When a chain completes, report it. When all chains complete, report the batch summary.

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

## Notes

- Only spawn **one chain per invocation** unless `--batch` is used.
- Each agent in the chain handles its own commits and pushes. Do NOT duplicate their work in the main context.
- The orchestrator's job is to **coordinate the chain**, not to build. Never do an agent's work yourself.
- If an agent goes idle (no completion after a reasonable time), kill and respawn per team norms.
- For `type:test` issues, Loki is both the first and final agent — he writes tests AND creates the PR.
