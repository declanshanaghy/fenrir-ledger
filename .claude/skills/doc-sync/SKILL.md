---
name: doc-sync
description: "Documentation sync skill for team agents. Updates all Markdown files in the agent's owned directory, removes stale content, and keeps the README index accurate. Use this skill whenever a team agent needs to update, review, or synchronise their docs — including after completing a sprint, after architectural changes, when asked to 'update docs', 'clean up documentation', 'review my markdown files', or 'sync the docs'. Supports --all to dispatch all roles in parallel with a consolidator."
---

# doc-sync — Documentation Maintenance

Your job: make the documentation in the owned directory accurate, complete, and well-indexed.

This skill supports two modes:
- **Single role:** `/doc-sync --role luna` — sync one agent's docs (Steps 1-7 below)
- **All roles:** `/doc-sync --all` — dispatch all roles in parallel via GKE, then consolidate (Orchestration Mode below)

---

## Project Configuration

This table maps role names and agent name aliases to their owned output directory (DEST), agent file, and GKE dispatch model.

| ROLE / AGENT NAME | DEST | AGENT FILE | DISPATCH MODEL |
|---|---|---|---|
| `product-owner` / `freya` | `product/` | `.claude/agents/freya.md` | `claude-sonnet-4-6` |
| `ux-designer` / `luna` | `ux/` | `.claude/agents/luna.md` | `claude-sonnet-4-6` |
| `principal-engineer` / `firemandecko` | `architecture/`, `development/`, `infrastructure/` | `.claude/agents/fireman-decko.md` | `claude-opus-4-6` |
| `qa-tester` / `loki` | `quality/` | `.claude/agents/loki.md` | `claude-haiku-4-5-20251001` |
| `security` / `heimdall` | `security/` | `.claude/agents/heimdall.md` | `claude-haiku-4-5-20251001` |

> **Shared manifesto:** `ux/README.md` is the design system manifesto covering all three design domains. Luna owns it; the other roles link to it from their own READMEs.

---

## Orchestration Mode (`--all`)

When invoked with `--all`, the orchestrator dispatches all roles in parallel and then
runs a consolidator. This replaces the manual process of filing 5 issues + 1 join issue.

### Phase 1 — File issues (if not already filed)

For each role in the Project Configuration table, check if an open doc-sync issue exists:

```bash
gh issue list --search "Doc sync: <AGENT_NAME>" --state open --json number --jq '.[0].number'
```

If no issue exists, file one per role:

```
Title: Doc sync: <Agent Display Name> (<Role>)
Labels: enhancement, low
Body: Run /doc-sync --role <role>. Update all markdown in <DEST>. Remove stale content, ensure README index is accurate.
skip-refinement
```

Also file the consolidator issue if not already open:

```
Title: Consolidate doc-sync outputs into top-level README.md
Labels: enhancement, low
Body: Blocked by #<all role issue numbers>
Read all {DEST}/.sync-report.md files and update root README.md.
skip-refinement
```

### Phase 2 — Dispatch all roles in parallel

For each role, dispatch via `/dispatch` using the **role's own agent**:

```
/dispatch #<ISSUE> --agent <AGENT_FROM_TABLE> --step 1
```

The agent prompt MUST:
1. Reference the correct **agent definition file** from the Project Configuration table
2. Include `/doc-sync --role <role>` as the task (the agent runs Steps 1-7 below)
3. Use the correct **dispatch model** from the table

All dispatches run in parallel (`--parallel` flag to `/dispatch`).

### Phase 3 — Resume and consolidate

