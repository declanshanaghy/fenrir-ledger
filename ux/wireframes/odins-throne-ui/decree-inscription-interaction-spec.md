# Interaction Spec: All-Father's Decree Norse Inscription
**Issue #1020** · Monitor UI · Luna · 2026-03-16

---

## 1 — Collapse / Expand Flows

### 1a — Outer Decree Toggle (unchanged from current)

```
User clicks .norse-tablet-header
  → setOpen(!open)
  → .norse-tablet.open class toggled
  → .norse-tablet-body-wrap max-height transitions (existing CSS)
  → chevron rotates 90° (existing CSS)
```

**Auto-collapse** (existing, unchanged):
```
autoScroll prop = true
  → setTimeout 3000ms
  → setOpen(false)
  → setHasBeenCollapsed(true)
  → timer cleared on cleanup
```

### 1b — Sub-inscription Section Toggle (unchanged from current)

```
User clicks .decree-section-header
  → setOpen(!open) on that section's local state
  → .decree-section.open class toggled
  → .decree-section-body rendered/hidden
  → chevron rotates 90°
```

**Default states** set once on mount via `defaultOpen` prop — no re-evaluation.

---

## 2 — Wikipedia Link Behaviour

All links produced by `DecreeSectionBody` and the royal seal:

- `target="_blank"` — opens Wikipedia in a new tab
- `rel="noopener noreferrer"` — security: no referrer, no opener access
- `title="Wikipedia: {term}"` — tooltip on hover
- Visual: gold color (`var(--gold)`), underline
- No JS involved — pure `<a>` tags

**Matching algorithm** (applied inside `DecreeSectionBody`):

1. Iterate `Object.entries(WIKI_LINKS)` — each `[term, url]`
2. Split the text segment on `new RegExp(\`(\\b\${escapeRegex(term)}\\b)\`, 'g')`
3. Replace matched segments with `<a href={url} target="_blank" rel="noopener noreferrer" title={\`Wikipedia: \${term}\`}>{term}</a>`
4. Apply all WIKI_LINKS entries sequentially (not nested — process one at a time to avoid double-wrapping)

---

## 3 — Inline Formatting Algorithm

`DecreeSectionBody` renders a React element tree from the raw body string. Steps:

1. **Split into lines** via `\n`
2. **Classify each line:**
   - Code block line: starts with `cd `, `git `, `gh `, `bash `, `npm `, `node `, `  ` (2+ spaces indent), or `\`\`\``-fenced — render as `<code class="decree-body-block">`
   - Heading line: starts with `## ` or `**` — render as `<strong>`
   - List item: starts with `- ` or `* ` — render as `<li>` inside `<ul>`
   - Normal line: render as `<p>` with inline formatting applied
3. **Inline pass** on normal lines: apply backtick → `<code class="decree-body-code">`, then apply WIKI_LINKS replacements (Section 2 above)
4. Group consecutive list items into a single `<ul>`
5. Group consecutive code block lines into a single `<code class="decree-body-block">`

**Do NOT use `dangerouslySetInnerHTML`** — build React element array.

---

## 4 — Agent Key Resolution

```
agentMatch = /^You are (\w+)/m.exec(text)
agentName  = agentMatch?.[1] ?? "Agent"          // e.g. "firemandecko"
agentKey   = agentName.toLowerCase()             // normalize

agentRunes = AGENT_RUNE_NAMES[agentKey] ?? AGENT_RUNE_NAMES._fallback
firstRune  = agentRunes[0] ?? "ᛟ"               // first Unicode code point

agentColor = AGENT_COLORS[agentKey] ?? "#888"
agentTitle = AGENT_TITLES[agentKey] ?? "Agent"
```

The `firstRune` is extracted as a Unicode code point (not a char index), because
Elder Futhark runes are in the Supplementary Multilingual Plane (U+16A0–U+16FF).
Use `[...agentRunes][0]` (spread to code points) rather than `agentRunes[0]` (byte index).

---

## 5 — Keyboard Accessibility

| Element | Key | Action |
|---------|-----|--------|
| `.norse-tablet-header` | Enter / Space | Toggle outer decree open/closed |
| `.decree-section-header` | Enter / Space | Toggle that section open/closed |
| `.decree-section-header` | Tab | Move to next interactive element |
| Wikipedia links | Enter | Follow link (native browser) |

Implementation: wrap clickable headers in `<button>` elements or add `role="button"` + `tabIndex={0}` + `onKeyDown` handler.

Current implementation uses `onClick` on divs — FiremanDecko should audit whether `<button>` refactor is in scope for this issue or filed separately.

---

## 6 — Animation / Transition

No new animations introduced. Existing transitions apply:

- `.norse-tablet-body-wrap`: max-height CSS transition on expand/collapse (existing)
- `.decree-section-body`: existing fade-in / fade-out behaviour
- `.ep-group-chevron`: existing `transform: rotate(90deg)` transition

Seal medallion: no animation. Static presentational element.

`prefers-reduced-motion`: existing media query in `index.css` should already disable transitions. Verify it covers `.norse-tablet-body-wrap` and `.decree-section-body`.

---

## 7 — Edge Cases

| Scenario | Handling |
|----------|----------|
| Unknown agent key | Falls back to `AGENT_RUNE_NAMES._fallback` ("ᚨᛊᚷᚨᚱᛞ"), `AGENT_COLORS` default (#888), title "Agent" |
| Empty prompt text | `parseDecreeSections` returns single `[{ glyph: "ᛟ", title: "The Decree", body: text, defaultOpen: true }]` — seal still renders |
| Prompt with no `## Issue details` section | No "Wound in Yggdrasil" section rendered; other sections render as usual |
| WIKI_LINKS term appears in code block | Do NOT linkify inside `<code>` blocks — apply WIKI_LINKS only to prose lines |
| Very long section body | Bottom fade-out mask (existing `::after` on `.decree-section-body`) handles visual overflow |
| `agentRunes` string is empty or undefined | `firstRune` defaults to `"ᛟ"` |

---

## 8 — Open Questions for FiremanDecko

1. **`<button>` vs `onClick div`**: Should this issue include a keyboard-accessible refactor of the section headers, or file a separate a11y ticket?
2. **`dangerouslySetInnerHTML` policy**: Confirm with Heimdall that prompt text source (K8s dispatch job) is fully trusted before using any HTML injection path.
3. **`nt-rune-sig` removal**: Confirm whether `.nt-rune-sig*` classes are used anywhere outside `NorseTablet` before deleting from `index.css`.
4. **Section count per template**: The current `SECTION_MAP` in `parseDecreeSections` covers 14 patterns. Do Luna/Freya templates have different sections? If so, should we add template-specific section maps keyed by `agentKey`?
