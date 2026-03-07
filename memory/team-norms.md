# Fenrir Ledger — Team Norms

## Form Validation: Scroll to First Error

**Rule:** When a form fails validation on submit, automatically scroll the first
invalid field into view and focus it.

**Requirements:**
1. Every form field must have an `id` attribute matching its react-hook-form field name.
2. Disable react-hook-form's built-in focus: set `shouldFocusError: false` in `useForm`.
3. Pass `scrollToFirstError` as the second argument to `handleSubmit`.

**Standard implementation (copy-paste into any form component):**

```tsx
const { register, handleSubmit, ... } = useForm<MyFormValues>({
  resolver: zodResolver(mySchema),
  defaultValues,
  shouldFocusError: false, // handled manually
});

const scrollToFirstError = (errs: Record<string, unknown>) => {
  const elements = Object.keys(errs)
    .map((key) => document.getElementById(key))
    .filter((el): el is HTMLElement => el !== null)
    .sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    );
  if (elements.length > 0) {
    elements[0]!.scrollIntoView({ behavior: "smooth", block: "center" });
    elements[0]!.focus();
  }
};

// ...

<form onSubmit={handleSubmit(onSubmit, scrollToFirstError)}>
```

**Why DOM-order sort matters:** `Object.keys(errors)` returns schema insertion order,
not visual order. The `compareDocumentPosition` sort ensures we scroll to whichever
field appears first on screen, not first in the schema.

**Reference implementation:** `development/frontend/src/components/cards/CardForm.tsx`

---

## Mobile-Friendly: Everything, Always

**Rule:** Every component, page, and modal in this app must work on mobile.
This is not optional and is not a sprint-3 concern — it is a baseline requirement.

**Minimum viewport:** 375px wide (iPhone SE / smallest mainstream phone).

**Checklist for every component:**
1. Use responsive Tailwind prefixes (`sm:`, `md:`, `lg:`) for layout changes — never
   hard-code a layout that only works at desktop widths.
2. Two-column or multi-column layouts must collapse to single-column on mobile
   (use `flex flex-col md:grid md:grid-cols-[...]` or `grid-cols-1 md:grid-cols-2`).
3. Modals and dialogs: use `w-[92vw]` + `max-h-[90vh]` to keep them within the
   viewport. If the modal has a fixed left column, collapse it into the header
   (`hidden md:flex`) and show a compact version inline on mobile.
4. Text that is `hidden sm:block` on mobile must not hide content critical to the
   user's task — only supplementary labels.
5. Touch targets must be at least 44x44px (use `min-h-[44px] min-w-[44px]` or
   generous padding on interactive elements).

**Reference implementation:** `development/frontend/src/components/layout/AboutModal.tsx`
— demonstrates the desktop 2-col → mobile single-col collapse pattern with a modal.

---

## Schema Migrations: No Migrations Until Launch

**Rule:** Do not increment `SCHEMA_VERSION` or add migration steps in `runMigrations()`
until the product has had a public launch with real user data in the wild.

**Rationale:** Before launch, all storage is ephemeral dev/test data. Running
migrations on pre-launch builds adds complexity with no user value and risks
introducing bugs into the migration path before there is anything to protect.

**What to do instead:** When adding optional fields to `Card` or `Household`
(e.g. `deletedAt?: string`), rely on TypeScript's optional typing and JavaScript's
natural `undefined` for absent fields. No migration step is needed — existing records
simply lack the field, and the code handles that via `?? undefined` or optional
chaining.

**When the rule lifts:** After the first public release (v1.0), every subsequent
schema change that alters stored record shape must bump `SCHEMA_VERSION` and add
the corresponding `if (fromVersion < N && toVersion >= N)` block in `runMigrations()`.

---

## Structured Logging: Every New Module, Every Error Path

**Rule:** All new code must include structured logging statements at key decision
points, error paths, and entry/exit of significant operations. This applies to
both frontend and backend code.

