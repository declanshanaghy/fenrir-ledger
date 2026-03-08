---
description: Break work into GitHub Issues with labels, dependencies, and acceptance criteria. Interviews Odin via Freya, wireframes via Luna (if UI), then files issues to the Project board.
argument-hint: [user prompt]
model: opus
disallowed-tools: Task, EnterPlanMode
---

# Plan With Team

Break the user's request into GitHub Issues on Project #1. Each issue becomes a unit of work that `/fire-next-up` picks up and runs through the agent chain.

## Variables

USER_PROMPT: $1
TEAM_MEMBERS:
  - Product Owner: `.claude/agents/freya.md` (subagent_type: freya-product-owner)
  - UX Designer: `.claude/agents/luna.md` (subagent_type: luna-ux-designer)
  - Builder: `.claude/agents/fireman-decko.md` (subagent_type: fireman-decko-principal-engineer)
  - Validator: `.claude/agents/loki.md` (subagent_type: loki-qa-tester)
  - Security: `.claude/agents/heimdall.md` (subagent_type: heimdall)

## Instructions

- **PLANNING ONLY**: Do NOT build, write code, or deploy agents. Your only output is GitHub Issues.
- If no `USER_PROMPT` is provided, stop and ask the user to provide it.
- Think deeply about the best approach before breaking work into issues.
- Understand the codebase directly (no subagents) to understand existing patterns.
- Each issue must be small enough for a single agent chain to complete (1 branch, 1 PR).
- Max 5 issues per plan. If the work is larger, split into phases and plan one phase at a time.
- Issues must have correct type and priority labels so `/fire-next-up` routes them to the right agent chain.

## Workflow

### Step 1 — Analyze Requirements

Parse the USER_PROMPT. Determine:
- Work type: feature, bug, ux, security, test, chore
- Complexity: simple (1 issue), medium (2-3 issues), complex (4-5 issues)
- Whether UI changes are involved (triggers Luna in Step 3)

### Step 2 — Freya Interviews Odin

Spawn Freya to clarify requirements with the user:

```
Agent({
  subagent_type: "freya-product-owner",
  prompt: "The user's name is Odin. He is the project owner and ultimate decision-maker
    for Fenrir Ledger. Address him as Odin.

    Interview Odin to clarify requirements for: <USER_PROMPT>

    Ask about:
    - Priorities and must-haves vs nice-to-haves
    - Edge cases and error scenarios
    - UX preferences (if UI work)
    - Acceptance criteria — what does 'done' look like?

    Use AskUserQuestion to conduct the interview.
    When done, summarize your findings as a structured brief with:
    - Problem statement
    - Requirements (numbered)
    - Acceptance criteria (checkboxes)
    - Priority recommendation (critical/high/normal/low)
    - Suggested issue breakdown (if multiple issues needed)"
})
```

Wait for Freya's summary before proceeding.

### Step 3 — Luna Wireframes (UI work only)

**Skip this step** if the work has no UI changes.

If the plan involves UI changes, spawn Luna:

```
Agent({
  subagent_type: "luna-ux-designer",
  prompt: "The user's name is Odin. Interview Odin about UX preferences using
    AskUserQuestion before producing wireframes.

    Create HTML5 wireframes (no theme styling — structure only) for:
    <UI components from Freya's brief>

    Write wireframes to ux/wireframes/<feature-slug>/.
    Questions to ask: layout preferences, interaction patterns, mobile behavior.

    When done, summarize:
    - Files created
    - Key layout decisions
    - Mobile behavior
    - Interaction patterns"
})
```

Wait for Luna's wireframes before proceeding. Reference them in issue bodies.

### Step 4 — Break Into Issues

Using Freya's brief (and Luna's wireframes if applicable), break the work into 1-5 issues.

**Issue sizing rules:**
- Each issue = 1 branch + 1 PR + 1 agent chain
- A `ux` issue runs Luna -> FiremanDecko -> Loki (3-step chain)
- A `enhancement` or `bug` issue runs FiremanDecko -> Loki (2-step chain)
- A `security` issue runs Heimdall -> Loki (2-step chain)
- A test-only issue runs Loki only (1-step chain)
- If an issue needs both UX design AND implementation, label it `ux` — the chain handles both

**Dependency rules:**
- Issues that can be worked in parallel should have NO dependency references
- Issues that depend on others include `Blocked by #N` in their body
- `/fire-next-up` checks if blocking issues are still open before dispatching

**Label assignment:** See `quality/issue-template.md` for the full schema.
Each issue gets one type label (`bug`, `enhancement`, `ux`, `security`) and one
priority label (`critical`, `high`, `normal`, `low`).

### Step 5 — Create Issues

Create each issue sequentially (need the issue number from each to set dependencies on later ones).

**Title format:** Short and descriptive — no `[Type]` or `[Priority]` prefixes (labels carry that).

**Body template:** Use the template from `quality/issue-template.md`. Add an
`## Implementation Notes` section with key files, patterns, and wireframe paths.

**For each issue, run:**

```bash
# Create the issue
gh issue create \
  --title "Short descriptive title" \
  --label "<type>,<priority>" \
  --body "$(cat <<'EOF'
<issue body from template above>
EOF
)"

# Add to project board
gh project item-add 1 --owner declanshanaghy --url <issue-url>

# MANDATORY: Set status to "Up Next" (otherwise it lands in "No Status")
SCRIPT_DIR="$(git rev-parse --show-toplevel)/.claude/skills/fire-next-up/scripts"
node "$SCRIPT_DIR/pack-status.mjs" --move <issue-number> up-next
```

**After creating all issues:** If any issue references `Blocked by #N`, edit the earlier issue to add a note:

```bash
# Optional: add "Blocks #M" to the earlier issue for bidirectional tracking
gh issue comment <N> --body "Blocks #M — <one-line summary of dependent issue>"
```

### Step 6 — Report

After all issues are created, report:

```
## Plan Filed

**Topic:** <brief description>
**Issues created:** N

| # | Title | Type | Priority | Chain | Depends On |
|---|-------|------|----------|-------|------------|
| #N | ... | enhancement | normal | Decko -> Loki | — |
| #M | ... | ux | high | Luna -> Decko -> Loki | #N |

**Wireframes:** <path or "none">

To start execution:
- `/fire-next-up` — pick the top unblocked issue
- `/fire-next-up --batch 3` — pick top 3 unblocked issues in parallel
- `/fire-next-up --peek` — preview the queue
```

## Rules

1. **Max 5 issues per plan** — if the work is bigger, plan in phases
2. **Each issue must be self-contained** — one branch, one PR, one agent chain
3. **Labels are mandatory** — every issue gets one type label and one priority label
4. **Add to project board** — every issue goes to Project #1 via `gh project item-add`, then **immediately set status to "Up Next"** via `pack-status.mjs --move N up-next`
5. **Sequential creation** — create issues one at a time to capture numbers for dependencies
6. **No spec files** — the issues ARE the spec. Do not write to `specs/`
7. **No code** — planning only. Agents do the building via `/fire-next-up`
8. **Freya always interviews** — never skip the product owner interview
9. **Luna only for UI** — skip wireframes for pure backend/infra/test work
10. **Use the issue template** — all required sections must be present for agents to work from
