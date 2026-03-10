# GitHub Issue Template & Labeling Schema

Canonical reference for filing issues in Fenrir Ledger. All agents, skills, and
team members MUST follow this schema.

## Labels

Every issue gets **one type label** and **one priority label**.

### Type labels

| Label | When to use |
|-------|-------------|
| `bug` | Fixing broken behavior |
| `enhancement` | New functionality |
| `ux` | UI/layout changes that need wireframes first |
| `security` | Security fixes or audits |
| `documentation` | Docs-only changes |

### Priority labels

| Label | When to use |
|-------|-------------|
| `critical` | Blocking production or users |
| `high` | Important, do soon |
| `normal` | Normal priority |
| `low` | Nice to have |

### Other labels (use when applicable)

| Label | When to use |
|-------|-------------|
| `duplicate` | Duplicate of another issue |
| `invalid` | Not a real issue |
| `question` | Needs discussion, not code |
| `wontfix` | Intentionally won't address |

## Issue title

Short and descriptive. No `[Type]` or `[Priority]` prefixes — labels carry that info.

Good: `Howl panel overlaps user menu on mobile`
Bad: `[Bug] [P1]: Howl panel overlaps user menu on mobile`

## Issue body template

```markdown
## Description
<!-- What's wrong or what's missing? 2-3 sentences. -->

## Screenshots
<!-- Attach if applicable. Delete section if not needed. -->

## Expected Behavior
<!-- What should happen instead? -->

## Affected Code
- `src/path/to/file.ts:line`

## Reproduction Steps
<!-- For bugs only. Delete section for features. -->
1. Go to...
2. Click...
3. Observe...

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Dependencies
<!-- If blocked by another issue -->
Blocked by #N

## Notes
<!-- Implementation hints, related issues. Delete if empty. -->
```

Only include sections that are relevant — delete empty ones.

## Filing workflow

```bash
# 1. Create the issue
gh issue create \
  --title "Short descriptive title" \
  --label "bug,high" \
  --body "$(cat <<'EOF'
## Description
...

## Acceptance Criteria
- [ ] ...
EOF
)"

# 2. Set status to "Up Next" (auto-add action handles board addition)
SCRIPT_DIR="$(git rev-parse --show-toplevel)/.claude/skills/fire-next-up/scripts"
node "$SCRIPT_DIR/pack-status.mjs" --move ISSUE_NUMBER up-next
```

## Agent chain routing

The type label determines which agent chain runs when `/fire-next-up` picks the issue:

| Type label | Step 1 | Step 2 | Step 3 |
|------------|--------|--------|--------|
| `bug` | FiremanDecko (fix) | Loki (validate) | -- |
| `enhancement` | FiremanDecko (implement) | Loki (validate) | -- |
| `ux` | Luna (wireframes) | FiremanDecko (implement) | Loki (validate) |
| `security` | Heimdall (fix/audit) | Loki (validate) | -- |

## Priority ordering

When selecting the next issue to work on:

1. `critical` before `high` before `normal` before `low`
2. Within the same priority: bugs > security > ux > enhancements
3. Within the same priority and type: lowest issue number (oldest first)

## Rules

- **All bugs, defects, features, and security findings** MUST be filed as GitHub Issues
- **No disk-only tracking** — QA verdicts, security reports, and TODO comments don't count
- **Every issue goes to Project #1** via `gh project item-add`
- **Loki handoff pattern:** file issue, add to board, hand off with issue URL
- **FiremanDecko references:** `Fixes #N` or `Ref #N` in commit/PR
