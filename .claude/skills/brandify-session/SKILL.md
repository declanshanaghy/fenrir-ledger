---
name: brandify-session
description: Use this skill when the user says "brandify-session", "brandify session", "save session as HTML", or provides a session name to archive. Exports the current Claude Code session to a Fenrir-styled HTML chronicle and updates the sessions index.
---

# Brandify Session — Session Chronicle Generator

Exports the current session to a styled HTML chronicle using the Fenrir Ledger visual system.

---

## Step 1 — Resolve the Session Name

The user provides `{{NAME}}` — a kebab-case slug (e.g., `card-form-refactor`).
If none provided, derive one from the session's primary topic (max 4 words).

---

## Step 2 — Locate the Session Export

Check for the file at `tmp/sessions/{{NAME}}.txt`, then `sessions/{{NAME}}.txt`, then `tmp/{{NAME}}.txt`.

If not found: tell the user to run `/export tmp/sessions/{{NAME}}.txt` first.

Copy to `tmp/{{NAME}}.txt` if found elsewhere.

---

## Step 3 — Parse the Session

Read `tmp/{{NAME}}.txt`. Parse into **Acts** — logical groupings of user intent + Claude response.

**How to identify Acts:** Each Act begins with a user message (after `>` prompt). Group all tool uses, output, and narrative that follow.

**Extract per Act:**

| Field | Source |
|-------|--------|
| `act_title` | Summarise user's request in 5 words or fewer |
| `act_rune` | Read `templates/rune-guide.md` for the Elder Futhark rune table |
| `user_msg` | Raw user message text |
| `work_summary` | 2-3 sentence prose summary |
| `files_changed` | Paths from Write/Edit/Read tool calls |
| `code_snippets` | Key blocks worth preserving (1-2 per act) |
| `bugs_fixed` | Errors caught and corrected |
| `decisions` | Architectural or design decisions |

**Session-level metadata:** title, date, total acts, files created, files modified.

---

## Step 4 — Generate `sessions/{{NAME}}.html`

Read `templates/chronicle-skeleton.md` for the HTML structure and component rules.
Read `sessions/wireframes-modals.html` for the exact CSS — copy it, don't simplify.

Output a complete, self-contained HTML file. All CSS inline in `<style>`, fully viewable as a static file.

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
</a>
```

---

## Step 6 — Verify & Report

Confirm `sessions/{{NAME}}.html` and `sessions/index.html` exist and are non-empty.

Report: chronicle path, act count, files documented, index updated.
