---
name: doc-sync
description: "Documentation sync skill for team agents. Updates all Markdown files in the agent's owned directory, removes stale content, and keeps the README index accurate. Use this skill whenever a team agent needs to update, review, or synchronise their docs — including after completing a sprint, after architectural changes, when asked to 'update docs', 'clean up documentation', 'review my markdown files', or 'sync the docs'. ROLE is required — accepts either a role name (e.g. product-owner) or an agent name (e.g. freya)."
---

# doc-sync — Documentation Maintenance

Your job: make the documentation in the owned directory accurate, complete, and well-indexed.

---

## Project Configuration

This table maps role names and agent name aliases to their owned output directory (DEST) and agent file.
**Update this table when adopting this skill in a new project.**

| ROLE / AGENT NAME | DEST | AGENT FILE |
|---|---|---|
| `product-owner` / `freya` | `product/` | `.claude/agents/freya.md` |
| `ux-designer` / `luna` | `ux/` | `.claude/agents/luna.md` |
| `principal-engineer` / `firemandecko` | `architecture/` | `.claude/agents/fireman-decko.md` |
| `qa-tester` / `loki` | `quality/` | `.claude/agents/loki.md` |

> **Shared manifesto:** `ux/README.md` is the design system manifesto covering all three design domains. Luna owns it; the other roles link to it from their own READMEs.

---

## Step 1 — Resolve input to DEST

The caller supplies either a role name or an agent name (case-insensitive). Look up the value in the Project Configuration table above to determine DEST and the agent file path.

If the value is not in the table, stop and ask the caller to supply a valid role or agent name.

Once DEST is resolved, load the agent file from the AGENT FILE path in the table to adopt the correct persona before editing any content.

---

## Step 2 — Collect all .md files in DEST

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

## Step 3 — Read and assess each file

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

## Step 4 — Update stale content

For each file that is stale but salvageable:

- Correct inaccurate facts in-place.
- Remove or update sections that reference removed features, unless the removal itself is the useful information (in which case, add a brief note and keep the historical record).
- Update any file links that now point to deleted or moved files.
- Keep the document's existing structure and voice — you are editing, not rewriting.

For a file that is entirely obsolete — its entire purpose relates to something that no longer exists and keeping it would only confuse — mark it for deletion in Step 5.

---

## Step 5 — Remove fully obsolete files

For each file flagged for deletion in Step 4:

1. Confirm it contains nothing of current or historical value that isn't captured elsewhere.
2. Delete the file.
3. Search for all links to this file across the entire `{DEST}/` tree **and** in the top-level `README.md`. Remove every link. Do not leave dangling references.

Be conservative: if in doubt, update the file and mark it deprecated rather than deleting it.

---

## Step 6 — Maintain `{DEST}/README.md`

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

## Step 7 — Check the top-level `README.md`

Open `README.md` at the repo root. Verify:

1. There is a section that covers `{DEST}`. Find the heading for that section.
2. **The section heading must itself be a hyperlink to `{DEST}/README.md`.** If it is plain text, convert it to a link. Example:
   ```markdown
   ### [Design](ux/README.md)
   ```
3. Within that section, verify there is a link to `{DEST}/README.md`. It must appear **at the top of the link list** for that section, before any other entries.
4. If the link to `{DEST}/README.md` is missing, add it as the first item.
5. If there are links in the top-level README pointing to files you deleted in Step 5, remove those links.
6. Do **not** restructure or rewrite sections you don't own. Make surgical edits only.

---

## Principles

**Accuracy over completeness.** One accurate document is worth more than ten partially-correct ones.

**Surgical edits.** You own `{DEST}/` and the top-level README entry for your area. Do not modify content in other directories unless you are removing a dangling link to a file you deleted.

**The README is a live index.** It should always reflect what's actually in the directory right now — no dead links, no missing entries.