When all role PRs are merged (detected via `/fire-next-up --resume`), dispatch the
consolidator issue (#704 or equivalent):

```
/dispatch #<CONSOLIDATOR_ISSUE> --agent firemandecko --step 1
```

The consolidator agent:
1. Reads all `{DEST}/.sync-report.md` files from each role's merged branch
2. Updates root `README.md` based on the hints in each sync report
3. Creates a PR and posts handoff

### Example Full Flow

```
/doc-sync --all
  → Files 5 role issues + 1 consolidator (if needed)
  → /dispatch #700 #701 #702 #703 #753 --parallel
  → Agents run on GKE, each creates PR
  → /fire-next-up --resume  (merges PASS PRs, detects all done)
  → /dispatch #704 --agent firemandecko  (consolidator)
  → Consolidator merges, chain complete
```

---

## Single Role Mode (`--role <name>`)

When invoked with a specific role, the agent runs Steps 1-7 directly.

### Step 1 — Resolve input to DEST

The caller supplies either a role name or an agent name (case-insensitive). Look up the value in the Project Configuration table above to determine DEST and the agent file path.

If the value is not in the table, stop and ask the caller to supply a valid role or agent name.

Once DEST is resolved, load the agent file from the AGENT FILE path in the table to adopt the correct persona before editing any content.

---

### Step 2 — Collect all .md files in DEST

Find every `.md` file under `{DEST}/`, recursively. Skip directories listed in `.gitignore` — they contain generated or third-party content:

```
node_modules/
venv/
playwright-report/
test-results/
dist/
.git/
```

Build a list of all surviving `.md` paths relative to the repo root.

---

### Step 3 — Read and assess each file

Read every file from Step 2, one by one. For each file, ask:

**Does this content still accurately describe the current project?**

A document is **stale** if it would mislead someone reading it today. Concrete signals:

- References features that were removed, without making clear they were removed.
- References files, scripts, or artifacts that no longer exist on disk.
- Contains a sprint plan, bug triage, or quality report for a sprint that is fully superseded and the content has zero forward relevance.
- Describes architecture or API shapes that contradict the project's ADRs or system design docs.

A document is **current** if:
- It accurately describes something that exists and works today, OR
- It is a historical record clearly labelled as such (e.g., an ADR with `Status: Deprecated`) — historical records with clear labels are not stale, they are context.

**Do not delete things just because they are old.** Delete things because they would mislead.

---

### Step 4 — Update stale content

For each file that is stale but salvageable:

- Correct inaccurate facts in-place.
- Remove or update sections that reference removed features, unless the removal itself is the useful information (in which case, add a brief note and keep the historical record).
- Update any file links that now point to deleted or moved files.
- Keep the document's existing structure and voice — you are editing, not rewriting.

For a file that is entirely obsolete — its entire purpose relates to something that no longer exists and keeping it would only confuse — mark it for deletion in Step 5.

---

### Step 5 — Remove fully obsolete files

For each file flagged for deletion in Step 4:

1. Confirm it contains nothing of current or historical value that isn't captured elsewhere.
2. Delete the file.
3. Search for all links to this file across the entire `{DEST}/` tree. Remove every link. Do not leave dangling references inside your own directory.

Be conservative: if in doubt, update the file and mark it deprecated rather than deleting it.

---

### Step 6 — Maintain `{DEST}/README.md`

The README is the index for everything in this directory. After Steps 4 and 5, it must:

- **Exist.** Create it if it doesn't.
- **List itself first.** The first entry must be a self-referencing link to `README.md` — this anchors the index.
- **Link every surviving `.md` file** in `{DEST}/` (recursively, skipping excluded directories from Step 2). One entry per file.
- **Provide a single sentence of context** for each link — enough that a reader knows what they'll find before clicking.
- **Be organised** — group related docs under short headings if it helps readability. Flat is fine too if there are only a few files.
- **Not link deleted files.** Remove any entries for files deleted in Step 5.

Format each entry as:

```markdown
- [Document Title](relative/path/to/file.md) — One sentence describing what this document contains.
```

---

### Step 7 — Write sync report

Write `{DEST}/.sync-report.md` summarising what this run changed. The session coordinator reads all reports after agents complete and uses them to update the root `README.md`.

Format:

```markdown
# doc-sync report — {ROLE} — {DATE}

## Files changed
- `{DEST}/foo.md` — brief description of what changed and why
- `{DEST}/bar.md` — deleted (reason)

## Files unchanged
- `{DEST}/baz.md` — verified current, no edits needed

## README.md hints
<!-- Tell the coordinator what (if anything) needs updating in the root README for your section. -->
- Added link to `{DEST}/foo.md` in DEST/README.md — root README should reflect this
- Deleted `{DEST}/bar.md` — root README link to this file should be removed
- No root README changes needed  ← use this if nothing changed
```

`{DEST}/.sync-report.md` is gitignored — do not add it to the commit. It exists only for the coordinator to read during the current session.

---

## Principles

**Accuracy over completeness.** One accurate document is worth more than ten partially-correct ones.

**Surgical edits.** You own `{DEST}/` only. Do not modify files outside your directory.

**The README is a live index.** It should always reflect what's actually in the directory right now — no dead links, no missing entries.

**The root README is the coordinator's job.** After all parallel doc-sync runs complete, the session coordinator reads every `{DEST}/.sync-report.md` and makes targeted edits to the root `README.md` based on the hints provided.

**Each agent uses their own persona.** When dispatched via `--all`, each role uses its own agent definition file — not a generic agent. The agent's domain knowledge about their owned directory produces better results.
