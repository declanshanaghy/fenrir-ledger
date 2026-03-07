# Index Creation Template

Only needed if `sessions/index.html` does not exist. Read `sessions/wireframes-modals.html`
for the full CSS token set — copy it into the style block below.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ᛟ The Dev Blog · Fenrir Ledger</title>
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
    .card-rune { font-size: 28px; color: var(--gold); opacity: 0.5; margin-bottom: 10px; display: block; }
    .card-title { font-family: 'Cinzel', serif; font-size: 0.95rem; font-weight: 700; color: var(--gold-bright); margin-bottom: 6px; line-height: 1.3; }
    .card-meta { font-family: 'JetBrains Mono', monospace; font-size: 0.65rem; color: var(--subtle); margin-bottom: 10px; }
    .card-excerpt { font-family: 'Source Serif 4', serif; font-size: 0.82rem; color: var(--muted); font-style: italic; line-height: 1.55; }
  </style>
</head>
<body>
<div class="page">
  <header class="session-header">
    <span class="header-runes">ᛟ ᚠ ᛖ ᚾ ᚱ ᛁ ᚱ ᛊ</span>
    <h1 class="session-title">Session Archive</h1>
    <p class="session-subtitle">Fenrir Ledger · Chronicle of the Pack</p>
    <div class="session-meta"><span>THE WOLF REMEMBERS EVERYTHING</span></div>
  </header>

  <div class="index-grid" id="sessions">
    <!-- session cards injected here, newest first -->
  </div>

  <footer class="session-footer">
    <p class="footer-cipher">ᚠ ᛖ ᚾ ᚱ ᛁ ᚱ</p>
    <p class="footer-text">Fenrir Ledger Session Archive</p>
  </footer>
</div>
</body>
</html>
```

## Adding a Session Card

Insert before existing entries inside `<div id="sessions">` (most recent first):

```html
<a class="session-card" href="/sessions/{{NAME}}.html">
  <span class="card-rune">{{PRIMARY_RUNE}}</span>
  <p class="card-title">{{SESSION_TITLE}}</p>
  <p class="card-meta">{{DATE}} &middot; {{TOTAL_ACTS}} acts &middot; {{TOTAL_FILES}} files</p>
  <p class="card-excerpt">{{ONE_SENTENCE_SUMMARY}}</p>
</a>
```
