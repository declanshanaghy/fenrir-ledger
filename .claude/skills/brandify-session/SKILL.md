---
name: brandify-session
description: Use this skill when the user says "brandify-session", "brandify session", "save session as HTML", or provides a session name to archive. Exports the current Claude Code session to a Fenrir-styled HTML chronicle and updates the sessions index.
---

# Brandify Session — Session Chronicle Generator

Exports the current session to a styled HTML chronicle using the Fenrir Ledger visual system. CSS is shared via `sessions/chronicle.css` (served by Vercel). HTML is generated from JSON by a pre-compiled script.

---

## Step 1 — Resolve the Session Name

The user provides `{{NAME}}` — a kebab-case slug (e.g., `card-form-refactor`).
If none provided, derive one from the session's primary topic (max 4 words).

---

## Step 2 — Locate the Session Export

Check for the file at `tmp/sessions/{{NAME}}.txt`, then `sessions/{{NAME}}.txt`, then `tmp/{{NAME}}.txt`.

If not found: tell the user to run `/export tmp/sessions/{{NAME}}.txt` first.

---

## Step 3 — Parse the Session into Acts JSON

Read `tmp/sessions/{{NAME}}.txt`. Parse into **Acts** — logical groupings of user intent + Claude response.

**How to identify Acts:** Each Act begins with a user message (after `>` or `❯` prompt). Group all tool uses, output, and narrative that follow.

Write a JSON file to `tmp/sessions/{{NAME}}.json` with this schema:

```json
{
  "title": "Evocative Session Title",
  "date": "2026-03-07",
  "runes": "ᛏ ᚢ ᚢ ᛚ",
  "primary_rune": "ᛏ",
  "acts": [
    {
      "title": "Act Title (5 words max)",
      "rune": "ᛏ",
      "category": "Refactoring",
      "user_msg": "the user's raw message",
      "work_summary": "<p>HTML paragraphs. Use <span class=\"hl\">highlights</span> and <span class=\"mono\">code refs</span>.</p>",
      "code_snippet": "optional pre-formatted code (use <span class=\"ca\"> for adds, <span class=\"cr\"> for removes)",
      "bug_fix": "optional bug description",
      "files_new": ["new-file.ts"],
      "files_mod": ["existing-file.ts"],
      "files_mem": ["memory-file.md"]
    }
  ]
}
```

**Rune assignment:** Read `templates/rune-guide.md` for the Elder Futhark rune table.

**Voice:** Ancient, unhurried, knowing — rune inscriptions, not UI copy.

---

## Step 4 — Generate `sessions/{{NAME}}.html`

Run the pre-compiled generator script:

```bash
SCRIPT_DIR="$(git rev-parse --show-toplevel)/.claude/skills/brandify-session/scripts"
node "$SCRIPT_DIR/generate-chronicle.mjs" \
  --input tmp/sessions/{{NAME}}.json \
  --output sessions/{{NAME}}.html
```

The script links to `sessions/chronicle.css` — **do NOT inline CSS**.

**Fallback:** `npx tsx generate-chronicle.ts` (if `.mjs` is stale)
**After editing `generate-chronicle.ts`:** run `scripts/build.sh` to rebuild

---

## Step 5 — Update `sessions/index.html`

If `sessions/index.html` does not exist, read `templates/index-skeleton.md` and create it.

Insert a new session card inside `<div id="sessions">`, **before** existing entries (newest first):

```html
<a class="session-card" href="/sessions/{{NAME}}.html">
  <span class="card-rune">{{PRIMARY_RUNE}}</span>
  <p class="card-title">{{SESSION_TITLE}}</p>
  <p class="card-meta">{{DATE}} &middot; {{TOTAL_ACTS}} acts &middot; {{TOTAL_FILES}} files</p>
  <p class="card-excerpt">{{ONE_SENTENCE_SUMMARY}}</p>
  <span class="card-arrow">&rarr;</span>
</a>
```

---

## Step 6 — Verify & Report

Confirm `sessions/{{NAME}}.html` and `sessions/index.html` exist and are non-empty.

Report: chronicle path, act count, files documented, index updated.

---

## Step 7 — Commit, Push & PR

Create a branch, commit the generated files, and open a PR:

```bash
git checkout -b chore/session-{{NAME}}
git add sessions/{{NAME}}.html sessions/index.html
git commit -m "chore: add session chronicle — {{NAME}}"
git push -u origin chore/session-{{NAME}}
gh pr create --title "chore: session chronicle — {{NAME}}" \
  --body "Adds brandified session chronicle for **{{NAME}}**."
```

Report the PR URL to the user. Do NOT merge — Odin decides when to merge.
