---
name: brandify-session
description: Use this skill when the user says "brandify-session", "brandify session", "save session as HTML", or provides a session name to archive. Exports the current Claude Code session to a Fenrir-styled HTML chronicle and updates the sessions index.
---

# Brandify Session — Session Chronicle Generator

Exports the current session to a styled HTML chronicle using the Fenrir Ledger visual system.
Reads the raw session `.txt` export, renders it as a narrative HTML document, and updates `sessions/index.html`.

---

## Step 1 — Resolve the Session Name

The user provides `{{NAME}}` — a kebab-case slug identifying this session (e.g., `cat-easter-egg`, `card-form-refactor`).

If no name is provided, derive one from the session's primary topic (kebab-case, max 4 words).

---

## Step 2 — Locate the Session Export File

The Claude Code `/export` command writes sessions to `sessions/{{NAME}}.txt` by default.

Run these bash commands in order:

```bash
mkdir -p tmp
```

Then check for the file:

```bash
ls sessions/{{NAME}}.txt 2>/dev/null && echo "FOUND_IN_SESSIONS" || echo "NOT_FOUND"
```

**If found** at `sessions/{{NAME}}.txt`:
```bash
cp sessions/{{NAME}}.txt tmp/{{NAME}}.txt
```

**If not found**, check `tmp/{{NAME}}.txt`:
```bash
ls tmp/{{NAME}}.txt 2>/dev/null && echo "FOUND_IN_TMP" || echo "NOT_FOUND"
```

**If neither exists**: Stop and tell the user:
> Session file not found. Run `/export sessions/{{NAME}}.txt` first, then invoke this skill again.

Once the file is confirmed at `tmp/{{NAME}}.txt`, proceed.

---

## Step 3 — Parse the Session

Read `tmp/{{NAME}}.txt` in full. The file is a Claude Code terminal transcript. Parse it intelligently into **Acts** — logical groupings of user intent + Claude's response.

### How to identify Acts

Each Act begins with a user message. In the transcript, user messages appear after `❯` or as the first substantive line after a `✻` compaction notice. Group all the tool uses, code output, and Claude narrative that follow into a single Act.

### What to extract per Act

| Field | Where to find it |
|-------|-----------------|
| `act_title` | Summarise the user's request in 5 words or fewer |
| `act_rune` | Pick one Elder Futhark rune that fits the work (see rune table below) |
| `user_msg` | The raw user message text |
| `work_summary` | 2–3 sentence prose summary of what Claude did |
| `files_changed` | All file paths seen in `⏺ Write(...)`, `⏺ Edit(...)`, `⏺ Read(...)` |
| `code_snippets` | Key code blocks worth preserving (limit to 1–2 per act) |
| `bugs_fixed` | Any errors caught and corrected |
| `decisions` | Architectural or design decisions made |

### Rune assignment guide

| Rune | Use for |
|------|---------|
| ᚠ | Foundations, first implementations |
| ᚢ | Strength, refactoring, making things robust |
| ᚦ | Problem-solving, fixing bugs |
| ᚱ | Routing, navigation, structure |
| ᚲ | Easter eggs, secrets, hidden things |
| ᚷ | Data, storage, persistence |
| ᚹ | UI, visual design, components |
| ᚺ | Haste, quick fixes, patches |
| ᚾ | New features, fresh additions |
| ᛁ | Integrations, wiring things together |
| ᛃ | Journeys, flows, multi-step processes |
| ᛇ | Complexity, deep systems |
| ᛈ | Parsing, transformation, conversion |
| ᛉ | Protection, guards, validation |
| ᛊ | Sound, audio, animations |
| ᛏ | Tooling, skills, meta-work |
| ᛒ | Design, aesthetics, style |
| ᛖ | Events, interactions, user actions |
| ᛗ | Memory, persistence, localStorage |
| ᛚ | Layout, structure, composition |
| ᛜ | Hooks, connections, bindings |
| ᛞ | Deployments, delivery |
| ᛟ | Identity, branding, Fenrir-specific |

### Session-level metadata to extract

- **Session title**: Human-readable title for the whole session (from the primary topic)
- **Date**: From the terminal timestamp or derive from file modification date
- **Total acts**: Count of Acts
- **Files created**: List of new files (from `⏺ Write(...)`)
- **Files modified**: List of changed files (from `⏺ Edit(...)`)

---

## Step 4 — Generate `sessions/{{NAME}}.html`

Write a complete, self-contained HTML file to `sessions/{{NAME}}.html`.

### Design system

Copy the CSS variables and font imports **exactly** from `sessions/wireframes-modals.html` — read that file first for the full token set. Key tokens:

