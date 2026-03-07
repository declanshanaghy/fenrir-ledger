# Chronicle HTML Skeleton

Generate a complete, self-contained HTML file at `sessions/{{NAME}}.html`.

## CSS Source

Copy CSS variables and font imports **exactly** from `sessions/wireframes-modals.html`.
Read that file first — do not rewrite or simplify its styles.

## HTML Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>{{RUNE}} Session Chronicle: {{SESSION_TITLE}} · Fenrir Ledger</title>
  <!-- Google Fonts: Cinzel Decorative, Cinzel, Source Serif 4, JetBrains Mono -->
  <!-- Full CSS copied from wireframes-modals.html + any additions -->
</head>
<body>
<div class="page">

  <nav class="back-nav" aria-label="Return to archive">
    <a href="/sessions/" class="back-link">&larr; ᛏ Session Archive</a>
  </nav>

  <!-- 1. Session Header -->
  <header class="session-header">
    <span class="header-runes">{{RUNES}}</span>
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
    <div class="toc-title">Chronicle of Acts</div>
    <ul class="toc-list">
      <li><a href="#act-1"><span class="toc-rune">{{RUNE}}</span> <span class="toc-num">I</span> {{ACT_TITLE}}</a></li>
      <!-- One <li> per Act -->
    </ul>
  </nav>

  <!-- 3. Timeline -->
  <div class="timeline">
    <!-- One .entry per Act -->
    <section class="entry" id="act-{{N}}">
      <div class="entry-rune" title="{{ACT_TITLE}}">{{RUNE}}</div>
      <div class="entry-body">
        <p class="act-label">Act {{ROMAN_N}} · {{CATEGORY}}</p>
        <h2 class="entry-title">{{ACT_TITLE}}</h2>

        <div class="user-msg">
          <div class="msg-role">
            <span class="role-badge badge-fireman">Odin</span>
          </div>
          <p class="msg-text">{{USER_MESSAGE}}</p>
        </div>

        <div class="work-card">
          <div class="work-body"><p>{{WORK_SUMMARY}}</p></div>
          <!-- Include only if act has code: -->
          <div class="code-block"><pre>{{CODE_SNIPPET}}</pre></div>
          <!-- Include only if act has bug fix: -->
          <div class="bug-box">
            <p class="bug-label">Bug Fixed</p>
            <p class="bug-text">{{BUG_DESCRIPTION}}</p>
          </div>
          <!-- Always include file chips: -->
          <div class="file-chips">
            <span class="chip chip-new">{{NEW_FILE}}</span>
            <span class="chip chip-mod">{{MOD_FILE}}</span>
          </div>
        </div>
      </div>
    </section>
  </div>

  <!-- 4. Footer -->
  <footer class="session-footer">
    <div class="footer-cipher">{{RUNES}}</div>
    <div class="footer-text">{{SESSION_TITLE}} · Fenrir Ledger Session Chronicle</div>
    <p class="footer-sub">The wolf remembers everything.</p>
  </footer>

</div>
</body>
</html>
```

## Component Rules

- Only include `code-block`, `bug-box`, `.changes` when the Act has such content — omit empty sections
- User messages: `badge-fireman` (Odin) unless content clearly comes from a different persona
- File chips: `.chip-new` for Write, `.chip-mod` for Edit, `.chip-mem` for memory/design docs
- Roman numerals: I II III IV V VI VII VIII IX X
- Back nav always links to `/sessions/`
- Session title: title-cased, evocative, not mechanical
- Code syntax highlighting: `.ca` (add/green), `.cr` (remove/red), `.cc` (comment/subtle)
- Voice: ancient, unhurried, knowing — rune inscriptions, not UI copy
