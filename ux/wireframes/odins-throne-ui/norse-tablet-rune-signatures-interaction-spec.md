# Interaction Spec — Norse Tablet Rune Signatures & Wikipedia Links
**Issue #1003** | Branch: `ux/issue-1003-norse-tablet-enhance` | Designer: Luna | Date: 2026-03-15

---

## 1 — Wikipedia Links

### Behavior
- Norse terms in `NorseErrorTablet` subheadings are rendered as `<a>` elements.
- Links open Wikipedia in a new tab (`target="_blank" rel="noopener noreferrer"`).
- Styled with `var(--gold)` color and `text-decoration: underline`.
- An external link arrow glyph (↗) is appended via CSS `::after` pseudo-element so it doesn't add to the accessible text.

### Link map

| Term | URL | Location |
|------|-----|----------|
| Yggdrasil | `https://en.wikipedia.org/wiki/Yggdrasil` | `ttl-expired` subheading |
| Bifröst | `https://en.wikipedia.org/wiki/Bifr%C3%B6st` | `node-unreachable` subheading |

### Accessibility
```
aria-label="Yggdrasil on Wikipedia, opens in new tab"
aria-label="Bifröst on Wikipedia, opens in new tab"
```

### Why NOT in NorseTablet inscription
The inscription in `NorseTablet` is the raw agent system prompt text — a dynamic string generated at dispatch time. Auto-linking Norse words in arbitrary text risks:
1. False positives (the word "Loki" in a sentence about something else)
2. Accessibility regressions if link context is ambiguous
3. XSS surface if text isn't already sanitised

Wikipedia links apply only to known static strings in `NorseErrorTablet.tsx` VARIANT_CONTENT.

---

## 2 — Agent Rune Signature Block

### When it renders
The `RuneSignatureBlock` renders at the bottom of the `norse-tablet-body` div in `NorseTablet`, replacing the old single-line seal:
```
{"\u16B1\u16A0\u16C7\u16BE\u16A0\u16B1"} — So it is written, so it shall be done — {"\u16B1\u16A0\u16C7\u16BE\u16A0\u16B1"}
```

### Trigger
Rendered whenever `NorseTablet` renders (i.e., for every `entrypoint-task` log entry). Always visible — no expand/collapse needed, it is part of the static tablet footer.

### agentKey threading

```
LogViewer (has activeJob.agentKey)
  └── renders LogLine (currently no agentKey)
        └── renders NorseTablet (needs agentKey)
```

**Recommended pattern:** Create a `AgentKeyContext` (React.createContext) at the `LogViewer` level. Provide `activeJob?.agentKey`. Consume inside `NorseTablet` via `useContext(AgentKeyContext)`. This avoids prop-drilling through `LogLine` → `NorseTablet`.

Alternatively, since `LogViewer` controls the rendering tree, thread `agentKey` as a prop on `LogLine` if the context approach is deemed overkill. Either is acceptable.

### Fallback
If `agentKey` is `undefined` or not found in `AGENT_RUNE_NAMES`:
- Show `AGENT_RUNE_NAMES["_fallback"]` = `ᚨᛊᚷᚨᚱᛞ` (ASGARD)
- Quote: `"From Asgard this decree is issued — let it be fulfilled"`
- Label: `"The All-Father's Council"`

---

## 3 — Epic Seal: NorseErrorTablet

### Change
The old `net-seal` div:
```tsx
<div className="net-seal" aria-hidden="true">
  ᚠᚢᚦ — So it is written, so shall it remain — ᚦᚢᚠ
</div>
```
Is replaced by a 3-layer `net-seal-epic` structure:

```tsx
<div className="net-seal-epic" aria-hidden="true">
  <div className="net-seal-rune-row">{seal.runes}</div>
  <div className="net-seal-inscription">{seal.inscription}</div>
  <div className="net-seal-sub">{seal.sub}</div>
</div>
```

Where `seal = ERROR_TABLET_SEALS[variant]` from `constants.ts`.

The entire seal div remains `aria-hidden="true"` — it is decorative. The meaningful error content is in `net-heading`, `net-subheading`, and `net-body`.

### Variant content

| Variant | runes | inscription | sub |
|---------|-------|-------------|-----|
| `ttl-expired` | `ᛃᚷᚷᛞᚱᚨᛊᛁᛚ` | "From the roots of Yggdrasil, all things return to silence" | `ᚦ — So it is carved in the world-tree — ᚦ` |
| `node-unreachable` | `ᛒᛁᚠᚱᛟᛊᛏ` | "The bridge between worlds does not always hold — seek another path" | `ᚺ — Heimdall watches, but even gods cannot hold the severed — ᚺ` |

---

## 4 — constants.ts Extension