```
--void:        #07070d   (page background)
--forge:       #0f1018   (card surfaces)
--chain:       #13151f   (secondary surfaces)
--rune-border: #1e2235   (hairline dividers)
--iron-border: #2a2d45   (card borders)
--gold:        #c9920a   (primary accent)
--gold-bright: #f0b429   (highlights)
--teal:        #0a8c6e   (new / success)
--fire:        #c94a0a   (error / warning)
--amber:       #f59e0b   (user badge)
--violet:      #a78bfa   (luna / secondary)
--text:        #e8e4d4   (body text)
--muted:       #8a8578   (captions)
--subtle:      #3d3d52   (disabled / dim)
```

Fonts (Google Fonts):
- `Cinzel Decorative` — page title
- `Cinzel` — section headings, labels
- `Source Serif 4` — body text
- `JetBrains Mono` — code, metadata, badges

### HTML structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ᚠ Session Chronicle: {{SESSION_TITLE}} · Fenrir Ledger</title>
  <!-- Google Fonts -->
  <!-- Full CSS copied from wireframes-modals.html + any additions -->
</head>
<body>
<div class="page">

  <nav class="back-nav" aria-label="Return to archive">
    <a href="https://fenrir-ledger.vercel.app/sessions/" class="back-link">← ᛏ Session Archive</a>
  </nav>

  <!-- 1. Session Header -->
  <header class="session-header">
    <span class="header-runes">ᚠ ᛖ ᚾ ᚱ ᛁ ᚱ ᛊ</span>
    <h1 class="session-title">{{SESSION_TITLE}}</h1>
    <p class="session-subtitle">Session Chronicle · Fenrir Ledger</p>
    <div class="session-meta">
      <span>DATE <span class="val">{{DATE}}</span></span>
      <span>ACTS <span class="val">{{TOTAL_ACTS}}</span></span>
      <span>FILES CHANGED <span class="val">{{TOTAL_FILES}}</span></span>
    </div>
  </header>

  <!-- 2. Table of Contents -->
  <nav class="toc">
    <p class="toc-title">Chronicle of Acts</p>
    <ol class="toc-list">
      <!-- One <li> per Act -->
      <li><a href="#act-1"><span class="toc-rune">{{RUNE}}</span> <span class="toc-num">I</span> {{ACT_TITLE}}</a></li>
    </ol>
  </nav>

  <!-- 3. Timeline -->
  <div class="timeline">
    <!-- One .entry per Act -->
    <section class="entry" id="act-{{N}}">
      <div class="entry-rune" title="{{ACT_TITLE}}">{{RUNE}}</div>
      <div class="entry-body">
        <p class="act-label">Act {{ROMAN_N}} · {{CATEGORY}}</p>
        <h2 class="entry-title">{{ACT_TITLE}}</h2>

        <!-- User message -->
        <div class="user-msg">
          <div class="msg-role">
            <span class="role-badge badge-fireman">FiremanDecko</span>
          </div>
          <p class="msg-text">{{USER_MESSAGE}}</p>
        </div>

        <!-- Work summary card -->
        <div class="work-card">
          <div class="work-body">
            <p>{{WORK_SUMMARY}}</p>
          </div>

          <!-- Code snippet (if applicable) -->
          <div class="code-block">
            <pre>{{CODE_SNIPPET}}</pre>
          </div>

          <!-- Bug fix (if applicable) -->
          <div class="bug-box">
            <p class="bug-label">🐺 Bug Fixed</p>
            <p class="bug-text">{{BUG_DESCRIPTION}}</p>
          </div>

          <!-- Files changed -->
          <div class="file-chips">
            <span class="chip chip-new">✦ new/path/to/file.tsx</span>
            <span class="chip chip-mod">◈ modified/file.ts</span>
          </div>
        </div>

      </div>
    </section>
  </div>

  <!-- 4. Section divider between acts -->
  <div class="rune-hr"><span>ᚠ ᛁ ᛊ</span></div>

  <!-- 5. Footer -->
  <footer class="session-footer">
    <p class="footer-cipher">ᚠ ᛖ ᚾ ᚱ ᛁ ᚱ ᛊ</p>
    <p class="footer-text">{{SESSION_TITLE}} · Fenrir Ledger Session Chronicle</p>
    <p class="footer-sub">The wolf remembers everything.</p>
  </footer>

