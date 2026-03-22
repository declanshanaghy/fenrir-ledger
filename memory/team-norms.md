# Fenrir Ledger — Team Norms

## Form Validation: Scroll to First Error

On submit failure, scroll + focus the first invalid field (DOM order, not schema order).

- Field `id` must match RHF field name
- `shouldFocusError: false` in `useForm`
- Pass `scrollToFirstError` as second arg to `handleSubmit`
- Sort by `compareDocumentPosition` for visual order
- Ref: `development/ledger/src/components/cards/CardForm.tsx`

---

## Mobile-First (Baseline Requirement)

Min viewport: 375px. Every component must work on mobile.

1. Responsive Tailwind prefixes (`sm:`, `md:`, `lg:`) — never hard-coded desktop layouts
2. Multi-col → single-col on mobile (`flex flex-col md:grid`)
3. Modals: `w-[92vw] max-h-[90vh]`
4. `hidden sm:block` only for supplementary labels, never critical content
5. Touch targets: min 44x44px

---

## Schema Migrations: Not Until Launch

No `SCHEMA_VERSION` bumps or `runMigrations()` changes until v1.0 with real users.
Use TypeScript optional fields + `?? undefined` for new properties. After v1.0,
every shape change requires a versioned migration block.

---

## Structured Logging

### Backend: Fenrir Logger (UNBREAKABLE — no raw `console.*`)

```ts
import { log } from "@/lib/logger";
```

tslog wrapper at `development/ledger/src/lib/logger.ts`. Auto-prefixes `[fenrir-backend]`,
JSON in prod, pretty in dev, automatic secret masking.

| Level | Use |
|---|---|
| `log.error()` | Caught errors with error code + entity IDs |
| `log.info()` | Operational events, external API calls, phase transitions |
| `log.debug()` | Entry/exit tracing (stripped in prod) |

### Frontend: `console.*` with `[ModuleName]` prefix

- `console.error()` — caught errors (always present)
- `console.debug()` — dev tracing (stripped in prod)

### Method Entry/Exit (UNBREAKABLE)

Every backend function: `log.debug` at entry (all inputs) and before every `return`
(summary of output). Sensitive inputs: log presence/length only.

### What NEVER to Log

- Secrets, tokens, API keys, credentials, auth headers
- Full request/response bodies (log counts/summaries)
- PII — user email/sub must be hashed (SHA-256 prefix), never raw

---

## Loki QA: New Tests Only

Loki writes + runs **new Playwright tests** for the feature's acceptance criteria in
`quality/test-suites/<feature-slug>/`. Full regression runs in CI on the PR — don't
duplicate it locally.

---

## Vercel Env Vars: No Trailing Newlines

Always pipe with `printf '%s'`. Never `echo`, `echo -n`, heredocs, or `<<<`.

```bash
printf '%s' 'value' | vercel env add KEY production
```

---

## Bash Tool: Semicolons for Variable Assignments

`&&` after assignments loses context in eval. Use semicolons:
```bash
REPO_ROOT=/foo; DIR="${REPO_ROOT}/bar"; cd "$DIR"
```

---

## Hooks: Bash Only

New hooks: bash in `.claude/hooks/scripts/`.
Python hooks are legacy (observability only): `.claude/hooks/observability/`.

---

## Quality Standards

- No shortcuts, strict syntax everywhere. Fix small things immediately.
- Quality over deadlines. Every change is production-grade.
- Don't leave TODOs for things you can fix now.

---

## All Issues in GitHub (UNBREAKABLE)

Every bug, feature, and security finding MUST be a GitHub Issue.
See `quality/issue-template.md` for labels, template, and workflow.
Disk-only tracking (QA verdicts, TODOs, PR comments) does NOT count.

**Every issue MUST be on the Project Board.** When filing a new issue, immediately
add it to Project #1 and set its status to "Up Next" (unless it belongs elsewhere).
Never leave an issue orphaned off the board.

---

## Behaviour Changes: Replace, Don't Layer

When Odin asks to change behaviour, **replace** the old one entirely. Don't add
flags or conditionals to preserve both. Ask if ambiguous.

---

## Research: File an Issue First

Open a GitHub Issue with the `research` label before starting any research.
Post findings as a comment and close when done.

---

## "Hunt. Kill. Return."

When Odin says this (or similar wolf phrases), it means: commit all outstanding
orchestrator changes, push to a branch, create/update a PR, merge it, and get
back onto `main`. Full cycle, no pausing.

---

## Non-Responsive Subagents: Kill and Respawn

If a subagent is idle after 2 pings / ~60s, kill it and spawn a fresh one.
Never do the subagent's work as the orchestrator.

---

## No File Structure Trees in Documentation (UNBREAKABLE)

Never include file/directory tree listings in READMEs or architecture docs. They go
stale immediately and duplicate what `ls`/`find`/`tree` already provide. Instead,
describe subsystems by their **functionality** — what they do, not where they live.
The codebase is the source of truth for file structure.