```typescript
// Add alongside existing AGENT_NAMES, AGENT_TITLES, AGENT_COLORS

export const AGENT_RUNE_NAMES: Record<string, string> = {
  firemandecko: "ᚠᛁᚱᛖᛗᚨᚾᛞᛖᚲᚲᛟ",
  loki:         "ᛚᛟᚲᛁ",
  luna:         "ᛚᚢᚾᚨ",
  freya:        "ᚠᚱᛖᛃᚨ",
  heimdall:     "ᚺᛖᛁᛗᛞᚨᛚᛚ",
  _fallback:    "ᚨᛊᚷᚨᚱᛞ",
};

export const AGENT_RUNE_TITLES: Record<string, string> = {
  firemandecko: "ᛈᚱᛁᚾᚲᛁᛈᚨᛚ ᛖᚾᚷᛁᚾᛖᛖᚱ",
  loki:         "ᛩᚨ ᛏᛖᛊᛏᛖᚱ",
  luna:         "ᚢᛉ ᛞᛖᛊᛁᚷᚾᛖᚱ",
  freya:        "ᛈᚱᛟᛞᚢᚲᛏ ᛟᚹᚾᛖᚱ",
  heimdall:     "ᛊᛖᚲᚢᚱᛁᛏᛃ ᛊᛈᛖᚲᛁᚨᛚᛁᛊᛏ",
};

export const AGENT_QUOTES: Record<string, string> = {
  firemandecko: "Not with words but with fire and iron is the world built — strike true, forge deep, let no flaw survive the flame",
  loki:         "Every truth hides a lie, every build hides a flaw — I am the crack in the armor that saves you before battle",
  luna:         "By moonlight are the hidden paths revealed — that which cannot be seen cannot be walked",
  freya:        "I have walked the nine worlds in sorrow and in glory — I know what is worth building before the first stone is laid",
  heimdall:     "Nothing passes the Bifröst without my knowing — I neither sleep nor blink, and neither shall your secrets slip past me",
  _fallback:    "From Asgard this decree is issued — let it be fulfilled",
};

export const ERROR_TABLET_SEALS: Record<string, { runes: string; inscription: string; sub: string }> = {
  "ttl-expired": {
    runes: "ᛃᚷᚷᛞᚱᚨᛊᛁᛚ",
    inscription: "From the roots of Yggdrasil, all things return to silence",
    sub: "ᚦ — So it is carved in the world-tree — ᚦ",
  },
  "node-unreachable": {
    runes: "ᛒᛁᚠᚱᛟᛊᛏ",
    inscription: "The bridge between worlds does not always hold — seek another path",
    sub: "ᚺ — Heimdall watches, but even gods cannot hold the severed — ᚺ",
  },
};

export const WIKI_LINKS: Record<string, string> = {
  Yggdrasil:  "https://en.wikipedia.org/wiki/Yggdrasil",
  "Bifröst":  "https://en.wikipedia.org/wiki/Bifr%C3%B6st",
  Valhalla:   "https://en.wikipedia.org/wiki/Valhalla",
  "Nine Worlds": "https://en.wikipedia.org/wiki/Norse_cosmology#Nine_worlds",
};
```

---

## 5 — RuneSignatureBlock Component Sketch

```tsx
// Internal component — can live in LogViewer.tsx or be extracted to
// development/odins-throne-ui/src/components/RuneSignatureBlock.tsx

interface RuneSignatureBlockProps {
  agentKey?: string;
}

function RuneSignatureBlock({ agentKey }: RuneSignatureBlockProps) {
  const key = agentKey && AGENT_RUNE_NAMES[agentKey] ? agentKey : "_fallback";
  const name       = AGENT_NAMES[key]       ?? "The All-Father's Council";
  const title      = AGENT_TITLES[key]      ?? "";
  const runeNames  = AGENT_RUNE_NAMES[key]  ?? AGENT_RUNE_NAMES["_fallback"];
  const runeTitles = AGENT_RUNE_TITLES[key] ?? "";
  const quote      = AGENT_QUOTES[key]      ?? AGENT_QUOTES["_fallback"];

  return (
    <div
      className="nt-rune-sig"
      role="complementary"
      aria-label={`${name} rune signature`}
    >
      <div className="nt-rune-sig-agent-runes" aria-hidden="true">{runeNames}</div>
      {runeTitles && (
        <div className="nt-rune-sig-title-runes" aria-hidden="true">{runeTitles}</div>
      )}
      <div className="nt-rune-sig-divider" aria-hidden="true">— ᚠ ᚢ ᚦ —</div>
      <div className="nt-rune-sig-quote">"{quote}"</div>
      <div className="nt-rune-sig-label">{name}{title ? ` · ${title}` : ""}</div>
    </div>
  );
}
```

---

## 6 — CSS Classes Required (new)

FiremanDecko to add these to the existing Norse tablet stylesheet (likely `monitor.css` or inline `<style>` in the component):

```css
/* === NorseErrorTablet epic seal === */
.net-seal-epic { text-align: center; padding: 16px; border: 1px solid var(--border); margin: 12px 0; }
.net-seal-rune-row { font-size: 14px; letter-spacing: 6px; margin-bottom: 8px; color: var(--gold); }
.net-seal-inscription { font-size: 13px; font-weight: 700; font-style: italic; }
.net-seal-sub { font-size: 11px; margin-top: 4px; color: var(--text-muted); }

/* === NorseTablet agent rune signature block === */
.nt-rune-sig { border: 1px solid var(--border); padding: 16px; text-align: center; margin-top: 16px; }
.nt-rune-sig-agent-runes { font-size: 22px; letter-spacing: 6px; margin-bottom: 6px; color: var(--gold); }
.nt-rune-sig-title-runes { font-size: 13px; letter-spacing: 3px; color: var(--text-muted); }
.nt-rune-sig-divider { margin: 10px 0; font-size: 10px; letter-spacing: 4px; color: var(--text-void); }
.nt-rune-sig-quote { font-size: 12px; font-style: italic; max-width: 380px; margin: 0 auto; line-height: 1.6; }
.nt-rune-sig-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 10px; color: var(--text-muted); }

/* Wikipedia links */
.wiki-link { color: var(--gold); text-decoration: underline; }
.wiki-link::after { content: " ↗"; font-size: 0.75em; }

/* Mobile ≤375px */
@media (max-width: 375px) {
  .nt-rune-sig-agent-runes { font-size: 16px; letter-spacing: 3px; }
  .nt-rune-sig-title-runes { font-size: 11px; }
  .nt-rune-sig-quote { max-width: 100%; }
}
```