</div>
</body>
</html>
```

### Component rules

- Only include `code-block`, `bug-box`, `.changes` etc. when that Act actually has such content — omit empty sections
- User messages: always `badge-fireman` (FiremanDecko) unless the content clearly comes from a different persona
- File chips:
  - `.chip-new` for newly created files (seen in `⏺ Write(...)`)
  - `.chip-mod` for edited files (seen in `⏺ Edit(...)`)
  - `.chip-mem` for memory/design doc writes
- Roman numerals for act numbers: I II III IV V VI VII VIII IX X
- The `footer-text` and `footer-sub` classes come from wireframes-modals.html — read that file to get their exact CSS
- Always include `.back-nav` CSS and the `<nav class="back-nav">` block at the top of `.page` — it links back to the archive at `https://fenrir-ledger.vercel.app/sessions/`
- Session title should be title-cased and evocative, not mechanical. Example: "Cat's Footfall & The Silent Sync" not "easter-egg-cat-modal-sync-indicator"
- Emoji usage: wolf 🐺, rune ᚠ, chain ⛓, cat 🐾, sound 🔊 — use sparingly and only where thematically appropriate

---

## Step 5 — Update `sessions/index.html`

### If `sessions/index.html` does not exist

Create it now using this template:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ᛟ Session Archive · Fenrir Ledger</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Cinzel:wght@400;600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,600;1,8..60,300;1,8..60,400&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    /* === paste full CSS from wireframes-modals.html here === */

    /* Index-specific additions */
    .index-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
      padding-top: 40px;
    }
    .session-card {
      background: var(--forge);
      border: 1px solid var(--iron-border);
      padding: 20px 22px;
      text-decoration: none;
      display: block;
      transition: border-color 0.2s;
    }
    .session-card:hover { border-color: var(--gold); }
    .card-rune {
      font-size: 28px;
      color: var(--gold);
      opacity: 0.5;
      margin-bottom: 10px;
      display: block;
    }
    .card-title {
      font-family: 'Cinzel', serif;
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--gold-bright);
      margin-bottom: 6px;
      line-height: 1.3;
    }
    .card-meta {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.65rem;
      color: var(--subtle);
      margin-bottom: 10px;
    }
    .card-excerpt {
      font-family: 'Source Serif 4', serif;
      font-size: 0.82rem;
      color: var(--muted);
      font-style: italic;
      line-height: 1.55;
    }
  </style>
</head>
<body>
<div class="page">
  <header class="session-header">
    <span class="header-runes">ᛟ ᚠ ᛖ ᚾ ᚱ ᛁ ᚱ ᛊ</span>
    <h1 class="session-title">Session Archive</h1>
    <p class="session-subtitle">Fenrir Ledger · Chronicle of the Pack</p>
    <div class="session-meta">
      <span>THE WOLF REMEMBERS EVERYTHING</span>
    </div>
  </header>

  <div class="index-grid" id="sessions">
    <!-- session cards injected here by export-wolf skill -->
  </div>

  <footer class="session-footer">
    <p class="footer-cipher">ᚠ ᛖ ᚾ ᚱ ᛁ ᚱ</p>
    <p class="footer-text">Fenrir Ledger Session Archive</p>
  </footer>
</div>
</body>
</html>
```

### Add the new session card

Insert a new `.session-card` `<a>` element inside `<div id="sessions">`, **before any existing entries** (most recent first):

```html
<a class="session-card" href="https://fenrir-ledger.vercel.app/sessions/{{NAME}}.html">
  <span class="card-rune">{{PRIMARY_RUNE}}</span>
  <p class="card-title">{{SESSION_TITLE}}</p>
  <p class="card-meta">{{DATE}} · {{TOTAL_ACTS}} acts · {{TOTAL_FILES}} files</p>
  <p class="card-excerpt">{{ONE_SENTENCE_SUMMARY}}</p>
</a>
```

Where:
- `{{PRIMARY_RUNE}}` — the rune that best represents the whole session
- `{{ONE_SENTENCE_SUMMARY}}` — a single evocative sentence (wolf-voice, present tense) describing what was built

---

## Step 6 — Verify & Report

Confirm these files exist and are non-empty:

| File | Expected |
|------|----------|
| `tmp/{{NAME}}.txt` | Source session export |
| `sessions/{{NAME}}.html` | Styled chronicle |
| `sessions/index.html` | Updated index |

Report:
1. **Chronicle**: `sessions/{{NAME}}.html` — N acts, N files documented
2. **Index**: updated with card linking to new chronicle
3. **View**: open `sessions/{{NAME}}.html` in browser to review

---

## Notes

- Read `sessions/wireframes-modals.html` in full before generating HTML — use its exact CSS, do not rewrite or simplify the styles
- The HTML output should be a **complete document** — not a fragment, not a template. All CSS inline in `<style>`, all content rendered, fully viewable as a static file
- Preserve the wolf's voice throughout: ancient, unhurried, knowing. Captions and labels should feel like rune inscriptions, not UI copy