### Backend Logging Format

All server-side code uses the fenrir logger: `import { log } from "@/lib/logger"`.
The logger is a tslog wrapper (`development/frontend/src/lib/logger.ts`) that provides:
- `[fenrir-backend]` prefix on all entries automatically
- JSON output in production, pretty output in development
- Automatic secret masking via `maskValuesOfKeys` + `maskValuesRegEx`

**Never use raw `console.*` in backend code.** Always use `log.*`.

| Level | When to use |
|---|---|
| `log.error()` | Caught errors. Always include error code, relevant entity IDs, and a summary of the input that caused the failure. |
| `log.info()` | Operational events: server startup, request lifecycle milestones, external API call initiation/completion. |
| `log.debug()` | Development-time tracing, entry/exit logging. Stripped in production via minLevel. |

**Backend example patterns:**

```ts
import { log } from "@/lib/logger";

// External API call
log.info("calling Google Sheets API", { sheetId, range });
// ...on success
log.info("Google Sheets API returned", { rowCount: rows.length });
// ...on failure
log.error("Google Sheets API error", {
  sheetId,
  status: error.status,
  message: error.message,
});

// Import pipeline phases
log.info("import phase transition", {
  importId,
  from: previousPhase,
  to: nextPhase,
  elapsedMs: Date.now() - phaseStartTime,
});

// Error handler (catch block or error middleware)
log.error("unhandled route error", {
  path: req.path,
  method: req.method,
  error: err.message,
  stack: err.stack,
});
```

### Frontend Logging Format

