---
name: file-issue
description: "File a GitHub Issue with proper labels and add to project board. Use when the user says \"file an issue\", \"create an issue\", \"open an issue\", \"file a bug\", \"file a ticket\", or describes a problem/feature that should be tracked."
---

# File Issue Skill

File a GitHub Issue with correct labels, structured body, and project board placement.
References `quality/issue-template.md` for body structure and labeling schema.

## When to Use

Trigger on: `/file-issue`, "file an issue", "create an issue", "open an issue", "file a bug", "file a ticket", or when the user describes something that should be tracked as an issue.

## Instructions

### 1. Parse Input

Extract from the user's message:
- **Title** — short, descriptive, no prefix tags
- **Description** — what's wrong or what's missing
- **Type** — infer from context (see classification below)
- **Priority** — infer from severity/urgency (see classification below)
- **Affected code** — file paths if known from conversation context

### 2. Classify

**Type label** (exactly one):

| Label | Signal |
|-------|--------|
| `bug` | Broken, failing, error, regression, crash |
| `enhancement` | New feature, add, improve, extend |
| `ux` | UI/layout change, design, wireframe needed |
| `security` | Vulnerability, auth, secrets, OWASP |
| `documentation` | Docs-only, README, guide |

**Priority label** (exactly one):

| Label | Signal |
|-------|--------|
| `critical` | Blocking production, data loss, security breach |
| `high` | Important, do soon, user-facing regression |
| `normal` | Standard work, no urgency |
| `low` | Nice to have, cosmetic, minor |

If type or priority is ambiguous, use `AskUserQuestion` to ask the user **one question max** — don't interrogate.

### 3. Check for Duplicates

Before creating, search for existing issues:

```bash
gh issue list --search "KEYWORD" --state open --json number,title --limit 10
```

If a potential duplicate exists, use `AskUserQuestion` to show it to the user and ask whether to proceed.

### 4. Build Issue Body

Use the template structure from `quality/issue-template.md`. Only include relevant sections — delete empty ones.

```markdown
## Description
<!-- 2-3 sentences -->

## Expected Behavior
<!-- What should happen instead (bugs only) -->

## Reproduction Steps
<!-- For bugs only -->
1. ...

## Affected Code
- `src/path/to/file.ts:line`

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Dependencies
<!-- If blocked by another issue -->
Blocked by #N

## Notes
<!-- Implementation hints, related issues -->

---
Generated with [Claude Code](https://claude.com/claude-code)
```

### 5. Create the Issue

```bash
gh issue create \
  --title "Short descriptive title" \
  --label "type,priority" \
  --body "$(cat <<'EOF'
... structured body ...
EOF
)"
```

Capture the issue number from the output.

### 6. Add to Project Board

```bash
SCRIPT_DIR="$(git rev-parse --show-toplevel)/.claude/skills/fire-next-up/scripts"
node "$SCRIPT_DIR/pack-status.mjs" --move ISSUE_NUMBER up-next
```

### 7. Report Back

Output to the user:
- Issue URL
- Labels applied (type + priority)
- Board status confirmation

Example:
```
Filed #534 — "Howl panel overlaps menu on mobile"
Labels: bug, high
Board: Up Next
https://github.com/declanshanaghy/fenrir-ledger/issues/534
```

### 8. Ask to Dispatch (ALL types)

After filing, **always** use `AskUserQuestion` to ask if the issue should be dispatched:

> **Dispatch agent for #N — "<title>"?** (<chain description>)

Include the chain in the description based on type:
- `bug` / `enhancement`: FiremanDecko → Loki
- `ux`: Luna → FiremanDecko → Loki
- `security`: Heimdall → Loki

Wait for the user's response via `AskUserQuestion`. If they confirm, invoke `/dispatch #N`.
If they decline, stop — the issue is filed and on the board.

## Rules

- **All questions to the user MUST use `AskUserQuestion`** — never output a question as plain text. This includes: ambiguous type/priority, duplicate confirmation, dispatch confirmation, and any other user input needed.
- Every issue MUST have exactly **one type label** and **one priority label**
- **Always add to board** — never skip this step
- **No duplicates** — always check open issues first
- If filing from a conversation where affected code is known, include file paths in body
- Append `Generated with [Claude Code]` footer to every issue body
- Follow the Orchestrator Rules: file the issue, add to board, then dispatch via agent chain if needed
