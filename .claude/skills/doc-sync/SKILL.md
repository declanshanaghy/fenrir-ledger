---
name: doc-sync
description: "Documentation sync skill for Fenrir Ledger team agents. Updates all Markdown files in the agent's owned directory, removes stale content, and keeps the README index accurate. Use this skill whenever a team agent needs to update, review, or synchronise their docs — including after completing a sprint, after architectural changes, when asked to 'update docs', 'clean up documentation', 'review my markdown files', or 'sync the docs'. ROLE is required: product-owner, ux-designer, principal-engineer, or qa-tester."
---

# doc-sync — Documentation Maintenance

You are performing a documentation synchronisation for the Fenrir Ledger project.
Your job: make the documentation in the owned directory accurate, complete, and well-indexed.

---

## Step 1 — Resolve ROLE to DEST

If ROLE is not provided, stop and ask the caller to supply it.

Load the team member SKILL from ${ROLE}/SKILL.md to ensure the correct persona
is editing content.

The ROLE parameter determines which directory we will write docs in (DEST):

| ROLE | DEST |
|---|---|
| `product-owner` | `design/` |
| `ux-designer` | `design/` |
| `principal-engineer` | `development/` |
| `qa-tester` | `quality/` |

---

## Step 2 — Collect all .md files in DEST

Find every `.md` file under `{DEST}/`, recursively. Skip anything in .gitignore — they contain generated or third-party content:

examples:
```
node_modules/
venv/
playwright-report/
playwright-report copy/
test-results/
dist/
.git/
```

Build a list of all surviving `.md` paths relative to the repo root.

---

## Step 3 — Read and assess each file

Read every file from the Step 2, one by one. For each file, ask:

**Does this content still accurately describe the current project?**

A document is **stale** if it would mislead someone reading it today. Concrete signals:

- References features that were removed in previous revisions, without making clear those were removed.
- References files, scripts, or artifacts that no longer exist on disk.
- Contains a sprint plan, bug triage, or quality report for a sprint that is fully superseded and the content has zero forward relevance.
- Describes architecture or API shapes that contradict `architecture/adrs` or `architecture/system-design.md`.

A document is **current** if:
- It accurately describes something that exists and works today, OR
- It is a historical record that is clearly labelled as such (e.g., an ADR with `Status: Deprecated`) — historical records with clear labels are not stale, they are context.

**Do not delete things just because they are old.** Delete things because they would mislead.

---

## Step 4 — Update stale content

For each file that is stale but salvageable (content is mostly right, just outdated in places):

- Correct inaccurate facts in-place.
- Remove or update sections that reference removed features, unless the removal itself is the useful information (in which case, add a brief "Note: this feature was removed in v6.0.0" and keep the historical record).
- Update any file links within the document that now point to deleted or moved files.
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

The README is the index for everything in this directory. After Step 4 and Step 5, it must:

- **Exist.** Create it if it doesn't.
- **Link every surviving `.md` file** in `{DEST}/` (recursively, skipping the excluded directories from Step 3). One entry per file.
- **Provide a single sentence of context** for each link — enough that a reader knows what they'll find before clicking.
- **Be organised** — group related docs under short headings if it helps readability (e.g., `## Design Artifacts`, `## Environment Setup`). Flat is fine too if there are only a few files.
- **Not link deleted files.** Remove any entries for files deleted in Step 6.

Format each entry as:

```markdown
- [Document Title](relative/path/to/file.md) — One sentence describing what this document contains.
```

---

## Step 7 — Check the top-level `README.md`

Open `README.md` at the repo root. Verify:

1. There is a link to `{DEST}/README.md`.
2. The link is not broken (the file now exists after Step 7).
3. If the link is missing, add it in the appropriate section. Follow the existing style: short link text, no paragraph of explanation.
4. If there are links in the top-level README that point to files you deleted in Step 6, remove those links.
5. Do **not** restructure or rewrite sections you don't own. Make surgical edits only.

---

## Principles

**Accuracy over completeness.** One accurate document is worth more than ten partially-correct ones.

**Surgical edits.** You own `{DEST}/` and the top-level README entry for your area. Do not modify content in other directories unless you are removing a dangling link to a file you deleted.

**The README is a live index.** It should always reflect what's actually in the directory right now — no dead links, no missing entries.