Frontend (client-side) code cannot use the fenrir logger (it's server-only / tslog).
Use `console.error` and `console.debug` with a bracketed module prefix.

| Level | When to use |
|---|---|
| `console.error()` | Caught errors in try/catch, error boundaries, and failed fetch calls. Always log before returning or re-throwing. |
| `console.debug()` | Development-time flow tracing (hook lifecycle, state transitions, conditional branches). Stripped by Next.js in production builds. |

**Frontend example patterns:**

```ts
// Hook initialization
console.debug("[useSheetImport] attempting WebSocket connection", { url });

// Fetch error
try {
  const res = await fetch("/api/sheets/import", { method: "POST", body });
  if (!res.ok) {
    console.error("[useSheetImport] HTTP import failed", {
      status: res.status,
      statusText: res.statusText,
    });
  }
} catch (err) {
  console.error("[useSheetImport] network error during import", {
    message: (err as Error).message,
  });
}

// State transition
console.debug("[ImportWizard] phase changed", { from: prev, to: next });
```

### What to Log (Checklist)

1. **External API calls** (Anthropic, Google Sheets) -- log the call being made
   (not the payload), response status, and error details on failure.
2. **WebSocket events** -- connection, disconnection, message type received, errors.
3. **Import pipeline phases** -- each phase transition with timing.
4. **Authentication flow** -- token exchange attempts, success/failure. Never log
   the token value itself.
5. **Error handlers** -- always log the error before returning a response or
   re-throwing.

### Method Entry / Exit Logging (UNBREAKABLE RULE)

**Rule:** Every function and method in backend (server-side) code must log at entry
and before every return.

**Entry logging:** At the top of every function, call `log.debug` with the function
name and a structured object of all input parameters. For sensitive inputs (tokens,
secrets, CSV bodies), log safe summaries (presence booleans, lengths) — the logger's
auto-masking handles the rest, but don't rely on it for intentional secrets.

**Exit logging:** Before every `return` statement, call `log.debug` with the function
name and a structured summary of the return value. For complex objects, log key
fields (counts, status codes, boolean flags) rather than the full object.

**Format:**

```ts
import { log } from "@/lib/logger";

// Entry
log.debug("myFunction called", { param1, param2 });

// Exit (success)
log.debug("myFunction returning", { cardCount: cards.length, hasWarning: !!warning });
return { cards, warning };

// Exit (error)
log.debug("myFunction returning error", { code: "INVALID_URL" });
return { error: { code: "INVALID_URL", message: "..." } };
```

**Sensitive input logging rules:**
- Tokens/secrets: log `{ hasToken: true }` or `{ tokenLength: token.length }` — never the value
- CSV/body content: log `{ csvLength: csv.length }` — never the content
- URLs: safe to log (not secret)
- Error messages: safe to log
- User email/sub: PII — hash before logging (e.g. SHA-256 prefix), never log raw

### What NEVER to Log

- Secrets, tokens, API keys (see CLAUDE.md Secret Masking rule)
- Full request or response bodies (log a summary or count instead)
- Personally identifiable information (PII)
- Raw credentials or passwords
- Authorization header values

**Rationale:** Structured, prefixed logging lets any team member (especially Loki
during QA) trace a request through the system by searching for the prefix or an
entity ID. Separating `console.debug` (stripped in production) from `console.error`
(always present) keeps production logs focused while giving developers full
visibility during development.

---

## Loki QA: New Tests Only, CI Handles Regression

**Rule:** When Loki runs QA validation, he writes and runs **new Playwright tests
for the feature's acceptance criteria only**. The full regression suite runs in
GitHub Actions on the PR — Loki should not duplicate that work locally.

**What Loki does:**
1. Write new tests in `quality/test-suites/<feature-slug>/`
2. Run those new tests to verify they pass
3. Commit tests to the feature branch
4. Check GH Actions status for full suite results (`gh pr checks <N>`)

**What Loki does NOT do:**
- Run the entire existing test suite locally (CI handles this)
- Re-run tests from other feature directories

**Rationale:** Avoids duplicate work and long local test runs. CI is the single
source of truth for regression testing.

---

## Vercel Env Vars: No Trailing Newlines

**Rule:** When setting Vercel environment variables via CLI, **always use `printf '%s'`** to pipe the value. Never use `echo`, `echo -n`, heredocs, or `<<<` — they all risk appending a trailing newline that becomes part of the stored value and silently breaks string comparisons at runtime.

**Correct pattern:**
```bash
# Set a new var
printf '%s' 'stripe' | vercel env add SUBSCRIPTION_PLATFORM production

# Replace an existing var
vercel env rm SUBSCRIPTION_PLATFORM production --yes
printf '%s' 'stripe' | vercel env add SUBSCRIPTION_PLATFORM production
```

**Wrong patterns (all add `\n`):**
```bash
echo "stripe" | vercel env add ...          # adds \n
echo -n "stripe" | vercel env add ...       # unreliable across shells
vercel env add ... <<< "stripe"             # adds \n
```

**Verify after setting:**
```bash
vercel env pull .env.check --environment=production
grep VARNAME .env.check   # value should NOT end with \n
rm .env.check
```

---

## Bash Tool: Variable Assignments Need Semicolons, Not &&

**Problem:** The Bash tool runs commands through `eval`. Variable assignments
chained with `&&` lose context — the variable is empty in subsequent commands.

**This is a tooling limitation, NOT something memory can fix.** It needs to be
encoded into skill files, command templates, and agent prompts that generate
shell commands. Memory alone won't ensure consistent execution across sessions
and agents.

**Broken pattern:**
```bash
REPO_ROOT=/foo && WORKTREE_DIR="${REPO_ROOT}-trees/bar" && cd "${WORKTREE_DIR}/dev"
# WORKTREE_DIR is empty → cd fails with "/dev" not found
```

**Working patterns:**
```bash
# Semicolons for assignments
REPO_ROOT=/foo; WORKTREE_DIR="${REPO_ROOT}-trees/bar"; cd "${WORKTREE_DIR}/dev"

# Or just use literal paths
cd /foo-trees/bar/dev && npm install
```

**Where to enforce:** Skill files (`create-worktree.md`, `remove-worktree.md`),
agent prompts that generate shell commands, and any orchestration templates.

---

## Hooks: Bash Only, Python in Observability

**Rule:** All new hooks in this project must be written in **bash**, placed in `.claude/hooks/scripts/`.
Python hooks are legacy — they live in `.claude/hooks/observability/` and are only for the observability pipeline (pre_tool_use, send_event, etc.). Do not write new Python hooks.

- Project hooks (bash): `.claude/hooks/scripts/`
- Observability hooks (python, legacy): `.claude/hooks/observability/`
- Hook settings: `.claude/settings-observability.json`

---

## No Shortcuts, Strict Syntax, Fix Small Things Immediately

**Rule:** Always do things properly. No shortcuts, strict syntax everywhere. Do not
postpone small fixes that become big problems later.

- If you notice a minor issue while working on something else, fix it now.
- Use strict typing, proper error handling, and correct patterns — even for "quick" changes.
- Don't leave TODOs for things you can fix in the current pass.
- Treat every code change as production-grade, not "good enough for now."
- Quality over deadlines — always. Don't rush to ship; get it right.

---

## All Issues Tracked in GitHub (UNBREAKABLE RULE)

**Rule:** All bugs, defects, feature requests, and security findings MUST be filed as
GitHub Issues. No tracking bugs on disk in markdown files, QA verdicts, or security
reports without a corresponding GitHub Issue.

**Canonical reference:** `quality/issue-template.md` — labels, body template, filing
workflow, agent chain routing, and priority ordering are all defined there.

**What does NOT count as tracking:**
- Writing a defect in a QA verdict markdown file without a GitHub Issue
- Noting a bug in a security report without a GitHub Issue
- Adding a TODO/FIXME comment in code without a GitHub Issue
- Mentioning a bug in a PR comment without a GitHub Issue

**Rationale:** Disk-based bug tracking gets stale, scattered, and forgotten. GitHub
Issues are the single source of truth — searchable, linkable, closeable, and visible
to the whole team.

---

## Behaviour Changes: Replace, Don't Layer

**Rule:** When Odin asks for a behaviour to change, the default assumption is to
**replace** the previous behaviour entirely — not to add a mode, flag, or conditional
that preserves the old behaviour alongside the new one.

If the change is ambiguous (e.g. "make the gate soft" could mean "add a soft option"
or "remove hard mode entirely"), ask for clarification before implementing. But the
default is: the old behaviour goes away.

**Examples:**
- "Make the subscription gate soft" → remove hard gate, always render children
- "Use XML delimiters in the prompt" → replace the old prompt format, don't keep both
- "Switch to Clerk" → remove Google OAuth, don't maintain both IDPs

---

## Research Requests: Always Open a GitHub Issue

**Rule:** Whenever Odin asks to research something, **open a GitHub Issue first** to track
the research before starting any work. Use the `enhancement` and `low` labels unless the
request clearly warrants a higher priority.

**Title:** `Research — <topic>` (labels carry type/priority)

**Body:** Include the research question, any constraints or context Odin provided, and
acceptance criteria for what "done" looks like (e.g. a recommendation, a comparison table,
a proof-of-concept).

**After filing:** Add to the project board as usual. Then do the research. When complete,
post findings as a comment on the issue (or link to a committed doc) and close it.

**Rationale:** Research artifacts written to disk without an issue get stale and forgotten.
An issue ensures the work is tracked, searchable, and closeable.

---

## Non-Responsive Subagents: Kill and Respawn

**Rule:** If a subagent goes idle and doesn't respond to messages after a reasonable
wait (two pings or ~60 seconds), do NOT do their work yourself. Instead:

1. Send a `shutdown_request` to kill the non-responsive agent
2. Spawn a fresh replacement agent with the same task
3. Never attempt to do the subagent's work manually as the orchestrator

**Rationale:** The orchestrator's job is to coordinate, not to build. If an agent
is stuck, a fresh spawn with a clean context is more reliable than the orchestrator
context-switching into a builder role.
